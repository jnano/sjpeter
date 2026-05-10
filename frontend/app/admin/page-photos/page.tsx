"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PAGE_PHOTO_SLUGS } from "./slugs";

const API = process.env.NEXT_PUBLIC_API_URL;

interface SlugStat {
  slug: string;
  count: number;
  transition_mode: string;
  interval_seconds: number;
}

const TRANSITION_KO: Record<string, string> = {
  none: "전환 없음",
  fade: "페이드",
  slide: "슬라이드",
  "slide-up": "슬라이드↑",
  "slide-down": "슬라이드↓",
  "zoom-in": "줌 인",
  "zoom-out": "줌 아웃",
  "ken-burns": "켄 번즈",
  blur: "블러",
};

export default function AdminPagePhotosIndex() {
  const [stats, setStats] = useState<Record<string, SlugStat>>({});

  useEffect(() => {
    Promise.all(
      PAGE_PHOTO_SLUGS.map(async (s) => {
        const res = await fetch(`${API}/api/page-photos/${s.slug}`);
        if (!res.ok) return null;
        const data = await res.json();
        return {
          slug: s.slug,
          count: (data.photos ?? []).length,
          transition_mode: data.settings?.transition_mode ?? "fade",
          interval_seconds: data.settings?.interval_seconds ?? 5,
        } as SlugStat;
      }),
    ).then((rs) => {
      const m: Record<string, SlugStat> = {};
      rs.forEach((r) => {
        if (r) m[r.slug] = r;
      });
      setStats(m);
    });
  }, []);

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">페이지 사진 관리</h1>
        <p className="text-sm text-gray-500 mt-1">
          각 페이지의 히어로 영역에 표시될 사진을 등록·관리합니다. 여러 장 등록하면 자동 슬라이드쇼로 전환됩니다.
        </p>
      </div>

      <ul className="space-y-2">
        {PAGE_PHOTO_SLUGS.map((s) => {
          const stat = stats[s.slug];
          return (
            <li key={s.slug}>
              <Link
                href={`/admin/page-photos/${s.slug}`}
                className="block p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-gray-800">{s.label}</h2>
                      <code className="text-xs text-gray-400 px-1.5 py-0.5 bg-gray-100 rounded">{s.slug}</code>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium text-gray-700">
                      {stat ? `${stat.count}장` : "..."}
                    </p>
                    {stat && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {TRANSITION_KO[stat.transition_mode] ?? stat.transition_mode} · {stat.interval_seconds}초
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
