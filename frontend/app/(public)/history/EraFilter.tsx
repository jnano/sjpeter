"use client";

import { useState } from "react";

/**
 * 시안 .era-filter 재현 — 10년 단위 era 칩.
 * 클릭 시 해당 era 의 첫 항목으로 스크롤(anchor 점프).
 */
export interface Era {
  id: string;        // "2020s" 등
  label: string;     // "2020년대"
  count: number;
}

export default function EraFilter({ eras, total }: { eras: Era[]; total: number }) {
  const [active, setActive] = useState<string>("all");

  function jump(id: string) {
    setActive(id);
    if (id === "all") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const el = document.getElementById(`era-${id}`);
    if (!el) return;
    const offset = window.innerWidth < 768 ? 110 : 140;
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: "smooth" });
  }

  return (
    <div className="flex gap-1.5 flex-wrap mb-8 sticky top-14 md:top-32 z-10 bg-[var(--color-background)]/95 backdrop-blur py-2 -mx-1 px-1">
      <button
        type="button"
        onClick={() => jump("all")}
        className={`px-4 py-2 rounded-full border text-[13px] font-semibold transition-colors ${
          active === "all"
            ? "bg-[var(--color-text)] text-white border-[var(--color-text)]"
            : "bg-white text-[var(--color-text-muted)] border-[var(--color-border)] hover:text-[var(--color-text)]"
        }`}
      >
        전체
        <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] tabular-nums font-bold ${
          active === "all" ? "bg-white/15 text-white" : "bg-[var(--color-surface-warm)] text-[var(--color-text-muted)]"
        }`}>
          {total}
        </span>
      </button>
      {eras.map((e) => {
        const on = active === e.id;
        return (
          <button
            key={e.id}
            type="button"
            onClick={() => jump(e.id)}
            className={`px-4 py-2 rounded-full border text-[13px] font-semibold transition-colors ${
              on
                ? "bg-[var(--color-text)] text-white border-[var(--color-text)]"
                : "bg-white text-[var(--color-text-muted)] border-[var(--color-border)] hover:text-[var(--color-text)]"
            }`}
          >
            {e.label}
            <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] tabular-nums font-bold ${
              on ? "bg-white/15 text-white" : "bg-[var(--color-surface-warm)] text-[var(--color-text-muted)]"
            }`}>
              {e.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
