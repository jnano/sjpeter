"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { DataEvent, useInvalidationListener } from "./dataEvents";

const API = process.env.NEXT_PUBLIC_API_URL;

export type TransitionMode =
  | "none"
  | "fade"
  | "slide"
  | "slide-up"
  | "slide-down"
  | "zoom-in"
  | "zoom-out"
  | "ken-burns"
  | "blur";

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
  transition_duration_ms: number;
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

const SLIDE_MODES: TransitionMode[] = ["slide", "slide-up", "slide-down"];

/**
 * 페이지(슬러그)별 히어로 영역 슬라이드쇼.
 * 사진 0장: fallback / 1장 또는 none: 정적 / 2장 이상: 모드별 자동 전환.
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
    transition_duration_ms: 700,
  });
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(() => {
    fetch(`${API}/api/page-photos/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setPhotos(data.photos ?? []);
        if (data.settings) setSettings(data.settings);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [slug]);

  useEffect(() => { reload(); }, [reload]);
  useInvalidationListener(DataEvent.PAGE_PHOTOS, reload);

  useEffect(() => {
    if (photos.length < 2 || settings.transition_mode === "none") return;
    const ms = Math.max(1, settings.interval_seconds) * 1000;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % photos.length);
    }, ms);
    return () => clearInterval(id);
  }, [photos.length, settings.transition_mode, settings.interval_seconds]);

  // 0장: fallback
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

  // 1장 또는 none: 정적
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

  const duration = settings.transition_duration_ms;

  // 슬라이드 계열: 캐러셀 (가로/세로 translate)
  if (SLIDE_MODES.includes(settings.transition_mode)) {
    const isVertical = settings.transition_mode !== "slide";
    const direction = settings.transition_mode === "slide-down" ? 1 : -1;
    return (
      <div className={`${className ?? ""} relative overflow-hidden`}>
        <div
          className="absolute inset-0"
          style={{
            transition: `transform ${duration}ms ease-in-out`,
            transform: isVertical
              ? `translateY(${direction * index * 100}%)`
              : `translateX(-${index * 100}%)`,
          }}
        >
          {photos.map((p, i) => (
            <div
              key={p.id}
              className="absolute inset-0"
              style={{
                transform: isVertical
                  ? `translateY(${i * 100 * direction * -1}%)`
                  : `translateX(${i * 100}%)`,
              }}
            >
              <Image
                src={`${API}${p.file_url}`}
                alt={p.alt ?? fallbackAlt ?? "사진"}
                fill
                className={imgClassName ?? "object-cover"}
                style={imgStyle}
                sizes={sizes}
                priority={priority && i === 0}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 페이드 계열: 스택 (fade / zoom-in / zoom-out / ken-burns / blur)
  // 인접한 두 장만 렌더(부담 ↓), 켄번즈는 active 사진에 CSS animation
  return (
    <div className={`${className ?? ""} relative`}>
      {photos.map((p, i) => {
        const active = i === index;
        const style: React.CSSProperties = {
          ...imgStyle,
          opacity: active ? 1 : 0,
          transition: `opacity ${duration}ms ease-in-out, transform ${duration}ms ease-in-out, filter ${duration}ms ease-in-out`,
        };
        if (settings.transition_mode === "zoom-in") {
          style.transform = active ? "scale(1)" : "scale(0.92)";
        } else if (settings.transition_mode === "zoom-out") {
          style.transform = active ? "scale(1)" : "scale(1.1)";
        } else if (settings.transition_mode === "blur") {
          style.filter = active ? "blur(0px)" : "blur(10px)";
        } else if (settings.transition_mode === "ken-burns" && active) {
          // 한 사진이 표시되는 시간 = 전환 간격, 켄 번즈는 그 동안 천천히 진행
          style.animation = `ken-burns ${Math.max(1, settings.interval_seconds + duration / 1000)}s ease-out forwards`;
        }
        return (
          <Image
            key={p.id}
            src={`${API}${p.file_url}`}
            alt={p.alt ?? fallbackAlt ?? "사진"}
            fill
            className={imgClassName ?? "object-cover"}
            style={style}
            sizes={sizes}
            priority={priority && i === 0}
          />
        );
      })}
    </div>
  );
}
