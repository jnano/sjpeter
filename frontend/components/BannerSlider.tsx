"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const AUTO_SLIDE_MS = 5000;
const TRANSITION_MS = 700;

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

// 전환 효과별 enter/leave 클래스 — 양쪽 슬라이드를 stack 으로 겹쳐 두고
// 활성 컷에는 enter 클래스, 직전 컷에는 leave 클래스를 입혀 700ms 동안
// 두 컷이 교차하도록 한다.
function classesFor(transition: Transition, active: boolean): string {
  // 공통 — duration·ease 는 transition 의 inline style 로 둠
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
      // Ken Burns 는 활성 컷에서 천천히 확대(15s) — 비활성은 fade out
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

  // 활성 그룹들의 이미지를 한 줄로 합쳐 슬라이드
  const images: BannerImage[] = (groups ?? []).flatMap((g) => g.images);
  const total = images.length;

  // 전환 효과는 (단순화를 위해) 첫 활성 그룹의 것을 사용. 여러 그룹이
  // 같은 placement 에 있어도 보통 하나만 활성이므로 충분.
  const transition: Transition = ((groups ?? []).find((g) => g.images.length > 0)?.transition
    ?? "fade") as Transition;

  // 자동 슬라이드 — 2장 이상
  useEffect(() => {
    if (total < 2) return;
    const timer = setInterval(() => {
      setIndex((i) => {
        prevIndexRef.current = i;
        return (i + 1) % total;
      });
    }, AUTO_SLIDE_MS);
    return () => clearInterval(timer);
  }, [total]);

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
      {/* 고정 비율 컨테이너 — 모든 컷을 stack 으로 겹쳐 둠 */}
      <div className="relative w-full aspect-[3/2] overflow-hidden">
        {images.map((img, i) => {
          const active = i === safeIndex;
          // 비활성 중 직전 컷만 leave 트랜지션이 시각적으로 의미 있음.
          // 그 외 컷은 opacity-0 으로 숨김(animation 무의미해도 트리 안에 둠).
          const inner = (
            <Image
              src={absoluteUrl(img.file_url)}
              alt={img.alt_text || ""}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover"
              unoptimized
              priority={active}
            />
          );
          const cls = classesFor(transition, active);
          const wrapStyle = { transitionDuration: `${TRANSITION_MS}ms` } as React.CSSProperties;

          // link_url 이 있으면 a 태그로 감싸기 — 활성 컷에서만 클릭 가능
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
            </div>
          );
        })}
      </div>

      {/* 인디케이터 — 2장 이상일 때만 */}
      {total >= 2 && (
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 z-10">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              aria-label={`배너 ${i + 1}번으로 이동`}
              onClick={() => jumpTo(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === safeIndex
                  ? "w-5 bg-[var(--color-primary)]"
                  : "w-1.5 bg-white/80 ring-1 ring-black/10 hover:bg-white"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
