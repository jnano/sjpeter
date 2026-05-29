"use client";

import { useRouter } from "next/navigation";
import { todayIso } from "./dateUtils";

/**
 * 시안 .week-list 재현 — 현재 표시 날짜가 속한 주의 월~일 7일.
 * server-side fetch 된 데이터(week prop)를 props 로 받음 — 클라이언트 컴포넌트는
 * 표시·라우팅만 담당. 데이터 미설정 시 placeholder("보기 →")로 폴백.
 */
export interface WeekDay {
  date: string;          // YYYY-MM-DD
  dayLabel: string;      // "월"·"화" ...
  firstRef: string | null;
  gospelRef: string | null;
}

export default function WeekReadings({
  currentIso,
  week,
}: {
  currentIso: string;
  week: WeekDay[];
}) {
  const router = useRouter();
  const today = todayIso();

  function jump(iso: string) {
    router.push(iso === today ? "/word" : `/word?date=${iso}`);
  }

  return (
    <ul>
      {week.map((d) => {
        const isToday = d.date === today;
        const isCurrent = d.date === currentIso;
        const highlight = isToday || isCurrent;
        return (
          <li
            key={d.date}
            className={`py-2.5 border-b border-dashed border-[var(--color-border)] last:border-b-0 grid grid-cols-[28px_1fr] gap-2.5 text-[13px] ${
              highlight ? "bg-[var(--color-primary)]/5 px-2.5 -mx-2.5 rounded" : ""
            }`}
          >
            <span className={`font-bold ${highlight ? "text-[var(--color-primary)]" : "text-[var(--color-text)]"}`}>
              {d.dayLabel}
            </span>
            <button
              type="button"
              onClick={() => jump(d.date)}
              className="text-left text-[var(--color-text-muted)] hover:text-[var(--color-primary)] min-w-0"
              title={`${d.date} 말씀 보기`}
            >
              {d.firstRef || d.gospelRef ? (
                <>
                  <span className={`block truncate ${highlight ? "text-[var(--color-text)] font-semibold" : ""}`}>
                    {d.firstRef ?? "—"}
                  </span>
                  {d.gospelRef && (
                    <small className={`block text-[11px] truncate mt-0.5 ${highlight ? "font-semibold" : ""}`}>
                      {d.gospelRef}
                    </small>
                  )}
                </>
              ) : (
                <>
                  <span className="block">{d.date.slice(5).replace("-", ".")}</span>
                  <small className="block text-[11px] mt-0.5">
                    {isCurrent ? "표시 중" : isToday ? "오늘" : "보기 →"}
                  </small>
                </>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
