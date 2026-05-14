"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const AUTO_SLIDE_MS = 5000;

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
  images: BannerImage[];
}

interface Props {
  placement: string;
  className?: string;
}

function absoluteUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API}${path}`;
}

export default function BannerSlider({ placement, className }: Props) {
  const [groups, setGroups] = useState<BannerGroup[] | null>(null);
  const [index, setIndex] = useState(0);

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

  // 활성 그룹들의 이미지를 한 줄로 합쳐 슬라이드 (그룹이 여러 개면 sort_order 순)
  const images: BannerImage[] = (groups ?? []).flatMap((g) => g.images);
  const total = images.length;

  // 자동 슬라이드 — 2장 이상일 때만
  useEffect(() => {
    if (total < 2) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % total);
    }, AUTO_SLIDE_MS);
    return () => clearInterval(timer);
  }, [total]);

  // 활성 이미지 0장 → 아무것도 렌더하지 않음
  if (groups === null) {
    // 로딩 중 — 자리만 미리 잡지 않음(높이가 0이면 grid 가 흔들리지 않음)
    return null;
  }
  if (total === 0) return null;

  const safeIndex = Math.min(index, total - 1);
  const current = images[safeIndex];

  // 이미지 비율이 달라도 카드 크기가 흔들리지 않도록 컨테이너에 고정 비율(3:2)
  // + object-cover 로 채움. 다양한 비율의 배너가 섞여도 슬라이드 전환 시
  // 카드 높이가 점프하지 않는다.
  const imageEl = (
    <div className="relative w-full aspect-[3/2]">
      <Image
        src={absoluteUrl(current.file_url)}
        alt={current.alt_text || ""}
        fill
        sizes="(max-width: 768px) 100vw, 33vw"
        className="object-cover"
        unoptimized
      />
    </div>
  );

  return (
    <div
      className={`relative border border-[var(--color-border)] rounded-xl overflow-hidden bg-white ${className ?? ""}`}
    >
      {current.link_url ? (
        <Link
          href={current.link_url}
          target={current.link_url.startsWith("http") ? "_blank" : undefined}
          rel={current.link_url.startsWith("http") ? "noopener noreferrer" : undefined}
          className="block"
        >
          {imageEl}
        </Link>
      ) : (
        imageEl
      )}

      {/* 인디케이터 — 2장 이상일 때만 노출 */}
      {total >= 2 && (
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 z-10">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              aria-label={`배너 ${i + 1}번으로 이동`}
              onClick={() => setIndex(i)}
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
