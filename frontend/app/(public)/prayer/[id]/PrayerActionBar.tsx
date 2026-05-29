"use client";

import { useEffect, useState } from "react";

const SAVE_KEY = "prayer-saved";
const SCALE_KEY = "prayer-fontscale";
const SCALES = [0.9, 1, 1.15, 1.3];

/**
 * 기도문 상세 액션바 (시안 prayer-detail.html .action-bar).
 * 저장(localStorage)·글자 크기(가/가, --reading-scale)·음성 듣기(SpeechSynthesis)·인쇄·공유.
 */
export default function PrayerActionBar({ prayerId, title, bodyText }: { prayerId: number; title: string; bodyText: string }) {
  const [saved, setSaved] = useState(false);
  const [scaleIdx, setScaleIdx] = useState(1);
  const [speaking, setSpeaking] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    try {
      const arr = JSON.parse(localStorage.getItem(SAVE_KEY) || "[]") as number[];
      setSaved(arr.includes(prayerId));
      const s = Number(localStorage.getItem(SCALE_KEY));
      if (Number.isFinite(s) && SCALES.includes(s)) {
        setScaleIdx(SCALES.indexOf(s));
        document.documentElement.style.setProperty("--reading-scale", String(s));
      }
    } catch { /* 무시 */ }
    return () => { if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel(); };
  }, [prayerId]);

  function showToast(m: string) { setToast(m); window.setTimeout(() => setToast(""), 1800); }

  function toggleSave() {
    try {
      const arr = JSON.parse(localStorage.getItem(SAVE_KEY) || "[]") as number[];
      const next = arr.includes(prayerId) ? arr.filter((x) => x !== prayerId) : [...arr, prayerId];
      localStorage.setItem(SAVE_KEY, JSON.stringify(next));
      const now = next.includes(prayerId);
      setSaved(now);
      showToast(now ? "보관함에 저장했어요" : "저장을 해제했어요");
    } catch { /* 무시 */ }
  }

  function setScale(i: number) {
    const idx = Math.max(0, Math.min(SCALES.length - 1, i));
    setScaleIdx(idx);
    const v = SCALES[idx];
    document.documentElement.style.setProperty("--reading-scale", String(v));
    try { localStorage.setItem(SCALE_KEY, String(v)); } catch { /* 무시 */ }
  }

  function toggleSpeak() {
    if (typeof window === "undefined" || !window.speechSynthesis) { showToast("음성 재생을 지원하지 않는 브라우저예요"); return; }
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const u = new SpeechSynthesisUtterance(`${title}. ${bodyText}`);
    u.lang = "ko-KR"; u.rate = 0.92;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  }

  async function share() {
    const url = window.location.href;
    if (navigator.share) { try { await navigator.share({ title, url }); } catch { /* 취소 */ } }
    else { try { await navigator.clipboard.writeText(url); showToast("링크를 복사했어요"); } catch { showToast("복사 실패"); } }
  }

  return (
    <div className="pr-actbar">
      <button type="button" className={`heart ${saved ? "on" : ""}`} aria-pressed={saved} onClick={toggleSave}>
        <svg viewBox="0 0 14 14" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6"><path d="M3.5 2h7v10l-3.5-2.5L3.5 12z" strokeLinejoin="round" /></svg>
        저장
      </button>
      <div className="pr-fontsize" role="group" aria-label="글자 크기">
        <button type="button" aria-label="작게" onClick={() => setScale(scaleIdx - 1)}><span className="s">가</span></button>
        <span className="sep" />
        <button type="button" aria-label="크게" onClick={() => setScale(scaleIdx + 1)}><span className="l">가</span></button>
      </div>
      <button type="button" className={`icon-only ${speaking ? "heart on" : ""}`} aria-label="음성으로 듣기" aria-pressed={speaking} onClick={toggleSpeak}>
        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 5h2l3-2v8L5 9H3z" strokeLinejoin="round" /><path d="M10 4.5a3 3 0 0 1 0 5" strokeLinecap="round" /></svg>
      </button>
      <button type="button" className="icon-only" aria-label="인쇄" onClick={() => window.print()}>
        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="4" y="2" width="6" height="3" /><rect x="2" y="5" width="10" height="6" /><rect x="4" y="8" width="6" height="3" /></svg>
      </button>
      <button type="button" className="icon-only" aria-label="공유" onClick={share}>
        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="3.5" cy="7" r="1.5" /><circle cx="10.5" cy="3.5" r="1.5" /><circle cx="10.5" cy="10.5" r="1.5" /><line x1="4.8" y1="6.3" x2="9.2" y2="4.2" /><line x1="4.8" y1="7.7" x2="9.2" y2="9.8" /></svg>
      </button>
      {toast && <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[60] bg-[var(--ink)] text-white text-sm px-4 py-2 rounded-full shadow-lg pointer-events-none">{toast}</div>}
    </div>
  );
}
