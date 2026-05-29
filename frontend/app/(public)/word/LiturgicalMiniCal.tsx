"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toLocalIso, todayIso } from "./dateUtils";

/**
 * 시안 .mini-cal 재현 — 작은 월간 캘린더.
 * 좌/우 화살표로 월 이동, 날짜 클릭 시 /word?date=YYYY-MM-DD 로 점프.
 * 일요일은 와인색, 오늘은 와인 배경 + 흰 글씨.
 */
export default function LiturgicalMiniCal({ currentIso }: { currentIso: string }) {
  const router = useRouter();
  const current = useMemo(() => new Date(currentIso + "T00:00:00"), [currentIso]);
  const today = todayIso();

  const [view, setView] = useState<{ y: number; m: number }>({
    y: current.getFullYear(),
    m: current.getMonth(), // 0..11
  });

  const days = useMemo(() => buildMonthGrid(view.y, view.m), [view.y, view.m]);

  function shiftMonth(d: number) {
    let { y, m } = view;
    m += d;
    if (m < 0) { y -= 1; m = 11; }
    if (m > 11) { y += 1; m = 0; }
    setView({ y, m });
  }

  function jump(iso: string) {
    router.push(iso === today ? "/word" : `/word?date=${iso}`);
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm font-bold">{view.y} · {view.m + 1}월</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label="이전 달"
            className="w-6 h-6 rounded-full border border-[var(--color-border)] flex items-center justify-center hover:bg-[var(--color-surface-warm)]"
          >
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6">
              <polyline points="6 2 3 5 6 8" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label="다음 달"
            className="w-6 h-6 rounded-full border border-[var(--color-border)] flex items-center justify-center hover:bg-[var(--color-surface-warm)]"
          >
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6">
              <polyline points="4 2 7 5 4 8" />
            </svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-[11px] text-center">
        {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
          <span key={d} className={`py-1 text-[10px] font-semibold ${i === 0 ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"}`}>
            {d}
          </span>
        ))}
        {days.map((d) => {
          const isToday = d.iso === today;
          const isCurrent = d.iso === currentIso;
          const sun = d.dow === 0;
          return (
            <button
              key={d.iso}
              type="button"
              onClick={() => jump(d.iso)}
              className={`py-1.5 rounded tabular-nums transition-colors ${
                d.muted
                  ? "text-[var(--color-text-muted)] opacity-40"
                  : isToday
                  ? "bg-[var(--color-primary)] text-white font-bold"
                  : isCurrent
                  ? "bg-[var(--color-primary)]/15 text-[var(--color-primary)] font-bold"
                  : sun
                  ? "text-[var(--color-primary)] hover:bg-[var(--color-surface-warm)]"
                  : "hover:bg-[var(--color-surface-warm)]"
              }`}
            >
              {d.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface Cell {
  iso: string;
  day: number;
  dow: number; // 0..6 (Sun..Sat)
  muted: boolean;
}

function buildMonthGrid(year: number, month: number): Cell[] {
  // 시안과 동일: 일요일 시작, 이전·다음 달 흐림 셀로 6주 = 42 칸.
  const first = new Date(year, month, 1);
  const firstDow = first.getDay();
  const start = new Date(first);
  start.setDate(1 - firstDow);

  const cells: Cell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({
      iso: toLocalIso(d),
      day: d.getDate(),
      dow: d.getDay(),
      muted: d.getMonth() !== month,
    });
  }
  return cells;
}

