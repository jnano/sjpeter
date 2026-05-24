"use client";
import { useEffect, useState, useRef } from "react";
import { useFocusItem, FOCUS_RING_CLASS } from "@/components/useFocusItem";

const API = process.env.NEXT_PUBLIC_API_URL;

const CATEGORIES = [
  { value: "liturgy", label: "전례" },
  { value: "community", label: "공동체" },
  { value: "education", label: "교육" },
  { value: "special", label: "특별행사" },
  { value: "general", label: "일반" },
];

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.label])
);

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

function AiBadge() {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 border border-violet-200 font-medium shrink-0">
      AI
    </span>
  );
}

// event_kind(한글) → 시안 카테고리 키(data-cat) — globals.css 의 --cat-* 색 사용
const KIND_TO_CAT: Record<string, string> = {
  "행사": "event", "모임": "meeting", "봉사": "service",
  "순례": "pilgrim", "피정": "retreat", "강의": "lecture", "기타": "other",
};

function KindBadge({ kind }: { kind: string | null }) {
  if (!kind || !KIND_TO_CAT[kind]) return null;
  return (
    <span data-cat={KIND_TO_CAT[kind]} className="cal-tag soft shrink-0">{kind}</span>
  );
}

interface Event {
  id: number;
  title: string;
  description: string | null;
  event_date: string;
  end_date: string | null;
  start_time: string | null;
  location: string | null;
  category: string;
  is_public: boolean;
  is_ai_generated: boolean;
  event_kind: string | null;
}

type ViewMode = "list" | "month" | "week" | "day";
type EventFormData = Omit<Event, "id" | "is_ai_generated">;

const EMPTY_FORM: EventFormData = {
  title: "",
  description: null,
  event_date: "",
  end_date: null,
  start_time: null,
  location: null,
  category: "general",
  is_public: true,
  event_kind: null,
};

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

// event_kind 별 색 (admin — cat 팔레트 근사 Tailwind 유틸)
const KIND_BAR: Record<string, string> = {
  "행사": "bg-blue-100 text-blue-700", "모임": "bg-green-100 text-green-700",
  "봉사": "bg-amber-100 text-amber-700", "순례": "bg-purple-100 text-purple-700",
  "피정": "bg-cyan-100 text-cyan-700", "강의": "bg-rose-100 text-rose-700",
  "기타": "bg-gray-200 text-gray-700",
};
const KIND_CHIP: Record<string, string> = {
  "행사": "bg-blue-50 text-blue-700 border-blue-200", "모임": "bg-green-50 text-green-700 border-green-200",
  "봉사": "bg-amber-50 text-amber-700 border-amber-200", "순례": "bg-purple-50 text-purple-700 border-purple-200",
  "피정": "bg-cyan-50 text-cyan-700 border-cyan-200", "강의": "bg-rose-50 text-rose-700 border-rose-200",
  "기타": "bg-gray-50 text-gray-700 border-gray-200",
};

function barStyle(e: Event): string {
  if (e.event_kind && KIND_BAR[e.event_kind]) return KIND_BAR[e.event_kind];
  return BAR_COLOR[e.category] ?? BAR_COLOR.general;
}

function chipStyle(e: Event): string {
  if (e.event_kind && KIND_CHIP[e.event_kind]) return KIND_CHIP[e.event_kind];
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

// ── 이벤트 폼 (기존 그대로) ─────────────

function EventForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: EventFormData;
  onSave: (data: EventFormData) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError("행사명을 입력해 주세요."); return; }
    if (!form.event_date) { setError("시작일을 선택해 주세요."); return; }
    setError(""); setBusy(true);
    try { await onSave(form); } catch { setError("저장에 실패했습니다."); }
    finally { setBusy(false); }
  }

  return (
    <div ref={ref}>
      <form
        onSubmit={handleSubmit}
        className="p-5 bg-[var(--color-surface-warm)] border border-[var(--color-border)] rounded-xl space-y-3"
      >
        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">행사·모임명 *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
              autoFocus
              placeholder="예: 부활절 미사 / 사목회의"
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">구분</label>
            <select
              value={form.event_kind ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, event_kind: e.target.value || null }))}
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-white"
            >
              <option value="">없음</option>
              <option value="행사">행사</option>
              <option value="모임">모임</option>
              <option value="봉사">봉사</option>
              <option value="순례">순례</option>
              <option value="피정">피정</option>
              <option value="강의">강의</option>
              <option value="기타">기타</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">분류</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-white"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">시작일 *</label>
            <input
              type="date"
              value={form.event_date}
              onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))}
              required
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">종료일</label>
            <input
              type="date"
              value={form.end_date ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value || null }))}
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">시간</label>
            <input
              type="text"
              value={form.start_time ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value || null }))}
              placeholder="예: 10:00"
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">장소</label>
            <input
              type="text"
              value={form.location ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value || null }))}
              placeholder="예: 성당 대성전"
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-white"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="is_public"
              checked={form.is_public}
              onChange={(e) => setForm((f) => ({ ...f, is_public: e.target.checked }))}
              className="w-4 h-4 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
            />
            <label htmlFor="is_public" className="text-sm cursor-pointer">공개</label>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">상세 설명</label>
            <textarea
              value={form.description ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value || null }))}
              rows={2}
              placeholder="설명 (선택)"
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-white"
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm hover:bg-white transition-colors"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {busy ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </div>
  );
}

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("admin_token");
}

