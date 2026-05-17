"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DataEvent, useInvalidationListener } from "@/components/dataEvents";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Meditation {
  title: string;
  scripture: string | null;
  body: string;
  author: string | null;
}

// 슬라이드는 텍스트 흐름이라 ReactMarkdown 풀 렌더링 대신
// 흔히 쓰이는 마크다운 문법만 제거 — admin 이 ### 헤더·**굵게** 등을 써도
// 슬라이드에서는 평문으로만 보이도록.
function stripMarkdown(md: string): string {
  if (!md) return "";
  return md
    .replace(/^#{1,6}\s+/gm, "")               // # ## ### 헤더
    .replace(/^>\s?/gm, "")                    // > blockquote
    .replace(/^[-*+]\s+/gm, "")                // - * + 불릿 리스트
    .replace(/^\d+\.\s+/gm, "")                // 1. 번호 리스트
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")  // ![alt](url) — 이미지: alt만
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")   // [text](url) — 링크: text만
    .replace(/\*\*([^*]+)\*\*/g, "$1")         // **굵게**
    .replace(/__([^_]+)__/g, "$1")             // __굵게__
    .replace(/\*([^*\n]+)\*/g, "$1")           // *기울임*
    .replace(/(?<![A-Za-z0-9_])_([^_\n]+)_(?![A-Za-z0-9_])/g, "$1") // _기울임_
    .replace(/~~([^~]+)~~/g, "$1")             // ~~취소선~~
    .replace(/`([^`]+)`/g, "$1");              // `코드`
}

export default function MeditationCredits() {
  const [meditation, setMeditation] = useState<Meditation | null>(null);
  const [paused, setPaused] = useState(false);

  const reload = useCallback(() => {
    fetch(`${API}/api/content/meditations/current`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setMeditation)
      .catch(() => setMeditation(null));
  }, []);

  useEffect(() => { reload(); }, [reload]);
  useInvalidationListener(DataEvent.MEDITATION_CURRENT, reload);

  // 한 사이클 50초 고정
  const duration = 50;

  return (
    <Link
      href="/meditation"
      className="relative block overflow-hidden hover:opacity-90 transition-opacity duration-200 group w-full h-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-label="묵상 글 보기"
    >
      {/* 라벨 — 좌상단 미세 padding */}
      <div className="absolute top-0.5 left-1 z-10 flex items-center gap-1.5">
        <span className="text-[var(--color-accent)] text-base leading-none">✝</span>
        <span className="text-[11px] font-medium text-[var(--color-text-muted)] tracking-wide">
          묵상 글
        </span>
      </div>

      {/* 흐르는 본문 영역 — 외곽 height 유지(min-h-[88px]).
          위/아래 fade gradient·라벨 padding 을 줄여 본문 visible 영역을 그만큼 확장. */}
      <div className="relative h-full min-h-[88px] overflow-hidden">
        <div
          className="absolute inset-x-3 text-center"
          style={{
            animation: `credits-scroll ${duration}s linear infinite`,
            animationPlayState: paused ? "paused" : "running",
            top: 0,
          }}
        >
          {meditation ? (
            <>
              {meditation.scripture && (
                <p className="text-[10px] text-[var(--color-accent)] uppercase tracking-widest mb-1">
                  {meditation.scripture}
                </p>
              )}
              <p className="font-serif font-bold text-[12.5px] text-[var(--color-primary)] mb-2 leading-snug">
                {meditation.title}
              </p>
              <p className="text-[12px] text-[var(--color-text)] leading-relaxed font-serif italic whitespace-pre-line">
                {stripMarkdown(meditation.body)}
              </p>
              {meditation.author && (
                <p className="text-[10.5px] text-[var(--color-text-muted)] mt-2">
                  — {meditation.author}
                </p>
              )}
            </>
          ) : (
            <p className="text-[12px] text-[var(--color-text-muted)] italic mt-6">
              묵상 글이 곧 올라올 예정입니다.
            </p>
          )}
        </div>
      </div>

      {/* 페이드 그라디언트 — 위/아래 가장자리, 최소화 */}
      <div className="absolute inset-x-0 top-0 h-3 bg-gradient-to-b from-white via-white/85 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-2 bg-gradient-to-t from-white via-white/85 to-transparent pointer-events-none" />
    </Link>
  );
}
