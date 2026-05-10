"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import PageHeroSlideshow from "./PageHeroSlideshow";

const API = process.env.NEXT_PUBLIC_API_URL;

interface PagePhotoSlug {
  id: number;
  slug: string;
  label: string;
  public_href: string;
  description: string | null;
  fallback_url: string | null;
}

interface Props {
  className?: string;
  sizes?: string;
  priority?: boolean;
}

const DEFAULT_CLASS =
  "relative w-full aspect-[3/1] md:aspect-auto md:h-[179px] lg:h-48 rounded-xl overflow-hidden border border-[var(--color-border)] mb-8";

/**
 * 현재 pathname을 /admin/page-photos에 등록된 슬러그와 매칭해
 * 사진이 있으면 자동으로 PageHeroSlideshow를 표시한다.
 *
 * 매칭 우선순위: pathname 정확 일치(public_href) → 마지막 segment가 slug와 동일.
 * 매칭 실패하거나 사진·fallback 모두 없으면 아무것도 렌더하지 않음.
 */
export default function AutoPageHero({ className, sizes, priority = true }: Props) {
  const pathname = usePathname();
  const [meta, setMeta] = useState<PagePhotoSlug | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/api/page-photos/slugs`)
      .then((r) => (r.ok ? r.json() : []))
      .then((slugs: PagePhotoSlug[]) => {
        if (cancelled) return;
        const direct = slugs.find((s) => s.public_href === pathname);
        if (direct) {
          setMeta(direct);
          setResolved(true);
          return;
        }
        const last = pathname.split("/").filter(Boolean).pop();
        const bySlug = last ? slugs.find((s) => s.slug === last) : undefined;
        setMeta(bySlug ?? null);
        setResolved(true);
      })
      .catch(() => setResolved(true));
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (!resolved || !meta) return null;

  return (
    <PageHeroSlideshow
      slug={meta.slug}
      fallbackSrc={meta.fallback_url ?? undefined}
      fallbackAlt={meta.label}
      className={className ?? DEFAULT_CLASS}
      sizes={sizes ?? "(max-width: 768px) 100vw, 768px"}
      priority={priority}
    />
  );
}
