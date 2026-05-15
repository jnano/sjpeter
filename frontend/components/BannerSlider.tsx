"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const TRANSITION_MS = 700;
const DEFAULT_DELAY_SECONDS = 5;
const DEFAULT_ASPECT_RATIO = "16:9";

interface BannerImage {
  id: number;
  file_url: string;
  link_url: string | null;
  alt_text: string;
  sort_order: number;
}

interface BannerGroup {
  id: number;
  name: string;
  placement: string;
  is_active: boolean;
  sort_order: number;
  transition: string;
  aspect_ratio: string;
  delay_seconds: number;
  show_caption_overlay: boolean;
  images: BannerImage[];
}

interface Props {
  placement: string;
  className?: string;
}

type Transition =
  | "none" | "fade" | "slide" | "slide-up" | "slide-down"
  | "zoom-in" | "zoom-out" | "ken-burns" | "blur";

function absoluteUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API}${path}`;
}

// "16:9" → "16 / 9" (CSS aspect-ratio 값)
function toAspectRatioCss(value: string): string {
  const [w, h] = value.split(":").map((v) => v.trim());
  if (!w || !h) return "16 / 9";
  return `${w} / ${h}`;
}

function classesFor(transition: Transition, active: boolean): string {
  const base = "absolute inset-0 transition-all ease-out";
  switch (transition) {
    case "none":
      return `${base} ${active ? "opacity-100" : "opacity-0"}`;
    case "fade":
      return `${base} ${active ? "opacity-100" : "opacity-0"}`;
    case "slide":
      return `${base} ${active ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0"}`;
    case "slide-up":
      return `${base} ${active ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"}`;
    case "slide-down":
      return `${base} ${active ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"}`;
    case "zoom-in":
      return `${base} ${active ? "scale-100 opacity-100" : "scale-90 opacity-0"}`;
    case "zoom-out":
      return `${base} ${active ? "scale-100 opacity-100" : "scale-110 opacity-0"}`;
    case "blur":
      return `${base} ${active ? "blur-0 opacity-100" : "blur-md opacity-0"}`;
    case "ken-burns":
      return `${base} ${active ? "opacity-100 [animation:kenburns_15s_ease-in-out_infinite_alternate]" : "opacity-0"}`;
    default:
      return `${base} ${active ? "opacity-100" : "opacity-0"}`;
  }
}

export default function BannerSlider({ placement, className }: Props) {
  const [groups, setGroups] = useState<BannerGroup[] | null>(null);
  const [index, setIndex] = useState(0);
  const prevIndexRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/api/banners/by-placement/${placement}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: BannerGroup[]) => {
        if (!cancelled) setGroups(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setGroups([]);
      });
    return () => {
      cancelled = true;
    };
  }, [placement]);

  const images: BannerImage[] = (groups ?? []).flatMap((g) => g.images);
  const total = images.length;

  // 활성 그룹의 설정값 사용 (첫 이미지가 있는 그룹 기준)
  const activeGroup = (groups ?? []).find((g) => g.images.length > 0) ?? null;
  const transition: Transition = (activeGroup?.transition ?? "fade") as Transition;
  const aspectRatio = activeGroup?.aspect_ratio ?? DEFAULT_ASPECT_RATIO;
  const delaySeconds = activeGroup?.delay_seconds ?? DEFAULT_DELAY_SECONDS;
  const showCaption = activeGroup?.show_caption_overlay ?? false;

  // 자동 슬라이드 — 2장 이상
  useEffect(() => {
    if (total < 2) return;
    const intervalMs = Math.max(1000, delaySeconds * 1000);
    const timer = setInterval(() => {
      setIndex((i) => {
        prevIndexRef.current = i;
        return (i + 1) % total;
      });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [total, delaySeconds]);

  if (groups === null) return null;
  if (total === 0) return null;

  const safeIndex = Math.min(index, total - 1);

  function jumpTo(i: number) {
    if (i === safeIndex) return;
    prevIndexRef.current = safeIndex;
    setIndex(i);
  }

  return (
    <div
      className={`relative border border-[var(--color-border)] rounded-xl overflow-hidden bg-white ${className ?? ""}`}
    >
      {/* 가변 비율 컨테이너 — 그룹별 aspect_ratio 적용 */}
      <div
        className="relative w-full overflow-hidden"
        style={{ aspectRatio: toAspectRatioCss(aspectRatio) }}
      >
        {images.map((img, i) => {
          const active = i === safeIndex;
          const inner = (
            <Image
              src={absoluteUrl(img.file_url)}
              alt={img.alt_text || ""}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
              unoptimized
              priority={active}
            />
          );
          const cls = classesFor(transition, active);
          const wrapStyle = { transitionDuration: `${TRANSITION_MS}ms` } as React.CSSProperties;

          return (
            <div key={img.id} className={cls} style={wrapStyle} aria-hidden={!active}>
              {img.link_url && active ? (
                <Link
                  href={img.link_url}
                  target={img.link_url.startsWith("http") ? "_blank" : undefined}
                  rel={img.link_url.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="block w-full h-full"
                >
                  {inner}
                </Link>
              ) : (
                inner
              )}

              {/* 캡션 오버레이 — show_caption_overlay 가 true이고 alt_text 가 있을 때만 */}
              {showCaption && img.alt_text && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent px-4 py-3">
                  <p className="text-white text-sm md:text-base font-medium leading-snug line-clamp-2">
                    {img.alt_text}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 인디케이터 — 2장 이상일 때만 */}
      {total >= 2 && (
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2 z-10">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              aria-label={`배너 ${i + 1}번으로 이동`}
              onClick={() => jumpTo(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === safeIndex
                  ? "w-6 bg-[var(--color-primary)]"
                  : "w-1.5 bg-white/80 ring-1 ring-black/10 hover:bg-white"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
