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

// category(보조 회색 태그) 라벨 — 시안 list-tag.kind
const CATEGORY_LABEL: Record<string, string> = {
  liturgy: "전례", community: "공동체", education: "교육",
  general: "일반", special: "특별행사",
};

// event_kind(한글) → 시안 카테고리 키(data-cat) — --c / --c-bg 색 주입용
const KIND_TO_CAT: Record<string, string> = {
  "행사": "event", "모임": "meeting", "봉사": "service",
  "순례": "pilgrim", "피정": "retreat", "강의": "lecture", "기타": "other",
};
// 시안 카테고리 키 → 한글 라벨 (콜로어드 태그 표기)
const CAT_LABEL: Record<string, string> = {
  event: "행사", meeting: "모임", service: "봉사",
  pilgrim: "순례", retreat: "피정", lecture: "강의", other: "기타",
};

function catKey(e: Event): string {
  return (e.event_kind && KIND_TO_CAT[e.event_kind]) || "other";
}

// admin 드롭다운·필터 카테고리 7종 (시안 cat-bar)
const KIND_OPTIONS = ["행사", "모임", "봉사", "순례", "피정", "강의", "기타"];

const FILTER_CATS: { value: string; label: string; cat: string | null }[] = [
  { value: "all", label: "전체", cat: null },
  { value: "행사", label: "행사", cat: "event" },
  { value: "모임", label: "모임", cat: "meeting" },
  { value: "봉사", label: "봉사", cat: "service" },
  { value: "순례", label: "순례", cat: "pilgrim" },
  { value: "피정", label: "피정", cat: "retreat" },
  { value: "강의", label: "강의", cat: "lecture" },
  { value: "기타", label: "기타", cat: "other" },
];

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

const VIEW_TABS: { value: ViewMode; label: string }[] = [
  { value: "month", label: "월" },
  { value: "week", label: "주" },
  { value: "day", label: "일" },
  { value: "list", label: "목록" },
];

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const DOW_EN = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

// ── 날짜 헬퍼 ────────────────────────────

function dateToStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
function fmtMD(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** 시안 status pill — 진행 중(live) / 예정(upcoming) / 기록대기·기록됨(past) */
function statusInfo(e: Event, now: Date, todayStr: string): { cls: string; label: string } {
  if (e.event_date === todayStr && e.start_time) {
    const [h, m] = e.start_time.split(":").map(Number);
    if (!Number.isNaN(h)) {
      const startMin = h * 60 + (m || 0);
      const nowMin = now.getHours() * 60 + now.getMinutes();
      if (nowMin >= startMin && nowMin <= startMin + 120) return { cls: "live", label: "진행 중" };
    }
  }
  if (e.status === "예정") return { cls: "upcoming", label: "예정" };
  return { cls: "past", label: e.status };
}

// 전체 보이는 달력 격자(이전·다음달 흐린 날짜 포함) 날짜 배열
function monthGridDates(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month - 1, 1);
  const startGrid = addDays(firstOfMonth, -firstOfMonth.getDay());
  const totalCells = Math.ceil((firstOfMonth.getDay() + new Date(year, month, 0).getDate()) / 7) * 7;
  return Array.from({ length: totalCells }, (_, i) => addDays(startGrid, i));
}

// ── 작은 아이콘 ───────────────────────────
function IconPin() {
  return (
    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6 1c-2.5 0-4.5 2-4.5 4.5 0 3 4.5 5.5 4.5 5.5s4.5-2.5 4.5-5.5C10.5 3 8.5 1 6 1z" />
      <circle cx="6" cy="5.5" r="1.5" />
    </svg>
  );
}
function IconClock() {
  return (
    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="6" cy="6" r="4.5" />
      <polyline points="6 3 6 6 8 7" />
    </svg>
  );
}

