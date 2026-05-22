"use client";

import Link from "next/link";
import { useMemo } from "react";

/**
 * 분과·단체 태그 클라우드.
 *
 * - 가장 많은 태그수와 가장 적은 태그수로 폰트 크기 결정 (log 스케일 — 격차 큰 경우 큰 항목이 화면 점령 회피)
 * - 무작위 순서 + 회전 — seed 기반 결정적이므로 SSR/CSR 일치
 * - 태그 클릭 → /groups/[slug]/posts (분과로 태그된 글 모아보기)
 *
 * count=0 인 분과는 표시 안 함 (의미 없는 클릭 회피).
 */

interface TagItem {
  id: number;
  name: string;
  slug: string | null;
  count: number;
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  // Mulberry32 — 결정적 의사난수, SSR/CSR 일관성
  let s = seed >>> 0;
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    const j = Math.floor(r * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function rotationFor(name: string): number {
  // 이름 해시로 -8°~+8° 결정 — 같은 분과는 항상 같은 각도(UX 안정)
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return ((h % 17) - 8); // -8 .. +8
}

export default function TagCloud({
  items,
  minSize = 12,
  maxSize = 36,
  seed = 0,
  hrefBase = "/groups",
}: {
  items: TagItem[];
  minSize?: number;
  maxSize?: number;
  seed?: number;
  hrefBase?: string;
}) {
  const visible = items.filter((it) => it.count > 0 && it.slug);

  const sized = useMemo(() => {
    if (visible.length === 0) return [];
    const counts = visible.map((v) => v.count);
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    // log 스케일 (count=0 은 위에서 제외)
    const logMin = Math.log10(min);
    const logMax = Math.log10(max);
    const range = Math.max(0.0001, logMax - logMin);
    return visible.map((v) => {
      const t = (Math.log10(v.count) - logMin) / range; // 0..1
      const fontSize = Math.round(minSize + t * (maxSize - minSize));
      return { ...v, fontSize };
    });
  }, [visible, minSize, maxSize]);

  const shuffled = useMemo(() => seededShuffle(sized, seed || 1), [sized, seed]);

  if (shuffled.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-muted)] text-center py-8">
        아직 태그된 글이 없습니다.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-3 py-4">
      {shuffled.map((it) => (
        <Link
          key={it.id}
          href={`${hrefBase}/${it.slug}/posts`}
          className="inline-block px-1 text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors leading-tight"
          style={{
            fontSize: `${it.fontSize}px`,
            transform: `rotate(${rotationFor(it.name)}deg)`,
          }}
          title={`${it.name} · ${it.count}건`}
        >
          {it.name}
          <span className="ml-1 text-[0.55em] text-[var(--color-text-muted)] align-super">{it.count}</span>
        </Link>
      ))}
    </div>
  );
}
