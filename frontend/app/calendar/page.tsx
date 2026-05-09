"use client";
import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";

const API = process.env.NEXT_PUBLIC_API_URL;

const CATEGORY_LABEL: Record<string, string> = {
  liturgy: "전례",
  community: "공동체",
  education: "교육",
  general: "일반",
  special: "특별행사",
};

const CATEGORY_COLOR: Record<string, string> = {
  liturgy: "bg-purple-100 text-purple-700 border-purple-200",
  community: "bg-green-100 text-green-700 border-green-200",
  education: "bg-blue-100 text-blue-700 border-blue-200",
  general: "bg-gray-100 text-gray-600 border-gray-200",
  special: "bg-amber-100 text-amber-700 border-amber-200",
};

const DOT_COLOR: Record<string, string> = {
  liturgy: "bg-purple-400",
  community: "bg-green-400",
  education: "bg-blue-400",
  general: "bg-gray-400",
  special: "bg-amber-400",
};

const STATUS_BADGE: Record<string, string> = {
  "예정":     "bg-blue-50 text-blue-600 border-blue-200",
  "기록대기": "bg-amber-50 text-amber-600 border-amber-200",
  "기록됨":   "bg-emerald-50 text-emerald-600 border-emerald-200",
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
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200 font-medium">
        행사
      </span>
    );
  if (kind === "모임")
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-600 border border-green-200 font-medium">
        모임
      </span>
    );
  return null;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay();
}

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
      .then((r) => r.json())
      .then((data) => setEvents(Array.isArray(data) ? data : []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [year, month]);

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  // 필터링된 목록
  const filtered = filterKind === "all"
    ? events
    : events.filter((e) => e.event_kind === filterKind);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDow = getFirstDayOfWeek(year, month);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const eventsByDate = filtered.reduce((acc, e) => {
    const d = e.event_date;
    if (!acc[d]) acc[d] = [];
    acc[d].push(e);
    return acc;
  }, {} as Record<string, Event[]>);

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

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
        {KIND_FILTERS.map((f) => {
          const count = f.value === "all" ? events.length
            : events.filter((e) => e.event_kind === f.value).length;
          return (
            <button
              key={f.value}
              onClick={() => setFilterKind(f.value)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filterKind === f.value
                  ? f.value === "모임"
                    ? "bg-green-600 text-white border-green-600"
                    : f.value === "행사"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                  : "border-[var(--color-border)] bg-white hover:bg-gray-50"
              }`}
            >
              {f.label} {count > 0 && <span className="opacity-80">({count})</span>}
            </button>
          );
        })}
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap gap-3 mb-4 text-xs">
        {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${DOT_COLOR[k]}`} />
            {v}
          </span>
        ))}
      </div>

      {/* 캘린더 그리드 */}
      <div className="bg-white border border-[var(--color-border)] rounded-xl overflow-hidden mb-6">
        <div className="grid grid-cols-7">
          {WEEKDAYS.map((d, i) => (
            <div
              key={d}
              className={`py-2 text-center text-xs font-medium border-b border-[var(--color-border)] ${
                i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-[var(--color-text-muted)]"
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} className="border-b border-r border-[var(--color-border)] h-24 bg-gray-50/50" />;
            const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayEvents = eventsByDate[dateStr] ?? [];
            const isToday = dateStr === todayStr;
            const isWeekend = (firstDow + day - 1) % 7 === 0 || (firstDow + day - 1) % 7 === 6;
            const isSunday = (firstDow + day - 1) % 7 === 0;

            return (
              <div
                key={day}
                className="border-b border-r border-[var(--color-border)] h-24 p-1.5 overflow-hidden hover:bg-gray-50/50 transition-colors"
              >
                <div
                  className={`text-xs font-medium mb-1 w-6 h-6 rounded-full flex items-center justify-center ${
                    isToday
                      ? "bg-[var(--color-primary)] text-white"
                      : isSunday
                      ? "text-red-500"
                      : isWeekend
                      ? "text-blue-500"
                      : "text-[var(--color-text)]"
                  }`}
                >
                  {day}
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 2).map((e) => (
                    <button
                      key={e.id}
                      onClick={() => setSelected(e)}
                      className={`w-full text-left text-[10px] px-1.5 py-0.5 rounded truncate border ${
                        e.event_kind === "모임"
                          ? "bg-green-50 text-green-700 border-green-200"
                          : e.event_kind === "행사"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : CATEGORY_COLOR[e.category] ?? CATEGORY_COLOR.general
                      }`}
                    >
                      {e.title}
                    </button>
                  ))}
                  {dayEvents.length > 2 && (
                    <p className="text-[10px] text-[var(--color-text-muted)] pl-1">+{dayEvents.length - 2}개</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 이번 달 목록 */}
      {filtered.length > 0 && (
        <div className="bg-white border border-[var(--color-border)] rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--color-border)]">
            <h2 className="text-sm font-bold text-[var(--color-primary)]">
              {month}월 {filterKind === "all" ? "전체 일정" : filterKind === "행사" ? "행사 일정" : "모임 일정"}
            </h2>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {filtered.map((e) => (
              <button
                key={e.id}
                onClick={() => setSelected(e)}
                className="w-full flex items-center gap-4 px-5 py-3 hover:bg-gray-50 text-left transition-colors"
              >
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 mt-0.5 ${DOT_COLOR[e.category] ?? DOT_COLOR.general}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <KindBadge kind={e.event_kind} />
                    <p className="text-sm font-medium text-[var(--color-text)] truncate">{e.title}</p>
                  </div>
                  {e.location && <p className="text-xs text-[var(--color-text-muted)]">{e.location}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_BADGE[e.status] ?? STATUS_BADGE["예정"]}`}>
                    {e.status}
                  </span>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    {new Date(e.event_date).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
                    {e.start_time && ` ${e.start_time}`}
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
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <KindBadge kind={selected.event_kind} />
                <span className={`text-xs px-2 py-1 rounded border ${CATEGORY_COLOR[selected.category] ?? CATEGORY_COLOR.general}`}>
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