// ════════ 월간 뷰 (시안 cal-grid) ════════
function MonthView({
  year, month, events, todayStr, onSelect, onCreateForDate,
}: {
  year: number; month: number; events: Event[]; todayStr: string;
  onSelect: (e: Event) => void; onCreateForDate?: (dateStr: string) => void;
}) {
  const grid = monthGridDates(year, month);
  const weeks: Date[][] = [];
  for (let i = 0; i < grid.length; i += 7) weeks.push(grid.slice(i, i + 7));

  return (
    <div className="cal-grid">
      <div className="dow-row">
        {WEEKDAYS.map((d, i) => (
          <div key={d} className={`dow ${i === 0 ? "sun" : i === 6 ? "sat" : ""}`}>{d} {DOW_EN[i]}</div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b border-[var(--color-border)] last:border-b-0">
          {week.map((d, i) => {
            const ds = dateToStr(d);
            const inMonth = d.getMonth() === month - 1;
            const isToday = ds === todayStr;
            const dow = d.getDay();
            const dayEvs = events.filter(e => eventOverlapsDate(e, ds)).sort(compareEvents);
            return (
              <div
                key={i}
                className={`min-h-[130px] p-[10px] pb-3 flex flex-col gap-1 ${i < 6 ? "border-r border-[var(--color-border)]" : ""} ${
                  inMonth ? "hover:bg-[var(--color-background)]" : "bg-[var(--color-background)] opacity-55"
                }`}
              >
                <button
                  type="button"
                  disabled={!onCreateForDate || !inMonth}
                  onClick={() => onCreateForDate?.(ds)}
                  title={onCreateForDate && inMonth ? "이 날짜에 일정 추가" : undefined}
                  className={`cal-daynum ${isToday ? "today" : dow === 0 ? "sun" : dow === 6 ? "sat" : ""} ${
                    onCreateForDate && inMonth ? "cursor-pointer hover:bg-[var(--color-primary)] hover:text-white transition-colors" : ""
                  }`}
                >
                  {d.getDate()}
                </button>
                {dayEvs.slice(0, 3).map(e => (
                  <button key={e.id} data-cat={catKey(e)} onClick={() => onSelect(e)} className="cal-evt evt-soft">
                    {e.title}
                  </button>
                ))}
                {dayEvs.length > 3 && <span className="cal-evt-more">+{dayEvs.length - 3}개 더보기</span>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ════════ 주간 뷰 (시안 week-grid) ════════
function WeekView({
  weekStart, events, todayStr, onSelect, onCreateForDate,
}: {
  weekStart: Date; events: Event[]; todayStr: string;
  onSelect: (e: Event) => void; onCreateForDate?: (dateStr: string) => void;
}) {
  const dates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  return (
    <div className="cal-week">
      <div className="dow-row">
        {dates.map((d, i) => {
          const ds = dateToStr(d);
          const isToday = ds === todayStr;
          return (
            <div key={i} className={`wk-dow ${i === 0 ? "sun" : i === 6 ? "sat" : ""} ${isToday ? "today" : ""}`}>
              <span className="name">{WEEKDAYS[i]} {DOW_EN[i]}</span>
              <button
                type="button"
                disabled={!onCreateForDate}
                onClick={() => onCreateForDate?.(ds)}
                title={onCreateForDate ? "이 날짜에 일정 추가" : undefined}
                className={`num ${onCreateForDate ? "cursor-pointer" : ""}`}
              >
                {d.getDate()}
              </button>
            </div>
          );
        })}
      </div>
      <div className="events-row">
        {dates.map((d, i) => {
          const ds = dateToStr(d);
          const isToday = ds === todayStr;
          const dayEvs = events
            .filter(e => eventOverlapsDate(e, ds))
            .sort((a, b) => {
              const am = isMultiDay(a) ? 0 : 1, bm = isMultiDay(b) ? 0 : 1;
              if (am !== bm) return am - bm;
              return (a.start_time ?? "").localeCompare(b.start_time ?? "");
            });
          return (
            <div key={i} className={`day-col ${isToday ? "today" : ""}`}>
              {dayEvs.map(e => {
                const multi = isMultiDay(e);
                const isStart = e.event_date === ds;
                const isEnd = (e.end_date ?? e.event_date) === ds;
                const spanCls = multi ? (isStart ? "span" : isEnd ? "span-end" : "span-mid") : "";
                return (
                  <button key={e.id} data-cat={catKey(e)} onClick={() => onSelect(e)} className={`cal-weekevt ${spanCls}`}>
                    {!multi && e.start_time && <span className="t">{e.start_time}</span>}
                    {multi && isStart && <span className="t">{e.start_time ?? `${d.getMonth() + 1}/${d.getDate()} 시작`}</span>}
                    {e.title}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ════════ 일간 뷰 (시안 day-head + day-events) ════════
function DayView({
  date, events, todayStr, now, onSelect, onCreateForDate,
}: {
  date: Date; events: Event[]; todayStr: string; now: Date;
  onSelect: (e: Event) => void; onCreateForDate?: (dateStr: string) => void;
}) {
  const ds = dateToStr(date);
  const isToday = ds === todayStr;
  const dow = date.getDay();
  const dayEvents = events
    .filter(e => eventOverlapsDate(e, ds))
    .sort((a, b) => {
      const am = isMultiDay(a) ? 0 : 1, bm = isMultiDay(b) ? 0 : 1;
      if (am !== bm) return am - bm;
      return (a.start_time ?? "").localeCompare(b.start_time ?? "");
    });

  return (
    <div>
      <div className="cal-dayhead">
        <div className="flex items-center gap-6">
          <div className="cal-daycircle">{date.getDate()}</div>
          <div>
            <div className="text-[13px] text-[var(--cal-ink3)] tracking-wide font-medium mb-1">
              {date.getFullYear()}년 {date.getMonth() + 1}월
            </div>
            <div className="dow-name">
              <b className={dow === 0 ? "" : ""} style={dow === 0 ? { color: "var(--color-primary)" } : undefined}>{WEEKDAYS[dow]}요일</b>
              {isToday && (
                <span
                  className="ml-2 align-middle inline-block text-xs px-2.5 py-[3px] rounded-full font-semibold"
                  style={{ background: "color-mix(in srgb, var(--color-primary) 9%, transparent)", color: "var(--color-primary)" }}
                >오늘</span>
              )}
            </div>
          </div>
        </div>
        {onCreateForDate && (
          <button onClick={() => onCreateForDate(ds)} className="cal-btn-add shrink-0">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><line x1="6" y1="2" x2="6" y2="10" /><line x1="2" y1="6" x2="10" y2="6" /></svg>
            일정 추가
          </button>
        )}
      </div>
      <div className="cal-dayevents">
        {dayEvents.length === 0 ? (
          <div className="py-[60px] text-center text-[var(--cal-ink3)] text-sm">등록된 일정이 없습니다.</div>
        ) : (
          dayEvents.map(e => {
            const st = statusInfo(e, now, todayStr);
            return (
              <button key={e.id} data-cat={catKey(e)} onClick={() => onSelect(e)} className="cal-dayevent">
                <div className="rail" />
                <div className="w-20 shrink-0 leading-tight">
                  <div className="from">{e.start_time ?? "종일"}</div>
                  {isMultiDay(e) && <div className="to">~ {fmtMD(e.end_date!)}</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex gap-1.5 mb-1.5">
                    <span className="cal-tag soft">{CAT_LABEL[catKey(e)]}</span>
                    <span className="cal-tag kind">{CATEGORY_LABEL[e.category] ?? "일반"}</span>
                  </div>
                  <h4>{e.title}</h4>
                  {e.location && (
                    <div className="cal-meta"><span><IconPin /> {e.location}</span></div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className={`cal-status ${st.cls}`}>{st.label}</span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ════════ 목록 뷰 (시안 list-item) ════════
function ListView({
  events, monthLabel, todayStr, now, onSelect,
}: {
  events: Event[]; monthLabel: string; todayStr: string; now: Date; onSelect: (e: Event) => void;
}) {
  const sorted = [...events].sort(compareEvents);
  let lastDate = "";
  return (
    <div>
      <div className="text-[11px] tracking-[0.16em] uppercase text-[var(--cal-ink3)] font-bold pb-3 border-b border-[var(--color-text)] mb-1">
        {monthLabel} · 전체 {sorted.length}건
      </div>
      {sorted.length === 0 ? (
        <div className="py-12 text-center text-sm text-[var(--cal-ink3)]">등록된 일정이 없습니다.</div>
      ) : (
        sorted.map(e => {
          const showDate = e.event_date !== lastDate;
          lastDate = e.event_date;
          const d = new Date(e.event_date);
          const dow = d.getDay();
          const isToday = e.event_date === todayStr;
          const st = statusInfo(e, now, todayStr);
          return (
            <button key={e.id} data-cat={catKey(e)} onClick={() => onSelect(e)} className="cal-listitem w-full">
              <div className={`cal-listdate ${dow === 0 ? "sun" : ""} ${isToday ? "today" : ""}`}>
                <div className="d" style={showDate ? undefined : { visibility: "hidden" }}>{d.getDate()}</div>
                <div className="dow" style={showDate ? undefined : { visibility: "hidden" }}>
                  {isToday ? "오늘" : `${d.getMonth() + 1}월`} · {WEEKDAYS[dow]}요일
                </div>
              </div>
              <div className="cal-listbody min-w-0">
                <div className="flex gap-1.5 mb-2">
                  <span className="cal-tag soft">{CAT_LABEL[catKey(e)]}</span>
                  <span className="cal-tag kind">{CATEGORY_LABEL[e.category] ?? "일반"}</span>
                </div>
                <h4>{e.title}</h4>
                <div className="cal-meta">
                  {e.location && <span><IconPin /> {e.location}</span>}
                  {(e.start_time || isMultiDay(e)) && (
                    <span><IconClock /> {isMultiDay(e) ? `${fmtMD(e.event_date)} — ${fmtMD(e.end_date!)}` : e.start_time}</span>
                  )}
                </div>
              </div>
              <span className={`cal-status ${st.cls}`}>{st.label}</span>
            </button>
          );
        })
      )}
    </div>
  );
}

// ════════ 다가오는 일정 카드 (시안 upcoming-strip) ════════
function UpcomingStrip({ events, todayStr, onSelect }: { events: Event[]; todayStr: string; onSelect: (e: Event) => void }) {
  const up = [...events].filter(e => (e.end_date ?? e.event_date) >= todayStr).sort(compareEvents).slice(0, 3);
  if (up.length === 0) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
      {up.map(e => {
        const diff = Math.round((Date.parse(e.event_date) - Date.parse(todayStr)) / 86400000);
        const d = new Date(e.event_date);
        const rel = diff <= 0 ? "오늘" : diff === 1 ? "내일" : diff === 2 ? "모레" : "";
        const dd = diff <= 0 ? "지금" : `D-${diff}`;
        return (
          <button key={e.id} data-cat={catKey(e)} onClick={() => onSelect(e)} className="cal-upcard">
            <div className="ribbon">
              <span className="evt-dot inline-block w-[7px] h-[7px] rounded-full" />
              {rel ? `${rel} · ` : ""}{d.getMonth() + 1}월 {d.getDate()}일 {WEEKDAYS[d.getDay()]}요일
            </div>
            <h5>{e.title}</h5>
            <div className="date-loc">
              <strong>{isMultiDay(e) ? `${fmtMD(e.event_date)} — ${fmtMD(e.end_date!)}` : (e.start_time ?? "시간 미정")}</strong>
              {e.location ? ` · ${e.location}` : ""}
            </div>
            <div className="countdown">
              <span className="big">{dd}{diff <= 0 && <sub> 시작</sub>}</span>
              <span className="add">자세히 →</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ════════ 모바일 미니 캘린더 (시안 mini-cal) ════════
function MiniCalendar({
  year, month, events, todayStr, selectedStr, onSelectDay,
}: {
  year: number; month: number; events: Event[]; todayStr: string; selectedStr: string; onSelectDay: (ds: string) => void;
}) {
  const grid = monthGridDates(year, month);
  return (
    <div className="cal-mini">
      <div className="cal-mini-grid">
        {WEEKDAYS.map((d, i) => (
          <span key={d} className={`dow ${i === 0 ? "sun" : i === 6 ? "sat" : ""}`}>{d}</span>
        ))}
        {grid.map((d, i) => {
          const ds = dateToStr(d);
          const inMonth = d.getMonth() === month - 1;
          const dow = d.getDay();
          const isToday = ds === todayStr;
          const isSel = ds === selectedStr;
          const evs = events.filter(e => eventOverlapsDate(e, ds));
          return (
            <span
              key={i}
              onClick={() => onSelectDay(ds)}
              className={`cal-mini-d ${!inMonth ? "muted" : ""} ${dow === 0 ? "sun" : dow === 6 ? "sat" : ""} ${isToday ? "today" : isSel ? "selected" : ""}`}
            >
              {d.getDate()}
              {evs.length > 0 && (
                <span className="dots">
                  {evs.slice(0, 3).map((e, j) => <span key={j} data-cat={catKey(e)} className="e" />)}
                </span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ════════ 모바일 선택일 상세 (시안 day-detail + evt-card) ════════
function MobileDayDetail({
  dateStr, events, todayStr, now, onSelect,
}: {
  dateStr: string; events: Event[]; todayStr: string; now: Date; onSelect: (e: Event) => void;
}) {
  const d = new Date(dateStr);
  const dow = d.getDay();
  const isToday = dateStr === todayStr;
  const evs = events
    .filter(e => eventOverlapsDate(e, dateStr))
    .sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));
  return (
    <div className="mt-5">
      <div className="cal-dd-head">
        <span className="cal-dd-date">{d.getDate()}</span>
        <div className="flex-1">
          <div className="text-[11px] text-[var(--cal-ink3)] tracking-wide uppercase font-semibold">{d.getFullYear()}년 {d.getMonth() + 1}월</div>
          <div className="cal-dd-name"><b>{WEEKDAYS[dow]}요일</b>{isToday ? " · 오늘" : ""}</div>
        </div>
      </div>
      {evs.length === 0 ? (
        <div className="py-8 text-center text-sm text-[var(--cal-ink3)]">이 날은 일정이 없습니다.</div>
      ) : (
        evs.map(e => {
          const st = statusInfo(e, now, todayStr);
          return (
            <button key={e.id} data-cat={catKey(e)} onClick={() => onSelect(e)} className="cal-evtcard">
              <div className="flex gap-1.5">
                <span className="cal-tag soft">{CAT_LABEL[catKey(e)]}</span>
                <span className="cal-tag kind">{CATEGORY_LABEL[e.category] ?? "일반"}</span>
              </div>
              <div className="flex justify-between items-start gap-3">
                <h4>{e.title}</h4>
                <span className={`cal-status ${st.cls}`}>{st.label}</span>
              </div>
              <div className="cal-meta">
                {(e.start_time || isMultiDay(e)) && (
                  <span><IconClock /> {isMultiDay(e) ? `${fmtMD(e.event_date)} — ${fmtMD(e.end_date!)}` : e.start_time}</span>
                )}
                {e.location && <span><IconPin /> {e.location}</span>}
              </div>
            </button>
          );
        })
      )}
    </div>
  );
}

// ════════════ 메인 페이지 ════════════

export default function CalendarPage() {
  const today = new Date();
  const todayStr = dateToStr(today);
  const { currentGroup } = useNavigation();
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState<Date>(today);
  const [events, setEvents] = useState<Event[]>([]);
  const [selected, setSelected] = useState<Event | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterKind, setFilterKind] = useState("all");
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  // 모바일 미니캘린더 선택일 (기본 오늘)
  const [mobileDay, setMobileDay] = useState<string>(todayStr);
  const [editForm, setEditForm] = useState<{
    title: string; event_date: string; end_date: string;
    start_time: string; location: string; description: string;
  }>({ title: "", event_date: "", end_date: "", start_time: "", location: "", description: "" });
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
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
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
          .then(r => (r.ok ? r.json() : []))
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

  // 현재 뷰 범위의 행사 풀 (구분 필터 적용 전) — cat-bar 카운트 기준
  const viewPool = (() => {
    if (viewMode === "week") {
      const ws = dateToStr(startOfWeek(cursor));
      const we = dateToStr(addDays(startOfWeek(cursor), 6));
      return events.filter(e => {
        const start = e.event_date, end = e.end_date ?? e.event_date;
        return !(end < ws || start > we);
      });
    }
    if (viewMode === "day") {
      const ds = dateToStr(cursor);
      return events.filter(e => eventOverlapsDate(e, ds));
    }
    const y = cursor.getFullYear(), m = cursor.getMonth() + 1;
    const first = `${y}-${String(m).padStart(2, "0")}-01`;
    const last = `${y}-${String(m).padStart(2, "0")}-${new Date(y, m, 0).getDate()}`;
    return events.filter(e => {
      const start = e.event_date, end = e.end_date ?? e.event_date;
      return !(end < first || start > last);
    });
  })();

  const filtered = filterKind === "all" ? viewPool : viewPool.filter(e => e.event_kind === filterKind);
  // 모바일: 달 전체 풀(구분 필터 적용) — 미니캘린더 점·선택일 상세에 사용
  const monthPool = (() => {
    const y = cursor.getFullYear(), m = cursor.getMonth() + 1;
    const first = `${y}-${String(m).padStart(2, "0")}-01`;
    const last = `${y}-${String(m).padStart(2, "0")}-${new Date(y, m, 0).getDate()}`;
    const inMonth = events.filter(e => {
      const start = e.event_date, end = e.end_date ?? e.event_date;
      return !(end < first || start > last);
    });
    return filterKind === "all" ? inMonth : inMonth.filter(e => e.event_kind === filterKind);
  })();

  // cat-bar 칩 렌더 (데스크탑 wrap / 모바일 nowrap-scroll 공용)
  function CatBar({ scroll }: { scroll?: boolean }) {
    return (
      <div className={scroll
        ? "flex gap-1.5 pb-4 mb-4 border-b border-[var(--color-border)] overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        : "flex flex-wrap gap-2 pb-6 mb-6 border-b border-[var(--color-border)]"}>
        {FILTER_CATS.map(f => {
          const count = f.value === "all" ? viewPool.length : viewPool.filter(e => e.event_kind === f.value).length;
          return (
            <button
              key={f.value}
              data-cat={f.cat ?? undefined}
              onClick={() => setFilterKind(f.value)}
              className={`cal-chip shrink-0 ${filterKind === f.value ? "on" : ""}`}
            >
              {f.cat && <span className="dot" />}
              <span>{f.label}</span>
              <span className="count">{count}</span>
            </button>
          );
        })}
      </div>
    );
  }

  const monthLabel = `${cursor.getFullYear()} · ${cursor.getMonth() + 1}월`;

  return (
    <>
      <PageHeader
        group="알림과 게시판"
        title="행사 일정"
        subtitle="본당의 행사 · 모임 · 봉사 · 순례 일정을 한 곳에서 확인하세요."
        action={
          <div className="hidden md:flex items-center relative" ref={pickerRef}>
            <div className="cal-datenav">
              <button onClick={() => navigate(-1)} className="nav" aria-label="이전">
                <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" width="14" height="14"><polyline points="9 3 5 7 9 11" /></svg>
              </button>
              <button
                type="button"
                onClick={() => { if (!pickerOpen) setPickerYear(cursor.getFullYear()); setPickerOpen(v => !v); }}
                className="label"
                title="년월 빠른 선택"
              >
                {navigationLabel()}
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" width="12" height="12"><polyline points="3 5 6 8 9 5" /></svg>
              </button>
              <button onClick={() => navigate(1)} className="nav" aria-label="다음">
                <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" width="14" height="14"><polyline points="5 3 9 7 5 11" /></svg>
              </button>
            </div>

            {pickerOpen && (
              <div className="absolute top-full right-0 mt-2 z-50 w-64 bg-white border border-[var(--color-border)] rounded-xl shadow-xl p-3">
                <div className="flex items-center justify-between mb-3">
                  <button type="button" onClick={() => setPickerYear(y => y - 1)} className="px-2 py-1 rounded hover:bg-gray-100 text-[var(--color-text)]">‹</button>
                  <button type="button" onClick={() => { setCursor(new Date()); setPickerOpen(false); }} className="text-sm font-semibold text-[var(--color-primary)] hover:underline" title="오늘로">{pickerYear}년</button>
                  <button type="button" onClick={() => setPickerYear(y => y + 1)} className="px-2 py-1 rounded hover:bg-gray-100 text-[var(--color-text)]">›</button>
                </div>
                <div className="flex justify-between text-[11px] text-[var(--color-text-muted)] mb-3 px-1">
                  <button type="button" onClick={() => setPickerYear(today.getFullYear() - 10)} className="hover:text-[var(--color-primary)]">-10년</button>
                  <button type="button" onClick={() => setPickerYear(today.getFullYear() - 5)} className="hover:text-[var(--color-primary)]">-5년</button>
                  <button type="button" onClick={() => setPickerYear(today.getFullYear() - 1)} className="hover:text-[var(--color-primary)]">작년</button>
                  <button type="button" onClick={() => setPickerYear(today.getFullYear())} className="hover:text-[var(--color-primary)] font-medium">올해</button>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                    const isCurrent = pickerYear === cursor.getFullYear() && m === cursor.getMonth() + 1;
                    const isTodayM = pickerYear === today.getFullYear() && m === today.getMonth() + 1;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => { setCursor(new Date(pickerYear, m - 1, 1)); setPickerOpen(false); }}
                        className={`py-2 text-xs rounded transition-colors ${
                          isCurrent ? "bg-[var(--color-primary)] text-white"
                          : isTodayM ? "border border-[var(--color-primary)] text-[var(--color-primary)] bg-white"
                          : "hover:bg-[var(--color-surface-warm)] text-[var(--color-text)]"
                        }`}
                      >{m}월</button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        }
      />

      <div className="cal-root max-w-[1320px] mx-auto px-5 lg:px-14 py-8">
        <div className="flex flex-col md:flex-row md:gap-10">
          {currentGroup && currentGroup.items.length > 0 && (
            <div
              className={`shrink-0 md:relative md:transition-[width,opacity] md:duration-300 md:ease-out ${
                collapsed ? "md:w-0 md:opacity-0" : "md:w-[var(--sidebar-w)] md:opacity-100"
              }`}
              style={{ ["--sidebar-w" as string]: `${currentGroup.sidebar_width_px}px` } as React.CSSProperties}
              aria-hidden={collapsed ? true : undefined}
            >
              {/* 토글을 sticky 안에 두어 스크롤 시 사진·메뉴와 함께 따라오게 함 (v1.5.368).
                  overflow-hidden 이 SectionSidebar 자체 sticky 를 깨므로 이 wrapper 에 sticky 적용. */}
              <div className="md:overflow-hidden md:sticky md:self-start md:top-44">
                <SidebarCollapseTab collapsed={collapsed} onToggle={toggleCollapsed} />
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

            {/* ━━━━━━ 데스크탑 (md+) ━━━━━━ */}
            <div className="hidden md:block">
              <div className="flex items-center justify-between gap-4 mb-5">
                <div className="cal-viewswitch">
                  {VIEW_TABS.map(t => (
                    <button key={t.value} className={viewMode === t.value ? "on" : ""} onClick={() => setViewMode(t.value)}>{t.label}</button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button className="cal-btn-today" onClick={() => setCursor(new Date())}>오늘로</button>
                  {canManage && (
                    <button className="cal-btn-add" onClick={() => openCreateForDate(todayStr)}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><line x1="6" y1="2" x2="6" y2="10" /><line x1="2" y1="6" x2="10" y2="6" /></svg>
                      일정 등록
                    </button>
                  )}
                </div>
              </div>

              <CatBar />

              {loading ? (
                <p className="text-center text-sm text-[var(--cal-ink3)] py-12">불러오는 중…</p>
              ) : viewMode === "month" ? (
                <>
                  <MonthView
                    year={cursor.getFullYear()} month={cursor.getMonth() + 1}
                    events={filtered} todayStr={todayStr}
                    onSelect={setSelected} onCreateForDate={canManage ? openCreateForDate : undefined}
                  />
                  <UpcomingStrip events={events} todayStr={todayStr} onSelect={setSelected} />
                </>
              ) : viewMode === "week" ? (
                <WeekView
                  weekStart={startOfWeek(cursor)} events={filtered} todayStr={todayStr}
                  onSelect={setSelected} onCreateForDate={canManage ? openCreateForDate : undefined}
                />
              ) : viewMode === "day" ? (
                <DayView
                  date={cursor} events={filtered} todayStr={todayStr} now={today}
                  onSelect={setSelected} onCreateForDate={canManage ? openCreateForDate : undefined}
                />
              ) : (
                <ListView events={filtered} monthLabel={monthLabel} todayStr={todayStr} now={today} onSelect={setSelected} />
              )}
            </div>

            {/* ━━━━━━ 모바일 (<md) — 시안 events-mobile.html ━━━━━━ */}
            <div className="md:hidden">
              {/* date-nav (풀폭 pill) */}
              <div className="cal-datenav mb-4" style={{ display: "flex", justifyContent: "space-between", paddingLeft: 12 }}>
                <span className="label">{navigationLabel()}</span>
                <div className="flex gap-0.5">
                  <button onClick={() => navigate(-1)} className="nav" aria-label="이전">
                    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" width="12" height="12"><polyline points="9 3 5 7 9 11" /></svg>
                  </button>
                  <button onClick={() => { setCursor(new Date()); setMobileDay(todayStr); }} className="nav" style={{ width: "auto", padding: "0 12px", fontSize: 11, fontWeight: 600 }} aria-label="오늘로">오늘</button>
                  <button onClick={() => navigate(1)} className="nav" aria-label="다음">
                    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" width="12" height="12"><polyline points="5 3 9 7 5 11" /></svg>
                  </button>
                </div>
              </div>

              {/* view switch + add */}
              <div className="flex items-center justify-between gap-2 mb-3.5">
                <div className="cal-viewswitch">
                  {VIEW_TABS.map(t => (
                    <button key={t.value} className={viewMode === t.value ? "on" : ""} onClick={() => setViewMode(t.value)} style={{ padding: "7px 14px", fontSize: 12 }}>{t.label}</button>
                  ))}
                </div>
                {canManage && (
                  <button onClick={() => openCreateForDate(mobileDay)} className="w-9 h-9 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center shrink-0" aria-label="일정 등록">
                    <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><line x1="6" y1="2" x2="6" y2="10" /><line x1="2" y1="6" x2="10" y2="6" /></svg>
                  </button>
                )}
              </div>

              <CatBar scroll />

              {loading ? (
                <p className="text-center text-sm text-[var(--cal-ink3)] py-12">불러오는 중…</p>
              ) : viewMode === "list" ? (
                <ListView events={filtered} monthLabel={monthLabel} todayStr={todayStr} now={today} onSelect={setSelected} />
              ) : (
                <>
                  <MiniCalendar
                    year={cursor.getFullYear()} month={cursor.getMonth() + 1}
                    events={monthPool} todayStr={todayStr} selectedStr={mobileDay} onSelectDay={setMobileDay}
                  />
                  <MobileDayDetail dateStr={mobileDay} events={monthPool} todayStr={todayStr} now={today} onSelect={setSelected} />
                  <div className="mt-8 pt-1">
                    <div className="pb-3.5 mb-1 border-b border-[var(--color-border)]">
                      <div className="text-[10px] tracking-[0.16em] uppercase text-[var(--color-primary)] font-bold mb-1.5">다가오는 일정 · Upcoming</div>
                      <h3 className="text-[18px] font-bold tracking-[-0.02em]">이번 달 다가오는 일정</h3>
                    </div>
                    <UpcomingStrip events={events} todayStr={todayStr} onSelect={setSelected} />
                  </div>
                </>
              )}
            </div>

            {/* ━━━━━━ 상세 모달 ━━━━━━ */}
            {selected && (
              <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => { setSelected(null); setEditing(false); }}>
                <div className={`bg-white rounded-2xl p-6 w-full shadow-xl ${editing ? "max-w-md" : "max-w-sm"}`} onClick={e => e.stopPropagation()}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-1.5 flex-wrap" data-cat={catKey(selected)}>
                      <span className="cal-tag soft">{CAT_LABEL[catKey(selected)]}</span>
                      <span className="cal-tag kind">{CATEGORY_LABEL[selected.category] ?? "일반"}</span>
                      <span className={`cal-status ${statusInfo(selected, today, todayStr).cls}`}>{statusInfo(selected, today, todayStr).label}</span>
                    </div>
                    <button onClick={() => setSelected(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">✕</button>
                  </div>
                  <h3 className="text-lg font-bold text-[var(--color-primary)] mb-3">{selected.title}</h3>
                  <div className="space-y-2 text-sm text-[var(--color-text-muted)]">
                    <p>
                      📅 {new Date(selected.event_date).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
                      {selected.end_date && selected.end_date !== selected.event_date
                        ? ` ~ ${new Date(selected.end_date).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}` : ""}
                      {selected.start_time && ` ${selected.start_time}`}
                    </p>
                    {selected.location && <p>📍 {selected.location}</p>}
                    {selected.description && <div className="mt-3"><MarkdownContent content={selected.description} /></div>}
                  </div>

                  {canManage && !editing && (
                    <div className="mt-5 pt-4 border-t border-[var(--color-border)] flex gap-2 justify-end">
                      <button type="button" onClick={startEditEvent} className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-primary)] transition-colors">수정</button>
                      <button type="button" onClick={handleDeleteEvent} disabled={deleting} className="text-xs px-3 py-1.5 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors">{deleting ? "삭제 중…" : "삭제"}</button>
                    </div>
                  )}

                  {canManage && editing && (
                    <div className="mt-4 space-y-2 border-t border-[var(--color-border)] pt-4">
                      <p className="text-xs font-semibold text-[var(--color-primary)]">편집 중</p>
                      <input value={editForm.title} onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))} placeholder="제목" className="w-full border border-[var(--color-border)] rounded-md px-2 py-1.5 text-sm" />
                      <div className="grid grid-cols-2 gap-2">
                        <input type="date" value={editForm.event_date} onChange={(e) => setEditForm((p) => ({ ...p, event_date: e.target.value }))} className="border border-[var(--color-border)] rounded-md px-2 py-1.5 text-sm" />
                        <input type="date" value={editForm.end_date} onChange={(e) => setEditForm((p) => ({ ...p, end_date: e.target.value }))} placeholder="종료일 (선택)" className="border border-[var(--color-border)] rounded-md px-2 py-1.5 text-sm" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input value={editForm.start_time} onChange={(e) => setEditForm((p) => ({ ...p, start_time: e.target.value }))} placeholder="시간 (예: 19:30)" className="border border-[var(--color-border)] rounded-md px-2 py-1.5 text-sm" />
                        <input value={editForm.location} onChange={(e) => setEditForm((p) => ({ ...p, location: e.target.value }))} placeholder="장소" className="border border-[var(--color-border)] rounded-md px-2 py-1.5 text-sm" />
                      </div>
                      <textarea value={editForm.description} onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))} rows={6} placeholder="설명" className="w-full border border-[var(--color-border)] rounded-md px-2 py-1.5 text-sm resize-y" />
                      <div className="flex gap-2 pt-1">
                        <button type="button" onClick={handleSaveEvent} disabled={saving || !editForm.title.trim() || !editForm.event_date} className="flex-1 text-xs px-3 py-1.5 bg-[var(--color-primary)] text-white rounded-md font-medium hover:bg-[var(--color-primary-light)] disabled:opacity-50">{saving ? "저장 중…" : "저장"}</button>
                        <button type="button" onClick={() => setEditing(false)} disabled={saving} className="text-xs px-3 py-1.5 border border-[var(--color-border)] rounded-md disabled:opacity-50">취소</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ━━━━━━ 신규 등록 모달 ━━━━━━ */}
            {creatingDate && canManage && (
              <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !saving && setCreatingDate(null)}>
                <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-bold text-[var(--color-primary)]">새 일정 추가</h3>
                    <button onClick={() => !saving && setCreatingDate(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">✕</button>
                  </div>
                  <div className="space-y-2">
                    <input value={createForm.title} onChange={(e) => setCreateForm((p) => ({ ...p, title: e.target.value }))} placeholder="제목 *" className="w-full border border-[var(--color-border)] rounded-md px-2 py-1.5 text-sm" autoFocus />
                    <div className="grid grid-cols-2 gap-2">
                      <input type="date" value={createForm.event_date} onChange={(e) => setCreateForm((p) => ({ ...p, event_date: e.target.value }))} className="border border-[var(--color-border)] rounded-md px-2 py-1.5 text-sm" />
                      <input type="date" value={createForm.end_date} onChange={(e) => setCreateForm((p) => ({ ...p, end_date: e.target.value }))} placeholder="종료일 (선택)" className="border border-[var(--color-border)] rounded-md px-2 py-1.5 text-sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input value={createForm.start_time} onChange={(e) => setCreateForm((p) => ({ ...p, start_time: e.target.value }))} placeholder="시간 (예: 19:30)" className="border border-[var(--color-border)] rounded-md px-2 py-1.5 text-sm" />
                      <input value={createForm.location} onChange={(e) => setCreateForm((p) => ({ ...p, location: e.target.value }))} placeholder="장소" className="border border-[var(--color-border)] rounded-md px-2 py-1.5 text-sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <select value={createForm.event_kind} onChange={(e) => setCreateForm((p) => ({ ...p, event_kind: e.target.value }))} className="border border-[var(--color-border)] rounded-md px-2 py-1.5 text-sm bg-white">
                        {KIND_OPTIONS.map(k => <option key={k} value={k}>구분: {k}</option>)}
                        <option value="">구분 없음</option>
                      </select>
                      <select value={createForm.category} onChange={(e) => setCreateForm((p) => ({ ...p, category: e.target.value }))} className="border border-[var(--color-border)] rounded-md px-2 py-1.5 text-sm bg-white">
                        <option value="general">분류: 일반</option>
                        <option value="liturgy">분류: 전례</option>
                        <option value="community">분류: 공동체</option>
                        <option value="education">분류: 교육</option>
                        <option value="special">분류: 특별행사</option>
                      </select>
                    </div>
                    <textarea value={createForm.description} onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))} rows={5} placeholder="설명 (선택)" className="w-full border border-[var(--color-border)] rounded-md px-2 py-1.5 text-sm resize-y" />
                    <div className="flex gap-2 pt-2">
                      <button type="button" onClick={handleCreateEvent} disabled={saving || !createForm.title.trim() || !createForm.event_date} className="flex-1 text-xs px-3 py-1.5 bg-[var(--color-primary)] text-white rounded-md font-medium hover:bg-[var(--color-primary-light)] disabled:opacity-50">{saving ? "등록 중…" : "등록"}</button>
                      <button type="button" onClick={() => setCreatingDate(null)} disabled={saving} className="text-xs px-3 py-1.5 border border-[var(--color-border)] rounded-md disabled:opacity-50">취소</button>
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
