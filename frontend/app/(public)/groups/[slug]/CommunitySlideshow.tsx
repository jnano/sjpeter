"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Props {
  photos: string[];
  alt: string;
  /** 자동 전환 간격 (ms). 기본 5000 */
  intervalMs?: number;
  /** 전환 지속 (ms). 기본 700 */
  durationMs?: number;
}

export default function CommunitySlideshow({ photos, alt, intervalMs = 5000, durationMs = 700 }: Props) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (photos.length < 2 || paused) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % photos.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [photos.length, intervalMs, paused]);

  if (photos.length === 0) return null;

  return (
    <div
      className="relative w-full aspect-[16/9] rounded-xl overflow-hidden border border-[var(--color-border)] bg-gray-100"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {photos.map((url, i) => (
        <Image
          key={i}
          src={url.startsWith("http") ? url : `${API}${url}`}
          alt={`${alt} ${i + 1}`}
          fill
          className="object-cover transition-opacity"
          style={{
            opacity: i === index ? 1 : 0,
            transitionDuration: `${durationMs}ms`,
            zIndex: i === index ? 1 : 0,
          }}
          sizes="(max-width: 768px) 100vw, 720px"
          priority={i === 0}
        />
      ))}

      {photos.length > 1 && (
        <>
          {/* 이전/다음 버튼 */}
          <button
            type="button"
            onClick={() => setIndex((i) => (i - 1 + photos.length) % photos.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white text-sm flex items-center justify-center backdrop-blur-sm transition"
            aria-label="이전 사진"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setIndex((i) => (i + 1) % photos.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white text-sm flex items-center justify-center backdrop-blur-sm transition"
            aria-label="다음 사진"
          >
            ›
          </button>

          {/* 인디케이터 점 */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex gap-1.5">
            {photos.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "bg-white w-6" : "bg-white/50 w-1.5"
                }`}
                aria-label={`사진 ${i + 1}로 이동`}
              />
            ))}
          </div>

          {/* 카운터 (우상단) */}
          <div className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-full bg-black/40 text-white text-[10px] backdrop-blur-sm">
            {index + 1} / {photos.length}
          </div>
        </>
      )}
    </div>
  );
}
