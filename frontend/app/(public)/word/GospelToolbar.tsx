"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  /** 읽어줄 본문 (TTS) + 공유·복사용 텍스트 */
  text: string;
  /** 출처 (공유 시 함께 전송, 저장 키 일부) */
  reference: string | null;
  /** 저장 키 — 'YYYY-MM-DD' (날짜별 북마크) */
  dateIso: string;
}

const STORAGE_KEY = "gospel-bookmarks"; // ["YYYY-MM-DD", ...]

/**
 * 시안 .tool-bar 재현 — "들으며 묵상하기" 오디오 + 저장/인쇄/공유 우측 액션.
 *
 * 오디오: 외부 음원이 없어 브라우저 Web Speech API(speechSynthesis) 사용.
 *   - 한국어 음성이 OS에 설치되어 있어야 작동. 없으면 버튼 자체를 숨김(가짜 UI 회피).
 *   - 재생 중에는 일시정지 아이콘으로 토글.
 *   - 진행률 트랙은 utterance event 가 정밀하지 않아 글자 기반 추정으로 채움.
 */
export default function GospelToolbar({ text, reference, dateIso }: Props) {
  const [supported, setSupported] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [saved, setSaved] = useState(false);
  const [msg, setMsg] = useState("");
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);
  const startedAt = useRef<number>(0);
  const totalMs = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // TTS 한국어 음성 지원 확인 (mount 후)
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const check = () => {
      const voices = window.speechSynthesis.getVoices();
      setSupported(voices.some((v) => v.lang.startsWith("ko")));
    };
    check();
    window.speechSynthesis.onvoiceschanged = check;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // 저장 상태 동기화
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr: string[] = raw ? JSON.parse(raw) : [];
      setSaved(arr.includes(dateIso));
    } catch {/* ignore */}
  }, [dateIso]);

  function play() {
    if (!supported || !text) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ko-KR";
    u.rate = 0.95;
    u.onend = () => {
      setPlaying(false);
      setProgress(1);
      if (timerRef.current) clearInterval(timerRef.current);
    };
    utterRef.current = u;
    // 매우 거친 추정: 한글 1자 ≈ 90ms (0.95x)
    totalMs.current = Math.max(3000, text.length * 90);
    startedAt.current = Date.now();
    setProgress(0);
    setPlaying(true);
    window.speechSynthesis.speak(u);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAt.current;
      setProgress(Math.min(0.98, elapsed / totalMs.current));
    }, 200);
  }

  function stop() {
    window.speechSynthesis.cancel();
    setPlaying(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function toggleSave() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr: string[] = raw ? JSON.parse(raw) : [];
      const idx = arr.indexOf(dateIso);
      if (idx >= 0) {
        arr.splice(idx, 1);
        setSaved(false);
        setMsg("저장 해제");
      } else {
        arr.unshift(dateIso);
        setSaved(true);
        setMsg("이 날의 말씀을 저장했습니다");
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr.slice(0, 100)));
      setTimeout(() => setMsg(""), 2000);
    } catch {/* ignore */}
  }

  async function share() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const shareText = `[오늘의 복음 · ${reference ?? ""}]\n\n${text.slice(0, 200)}…\n\n${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "오늘의 복음", text: shareText, url });
      } else {
        await navigator.clipboard.writeText(shareText);
        setMsg("링크가 복사되었습니다");
        setTimeout(() => setMsg(""), 2000);
      }
    } catch {/* 사용자 취소 무시 */}
  }

  function printPage() {
    window.print();
  }

  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  return (
    <div className="mt-5 p-4 sm:p-5 bg-white border border-[var(--color-border)] rounded-2xl flex items-center justify-between gap-4 flex-wrap relative">
      {/* 오디오 버튼 (TTS 지원 시만) */}
      {supported ? (
        <button
          type="button"
          onClick={playing ? stop : play}
          className="inline-flex items-center gap-2.5 px-4 py-2.5 bg-[var(--color-text)] text-white rounded-full text-[13px] font-semibold hover:opacity-90"
        >
          {playing ? (
            <svg width="13" height="13" viewBox="0 0 14 14" fill="currentColor"><rect x="3" y="3" width="3" height="8"/><rect x="8" y="3" width="3" height="8"/></svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 14 14" fill="currentColor"><polygon points="4 3 11 7 4 11"/></svg>
          )}
          {playing ? "일시정지" : "들으며 묵상하기"}
        </button>
      ) : (
        <div className="text-xs text-[var(--color-text-muted)]">
          음성 재생은 한국어 TTS가 설치된 환경에서 작동합니다.
        </div>
      )}

      {/* 진행 트랙 */}
      {supported && (
        <div className="flex-1 min-w-[140px] flex items-center gap-3">
          <span className="text-[11px] tabular-nums text-[var(--color-text-muted)]">
            {fmt(progress * totalMs.current)}
          </span>
          <div className="flex-1 h-1 bg-[var(--color-border)] rounded-full relative overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full bg-[var(--color-primary)] rounded-full transition-[width]"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <span className="text-[11px] tabular-nums text-[var(--color-text-muted)]">
            {fmt(totalMs.current)}
          </span>
        </div>
      )}

      {/* 우측 액션 (저장/인쇄/공유) */}
      <div className="flex gap-1">
        <button
          type="button"
          onClick={toggleSave}
          aria-label={saved ? "저장 해제" : "저장"}
          title={saved ? "저장 해제" : "저장"}
          className={`w-9 h-9 rounded-full border flex items-center justify-center transition-colors ${
            saved
              ? "bg-[var(--color-primary)] border-[var(--color-primary)] text-white"
              : "bg-white border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          }`}
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6">
            <path d="M3.5 2h7v10l-3.5-2.5L3.5 12z" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          onClick={printPage}
          aria-label="인쇄"
          title="인쇄"
          className="w-9 h-9 rounded-full border border-[var(--color-border)] bg-white text-[var(--color-text-muted)] hover:text-[var(--color-text)] flex items-center justify-center"
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
            <rect x="4" y="2" width="6" height="3" />
            <rect x="2" y="5" width="10" height="6" />
            <rect x="4" y="8" width="6" height="3" />
          </svg>
        </button>
        <button
          type="button"
          onClick={share}
          aria-label="공유"
          title="공유"
          className="w-9 h-9 rounded-full border border-[var(--color-border)] bg-white text-[var(--color-text-muted)] hover:text-[var(--color-text)] flex items-center justify-center"
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="3.5" cy="7" r="1.5" />
            <circle cx="10.5" cy="3.5" r="1.5" />
            <circle cx="10.5" cy="10.5" r="1.5" />
            <line x1="4.8" y1="6.3" x2="9.2" y2="4.2" />
            <line x1="4.8" y1="7.7" x2="9.2" y2="9.8" />
          </svg>
        </button>
      </div>

      {msg && (
        <span className="absolute -top-7 right-2 text-[11px] bg-[var(--color-text)] text-white px-2 py-1 rounded shadow">
          {msg}
        </span>
      )}
    </div>
  );
}
