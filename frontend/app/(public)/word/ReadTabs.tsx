"use client";

import { useEffect, useState } from "react";

/**
 * 시안 .read-tabs 재현 — 4탭 (1독서·화답송·복음환호송·복음).
 * 클릭 시 해당 reading 카드(#anchor)로 스크롤 점프.
 * 스크롤 위치에 따라 현재 활성 탭을 자동 추적(IntersectionObserver).
 */
interface Tab {
  id: string;          // anchor id (e.g. "first")
  label: string;       // "제1독서"
  reference: string;   // "1코린"
}

export default function ReadTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState<string>(tabs[0]?.id ?? "");

  useEffect(() => {
    const els = tabs
      .map((t) => document.getElementById(t.id))
      .filter((el): el is HTMLElement => !!el);
    if (els.length === 0) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: 0 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [tabs]);

  function jump(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    // 헤더 + sticky tab 만큼 보정. 모바일은 app-header(50px)+tab(약 50px), 데스크탑은 헤더+브레드크럼+tab.
    const offset = window.innerWidth < 768 ? 110 : 140;
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: "smooth" });
    setActive(id);
  }

  return (
    <div className="flex gap-1 p-1 bg-white border border-[var(--color-border)] rounded-full mb-6 sticky top-14 md:top-32 z-10">
      {tabs.map((t) => {
        const on = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => jump(t.id)}
            className={`flex-1 px-2 py-2.5 rounded-full text-[12px] sm:text-[13px] font-semibold transition-colors flex flex-col items-center leading-tight ${
              on ? "bg-[var(--color-text)] text-white" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            <span className={`text-[9px] sm:text-[10px] opacity-70 mb-0.5 ${on ? "opacity-100" : ""}`} style={on ? { color: "var(--color-accent, #C9A961)" } : undefined}>
              {t.label}
            </span>
            <span className="truncate w-full text-center">{t.reference}</span>
          </button>
        );
      })}
    </div>
  );
}
