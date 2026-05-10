import Link from "next/link";
import Image from "next/image";
import type { Bulletin } from "@/lib/api";
import HomeBoards from "./HomeBoards";
import MiniCalendar from "./MiniCalendar";
import PhotoSlider from "./PhotoSlider";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const DAY_ORDER: Record<string, number> = {
  "주일": 0, "월요일": 1, "화요일": 2, "수요일": 3,
  "목요일": 4, "금요일": 5, "토요일": 6, "공휴일": 7,
};

const WEEKDAYS = ["월요일", "화요일", "수요일", "목요일", "금요일"];
const SHORT: Record<string, string> = {
  "월요일": "월", "화요일": "화", "수요일": "수", "목요일": "목", "금요일": "금",
};

interface MassEntry { day: string; time: string; note: string; }
interface Parish {
  name: string; phone: string | null; address: string | null;
  fax: string | null;
  mass_schedule: { entries: MassEntry[]; note: string; } | null;
}
interface Notice { id: number; title: string; is_pinned: boolean; created_at: string; }
interface GospelToday {
  date: string;
  liturgical_season: string | null;
  gospel_reference: string | null;
  gospel_text: string | null;
}

async function getParish(): Promise<Parish | null> {
  try { const r = await fetch(`${API}/api/parish/`, { next: { revalidate: 3600 } }); return r.ok ? r.json() : null; } catch { return null; }
}
async function getNotices(): Promise<Notice[]> {
  try { const r = await fetch(`${API}/api/notices/`, { next: { revalidate: 300 } }); return r.ok ? r.json() : []; } catch { return []; }
}
async function getBulletins(): Promise<Bulletin[]> {
  try { const r = await fetch(`${API}/api/bulletins/`, { next: { revalidate: 300 } }); return r.ok ? r.json() : []; } catch { return []; }
}
async function getGospelToday(): Promise<GospelToday | null> {
  try {
    const r = await fetch(`${API}/api/gospel/today`, { next: { revalidate: 3600 } });
    if (!r.ok) return null;
    const json = await r.json();
    return json.success ? json.data : null;
  } catch { return null; }
}

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h < 12 ? "오전" : "오후";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${period} ${hour}시` : `${period} ${hour}시 ${String(m).padStart(2, "0")}분`;
}

function formatTimesRow(times: string[]): string {
  const am = times.filter((t) => parseInt(t) < 12).map(formatTime);
  const pm = times.filter((t) => parseInt(t) >= 12).map(formatTime);
  return [...am, ...pm].join(", ");
}

function buildMassRows(entries: MassEntry[]): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];

  const sunday = entries.filter((e) => e.day === "주일").map((e) => e.time);
  if (sunday.length) rows.push({ label: "주일", value: formatTimesRow(sunday) });

  const wdMap: Record<string, string[]> = {};
  for (const e of entries) {
    if (WEEKDAYS.includes(e.day)) {
      (wdMap[e.day] ??= []).push(e.time);
    }
  }
  const wdKeys = WEEKDAYS.filter((d) => wdMap[d]);
  if (wdKeys.length) {
    const first = JSON.stringify(wdMap[wdKeys[0]]);
    const allSame = wdKeys.every((d) => JSON.stringify(wdMap[d]) === first);
    if (allSame) {
      rows.push({ label: "평일", value: formatTimesRow(wdMap[wdKeys[0]]) });
    } else {
      for (const day of wdKeys) {
        rows.push({ label: SHORT[day], value: formatTimesRow(wdMap[day]) });
      }
    }
  }

  const sat = entries.filter((e) => e.day === "토요일").map((e) => e.time);
  if (sat.length) rows.push({ label: "토요일", value: formatTimesRow(sat) });

  return rows;
}

const QUICK_LINKS = [
  { href: "/bulletin", label: "주보 보기", icon: "📖" },
  { href: "/about", label: "성당 안내", icon: "⛪" },
  { href: "/calendar", label: "행사 일정", icon: "📅" },
  { href: "/info", label: "미사 시간", icon: "⏰" },
  { href: "/word", label: "오늘의 복음", icon: "✝️" },
  { href: "/boards/notice", label: "공지·알림", icon: "📢" },
];

const CONTAINER = "max-w-5xl mx-auto px-4";

export default async function HomePage() {
  const [parish, notices, bulletins, gospel] = await Promise.all([
    getParish(), getNotices(), getBulletins(), getGospelToday(),
  ]);

  const entries = parish?.mass_schedule?.entries ?? [];
  const massRows = buildMassRows(entries);

  // 공지: 핀 우선 + 최신순
  const sortedNotices = [...notices].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    return b.created_at.localeCompare(a.created_at);
  });

  return (
    <div>
      {/* ── 메인 3단 ── */}
      <section className={`${CONTAINER} py-5 sm:py-7`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* 큰 사진 */}
          <div className="relative w-full aspect-[4/3] md:aspect-auto md:min-h-[260px] rounded-xl overflow-hidden border border-[var(--color-border)] group">
            <Image
              src="/yakhoun.jpg"
              alt="세종성베드로성당"
              fill
              priority
              className="object-cover group-hover:scale-105 transition-transform duration-700"
              sizes="(max-width: 768px) 100vw, 33vw"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent p-4">
              <p className="text-white font-serif font-bold text-base leading-tight tracking-tight">
                {parish?.name ?? "세종성베드로성당"}
              </p>
              <p className="text-white/80 text-[11px] mt-0.5 tracking-wider">
                ST. PETER&apos;S CATHEDRAL · SEJONG
              </p>
            </div>
          </div>

          {/* 오늘의 복음 */}
          <div className="border border-[var(--color-border)] rounded-xl p-4 flex flex-col bg-white hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between mb-2.5 pb-2.5 border-b border-[var(--color-border)]">
              <h2 className="font-serif font-bold text-[var(--color-primary)] text-sm flex items-center gap-1.5">
                <span className="text-[var(--color-accent)]">✝</span>
                오늘의 복음
              </h2>
              {gospel?.liturgical_season && (
                <span className="text-[10px] text-[var(--color-text-muted)] truncate ml-2">
                  {gospel.liturgical_season}
                </span>
              )}
            </div>
            {gospel?.gospel_text ? (
              <>
                <blockquote
                  className="text-[12.5px] text-[var(--color-text)] leading-relaxed flex-1 italic overflow-hidden"
                  style={{ display: "-webkit-box", WebkitLineClamp: 7, WebkitBoxOrient: "vertical" } as React.CSSProperties}
                >
                  &ldquo;{gospel.gospel_text}&rdquo;
                </blockquote>
                {gospel.gospel_reference && (
                  <cite className="block text-[11px] text-[var(--color-text-muted)] mt-2 not-italic">
                    — {gospel.gospel_reference}
                  </cite>
                )}
                <Link
                  href="/word"
                  className="inline-block mt-2 text-[11px] font-medium text-[var(--color-primary)] hover:underline"
                >
                  전체 보기 →
                </Link>
              </>
            ) : (
              <p className="text-xs text-[var(--color-text-muted)] flex-1 flex items-center justify-center">
                오늘의 말씀을 불러오는 중입니다…
              </p>
            )}
          </div>

          {/* 미사 시간 */}
          <div className="border border-[var(--color-border)] rounded-xl p-4 flex flex-col bg-white hover:shadow-sm transition-shadow">
            <div className="mb-2.5 pb-2.5 border-b border-[var(--color-border)]">
              <h2 className="font-serif font-bold text-[var(--color-primary)] text-sm flex items-center gap-1.5">
                <span className="text-[var(--color-accent)]">⏰</span>
                미사 시간
              </h2>
            </div>
            {massRows.length > 0 ? (
              <table className="text-xs w-full flex-1">
                <tbody>
                  {massRows.map((row) => (
                    <tr key={row.label} className="align-top">
                      <td className="text-[var(--color-text-muted)] pr-2 pb-1.5 whitespace-nowrap w-10 font-medium">
                        {row.label}
                      </td>
                      <td className="pb-1.5 text-[var(--color-text)] leading-relaxed">
                        {row.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-xs text-[var(--color-text-muted)] flex-1 flex items-center justify-center">
                미사 시간 정보가 없습니다.
              </p>
            )}
            {parish?.mass_schedule?.note && (
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1.5 leading-relaxed">
                ※ {parish.mass_schedule.note}
              </p>
            )}
            <Link
              href="/info"
              className="inline-block mt-2 text-[11px] font-medium text-[var(--color-primary)] hover:underline"
            >
              찾아오시는 길 →
            </Link>
          </div>
        </div>
      </section>

      {/* ── 빠른 메뉴 6개 ── */}
      <section className="border-t border-[var(--color-border)] bg-[var(--color-surface-warm)]/40">
        <div className={`${CONTAINER} py-6`}>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2.5 sm:gap-3">
            {QUICK_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center gap-1.5 px-2 py-4 border border-[var(--color-border)] rounded-xl bg-white hover:border-[var(--color-primary)] hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200"
              >
                <span className="text-2xl leading-none">{item.icon}</span>
                <span className="text-[11px] sm:text-xs font-medium text-[var(--color-text)] text-center leading-tight">
                  {item.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── 공지(좌) + 미니 캘린더(우) ── */}
      <section className="border-t border-[var(--color-border)]">
        <div className={`${CONTAINER} py-7`}>
          <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-4">

            {/* 공지사항 */}
            <div className="border border-[var(--color-border)] rounded-xl bg-white overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-surface-warm)]">
                <h2 className="font-serif font-bold text-[var(--color-primary)] text-sm flex items-center gap-1.5">
                  <span className="text-[var(--color-accent)]">📢</span>
                  공지사항
                </h2>
                <Link
                  href="/boards/notice"
                  className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                >
                  더 보기 →
                </Link>
              </div>
              {sortedNotices.length === 0 ? (
                <p className="text-xs text-[var(--color-text-muted)] text-center py-10">
                  등록된 공지사항이 없습니다.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--color-border)]/60">
                  {sortedNotices.slice(0, 7).map((n) => (
                    <li key={n.id}>
                      <Link
                        href={`/boards/notice/${n.id}`}
                        className="flex items-baseline gap-2 px-4 py-2.5 hover:bg-[var(--color-surface-warm)] transition-colors"
                      >
                        {n.is_pinned ? (
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" aria-label="고정" />
                        ) : (
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-border-dark)]/40 shrink-0" />
                        )}
                        <span
                          className={`flex-1 truncate text-[12.5px] ${
                            n.is_pinned
                              ? "font-semibold text-[var(--color-text)]"
                              : "text-[var(--color-text)]"
                          }`}
                        >
                          {n.title}
                        </span>
                        <span className="text-[10.5px] text-[var(--color-text-muted)] shrink-0">
                          {new Date(n.created_at).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* 미니 캘린더 */}
            <MiniCalendar />
          </div>
        </div>
      </section>

      {/* ── 사진 슬라이더 (자동 회전) ── */}
      <section className="border-t border-[var(--color-border)] bg-[var(--color-surface-warm)]/40">
        <div className={`${CONTAINER} py-7`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif font-bold text-[var(--color-primary)] text-base flex items-center gap-1.5">
              <span className="text-[var(--color-accent)]">📷</span>
              사진 갤러리
            </h2>
            <div className="flex items-center gap-3 text-[11px]">
              <Link href="/gallery/liturgy" className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)]">
                전례 사진
              </Link>
              <span className="text-[var(--color-border-dark)]">·</span>
              <Link href="/gallery/events" className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)]">
                행사 사진
              </Link>
            </div>
          </div>
          <PhotoSlider />
        </div>
      </section>

      {/* ── 게시판 (HomeBoards) ── */}
      <section className="border-t border-[var(--color-border)]">
        <div className={`${CONTAINER} py-8`}>
          <div className="mb-4">
            <h2 className="font-serif font-bold text-[var(--color-primary)] text-base flex items-center gap-1.5">
              <span className="text-[var(--color-accent)]">📰</span>
              소식
            </h2>
          </div>
          <HomeBoards notices={notices.slice(0, 10)} bulletins={bulletins.slice(0, 7)} />
        </div>
      </section>

      {/* ── 마무리 인용 (아기자기 포인트) ── */}
      <section className={`${CONTAINER} py-10`}>
        <div className="text-center">
          <span className="text-[var(--color-accent)] text-2xl">✝</span>
          <blockquote className="font-serif italic text-[var(--color-primary)] text-sm sm:text-base mt-2 leading-relaxed">
            &ldquo;너는 베드로이다. 나는 이 반석 위에 내 교회를 세우겠다.&rdquo;
          </blockquote>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">— 마태오 16,18</p>
        </div>
      </section>
    </div>
  );
}
