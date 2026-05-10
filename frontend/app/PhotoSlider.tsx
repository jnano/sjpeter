"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface SlidePost {
  id: number;
  title: string;
  thumbnail_url: string | null;
  source: "events" | "liturgy";
}

interface RawPost {
  id: number;
  title: string;
  thumbnail_url: string | null;
}

interface PostList {
  posts: RawPost[];
}

const ROTATE_MS = 5000;

async function fetchSlides(): Promise<SlidePost[]> {
  try {
    const [eventsRes, liturgyRes] = await Promise.all([
      fetch(`${API}/api/boards/photo/posts?page=1`).then((r) => (r.ok ? r.json() : { posts: [] } as PostList)),
      fetch(`${API}/api/boards/liturgy/posts?page=1`).then((r) => (r.ok ? r.json() : { posts: [] } as PostList)),
    ]);
    const events: SlidePost[] = (eventsRes.posts || [])
      .filter((p: RawPost) => p.thumbnail_url)
      .slice(0, 6)
      .map((p: RawPost) => ({ id: p.id, title: p.title, thumbnail_url: p.thumbnail_url, source: "events" as const }));
    const liturgy: SlidePost[] = (liturgyRes.posts || [])
      .filter((p: RawPost) => p.thumbnail_url)
      .slice(0, 6)
      .map((p: RawPost) => ({ id: p.id, title: p.title, thumbnail_url: p.thumbnail_url, source: "liturgy" as const }));
    // 행사·전례 인터리빙
    const merged: SlidePost[] = [];
    const max = Math.max(events.length, liturgy.length);
    for (let i = 0; i < max; i++) {
      if (events[i]) merged.push(events[i]);
      if (liturgy[i]) merged.push(liturgy[i]);
    }
    return merged.slice(0, 10);
  } catch {
    return [];
  }
}

export default function PhotoSlider() {
  const [slides, setSlides] = useState<SlidePost[]>([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    fetchSlides().then(setSlides);
  }, []);

  useEffect(() => {
    if (slides.length <= 1 || paused) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [slides.length, paused]);

  if (slides.length === 0) {
    return null;
  }

  const current = slides[index];
  const href =
    current.source === "events"
      ? `/gallery/events/${current.id}`
      : `/gallery/liturgy`;

  return (
    <div
      className="relative bg-white border border-[var(--color-border)] rounded-xl overflow-hidden group"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* 이미지 */}
      <Link href={href} className="block relative w-full aspect-[16/7] sm:aspect-[16/6]">
        {slides.map((s, i) => (
          <Image
            key={s.id}
            src={`${API}${s.thumbnail_url}`}
            alt={s.title}
            fill
            className={`object-cover transition-opacity duration-700 ${i === index ? "opacity-100" : "opacity-0"}`}
            sizes="(max-width: 1024px) 100vw, 1024px"
            priority={i === 0}
          />
        ))}
        {/* 캡션 그라디언트 */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent p-4 sm:p-5">
          <p className="text-[10.3px] uppercase tracking-widest text-white/70 mb-1">
            {current.source === "events" ? "행사 사진" : "전례 사진"}
          </p>
          <p className="text-white font-serif font-bold text-base sm:text-lg leading-tight line-clamp-1">
            {current.title}
          </p>
        </div>
      </Link>

      {/* 좌/우 화살표 */}
      {slides.length > 1 && (
        <>
          <button
            onClick={() => setIndex((i) => (i - 1 + slides.length) % slides.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 hover:bg-white text-[var(--color-primary)] flex items-center justify-center text-base shadow opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="이전"
          >
            ‹
          </button>
          <button
            onClick={() => setIndex((i) => (i + 1) % slides.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 hover:bg-white text-[var(--color-primary)] flex items-center justify-center text-base shadow opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="다음"
          >
            ›
          </button>
        </>
      )}

      {/* 인디케이터 */}
      {slides.length > 1 && (
        <div className="absolute bottom-2 right-3 flex items-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`rounded-full transition-all ${
                i === index ? "w-4 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/50 hover:bg-white/80"
              }`}
              aria-label={`${i + 1}번째 사진`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
