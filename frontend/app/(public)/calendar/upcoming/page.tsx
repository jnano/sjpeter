import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { fetchParishMin } from "@/lib/parish";

export const dynamic = "force-dynamic";

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface EventItem {
  id: number;
  title: string;
  event_date: string;
  end_date: string | null;
  start_time: string | null;
  location: string | null;
  description: string | null;
  event_kind: string | null;   // "행사" | "모임" | null
  category: string | null;
  is_ai_generated: boolean;
}

export async function generateMetadata(): Promise<Metadata> {
  const p = await fetchParishMin();
  return {
    title: "다가오는 일정",
    description: `${p.name} 다가오는 본당 일정 — 행사·모임 한 자리에서 보기`,
  };
}

async function fetchUpcoming(): Promise<EventItem[]> {
  // 백엔드 events 는 year+month 쿼리 기반이라 오늘이 속한 달부터 +1·+2달까지 모아서
  // 클라이언트 측에서 오늘 이후 + 날짜순으로 정렬·중복 제거.
  const now = new Date();
  const months: { y: number; m: number }[] = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push({ y: d.getFullYear(), m: d.getMonth() + 1 });
  }
  try {
    const results = await Promise.all(
      months.map((q) =>
        fetch(`${API}/api/events/?year=${q.y}&month=${q.m}`, { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
      ),
    );
    const flat: EventItem[] = results.flat();
    const seen = new Set<number>();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return flat
      .filter((e) => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        const d = new Date(e.event_date);
        return d.getTime() >= todayStart;
      })
      .sort((a, b) => a.event_date.localeCompare(b.event_date));
  } catch {
    return [];
  }
}

function fmtKDate(iso: string): { mmdd: string; dow: string; full: string } {
  const d = new Date(iso);
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return {
    mmdd: `${d.getMonth() + 1}월 ${d.getDate()}일`,
    dow: `${weekday}요일`,
    full: `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`,
  };
}

function daysFromToday(iso: string): { label: string; isToday: boolean; isTomorrow: boolean } {
  const target = new Date(iso);
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const t1 = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const diff = Math.round((t1 - t0) / 86400000);
  if (diff === 0) return { label: "오늘", isToday: true, isTomorrow: false };
  if (diff === 1) return { label: "내일", isToday: false, isTomorrow: true };
  return { label: `D-${diff}`, isToday: false, isTomorrow: false };
}

function fmtTime(s: string | null): string | null {
  if (!s) return null;
  // 'HH:MM:SS' 또는 'HH:MM' 형식 가정. 초 제거.
  const m = s.match(/^(\d{2}:\d{2})/);
  return m ? m[1] : s;
}

function kindBadge(kind: string | null): { label: string; bg: string; ink: string } | null {
  if (!kind) return null;
  if (kind === "행사") return { label: "행사", bg: "rgba(122,31,43,0.08)", ink: "var(--color-primary)" };
  if (kind === "모임") return { label: "모임", bg: "rgba(46,107,67,0.12)", ink: "#2E6B43" };
  return { label: kind, bg: "var(--color-surface-warm)", ink: "var(--color-text-muted)" };
}

export default async function UpcomingPage() {
  const [events, parish] = await Promise.all([fetchUpcoming(), fetchParishMin()]);
  const total = events.length;

  return (
    <>
      <PageHeader
        group="알림과 게시판"
        title="다가오는 일정"
        subtitle={`${parish.name} 본당의 행사·모임을 가까운 날짜 순서로 보여드립니다`}
      />
      <main className="max-w-[1320px] mx-auto px-5 sm:px-8 lg:px-14 py-8 sm:py-10">

        {/* hero 요약 */}
        <section className="bg-[var(--color-surface-warm)] rounded-3xl p-6 sm:p-8 mb-8 flex items-end justify-between gap-5 flex-wrap">
          <div>
            <span className="inline-flex items-center gap-3 text-[11px] tracking-[0.2em] uppercase text-[var(--color-primary)] font-bold mb-3">
              <span className="w-6 h-px bg-[var(--color-primary)]" />
              Upcoming · 다가오는 일정
            </span>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight leading-snug">
              앞으로 <em className="not-italic text-[var(--color-primary)]">{total}건</em>의 일정이 본당을 기다리고 있습니다
            </h2>
          </div>
          <Link
            href="/calendar"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-[var(--color-border)] rounded-full text-[13px] font-semibold text-[var(--color-text)] hover:border-[var(--color-text-muted)]"
          >
            월간 캘린더 보기 →
          </Link>
        </section>

        {total === 0 ? (
          <div className="bg-white border border-[var(--color-border)] rounded-2xl p-12 text-center">
            <p className="text-4xl mb-3">📅</p>
            <p className="font-semibold text-[var(--color-primary)] mb-1">예정된 일정이 없습니다</p>
            <p className="text-sm text-[var(--color-text-muted)]">
              관리자 페이지에서 일정을 등록하시면 이곳에 표시됩니다.
            </p>
          </div>
        ) : (
          /* upcoming-strip 카드 그리드 */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map((e) => {
              const d = fmtKDate(e.event_date);
              const dt = daysFromToday(e.event_date);
              const time = fmtTime(e.start_time);
              const kind = kindBadge(e.event_kind);
              return (
                <article
                  key={e.id}
                  className={`relative bg-white border rounded-2xl p-5 sm:p-6 flex flex-col gap-2 hover:-translate-y-0.5 transition-all ${
                    dt.isToday ? "border-[var(--color-primary)]" : "border-[var(--color-border)] hover:border-[var(--color-text-muted)]"
                  }`}
                >
                  {/* ribbon */}
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-muted)] font-semibold mb-1">
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <circle cx="5.5" cy="5.5" r="4" />
                      <polyline points="5.5 3 5.5 5.5 7.5 6.5" />
                    </svg>
                    <span>{dt.label} · {d.mmdd} {d.dow}</span>
                    {kind && (
                      <span
                        className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider"
                        style={{ background: kind.bg, color: kind.ink }}
                      >
                        {kind.label}
                      </span>
                    )}
                  </div>

                  {/* 제목 */}
                  <h3 className="text-lg sm:text-xl font-bold tracking-tight leading-snug text-balance line-clamp-2">
                    {e.title}
                  </h3>

                  {/* 시간·장소 */}
                  <p className="text-[13px] text-[var(--color-text-muted)] mt-1">
                    {time && <strong className="text-[var(--color-text)] font-semibold mr-1">{time}</strong>}
                    {time && e.location && " · "}
                    {e.location && <span>{e.location}</span>}
                    {!time && !e.location && <span>{d.full}</span>}
                  </p>

                  {/* countdown + 자세히 */}
                  <div className="mt-3 pt-3 border-t border-[var(--color-border)] flex items-end justify-between gap-2">
                    <div className="leading-none">
                      <span
                        className="text-2xl font-bold tabular-nums"
                        style={{ color: dt.isToday ? "var(--color-primary)" : "var(--color-text)" }}
                      >
                        {dt.isToday ? "오늘" : dt.label}
                      </span>
                      {!dt.isToday && (
                        <small className="text-[11px] text-[var(--color-text-muted)] ml-1 font-semibold">남음</small>
                      )}
                    </div>
                    <Link
                      href={`/calendar?focus=${e.id}`}
                      className="text-[12px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-primary)] inline-flex items-center gap-1"
                    >
                      자세히 →
                    </Link>
                  </div>

                  {e.is_ai_generated && (
                    <span className="absolute top-3 right-3 text-[9px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 font-bold tracking-wider">
                      AI
                    </span>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
