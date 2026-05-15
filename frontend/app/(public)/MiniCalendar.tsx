"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Event {
  id: number;
  event_date: string;
  end_date: string | null;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function dateToStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function eventOverlaps(e: Event, dateStr: string) {
  const start = e.event_date;
  const end = e.end_date ?? e.event_date;
  return dateStr >= start && dateStr <= end;
}

export default function MiniCalendar() {
  const today = new Date();
  const todayStr = dateToStr(today);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    fetch(`${API}/api/events/?year=${year}&month=${month}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setEvents(Array.isArray(data) ? data : []))
      .catch(() => setEvents([]));
  }, [year, month]);

  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow = new Date(year, month - 1, 1).getDay();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="border border-[var(--color-border)] rounded-xl bg-white overflow-hidden flex flex-col h-full">
      {/* 헤더 — 월 이동 */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-surface-warm)]">
        <button
          onClick={prevMonth}
          className="p-1 rounded hover:bg-white text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
          aria-label="이전 달"
        >
          ‹
        </button>
        <h3 className="font-serif font-bold text-[var(--color-primary)] text-[13px]">
          {year}년 {month}월
        </h3>
        <button
          onClick={nextMonth}
          className="p-1 rounded hover:bg-white text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
          aria-label="다음 달"
        >
          ›
        </button>
      </div>

      {/* 그리드 */}
      <div className="p-2 flex flex-col flex-1 min-h-0">
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAYS.map((d, i) => (
            <div
              key={d}
              className={`text-center text-[12px] font-medium py-1 ${
                i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-[var(--color-text-muted)]"
              }`}
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 flex-1 auto-rows-fr min-h-0">
          {cells.map((day, i) => {
            if (day === null) return <div key={i} />;
            const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const isToday = dateStr === todayStr;
            const hasEvent = events.some((e) => eventOverlaps(e, dateStr));
            const dow = (firstDow + day - 1) % 7;
            return (
              <Link
                key={i}
                href="/calendar"
                className="relative flex items-center justify-center rounded-md hover:bg-[var(--color-surface-warm)] transition-colors group"
              >
                <span
                  className={`text-[13px] ${
                    isToday
                      ? "bg-[var(--color-primary)] text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-[12px]"
                      : dow === 0
                      ? "text-red-500"
                      : dow === 6
                      ? "text-blue-500"
                      : "text-[var(--color-text)]"
                  }`}
                >
                  {day}
                </span>
                {hasEvent && !isToday && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--color-accent)]" />
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* 푸터 — 전체 일정 링크 */}
      <div className="border-t border-[var(--color-border)] px-4 py-2 text-right">
        <Link
          href="/calendar"
          className="text-[12px] font-medium text-[var(--color-primary)] hover:underline"
        >
          전체 일정 →
        </Link>
      </div>
    </div>
  );
}
