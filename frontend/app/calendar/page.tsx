"use client";
import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";

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

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isMultiDay(e: Event) {
  return !!e.end_date && e.end_date > e.event_date;
}

function barStyle(e: Event): string {
  if (e.event_kind === "모임") return "bg-green-100 text-green-700";
  if (e.event_kind === "행사") return "bg-blue-100 text-blue-700";
  return BAR_COLOR[e.category] ?? BAR_COLOR.general;
}

function chipStyle(e: Event): string {
  if (e.event_kind === "모임") return "bg-green-50 text-green-700 border-green-200";
  if (e.event_kind === "행사") return "bg-blue-50 text-blue-700 border-blue-200";
  return CHIP_COLOR[e.category] ?? CHIP_COLOR.general;
}

// ── 멀티데이 스패닝 계산 ─────────────────────────────

interface Span {
  event: Event;
  colStart: number; // 1-indexed CSS grid
  colEnd: number;   // exclusive
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

  // 시작 열 순서, 같으면 긴 것 먼저
  raw.sort((a, b) => a.colStart - b.colStart || (b.colEnd - b.colStart) - (a.colEnd - a.colStart));

  // 레인(행) 배정 — greedy
  const laneEnds: number[] = [];
  return raw.map(span => {
    let lane = laneEnds.findIndex(end => end <= span.colStart);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(0); }
    laneEnds[lane] = span.colEnd;
    return { ...span, lane };
  });
}

// ── 주(Week) 행 컴포넌트 ────────────────────────────

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function WeekRow({
  weekCells, year, month, events, todayStr, onSelect,
}: {
  weekCells: (number | null)[];
  year: number; month: number;
  events: Event[]; todayStr: string;
  onSelect: (e: Event) => void;
}) {
  const weekDates = weekCells.map(d => d ? toDateStr(year, month, d) : null);
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
      {/* 날짜 숫자 행 */}
      {weekCells.map((day, i) => {
        const d = weekDates[i];
        const isToday = d === todayStr;
        return (
          <div
            key={`n${i}`}
            style={{ gridRow: 1, gridColumn: i + 1 }}
            className={`px-1.5 pt-1.5 pb-0.5 ${i < 6 ? "border-r border-[var(--color-border)]" : ""}`}
          >
            {day !== null && (
              <span className={`text-xs font-medium w-6 h-6 rounded-full inline-flex items-center justify-center ${
                isToday ? "bg-[var(--color-primary)] text-white"
                : i === 0 ? "text-red-500"
                : i === 6 ? "text-blue-500"
                : "text-[var(--color-text)]"
              }`}>
                {day}
              </span>
            )}
          </div>
        );
      })}

      {/* 멀티데이 스패닝 바 */}
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
          className={`my-0.5 h-5 px-1.5 text-[10px] leading-5 font-medium truncate text-left
            ${span.isStart ? "rounded-l-sm" : "rounded-l-none"}
            ${span.isEnd ? "rounded-r-sm" : "rounded-r-none"}
            ${barStyle(span.event)}`}
        >
          {span.event.title}
        </button>
      ))}

      {/* 단일 날짜 이벤트 셀 */}
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

// ── 메인 페이지 ──────────────────────────────────────

const KIND_FILTERS = [
  { value: "all", label: "전체" },
  { value: "행사", label: "행사 모아보기" },
  { value: "모임", label: "모임 모아보기" },
];

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [events, setEvents] = useState<Event[]>([]);
  const [selected, setSelected] = useState<Event | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterKind, setFilterKind] = useState("all");

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/events/?year=${year}&month=${month}`)
      .then(r => r.json())
      .then(data => setEvents(Array.isArray(data) ? data : []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [year, month]);

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1);
  }

  const filtered = filterKind === "all" ? events : events.filter(e => e.event_kind === filterKind);

  // 캘린더 그리드 셀 생성
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow = new Date(year, month - 1, 1).getDay();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const todayStr = toDateStr(today.getFullYear(), today.getMonth() + 1, today.getDate());

  return (
    <>
      <PageHeader
        group="알림과 나눔"
        title="행사·모임 일정"
        subtitle="본당 행사와 모임 일정을 확인하세요."
        action={
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-1.5 rounded hover:bg-white/20 transition-colors text-white text-lg leading-none">‹</button>
            <span className="text-sm font-semibold text-white min-w-[90px] text-center">{year}년 {month}월</span>
            <button onClick={nextMonth} className="p-1.5 rounded hover:bg-white/20 transition-colors text-white text-lg leading-none">›</button>
          </div>
        }
      />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* 구분 필터 칩 */}
        <div className="flex flex-wrap gap-2 mb-5">
          {KIND_FILTERS.map(f => {
            const count = f.value === "all" ? events.length : events.filter(e => e.event_kind === f.value).length;
            return (
              <button
                key={f.value}
                onClick={() => setFilterKind(f.value)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  filterKind === f.value
                    ? f.value === "모임" ? "bg-green-600 text-white border-green-600"
                    : f.value === "행사" ? "bg-blue-600 text-white border-blue-600"
                    : "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                    : "border-[var(--color-border)] bg-white hover:bg-gray-50"
                }`}
              >
                {f.label}{count > 0 && <span className="ml-1 opacity-75">({count})</span>}
              </button>
            );
          })}
        </div>

        {/* 캘린더 */}
        <div className="bg-white border border-[var(--color-border)] rounded-xl overflow-hidden mb-6">
          {/* 요일 헤더 */}
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

          {/* 주 단위 행 */}
          {weeks.map((weekCells, wi) => (
            <WeekRow
              key={wi}
              weekCells={weekCells}
              year={year}
              month={month}
              events={filtered}
              todayStr={todayStr}
              onSelect={setSelected}
            />
          ))}
        </div>

        {/* 이번 달 목록 */}
        {filtered.length > 0 && (
          <div className="bg-white border border-[var(--color-border)] rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--color-border)]">
              <h2 className="text-sm font-bold text-[var(--color-primary)]">
                {month}월 {filterKind === "행사" ? "행사" : filterKind === "모임" ? "모임" : "전체"} 일정
              </h2>
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              {filtered.map(e => (
                <button
                  key={e.id}
                  onClick={() => setSelected(e)}
                  className="w-full flex items-center gap-4 px-5 py-3 hover:bg-gray-50 text-left transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <KindBadge kind={e.event_kind} />
                      <p className="text-sm font-medium text-[var(--color-text)] truncate">{e.title}</p>
                    </div>
                    {e.location && <p className="text-xs text-[var(--color-text-muted)]">📍 {e.location}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_BADGE[e.status] ?? STATUS_BADGE["예정"]}`}>
                      {e.status}
                    </span>
                    <div className="text-xs text-[var(--color-text-muted)] text-right">
                      <div>{new Date(e.event_date).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}</div>
                      {e.end_date && e.end_date !== e.event_date && (
                        <div>~ {new Date(e.end_date).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}</div>
                      )}
                      {e.start_time && <div>{e.start_time}</div>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {filtered.length === 0 && !loading && (
          <p className="text-center text-sm text-[var(--color-text-muted)] py-8">
            {events.length === 0 ? "이번 달 등록된 일정이 없습니다." : "해당 구분의 일정이 없습니다."}
          </p>
        )}

        {/* 상세 모달 */}
        {selected && (
          <div
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => setSelected(null)}
          >
            <div
              className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl"
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
                  <p className="text-[var(--color-text)] whitespace-pre-wrap mt-3">{selected.description}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