function authHeaders() {
  return { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" };
}

const KIND_FILTERS = [
  { value: "all", label: "전체" },
  { value: "행사", label: "행사만" },
  { value: "모임", label: "모임만" },
];

const VIEW_TABS: { value: ViewMode; label: string }[] = [
  { value: "list", label: "목록" },
  { value: "month", label: "월" },
  { value: "week", label: "주" },
  { value: "day", label: "일" },
];

// ── 그리드 뷰 (관리자 — 칩 클릭 시 onPick 호출) ──

function MonthGrid({
  year, month, events, todayStr, onPick,
}: {
  year: number; month: number;
  events: Event[]; todayStr: string;
  onPick: (e: Event) => void;
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
      {weeks.map((weekCells, wi) => {
        const weekDates = weekCells.map(d => d ? cellToStr(year, month, d) : null);
        const spans = computeSpans(events, weekDates);
        const laneCount = spans.reduce((m, s) => Math.max(m, s.lane + 1), 0);
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
            key={wi}
            className="grid grid-cols-7 border-b border-[var(--color-border)] last:border-b-0"
            style={{ gridTemplateRows: gridRows }}
          >
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
                onClick={() => onPick(span.event)}
                className={`my-0.5 h-5 px-1.5 text-[10px] leading-5 font-medium truncate text-left
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
                      onClick={() => onPick(e)}
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
      })}
    </div>
  );
}

function WeekGrid({
  weekStart, events, todayStr, onPick,
}: {
  weekStart: Date; events: Event[]; todayStr: string;
  onPick: (e: Event) => void;
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
      <div className="grid grid-cols-7 border-b border-[var(--color-border)]">
        {dates.map((d, i) => {
          const ds = dateStrs[i];
          const isToday = ds === todayStr;
          return (
            <div key={i} className={`py-2.5 text-center ${i < 6 ? "border-r border-[var(--color-border)]" : ""}`}>
              <div className={`text-[11px] font-medium mb-0.5 ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-[var(--color-text-muted)]"}`}>
                {WEEKDAYS[i]}
              </div>
              <span className={`text-sm font-semibold w-7 h-7 rounded-full inline-flex items-center justify-center ${
                isToday ? "bg-[var(--color-primary)] text-white"
                : i === 0 ? "text-red-500"
                : i === 6 ? "text-blue-500"
                : "text-[var(--color-text)]"
              }`}>
                {d.getDate()}
              </span>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-7" style={{ gridTemplateRows: gridRows }}>
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
            onClick={() => onPick(span.event)}
            className={`my-1 h-5 px-2 text-[11px] leading-5 font-medium truncate text-left
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
                  onClick={() => onPick(e)}
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

function DayGrid({
  date, events, todayStr, onPick,
}: {
  date: Date; events: Event[]; todayStr: string;
  onPick: (e: Event) => void;
}) {
  const dateStr = dateToStr(date);
  const isToday = dateStr === todayStr;
  const dow = date.getDay();
  const dayEvents = events
    .filter(e => eventOverlapsDate(e, dateStr))
    .sort((a, b) => {
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
        <div>
          <p className="text-sm text-[var(--color-text-muted)]">
            {date.getFullYear()}년 {date.getMonth() + 1}월
          </p>
          <p className={`text-base font-bold ${dow === 0 ? "text-red-500" : dow === 6 ? "text-blue-500" : "text-[var(--color-text)]"}`}>
            {WEEKDAYS[dow]}요일 {isToday && <span className="ml-1 text-xs text-[var(--color-primary)]">(오늘)</span>}
          </p>
        </div>
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
                onClick={() => onPick(e)}
                className="w-full px-5 py-3.5 hover:bg-gray-50 text-left transition-colors flex items-center gap-3"
              >
                <div className={`w-1 self-stretch rounded-full ${barStyle(e).split(" ")[0]}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <KindBadge kind={e.event_kind} />
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${CHIP_COLOR[e.category] ?? CHIP_COLOR.general}`}>
                      {CATEGORY_LABEL[e.category] ?? "일반"}
                    </span>
                    {e.is_ai_generated && <AiBadge />}
                    {!e.is_public && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600">비공개</span>
                    )}
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
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── 메인 페이지 ──────────────────────────

export default function AdminCalendarPage() {
  const focusId = useFocusItem();
  const today = new Date();
  const todayStr = dateToStr(today);

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [cursor, setCursor] = useState<Date>(today);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [filterKind, setFilterKind] = useState("all");

  // 그리드 뷰 모달용
  const [picked, setPicked] = useState<Event | null>(null);
  const [pickedEditing, setPickedEditing] = useState(false);

  // 다중 선택 (목록 뷰 전용)
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const allCheckRef = useRef<HTMLInputElement>(null);

  async function loadEvents() {
    setLoading(true);
    try {
      const monthsKeys = new Set<string>();
      if (viewMode === "week") {
        const ws = startOfWeek(cursor);
        const we = addDays(ws, 6);
        monthsKeys.add(`${ws.getFullYear()}-${ws.getMonth() + 1}`);
        monthsKeys.add(`${we.getFullYear()}-${we.getMonth() + 1}`);
      } else {
        monthsKeys.add(`${cursor.getFullYear()}-${cursor.getMonth() + 1}`);
      }
      const results = await Promise.all(
        Array.from(monthsKeys).map(key => {
          const [y, m] = key.split("-").map(Number);
          return fetch(`${API}/api/events/?year=${y}&month=${m}`, {
            headers: authHeaders(),
          }).then(r => r.ok ? r.json() : []).catch(() => []);
        })
      );
      const merged: Event[] = [];
      const seen = new Set<number>();
      for (const arr of results) {
        if (!Array.isArray(arr)) continue;
        for (const e of arr) {
          if (!seen.has(e.id)) { seen.add(e.id); merged.push(e); }
        }
      }
      setEvents(merged);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setSelected(new Set());
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // 필터링 (kind만 적용 — 그리드 뷰들은 자체적으로 날짜 필터링)
  const kindFiltered = filterKind === "all" ? events : events.filter(e => e.event_kind === filterKind);

  // 목록 뷰용: 그 달 이벤트만
  const listVisible = (() => {
    const y = cursor.getFullYear();
    const m = cursor.getMonth() + 1;
    const first = `${y}-${String(m).padStart(2, "0")}-01`;
    const last = `${y}-${String(m).padStart(2, "0")}-${new Date(y, m, 0).getDate()}`;
    return [...kindFiltered].filter(e => {
      const start = e.event_date;
      const end = e.end_date ?? e.event_date;
      return !(end < first || start > last);
    }).sort(compareEvents);
  })();

  const allSelected = listVisible.length > 0 && listVisible.every((e) => selected.has(e.id));
  const someSelected = listVisible.some((e) => selected.has(e.id)) && !allSelected;

  useEffect(() => {
    if (allCheckRef.current) allCheckRef.current.indeterminate = someSelected;
  }, [someSelected]);

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) listVisible.forEach((e) => next.delete(e.id));
      else listVisible.forEach((e) => next.add(e.id));
      return next;
    });
  }

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkDelete() {
    const ids = Array.from(selected);
    if (!confirm(`선택한 항목 ${ids.length}건을 삭제하시겠습니까?`)) return;
    setBulkDeleting(true);
    try {
      await Promise.all(
        ids.map((id) =>
          fetch(`${API}/api/events/${id}`, { method: "DELETE", headers: authHeaders() })
        )
      );
      setEvents((prev) => prev.filter((e) => !selected.has(e.id)));
      setSelected(new Set());
    } finally {
      setBulkDeleting(false);
    }
  }

  async function handleCreate(form: EventFormData) {
    const res = await fetch(`${API}/api/events/`, {
      method: "POST", headers: authHeaders(), body: JSON.stringify(form),
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    setEvents((prev) => [...prev, data].sort((a, b) => a.event_date.localeCompare(b.event_date)));
    setShowCreate(false);
  }

  async function handleEdit(id: number, form: EventFormData) {
    const res = await fetch(`${API}/api/events/${id}`, {
      method: "PUT", headers: authHeaders(), body: JSON.stringify(form),
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    setEvents((prev) => prev.map((e) => (e.id === id ? data : e)));
    setEditId(null);
    setPicked(null);
    setPickedEditing(false);
  }

  async function handleDelete(id: number) {
    if (!confirm("이 항목을 삭제하시겠습니까?")) return;
    const res = await fetch(`${API}/api/events/${id}`, { method: "DELETE", headers: authHeaders() });
    if (res.ok) {
      setEvents((prev) => prev.filter((e) => e.id !== id));
      setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
      setPicked(null);
      setPickedEditing(false);
    }
  }

  const countByKind = {
    행사: events.filter((e) => e.event_kind === "행사").length,
    모임: events.filter((e) => e.event_kind === "모임").length,
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-primary)]">본당 일정 관리</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">행사와 모임을 등록하고 관리합니다.</p>
        </div>
        <button
          onClick={() => { setShowCreate((v) => !v); setEditId(null); }}
          className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white rounded-lg text-sm font-medium transition-colors"
        >
          {showCreate ? "취소" : "+ 등록"}
        </button>
      </div>

      {/* 새 항목 등록 폼 */}
      {showCreate && (
        <div className="mb-5">
          <EventForm
            initial={{ ...EMPTY_FORM, event_date: dateToStr(cursor) }}
            onSave={handleCreate}
            onCancel={() => setShowCreate(false)}
          />
        </div>
      )}

      {/* 보기 모드 + 네비게이션 */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
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
        <button onClick={() => navigate(-1)} className="px-3 py-1.5 border border-[var(--color-border)] rounded-lg hover:bg-gray-50 text-sm">‹</button>
        <span className="font-semibold text-sm min-w-[140px] text-center">{navigationLabel()}</span>
        <button onClick={() => navigate(1)} className="px-3 py-1.5 border border-[var(--color-border)] rounded-lg hover:bg-gray-50 text-sm">›</button>
        <button
          onClick={() => setCursor(new Date())}
          className="text-xs px-3 py-1.5 border border-[var(--color-border)] rounded-lg hover:bg-gray-50"
        >
          오늘
        </button>
        <a
          href="/calendar"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-sm border border-[var(--color-border)] hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors"
        >
          사용자 페이지 →
        </a>
      </div>

      {/* 구분 필터 칩 */}
      {events.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {KIND_FILTERS.map((f) => {
            const count = f.value === "all" ? events.length
              : f.value === "행사" ? countByKind.행사
              : countByKind.모임;
            return (
              <button
                key={f.value}
                onClick={() => { setFilterKind(f.value); setSelected(new Set()); }}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  filterKind === f.value
                    ? f.value === "모임"
                      ? "bg-green-600 text-white border-green-600"
                      : f.value === "행사"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                    : "border-[var(--color-border)] hover:bg-[var(--color-surface-warm)]"
                }`}
              >
                {f.label} {count}건
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-12">불러오는 중…</p>
      ) : viewMode === "list" ? (
        <>
          {/* 선택 컨트롤 바 */}
          {listVisible.length > 0 && (
            <div className="flex items-center justify-between bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 mb-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  ref={allCheckRef}
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="w-4 h-4 rounded accent-[var(--color-primary)] cursor-pointer"
                />
                <span className="text-sm text-[var(--color-text-muted)]">
                  {selected.size > 0 ? `${selected.size}건 선택됨` : `${listVisible.length}건`}
                </span>
              </label>
              {selected.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="text-xs border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
                >
                  {bulkDeleting ? "삭제 중…" : `선택 삭제 (${selected.size})`}
                </button>
              )}
            </div>
          )}

          {listVisible.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-12">
              {events.length === 0 ? "이번 달 등록된 항목이 없습니다." : "해당 구분의 항목이 없습니다."}
            </p>
          ) : (
            <div className="space-y-2">
              {listVisible.map((ev) => (
                <div key={ev.id} data-focus-id={ev.id}>
                  <div
                    className={`p-4 bg-[var(--color-surface)] border rounded-xl transition-colors ${
                      editId === ev.id
                        ? "border-[var(--color-primary)] rounded-b-none border-b-0"
                        : selected.has(ev.id)
                        ? "border-[var(--color-primary)] bg-blue-50/20"
                        : focusId === ev.id
                        ? FOCUS_RING_CLASS
                        : "border-[var(--color-border)]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selected.has(ev.id)}
                        onChange={() => toggleOne(ev.id)}
                        className="mt-1 w-4 h-4 rounded accent-[var(--color-primary)] cursor-pointer shrink-0"
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <KindBadge kind={ev.event_kind} />
                          <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded shrink-0">
                            {CATEGORY_LABEL[ev.category] ?? ev.category}
                          </span>
                          {ev.is_ai_generated && <AiBadge />}
                          {!ev.is_public && (
                            <span className="text-xs px-1.5 py-0.5 bg-red-50 text-red-600 rounded shrink-0">비공개</span>
                          )}
                          <p className="font-medium truncate">{ev.title}</p>
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">
                          {new Date(ev.event_date).toLocaleDateString("ko-KR")}
                          {ev.end_date && ` ~ ${new Date(ev.end_date).toLocaleDateString("ko-KR")}`}
                          {ev.start_time && ` · ${ev.start_time}`}
                          {ev.location && ` · ${ev.location}`}
                        </p>
                        {ev.description && (
                          <p className="text-sm text-[var(--color-text-muted)] mt-1 line-clamp-1">{ev.description}</p>
                        )}
                      </div>

                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => { setEditId(editId === ev.id ? null : ev.id); setShowCreate(false); }}
                          className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                            editId === ev.id
                              ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                              : "border-[var(--color-border)] hover:bg-[var(--color-surface-warm)]"
                          }`}
                        >
                          {editId === ev.id ? "접기" : "수정"}
                        </button>
                        <button
                          onClick={() => handleDelete(ev.id)}
                          className="px-3 py-1.5 text-xs border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 인라인 수정 폼 */}
                  {editId === ev.id && (
                    <div className="border border-t-0 border-[var(--color-primary)] rounded-b-xl overflow-hidden">
                      <EventForm
                        initial={{
                          title: ev.title,
                          description: ev.description,
                          event_date: ev.event_date,
                          end_date: ev.end_date,
                          start_time: ev.start_time,
                          location: ev.location,
                          category: ev.category,
                          is_public: ev.is_public,
                          event_kind: ev.event_kind,
                        }}
                        onSave={(form) => handleEdit(ev.id, form)}
                        onCancel={() => setEditId(null)}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      ) : viewMode === "month" ? (
        <MonthGrid
          year={cursor.getFullYear()}
          month={cursor.getMonth() + 1}
          events={kindFiltered}
          todayStr={todayStr}
          onPick={(e) => { setPicked(e); setPickedEditing(false); }}
        />
      ) : viewMode === "week" ? (
        <WeekGrid
          weekStart={startOfWeek(cursor)}
          events={kindFiltered}
          todayStr={todayStr}
          onPick={(e) => { setPicked(e); setPickedEditing(false); }}
        />
      ) : (
        <DayGrid
          date={cursor}
          events={kindFiltered}
          todayStr={todayStr}
          onPick={(e) => { setPicked(e); setPickedEditing(false); }}
        />
      )}

      {/* 그리드 뷰 모달 — 미리보기 또는 수정 폼 */}
      {picked && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => { setPicked(null); setPickedEditing(false); }}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {pickedEditing ? (
              <EventForm
                initial={{
                  title: picked.title,
                  description: picked.description,
                  event_date: picked.event_date,
                  end_date: picked.end_date,
                  start_time: picked.start_time,
                  location: picked.location,
                  category: picked.category,
                  is_public: picked.is_public,
                  event_kind: picked.event_kind,
                }}
                onSave={(form) => handleEdit(picked.id, form)}
                onCancel={() => setPickedEditing(false)}
              />
            ) : (
              <>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <KindBadge kind={picked.event_kind} />
                    <span className={`text-xs px-2 py-1 rounded border ${CHIP_COLOR[picked.category] ?? CHIP_COLOR.general}`}>
                      {CATEGORY_LABEL[picked.category] ?? "일반"}
                    </span>
                    {picked.is_ai_generated && <AiBadge />}
                    {!picked.is_public && (
                      <span className="text-xs px-2 py-1 rounded bg-red-50 text-red-600">비공개</span>
                    )}
                  </div>
                  <button onClick={() => setPicked(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">✕</button>
                </div>
                <h3 className="text-lg font-bold text-[var(--color-primary)] mb-3">{picked.title}</h3>
                <div className="space-y-2 text-sm text-[var(--color-text-muted)] mb-5">
                  <p>
                    📅 {new Date(picked.event_date).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
                    {picked.end_date && picked.end_date !== picked.event_date
                      ? ` ~ ${new Date(picked.end_date).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}`
                      : ""}
                    {picked.start_time && ` ${picked.start_time}`}
                  </p>
                  {picked.location && <p>📍 {picked.location}</p>}
                  {picked.description && (
                    <p className="text-[var(--color-text)] whitespace-pre-wrap mt-3">{picked.description}</p>
                  )}
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => handleDelete(picked.id)}
                    className="px-4 py-2 text-sm border border-red-200 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    삭제
                  </button>
                  <button
                    onClick={() => setPickedEditing(true)}
                    className="px-4 py-2 text-sm bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white rounded-lg transition-colors"
                  >
                    수정
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
