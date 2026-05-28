"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";

/**
 * 시안 .week-list 재현 — 이번 주 7일 분 미사 말씀 placeholder.
 * 굿뉴스에서 본문을 미리 가져오려면 7번 fetch 필요 → 2단계로 미룸.
 * 1단계에서는 7일 날짜 카드 + 클릭 시 그 날짜로 /word?date= 점프.
 * 오늘 행은 와인 배경으로 강조 (시안 .today).
 */
export default function WeekReadings({ currentIso }: { currentIso: string }) {
  const router = useRouter();
  const todayIso = new Date().toISOString().slice(0, 10);

  // 시안과 동일: 월요일~일요일 한 줄씩 7개 행.
  const week = useMemo(() => buildWeek(currentIso), [currentIso]);

  function jump(iso: string) {
    router.push(iso === todayIso ? "/word" : `/word?date=${iso}`);
  }

  return (
    <ul>
      {week.map((d) => {
        const isToday = d.iso === todayIso;
        const isCurrent = d.iso === currentIso;
        const highlight = isToday || isCurrent;
        return (
          <li
            key={d.iso}
            className={`py-2.5 border-b border-dashed border-[var(--color-border)] last:border-b-0 grid grid-cols-[42px_1fr] gap-2 text-[13px] ${
              highlight ? "bg-[var(--color-primary)]/5 px-2.5 -mx-2.5 rounded" : ""
            }`}
          >
            <span className={`font-bold ${highlight ? "text-[var(--color-primary)]" : "text-[var(--color-text)]"}`}>
              {d.dayLabel}
            </span>
            <button
              type="button"
              onClick={() => jump(d.iso)}
              className="text-left text-[var(--color-text-muted)] hover:text-[var(--color-primary)] truncate"
              title="이 날의 말씀 보기"
            >
              {d.iso.slice(5).replace("-", ".")}
              <small className="block text-[11px] text-[var(--color-text-muted)] mt-0.5">
                {isCurrent ? "표시 중" : isToday ? "오늘" : "보기 →"}
              </small>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function buildWeek(currentIso: string): { iso: string; dayLabel: string }[] {
  const labels = ["월", "화", "수", "목", "금", "토", "일"];
  const cur = new Date(currentIso + "T00:00:00");
  // ISO week 의 월요일 시작
  const day = cur.getDay(); // 0(Sun)..6(Sat)
  const offsetToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(cur);
  monday.setDate(cur.getDate() + offsetToMon);
  return labels.map((dayLabel, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return { iso: `${y}-${m}-${dd}`, dayLabel };
  });
}
