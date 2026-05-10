"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Banner {
  id: number;
  file_url: string;
  original_name: string;
}

const ROTATE_MS = 6000;
const FADE_MS = 1200;

const FALLBACK = { id: -1, file_url: "/yakhoun.jpg", original_name: "fallback", isFallback: true };

interface Props {
  parishName: string;
}

export default function HomeHero({ parishName }: Props) {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/api/home-banners/`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: Banner[]) => {
        if (!cancelled && list.length > 0) setBanners(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const slides = useMemo(() => {
    if (banners.length === 0) return [FALLBACK];
    return banners.map((b) => ({ ...b, isFallback: false }));
  }, [banners]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [slides.length]);

  return (
    <div className="relative w-full aspect-[4/3] md:aspect-auto md:min-h-[260px] rounded-xl overflow-hidden border border-[var(--color-border)] group">
      {slides.map((s, i) => {
        const src = s.isFallback ? s.file_url : `${API}${s.file_url}`;
        return (
          <Image
            key={s.id}
            src={src}
            alt={parishName}
            fill
            priority={i === 0}
            className="object-cover transition-opacity ease-in-out group-hover:scale-105 transition-transform duration-700"
            sizes="(max-width: 768px) 100vw, 33vw"
            style={{
              opacity: i === index ? 1 : 0,
              transitionProperty: "opacity, transform",
              transitionDuration: `${FADE_MS}ms, 700ms`,
            }}
          />
        );
      })}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent p-3.5 z-10">
        <p className="text-white font-serif font-bold text-sm leading-tight tracking-tight">
          {parishName}
        </p>
        <p className="text-white/80 text-[10.3px] mt-0.5 tracking-wider">
          ST. PETER&apos;S CATHEDRAL · SEJONG
        </p>
      </div>
    </div>
  );
}
