"use client";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import PageHeader from "@/components/PageHeader";
import BannerSlider from "@/components/BannerSlider";
import SectionSidebar from "@/components/SectionSidebar";
import { SidebarCollapseTab, useSidebarCollapsed } from "@/components/SectionLayout";
import { useNavigation } from "@/components/useNavigation";
import MarkdownContent from "@/components/MarkdownContent";

const API = process.env.NEXT_PUBLIC_API_URL;

const CATEGORY_LABEL: Record<string, string> = {
  liturgy: "전례", community: "공동체", education: "교육",
  general: "일반", special: "특별행사",
};

const CHIP_COLOR: Record<string, string> = {
  liturgy: "bg-purple-50 text-purple-700 border-purple-200",
  community: "bg-green-50 text-green-700 border-green-200",
  education: "bg-blue-50 text-blue-700 border-blue-200",
  general: "bg-gray-100 text-gray-600 border-gray-200",
  special: "bg-amber-50 text-amber-700 border-amber-200",
};

const BAR_COLOR: Record<string, string> = {
  liturgy: "bg-purple-100 text-purple-700",
  community: "bg-green-100 text-green-700",
  education: "bg-blue-100 text-blue-700",
  general: "bg-gray-200 text-gray-600",
  special: "bg-amber-100 text-amber-700",
};

const STATUS_BADGE: Record<string, string> = {
  "예정": "bg-blue-50 text-blue-600 border-blue-200",
  "기록대기": "bg-amber-50 text-amber-600 border-amber-200",
  "기록됨": "bg-emerald-50 text-emerald-600 border-emerald-200",
};

type ViewMode = "month" | "week" | "day" | "list";

interface Event {
  id: number;
  title: string;
  description: string | null;
  event_date: string;
  end_date: string | null;
  start_time: string | null;
  location: string | null;
  category: string;
  status: string;
  event_kind: string | null;
}

function KindBadge({ kind }: { kind: string | null }) {
  if (kind === "행사")
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200 font-medium">행사</span>;
  if (kind === "모임")
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-600 border border-green-200 font-medium">모임</span>;
  return null;
}

// ── 날짜 헬퍼 ────────────────────────────

function dateToStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function cellToStr(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  r.setDate(r.getDate() - r.getDay());
  return r;
}

function isMultiDay(e: Event) {
  return !!e.end_date && e.end_date > e.event_date;
}

function eventOverlapsDate(e: Event, dateStr: string) {
  const start = e.event_date;
  const end = e.end_date ?? e.event_date;
  return dateStr >= start && dateStr <= end;
}

function compareEvents(a: Event, b: Event): number {
  const d = a.event_date.localeCompare(b.event_date);
  if (d !== 0) return d;
  return (a.start_time ?? "").localeCompare(b.start_time ?? "");
}

// event_kind 별 색 매핑 — KIND_FILTERS·KIND_FILTER_BTN 색과 톤 일관
const KIND_BAR_COLOR: Record<string, string> = {
  "행사": "bg-blue-100 text-blue-700",
  "모임": "bg-green-100 text-green-700",
  "봉사": "bg-orange-100 text-orange-700",
  "순례": "bg-indigo-100 text-indigo-700",
  "피정": "bg-purple-100 text-purple-700",
  "강의": "bg-teal-100 text-teal-700",
  "기타": "bg-gray-100 text-gray-700",
};

const KIND_CHIP_COLOR: Record<string, string> = {
  "행사": "bg-blue-50 text-blue-700 border-blue-200",
  "모임": "bg-green-50 text-green-700 border-green-200",
  "봉사": "bg-orange-50 text-orange-700 border-orange-200",
  "순례": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "피정": "bg-purple-50 text-purple-700 border-purple-200",
  "강의": "bg-teal-50 text-teal-700 border-teal-200",
  "기타": "bg-gray-50 text-gray-700 border-gray-200",
};

function barStyle(e: Event): string {
  if (e.event_kind && KIND_BAR_COLOR[e.event_kind]) return KIND_BAR_COLOR[e.event_kind];
  return BAR_COLOR[e.category] ?? BAR_COLOR.general;
}

function chipStyle(e: Event): string {
  if (e.event_kind && KIND_CHIP_COLOR[e.event_kind]) return KIND_CHIP_COLOR[e.event_kind];
  return CHIP_COLOR[e.category] ?? CHIP_COLOR.general;
}

// ── 멀티데이 스패닝 ─────────────────────

interface Span {
  event: Event;
  colStart: number;
  colEnd: number;
  isStart: boolean;
  isEnd: boolean;
  lane: number;
}

function computeSpans(events: Event[], weekDates: (string | null)[]): Span[] {
  const raw: Omit<Span, "lane">[] = [];
  for (const ev of events) {
    if (!isMultiDay(ev)) continue;
    let firstCol = -1, lastCol = -1;
    for (let c = 0; c < 7; c++) {
      const d = weekDates[c];
      if (d && d >= ev.event_date && d <= ev.end_date!) {
        if (firstCol === -1) firstCol = c;
        lastCol = c;
      }
    }
    if (firstCol === -1) continue;
    raw.push({
      event: ev,
      colStart: firstCol + 1,
      colEnd: lastCol + 2,
      isStart: weekDates[firstCol] === ev.event_date,
      isEnd: weekDates[lastCol] === ev.end_date,
    });
  }
  raw.sort((a, b) => a.colStart - b.colStart || (b.colEnd - b.colStart) - (a.colEnd - a.colStart));
  const laneEnds: number[] = [];
  return raw.map(span => {
    let lane = laneEnds.findIndex(end => end <= span.colStart);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(0); }
    laneEnds[lane] = span.colEnd;
    return { ...span, lane };
  });
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// ── 월간 뷰 — 한 주 행 ──────────────────

