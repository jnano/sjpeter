"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Meditation {
  title: string;
  scripture: string | null;
  body: string;
  author: string | null;
}

export default function MeditationCredits() {
  const [meditation, setMeditation] = useState<Meditation | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/content/meditations/current`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setMeditation)
      .catch(() => setMeditation(null));
  }, []);

  // 텍스트 길이에 비례한 흐름 속도 (긴 글일수록 느리게)
  const bodyLen = (meditation?.body ?? "").length;
  const duration = Math.max(28, Math.min(80, bodyLen * 0.18));

  return (
    <Link
      href="/meditation"
      className="relative block overflow-hidden border border-[var(--color-border)] rounded-xl bg-white hover:border-[var(--color-primary)] hover:shadow-sm transition-all duration-200 group"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-label="묵상 글 보기"
    >
      {/* 라벨 */}
      <div className="absolute top-2 left-3 z-10 flex items-center gap-1.5">
        <span className="text-[var(--color-accent)] text-base leading-none">✝</span>
        <span className="text-[11px] font-medium text-[var(--color-text-muted)] tracking-wide">
          묵상 글
        </span>
      </div>

      {/* 흐르는 본문 영역 (다른 카드와 동일한 높이) */}
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
                {meditation.body}
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

      {/* 페이드 그라디언트 (위/아래 가장자리) */}
      <div className="absolute inset-x-0 top-0 h-7 bg-gradient-to-b from-white via-white/85 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-white via-white/85 to-transparent pointer-events-none" />
    </Link>
  );
}
