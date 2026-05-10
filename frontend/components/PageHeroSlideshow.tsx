"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const API = process.env.NEXT_PUBLIC_API_URL;

export type TransitionMode = "fade" | "slide" | "none";

export interface PagePhoto {
  id: number;
  page_slug: string;
  file_url: string;
  alt: string | null;
  sort_order: number;
}

export interface PagePhotoSettings {
  page_slug: string;
  transition_mode: TransitionMode;
  interval_seconds: number;
}

interface Props {
  slug: string;
  fallbackSrc?: string;
  fallbackAlt?: string;
  className?: string;
  imgClassName?: string;
  imgStyle?: React.CSSProperties;
  sizes?: string;
  priority?: boolean;
}

/**
 * 페이지(슬러그)별 히어로 영역 슬라이드쇼.
 * 사진이 0장이면 fallback, 1장이면 정적 이미지, 2장 이상이면 자동 전환.
 */
export default function PageHeroSlideshow({
  slug,
  fallbackSrc,
  fallbackAlt,
  className,
  imgClassName,
  imgStyle,
  sizes,
  priority,
}: Props) {
  const [photos, setPhotos] = useState<PagePhoto[]>([]);
  const [settings, setSettings] = useState<PagePhotoSettings>({
    page_slug: slug,
    transition_mode: "fade",
    interval_seconds: 5,
  });
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/api/page-photos/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setPhotos(data.photos ?? []);
        setSettings(data.settings ?? settings);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (photos.length < 2 || settings.transition_mode === "none") return;
    const ms = Math.max(1, settings.interval_seconds) * 1000;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % photos.length);
    }, ms);
    return () => clearInterval(id);
  }, [photos.length, settings.transition_mode, settings.interval_seconds]);

  // 사진 0장: fallback
  if (loaded && photos.length === 0) {
    if (!fallbackSrc) return null;
    return (
      <div className={className}>
        <Image
          src={fallbackSrc}
          alt={fallbackAlt ?? "사진"}
          fill
          className={imgClassName ?? "object-cover"}
          style={imgStyle}
          sizes={sizes}
          priority={priority}
        />
      </div>
    );
  }

  // 1장이거나 transition=none: 정적
  if (photos.length === 1 || settings.transition_mode === "none") {
    const p = photos[0];
    if (!p) return <div className={className} />;
    return (
      <div className={className}>
        <Image
          src={`${API}${p.file_url}`}
          alt={p.alt ?? fallbackAlt ?? "사진"}
          fill
          className={imgClassName ?? "object-cover"}
          style={imgStyle}
          sizes={sizes}
          priority={priority}
        />
      </div>
    );
  }

  // 2장 이상: fade or slide
  if (settings.transition_mode === "slide") {
    return (
      <div className={`${className ?? ""} relative overflow-hidden`}>
        <div
          className="flex h-full transition-transform duration-700 ease-in-out"
          style={{
            width: `${photos.length * 100}%`,
            transform: `translateX(-${(index * 100) / photos.length}%)`,
          }}
        >
          {photos.map((p) => (
            <div
              key={p.id}
              className="relative h-full"
              style={{ width: `${100 / photos.length}%`, flexShrink: 0 }}
            >
              <Image
                src={`${API}${p.file_url}`}
                alt={p.alt ?? fallbackAlt ?? "사진"}
                fill
                className={imgClassName ?? "object-cover"}
                style={imgStyle}
                sizes={sizes}
                priority={priority}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // fade
  return (
    <div className={`${className ?? ""} relative`}>
      {photos.map((p, i) => (
        <Image
          key={p.id}
          src={`${API}${p.file_url}`}
          alt={p.alt ?? fallbackAlt ?? "사진"}
          fill
          className={`${imgClassName ?? "object-cover"} transition-opacity duration-700 ease-in-out`}
          style={{ ...imgStyle, opacity: i === index ? 1 : 0 }}
          sizes={sizes}
          priority={priority && i === 0}
        />
      ))}
    </div>
  );
}