function WeekRow({
  weekCells, year, month, events, todayStr, onSelect, onCreateForDate,
}: {
  weekCells: (number | null)[];
  year: number; month: number;
  events: Event[]; todayStr: string;
  onSelect: (e: Event) => void;
  onCreateForDate?: (dateStr: string) => void;
}) {
  const weekDates = weekCells.map(d => d ? cellToStr(year, month, d) : null);
  const spans = computeSpans(events, weekDates);
  const laneCount = spans.reduce((max, s) => Math.max(max, s.lane + 1), 0);

  const singleByDate: Record<string, Event[]> = {};
  for (const d of weekDates) {
    if (!d) continue;
    singleByDate[d] = events.filter(e => e.event_date === d && !isMultiDay(e));
  }

  const gridRows = laneCount > 0
    ? `28px repeat(${laneCount}, 22px) minmax(56px, auto)`
    : "28px minmax(56px, auto)";
  const singleRow = laneCount + 2;

  return (
    <div
      className="grid grid-cols-7 border-b border-[var(--color-border)] last:border-b-0"
      style={{ gridTemplateRows: gridRows }}
    >
      {weekCells.map((day, i) => {
        const d = weekDates[i];
        const isToday = d === todayStr;
        const clickable = !!(d && onCreateForDate);
        const NumberEl = clickable ? "button" : "span";
        return (
          <div
            key={`n${i}`}
            style={{ gridRow: 1, gridColumn: i + 1 }}
            className={`px-1.5 pt-1.5 pb-0.5 ${i < 6 ? "border-r border-[var(--color-border)]" : ""}`}
          >
            {day !== null && (
              <NumberEl
                {...(clickable ? { onClick: () => onCreateForDate!(d!), title: "이 날짜에 일정 추가" } : {})}
                className={`text-xs font-medium w-6 h-6 rounded-full inline-flex items-center justify-center ${
                  isToday ? "bg-[var(--color-primary)] text-white"
                  : i === 0 ? "text-red-500"
                  : i === 6 ? "text-blue-500"
                  : "text-[var(--color-text)]"
                } ${clickable ? "hover:bg-[var(--color-primary)] hover:text-white cursor-pointer transition-colors" : ""}`}
              >
                {day}
              </NumberEl>
            )}
          </div>
        );
      })}

      {/* lane row 영역의 column 세로선 — 멀티데이 스팬이 없는 컬럼에서도 세로 그리드 선 유지.
          z-index 음수로 멀티데이 바 아래에 둠. */}
      {laneCount > 0 && Array.from({ length: 7 }).map((_, i) => (
        <div
          key={`vline-${i}`}
          aria-hidden
          style={{ gridRow: `2 / span ${laneCount}`, gridColumn: i + 1 }}
          className={`pointer-events-none ${i < 6 ? "border-r border-[var(--color-border)]" : ""}`}
        />
      ))}

      {spans.map(span => (
        <button
          key={`s${span.event.id}-${span.lane}`}
          style={{
            gridColumnStart: span.colStart,
            gridColumnEnd: span.colEnd,
            gridRow: span.lane + 2,
            marginLeft: span.isStart ? 2 : 0,
            marginRight: span.isEnd ? 2 : 0,
          }}
          onClick={() => onSelect(span.event)}
          className={`relative my-0.5 h-5 px-1.5 text-[10px] leading-5 font-medium truncate text-left
            ${span.isStart ? "rounded-l-sm" : "rounded-l-none"}
            ${span.isEnd ? "rounded-r-sm" : "rounded-r-none"}
            ${barStyle(span.event)}`}
        >
          {span.event.title}
        </button>
      ))}

      {weekCells.map((day, i) => {
        const d = weekDates[i];
        const dayEvs = d ? singleByDate[d] ?? [] : [];
        return (
          <div
            key={`c${i}`}
            style={{ gridRow: singleRow, gridColumn: i + 1 }}
            className={`p-1 overflow-hidden ${i < 6 ? "border-r border-[var(--color-border)]" : ""} ${!day ? "bg-gray-50/40" : ""}`}
          >
            {dayEvs.slice(0, 2).map(e => (
              <button
                key={e.id}
                onClick={() => onSelect(e)}
                className={`w-full text-left text-[10px] px-1.5 py-0.5 rounded truncate border mb-0.5 block ${chipStyle(e)}`}
              >
                {e.title}
              </button>
            ))}
            {dayEvs.length > 2 && (
              <p className="text-[10px] text-[var(--color-text-muted)] pl-1">+{dayEvs.length - 2}개</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── 월간 뷰 ─────────────────────────────

function MonthView({
  year, month, events, todayStr, onSelect, onCreateForDate,
}: {
  year: number; month: number;
  events: Event[]; todayStr: string;
  onSelect: (e: Event) => void;
  onCreateForDate?: (dateStr: string) => void;
}) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow = new Date(year, month - 1, 1).getDay();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div className="bg-white border border-[var(--color-border)] rounded-xl overflow-hidden">
      <div className="grid grid-cols-7 border-b border-[var(--color-border)]">
        {WEEKDAYS.map((d, i) => (
          <div
            key={d}
            className={`py-2 text-center text-xs font-medium ${i < 6 ? "border-r border-[var(--color-border)]" : ""} ${
              i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-[var(--color-text-muted)]"
            }`}
          >
            {d}
          </div>
        ))}
      </div>
      {weeks.map((weekCells, wi) => (
        <WeekRow
          key={wi}
          weekCells={weekCells}
          year={year}
          month={month}
          events={events}
          todayStr={todayStr}
          onSelect={onSelect}
          onCreateForDate={onCreateForDate}
        />
      ))}
    </div>
  );
}

// ── 주간 뷰 ─────────────────────────────

function WeekView({
  weekStart, events, todayStr, onSelect, onCreateForDate,
}: {
  weekStart: Date; events: Event[]; todayStr: string;
  onSelect: (e: Event) => void;
  onCreateForDate?: (dateStr: string) => void;
}) {
  const dates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dateStrs = dates.map(dateToStr);
  const spans = computeSpans(events, dateStrs);
  const laneCount = spans.reduce((m, s) => Math.max(m, s.lane + 1), 0);

  const singleByDate: Record<string, Event[]> = {};
  for (const ds of dateStrs) {
    singleByDate[ds] = events.filter(e => e.event_date === ds && !isMultiDay(e))
      .sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));
  }

  const gridRows = laneCount > 0
    ? `repeat(${laneCount}, 24px) minmax(180px, auto)`
    : "minmax(180px, auto)";
  const singleRow = laneCount + 1;

  return (
    <div className="bg-white border border-[var(--color-border)] rounded-xl overflow-hidden">
      {/* 헤더 */}
      <div className="grid grid-cols-7 border-b border-[var(--color-border)]">
        {dates.map((d, i) => {
          const ds = dateStrs[i];
          const isToday = ds === todayStr;
          return (
            <div key={i} className={`py-2.5 text-center ${i < 6 ? "border-r border-[var(--color-border)]" : ""}`}>
              <div className={`text-[11px] font-medium mb-0.5 ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-[var(--color-text-muted)]"}`}>
                {WEEKDAYS[i]}
              </div>
              {onCreateForDate ? (
                <button
                  onClick={() => onCreateForDate(ds)}
                  title="이 날짜에 일정 추가"
                  className={`text-sm font-semibold w-7 h-7 rounded-full inline-flex items-center justify-center cursor-pointer transition-colors hover:bg-[var(--color-primary)] hover:text-white ${
                    isToday ? "bg-[var(--color-primary)] text-white"
                    : i === 0 ? "text-red-500"
                    : i === 6 ? "text-blue-500"
                    : "text-[var(--color-text)]"
                  }`}
                >
                  {d.getDate()}
                </button>
              ) : (
                <span className={`text-sm font-semibold w-7 h-7 rounded-full inline-flex items-center justify-center ${
                  isToday ? "bg-[var(--color-primary)] text-white"
                  : i === 0 ? "text-red-500"
                  : i === 6 ? "text-blue-500"
                  : "text-[var(--color-text)]"
                }`}>
                  {d.getDate()}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* 본문: 멀티데이 스패닝 + 단일 이벤트 */}
      <div className="grid grid-cols-7" style={{ gridTemplateRows: gridRows }}>
        {/* lane row 영역의 column 세로선 유지 — 멀티데이 스팬 없는 컬럼에서도 세로선 표시 */}
        {laneCount > 0 && Array.from({ length: 7 }).map((_, i) => (
          <div
            key={`vline-${i}`}
            aria-hidden
            style={{ gridRow: `1 / span ${laneCount}`, gridColumn: i + 1 }}
            className={`pointer-events-none ${i < 6 ? "border-r border-[var(--color-border)]" : ""}`}
          />
        ))}

        {spans.map(span => (
          <button
            key={`s${span.event.id}-${span.lane}`}
            style={{
              gridColumnStart: span.colStart,
              gridColumnEnd: span.colEnd,
              gridRow: span.lane + 1,
              marginLeft: span.isStart ? 4 : 0,
              marginRight: span.isEnd ? 4 : 0,
            }}
            onClick={() => onSelect(span.event)}
            className={`relative my-1 h-5 px-2 text-[11px] leading-5 font-medium truncate text-left
              ${span.isStart ? "rounded-l-md" : "rounded-l-none"}
              ${span.isEnd ? "rounded-r-md" : "rounded-r-none"}
              ${barStyle(span.event)}`}
          >
            {span.event.title}
          </button>
        ))}

        {dateStrs.map((ds, i) => {
          const dayEvs = singleByDate[ds] ?? [];
          return (
            <div
              key={`c${i}`}
              style={{ gridRow: singleRow, gridColumn: i + 1 }}
              className={`p-1.5 space-y-1 ${i < 6 ? "border-r border-[var(--color-border)]" : ""}`}
            >
              {dayEvs.map(e => (
                <button
                  key={e.id}
                  onClick={() => onSelect(e)}
                  className={`w-full text-left text-[11px] px-1.5 py-1 rounded border block ${chipStyle(e)}`}
                >
                  <div className="truncate font-medium leading-tight">{e.title}</div>
                  {e.start_time && (
                    <div className="text-[10px] opacity-75 mt-0.5">{e.start_time}</div>
                  )}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 일간 뷰 ─────────────────────────────

function DayView({
  date, events, todayStr, onSelect, onCreateForDate,
}: {
  date: Date; events: Event[]; todayStr: string;
  onSelect: (e: Event) => void;
  onCreateForDate?: (dateStr: string) => void;
}) {
  const dateStr = dateToStr(date);
  const isToday = dateStr === todayStr;
  const dow = date.getDay();
  const dayEvents = events
    .filter(e => eventOverlapsDate(e, dateStr))
    .sort((a, b) => {
      // 멀티데이 시작일 먼저, 그 다음 시간순
      const aMulti = isMultiDay(a) ? 0 : 1;
      const bMulti = isMultiDay(b) ? 0 : 1;
      if (aMulti !== bMulti) return aMulti - bMulti;
      return (a.start_time ?? "").localeCompare(b.start_time ?? "");
    });

  return (
    <div className="bg-white border border-[var(--color-border)] rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center gap-3">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
          isToday ? "bg-[var(--color-primary)] text-white"
          : dow === 0 ? "bg-red-50 text-red-600"
          : dow === 6 ? "bg-blue-50 text-blue-600"
          : "bg-gray-100 text-[var(--color-text)]"
        }`}>
          {date.getDate()}
        </div>
        <div className="flex-1">
          <p className="text-sm text-[var(--color-text-muted)]">
            {date.getFullYear()}년 {date.getMonth() + 1}월
          </p>
          <p className={`text-base font-bold ${dow === 0 ? "text-red-500" : dow === 6 ? "text-blue-500" : "text-[var(--color-text)]"}`}>
            {WEEKDAYS[dow]}요일 {isToday && <span className="ml-1 text-xs text-[var(--color-primary)]">(오늘)</span>}
          </p>
        </div>
        {onCreateForDate && (
          <button
            onClick={() => onCreateForDate(dateStr)}
            className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-light)] transition-colors"
          >
            + 일정 추가
          </button>
        )}
      </div>

      {dayEvents.length === 0 ? (
        <p className="text-center text-sm text-[var(--color-text-muted)] py-12">등록된 일정이 없습니다.</p>
      ) : (
        <div className="divide-y divide-[var(--color-border)]">
          {dayEvents.map(e => {
            const multi = isMultiDay(e);
            const isStartDay = e.event_date === dateStr;
            const isEndDay = e.end_date === dateStr;
            return (
              <button
                key={e.id}
                onClick={() => onSelect(e)}
                className="w-full px-5 py-3.5 hover:bg-gray-50 text-left transition-colors flex items-center gap-3"
              >
                <div className={`w-1 self-stretch rounded-full ${barStyle(e).split(" ")[0]}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <KindBadge kind={e.event_kind} />
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${CHIP_COLOR[e.category] ?? CHIP_COLOR.general}`}>
                      {CATEGORY_LABEL[e.category] ?? "일반"}
                    </span>
                    {multi && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">
                        {isStartDay ? "시작" : isEndDay ? "종료" : "진행 중"}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-[var(--color-text)] truncate">{e.title}</p>
                  {(e.start_time || e.location) && (
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {e.start_time && <span>🕐 {e.start_time}</span>}
                      {e.start_time && e.location && <span className="mx-1.5">·</span>}
                      {e.location && <span>📍 {e.location}</span>}
                    </p>
                  )}
                  {multi && (
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {new Date(e.event_date).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
                      {" ~ "}
                      {new Date(e.end_date!).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
                    </p>
                  )}
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${STATUS_BADGE[e.status] ?? STATUS_BADGE["예정"]}`}>
                  {e.status}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── 목록 뷰 ─────────────────────────────

function ListView({
  events, onSelect, onCreateForDate,
}: {
  events: Event[]; onSelect: (e: Event) => void;
  onCreateForDate?: () => void;
}) {
  const sorted = [...events].sort(compareEvents);
  // 날짜별 그룹
  const groups = new Map<string, Event[]>();
  for (const e of sorted) {
    const arr = groups.get(e.event_date) ?? [];
    arr.push(e);
    groups.set(e.event_date, arr);
  }

  if (sorted.length === 0) {
    return (
      <div className="bg-white border border-[var(--color-border)] rounded-xl p-12 text-center">
        <p className="text-sm text-[var(--color-text-muted)]">등록된 일정이 없습니다.</p>
        {onCreateForDate && (
          <button
            onClick={onCreateForDate}
            className="mt-4 text-xs px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-light)] transition-colors"
          >
            + 새 일정 추가
          </button>
        )}
      </div>
    );
  }

  return (
    <>
    {onCreateForDate && (
      <div className="mb-3 flex justify-end">
        <button
          onClick={onCreateForDate}
          className="text-xs px-3 py-1.5 rounded-lg bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-light)] transition-colors"
        >
          + 새 일정 추가
        </button>
      </div>
    )}
    <div className="bg-white border border-[var(--color-border)] rounded-xl overflow-hidden divide-y divide-[var(--color-border)]">
      {Array.from(groups.entries()).map(([dateStr, evs]) => {
        const d = new Date(dateStr);
        const dow = d.getDay();
        return (
          <div key={dateStr} className="flex">
            <div className="w-20 sm:w-24 shrink-0 bg-gray-50/60 px-3 py-3 border-r border-[var(--color-border)]">
              <p className={`text-[11px] font-medium ${dow === 0 ? "text-red-500" : dow === 6 ? "text-blue-500" : "text-[var(--color-text-muted)]"}`}>
                {d.getMonth() + 1}월 {d.getDate()}일
              </p>
              <p className={`text-xs mt-0.5 ${dow === 0 ? "text-red-500" : dow === 6 ? "text-blue-500" : "text-[var(--color-text-muted)]"}`}>
                {WEEKDAYS[dow]}요일
              </p>
            </div>
            <div className="flex-1 divide-y divide-[var(--color-border)]/60">
              {evs.map(e => (
                <button
                  key={e.id}
                  onClick={() => onSelect(e)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <KindBadge kind={e.event_kind} />
                      <p className="text-sm font-medium text-[var(--color-text)] truncate">{e.title}</p>
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {e.start_time && <span>🕐 {e.start_time}</span>}
                      {e.start_time && e.location && <span className="mx-1.5">·</span>}
                      {e.location && <span>📍 {e.location}</span>}
                      {e.end_date && e.end_date !== e.event_date && (
                        <span className="ml-1.5">~ {new Date(e.end_date).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}</span>
                      )}
                    </p>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${STATUS_BADGE[e.status] ?? STATUS_BADGE["예정"]}`}>
                    {e.status}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
    </>
  );
}

// ── 메인 페이지 ──────────────────────────

const KIND_FILTERS = [
  { value: "all", label: "전체" },
  { value: "행사", label: "행사" },
  { value: "모임", label: "모임" },
  { value: "봉사", label: "봉사" },
  { value: "순례", label: "순례" },
  { value: "피정", label: "피정" },
  { value: "강의", label: "강의" },
  { value: "기타", label: "기타" },
];

// 필터 칩 활성 시 배경색 (event_kind 별) — barStyle/chipStyle 와 톤 일관
const KIND_FILTER_BTN: Record<string, string> = {
  "행사": "bg-blue-600 text-white border-blue-600",
  "모임": "bg-green-600 text-white border-green-600",
  "봉사": "bg-orange-500 text-white border-orange-500",
  "순례": "bg-indigo-500 text-white border-indigo-500",
  "피정": "bg-purple-500 text-white border-purple-500",
  "강의": "bg-teal-500 text-white border-teal-500",
  "기타": "bg-gray-500 text-white border-gray-500",
};

const VIEW_TABS: { value: ViewMode; label: string }[] = [
  { value: "month", label: "월" },
  { value: "week", label: "주" },
  { value: "day", label: "일" },
  { value: "list", label: "목록" },
];

export default function CalendarPage() {
  const today = new Date();
  const todayStr = dateToStr(today);
  const { currentGroup } = useNavigation();
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();
  // 모바일(<768px)에서는 월간 그리드가 답답해 첫 진입 시 자동 'list' 뷰로.
  // 사용자가 다른 뷰 토글하면 그대로 사용.
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.innerWidth < 768) setViewMode("list");
  }, []);
  const [cursor, setCursor] = useState<Date>(today);
  const [events, setEvents] = useState<Event[]>([]);
  const [selected, setSelected] = useState<Event | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterKind, setFilterKind] = useState("all");
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<{
    title: string; event_date: string; end_date: string;
    start_time: string; location: string; description: string;
  }>({ title: "", event_date: "", end_date: "", start_time: "", location: "", description: "" });
  // 신규 등록 모달 (운영자 이상이 캘린더 날짜를 클릭하면 열림)
  const [creatingDate, setCreatingDate] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<{
    title: string; event_date: string; end_date: string;
    start_time: string; location: string; description: string;
    category: string; event_kind: string;
  }>({ title: "", event_date: "", end_date: "", start_time: "", location: "", description: "", category: "general", event_kind: "행사" });

  // 운영자 이상 권한 — 슈퍼관리자(admin_token) OR 운영자(session.isAdmin)
  const { data: session } = useSession();
  const [adminToken, setAdminToken] = useState<string | null>(null);
  useEffect(() => {
    try {
      const t = localStorage.getItem("admin_token");
      const expStr = localStorage.getItem("admin_token_exp");
      const exp = expStr ? Number(expStr) : 0;
      if (t && exp && Date.now() < exp) setAdminToken(t);
    } catch {}
  }, []);
  const isDelegatedAdmin = !!(session as { isAdmin?: boolean } | null)?.isAdmin;
  const canManage = !!adminToken || isDelegatedAdmin;
  const authToken = adminToken ?? (session as { accessToken?: string } | null)?.accessToken ?? "";

  function startEditEvent() {
    if (!selected) return;
    setEditForm({
      title: selected.title,
      event_date: selected.event_date,
      end_date: selected.end_date ?? "",
      start_time: selected.start_time ?? "",
      location: selected.location ?? "",
      description: selected.description ?? "",
    });
    setEditing(true);
  }

  async function handleSaveEvent() {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/events/${selected.id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editForm.title.trim(),
          description: editForm.description,
          event_date: editForm.event_date,
          end_date: editForm.end_date || null,
          start_time: editForm.start_time || null,
          location: editForm.location || null,
          category: selected.category,
          is_public: true,
          event_kind: selected.event_kind ?? null,
        }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail ?? "저장 실패");
      }
      const updated = await res.json();
      setEvents((prev) => prev.map((e) => (e.id === selected.id ? { ...e, ...updated } : e)));
      setSelected({ ...selected, ...updated });
      setEditing(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  function openCreateForDate(dateStr: string) {
    if (!canManage) return;
    setCreateForm({
      title: "", event_date: dateStr, end_date: "", start_time: "",
      location: "", description: "", category: "general", event_kind: "행사",
    });
    setCreatingDate(dateStr);
  }

  async function handleCreateEvent() {
    if (!creatingDate) return;
    if (!createForm.title.trim() || !createForm.event_date) {
      alert("제목과 날짜는 필수입니다.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/events/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: createForm.title.trim(),
          description: createForm.description || null,
          event_date: createForm.event_date,
          end_date: createForm.end_date || null,
          start_time: createForm.start_time || null,
          location: createForm.location || null,
          category: createForm.category,
          is_public: true,
          event_kind: createForm.event_kind || null,
        }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail ?? "등록 실패");
      }
      const created = await res.json();
      setEvents((prev) => [...prev, created]);
      setCreatingDate(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "등록에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteEvent() {
    if (!selected) return;
    if (!confirm(`'${selected.title}' 행사를 삭제하시겠습니까?\n복구할 수 없습니다.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API}/api/events/${selected.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail ?? "삭제 실패");
      }
      // 로컬 state 에서 제거 + 모달 닫기
      setEvents((prev) => prev.filter((e) => e.id !== selected.id));
      setSelected(null);
      setEditing(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "삭제에 실패했습니다.");
    } finally {
      setDeleting(false);
    }
  }
  // 빠른 년월 선택 팝오버
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState<number>(today.getFullYear());
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    function onDocClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [pickerOpen]);

  // viewMode/cursor 변경 시 필요한 월 fetch
  useEffect(() => {
    setLoading(true);

    const monthsKeys = new Set<string>();
    if (viewMode === "week") {
      const ws = startOfWeek(cursor);
      const we = addDays(ws, 6);
      monthsKeys.add(`${ws.getFullYear()}-${ws.getMonth() + 1}`);
      monthsKeys.add(`${we.getFullYear()}-${we.getMonth() + 1}`);
    } else {
      monthsKeys.add(`${cursor.getFullYear()}-${cursor.getMonth() + 1}`);
    }

    Promise.all(
      Array.from(monthsKeys).map(key => {
        const [y, m] = key.split("-").map(Number);
        return fetch(`${API}/api/events/?year=${y}&month=${m}`)
          .then(r => r.ok ? r.json() : [])
          .catch(() => []);
      })
    )
      .then(results => {
        const merged: Event[] = [];
        const seen = new Set<number>();
        for (const arr of results) {
          if (!Array.isArray(arr)) continue;
          for (const e of arr) {
            if (!seen.has(e.id)) { seen.add(e.id); merged.push(e); }
          }
        }
        setEvents(merged);
      })
      .finally(() => setLoading(false));
  }, [viewMode, cursor]);

  function navigate(dir: number) {
    setCursor(c => {
      if (viewMode === "month" || viewMode === "list") {
        const r = new Date(c);
        r.setDate(1);
        r.setMonth(r.getMonth() + dir);
        return r;
      }
      if (viewMode === "week") return addDays(c, dir * 7);
      return addDays(c, dir);
    });
  }

  function navigationLabel(): string {
    if (viewMode === "month" || viewMode === "list") {
      return `${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월`;
    }
    if (viewMode === "week") {
      const ws = startOfWeek(cursor);
      const we = addDays(ws, 6);
      const sameMonth = ws.getMonth() === we.getMonth();
      return sameMonth
        ? `${ws.getMonth() + 1}월 ${ws.getDate()}일 ~ ${we.getDate()}일`
        : `${ws.getMonth() + 1}/${ws.getDate()} ~ ${we.getMonth() + 1}/${we.getDate()}`;
    }
    return `${cursor.getMonth() + 1}월 ${cursor.getDate()}일 (${WEEKDAYS[cursor.getDay()]})`;
  }

  // 필터링 — 뷰별 적절한 범위로 한정
  const filtered = (() => {
    let pool = events;
    if (filterKind !== "all") pool = pool.filter(e => e.event_kind === filterKind);

    if (viewMode === "week") {
      const ws = dateToStr(startOfWeek(cursor));
      const we = dateToStr(addDays(startOfWeek(cursor), 6));
      return pool.filter(e => {
        const start = e.event_date;
        const end = e.end_date ?? e.event_date;
        return !(end < ws || start > we);
      });
    }
    if (viewMode === "day") {
      const ds = dateToStr(cursor);
      return pool.filter(e => eventOverlapsDate(e, ds));
    }
    // month/list — 그 달 + 멀티데이로 그 달과 겹치는 것
    const y = cursor.getFullYear();
    const m = cursor.getMonth() + 1;
    const first = `${y}-${String(m).padStart(2, "0")}-01`;
    const last = `${y}-${String(m).padStart(2, "0")}-${new Date(y, m, 0).getDate()}`;
    return pool.filter(e => {
      const start = e.event_date;
      const end = e.end_date ?? e.event_date;
      return !(end < first || start > last);
    });
  })();

  return (
    <>
      <PageHeader
        group="알림과 게시판"
        title="행사·모임 일정"
        subtitle="본당 행사와 모임 일정을 확인하세요."
        action={
          <div className="flex items-center gap-2 relative" ref={pickerRef}>
            <button
              onClick={() => navigate(-1)}
              className="p-1.5 rounded hover:bg-[var(--color-surface-warm)] transition-colors text-[var(--color-text)] text-lg leading-none"
              aria-label="이전"
            >‹</button>
            <button
              type="button"
              onClick={() => {
                if (!pickerOpen) setPickerYear(cursor.getFullYear());
                setPickerOpen(v => !v);
              }}
              className="text-sm font-semibold text-[var(--color-primary)] min-w-[130px] text-center hover:bg-[var(--color-surface-warm)] rounded px-2 py-1 transition-colors"
              title="년월 빠른 선택"
            >
              {navigationLabel()} ▾
            </button>
            <button
              onClick={() => navigate(1)}
              className="p-1.5 rounded hover:bg-[var(--color-surface-warm)] transition-colors text-[var(--color-text)] text-lg leading-none"
              aria-label="다음"
            >›</button>

            {/* 년월 빠른 선택 팝오버 — 월/목록 모드에서만 활성 */}
            {pickerOpen && (
              <div className="absolute top-full right-0 mt-1 z-50 w-64 bg-white border border-[var(--color-border)] rounded-xl shadow-xl p-3">
                {/* 년도 헤더 */}
                <div className="flex items-center justify-between mb-3">
                  <button
                    type="button"
                    onClick={() => setPickerYear(y => y - 1)}
                    className="px-2 py-1 rounded hover:bg-gray-100 text-[var(--color-text)]"
                  >‹</button>
                  <button
                    type="button"
                    onClick={() => {
                      setCursor(new Date());
                      setPickerOpen(false);
                    }}
                    className="text-sm font-semibold text-[var(--color-primary)] hover:underline"
                    title="오늘로"
                  >
                    {pickerYear}년
                  </button>
                  <button
                    type="button"
                    onClick={() => setPickerYear(y => y + 1)}
                    className="px-2 py-1 rounded hover:bg-gray-100 text-[var(--color-text)]"
                  >›</button>
                </div>

                {/* 빠른 년도 점프 (-10, -5, 올해) */}
                <div className="flex justify-between text-[11px] text-[var(--color-text-muted)] mb-3 px-1">
                  <button
                    type="button"
                    onClick={() => setPickerYear(today.getFullYear() - 10)}
                    className="hover:text-[var(--color-primary)]"
                  >-10년</button>
                  <button
                    type="button"
                    onClick={() => setPickerYear(today.getFullYear() - 5)}
                    className="hover:text-[var(--color-primary)]"
                  >-5년</button>
                  <button
                    type="button"
                    onClick={() => setPickerYear(today.getFullYear() - 1)}
                    className="hover:text-[var(--color-primary)]"
                  >작년</button>
                  <button
                    type="button"
                    onClick={() => setPickerYear(today.getFullYear())}
                    className="hover:text-[var(--color-primary)] font-medium"
                  >올해</button>
                </div>

                {/* 12개월 그리드 */}
                <div className="grid grid-cols-4 gap-1.5">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                    const isCurrent = pickerYear === cursor.getFullYear() && m === cursor.getMonth() + 1;
                    const isToday = pickerYear === today.getFullYear() && m === today.getMonth() + 1;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setCursor(new Date(pickerYear, m - 1, 1));
                          setPickerOpen(false);
                        }}
                        className={`py-2 text-xs rounded transition-colors ${
                          isCurrent
                            ? "bg-[var(--color-primary)] text-white"
                            : isToday
                            ? "border border-[var(--color-primary)] text-[var(--color-primary)] bg-white"
                            : "hover:bg-[var(--color-surface-warm)] text-[var(--color-text)]"
                        }`}
                      >
                        {m}월
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        }
      />

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:gap-10">
          {currentGroup && currentGroup.items.length > 0 && (
            <div
              className={`shrink-0 md:relative md:transition-[width,opacity] md:duration-300 md:ease-out ${
                collapsed ? "md:w-0 md:opacity-0" : "md:w-[var(--sidebar-w)] md:opacity-100"
              }`}
              style={{ ["--sidebar-w" as string]: `${currentGroup.sidebar_width_px}px` } as React.CSSProperties}
              aria-hidden={collapsed ? true : undefined}
            >
              <SidebarCollapseTab collapsed={collapsed} onToggle={toggleCollapsed} />
              <div className="md:overflow-hidden">
                <SectionSidebar
                  groupTitle={currentGroup.label}
                  imageSrc={currentGroup.sidebar_image_url ?? undefined}
                  widthPx={currentGroup.sidebar_width_px}
                  heightPx={currentGroup.sidebar_height_px ?? undefined}
                  imagePosition={currentGroup.sidebar_image_position}
                  items={currentGroup.items}
                />
              </div>
            </div>
          )}
          <div className="flex-1 min-w-0 mt-6 md:mt-0 md:relative">
            {collapsed && currentGroup && currentGroup.items.length > 0 && (
              <SidebarCollapseTab collapsed={collapsed} onToggle={toggleCollapsed} />
            )}
            <BannerSlider placement="calendar_top" className="mb-6" />
        {/* 보기 모드 토글 + 오늘 */}
        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
          <div className="inline-flex bg-gray-100 rounded-lg p-0.5">
            {VIEW_TABS.map(t => (
              <button
                key={t.value}
                onClick={() => setViewMode(t.value)}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  viewMode === t.value
                    ? "bg-white text-[var(--color-primary)] font-semibold shadow-sm"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setCursor(new Date())}
            className="text-xs px-3 py-1.5 border border-[var(--color-border)] rounded-md hover:bg-gray-50 bg-white"
          >
            오늘
          </button>
        </div>

        {/* 구분 필터 칩 */}
        <div className="flex flex-wrap gap-2 mb-5">
          {KIND_FILTERS.map(f => {
            const count = f.value === "all"
              ? filtered.length
              : filtered.filter(e => e.event_kind === f.value).length;
            const total = f.value === "all"
              ? events.length
              : events.filter(e => e.event_kind === f.value).length;
            return (
              <button
                key={f.value}
                onClick={() => setFilterKind(f.value)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  filterKind === f.value
                    ? KIND_FILTER_BTN[f.value]
                      ?? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                    : "border-[var(--color-border)] bg-white hover:bg-gray-50"
                }`}
              >
                {f.label}
                {total > 0 && <span className="ml-1 opacity-75">({total})</span>}
              </button>
            );
          })}
        </div>

        {/* 본문 */}
        {loading ? (
          <p className="text-center text-sm text-[var(--color-text-muted)] py-12">불러오는 중…</p>
        ) : viewMode === "month" ? (
          <MonthView
            year={cursor.getFullYear()}
            month={cursor.getMonth() + 1}
            events={filtered}
            todayStr={todayStr}
            onSelect={setSelected}
            onCreateForDate={canManage ? openCreateForDate : undefined}
          />
        ) : viewMode === "week" ? (
          <WeekView
            weekStart={startOfWeek(cursor)}
            events={filtered}
            todayStr={todayStr}
            onSelect={setSelected}
            onCreateForDate={canManage ? openCreateForDate : undefined}
          />
        ) : viewMode === "day" ? (
          <DayView
            date={cursor}
            events={filtered}
            todayStr={todayStr}
            onSelect={setSelected}
            onCreateForDate={canManage ? openCreateForDate : undefined}
          />
        ) : (
          <ListView
            events={filtered}
            onSelect={setSelected}
            onCreateForDate={canManage ? () => openCreateForDate(todayStr) : undefined}
          />
        )}

        {/* 상세 모달 */}
        {selected && (
          <div
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => { setSelected(null); setEditing(false); }}
          >
            <div
              className={`bg-white rounded-2xl p-6 w-full shadow-xl ${editing ? "max-w-md" : "max-w-sm"}`}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <KindBadge kind={selected.event_kind} />
                  <span className={`text-xs px-2 py-1 rounded border ${CHIP_COLOR[selected.category] ?? CHIP_COLOR.general}`}>
                    {CATEGORY_LABEL[selected.category] ?? "일반"}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded border ${STATUS_BADGE[selected.status] ?? STATUS_BADGE["예정"]}`}>
                    {selected.status}
                  </span>
                </div>
                <button onClick={() => setSelected(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">✕</button>
              </div>
              <h3 className="text-lg font-bold text-[var(--color-primary)] mb-3">{selected.title}</h3>
              <div className="space-y-2 text-sm text-[var(--color-text-muted)]">
                <p>
                  📅 {new Date(selected.event_date).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
                  {selected.end_date && selected.end_date !== selected.event_date
                    ? ` ~ ${new Date(selected.end_date).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}`
                    : ""}
                  {selected.start_time && ` ${selected.start_time}`}
                </p>
                {selected.location && <p>📍 {selected.location}</p>}
                {selected.description && (
                  <div className="mt-3">
                    <MarkdownContent content={selected.description} />
                  </div>
                )}
              </div>

              {canManage && !editing && (
                <div className="mt-5 pt-4 border-t border-[var(--color-border)] flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={startEditEvent}
                    className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-primary)] transition-colors"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteEvent}
                    disabled={deleting}
                    className="text-xs px-3 py-1.5 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors"
                  >
                    {deleting ? "삭제 중…" : "삭제"}
                  </button>
                </div>
              )}

              {canManage && editing && (
                <div className="mt-4 space-y-2 border-t border-[var(--color-border)] pt-4">
                  <p className="text-xs font-semibold text-[var(--color-primary)]">편집 중</p>
                  <input
                    value={editForm.title}
                    onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder="제목"
                    className="w-full border border-[var(--color-border)] rounded-md px-2 py-1.5 text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={editForm.event_date}
                      onChange={(e) => setEditForm((p) => ({ ...p, event_date: e.target.value }))}
                      className="border border-[var(--color-border)] rounded-md px-2 py-1.5 text-sm"
                    />
                    <input
                      type="date"
                      value={editForm.end_date}
                      onChange={(e) => setEditForm((p) => ({ ...p, end_date: e.target.value }))}
                      placeholder="종료일 (선택)"
                      className="border border-[var(--color-border)] rounded-md px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={editForm.start_time}
                      onChange={(e) => setEditForm((p) => ({ ...p, start_time: e.target.value }))}
                      placeholder="시간 (예: 19:30)"
                      className="border border-[var(--color-border)] rounded-md px-2 py-1.5 text-sm"
                    />
                    <input
                      value={editForm.location}
                      onChange={(e) => setEditForm((p) => ({ ...p, location: e.target.value }))}
                      placeholder="장소"
                      className="border border-[var(--color-border)] rounded-md px-2 py-1.5 text-sm"
                    />
                  </div>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                    rows={6}
                    placeholder="설명"
                    className="w-full border border-[var(--color-border)] rounded-md px-2 py-1.5 text-sm resize-y"
                  />
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleSaveEvent}
                      disabled={saving || !editForm.title.trim() || !editForm.event_date}
                      className="flex-1 text-xs px-3 py-1.5 bg-[var(--color-primary)] text-white rounded-md font-medium hover:bg-[var(--color-primary-light)] disabled:opacity-50"
                    >
                      {saving ? "저장 중…" : "저장"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      disabled={saving}
                      className="text-xs px-3 py-1.5 border border-[var(--color-border)] rounded-md disabled:opacity-50"
                    >
                      취소
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 신규 등록 모달 — 운영자 이상이 캘린더 날짜를 클릭하면 열림 */}
        {creatingDate && canManage && (
          <div
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => !saving && setCreatingDate(null)}
          >
            <div
              className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-bold text-[var(--color-primary)]">새 일정 추가</h3>
                <button
                  onClick={() => !saving && setCreatingDate(null)}
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                >✕</button>
              </div>
              <div className="space-y-2">
                <input
                  value={createForm.title}
                  onChange={(e) => setCreateForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="제목 *"
                  className="w-full border border-[var(--color-border)] rounded-md px-2 py-1.5 text-sm"
                  autoFocus
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={createForm.event_date}
                    onChange={(e) => setCreateForm((p) => ({ ...p, event_date: e.target.value }))}
                    className="border border-[var(--color-border)] rounded-md px-2 py-1.5 text-sm"
                  />
                  <input
                    type="date"
                    value={createForm.end_date}
                    onChange={(e) => setCreateForm((p) => ({ ...p, end_date: e.target.value }))}
                    placeholder="종료일 (선택)"
                    className="border border-[var(--color-border)] rounded-md px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={createForm.start_time}
                    onChange={(e) => setCreateForm((p) => ({ ...p, start_time: e.target.value }))}
                    placeholder="시간 (예: 19:30)"
                    className="border border-[var(--color-border)] rounded-md px-2 py-1.5 text-sm"
                  />
                  <input
                    value={createForm.location}
                    onChange={(e) => setCreateForm((p) => ({ ...p, location: e.target.value }))}
                    placeholder="장소"
                    className="border border-[var(--color-border)] rounded-md px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={createForm.event_kind}
                    onChange={(e) => setCreateForm((p) => ({ ...p, event_kind: e.target.value }))}
                    className="border border-[var(--color-border)] rounded-md px-2 py-1.5 text-sm bg-white"
                  >
                    <option value="행사">분류: 행사</option>
                    <option value="모임">분류: 모임</option>
                    <option value="">분류 없음</option>
                  </select>
                  <select
                    value={createForm.category}
                    onChange={(e) => setCreateForm((p) => ({ ...p, category: e.target.value }))}
                    className="border border-[var(--color-border)] rounded-md px-2 py-1.5 text-sm bg-white"
                  >
                    <option value="general">카테고리: 일반</option>
                    <option value="liturgy">카테고리: 전례</option>
                    <option value="community">카테고리: 공동체</option>
                    <option value="education">카테고리: 교육</option>
                    <option value="special">카테고리: 특별행사</option>
                  </select>
                </div>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
                  rows={5}
                  placeholder="설명 (선택)"
                  className="w-full border border-[var(--color-border)] rounded-md px-2 py-1.5 text-sm resize-y"
                />
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleCreateEvent}
                    disabled={saving || !createForm.title.trim() || !createForm.event_date}
                    className="flex-1 text-xs px-3 py-1.5 bg-[var(--color-primary)] text-white rounded-md font-medium hover:bg-[var(--color-primary-light)] disabled:opacity-50"
                  >
                    {saving ? "등록 중…" : "등록"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreatingDate(null)}
                    disabled={saving}
                    className="text-xs px-3 py-1.5 border border-[var(--color-border)] rounded-md disabled:opacity-50"
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
          </div>
        </div>
      </div>
    </>
  );
}
