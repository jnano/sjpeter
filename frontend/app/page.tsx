import Link from "next/link";
import Image from "next/image";
import MiniCalendar from "./MiniCalendar";
import PhotoSlider from "./PhotoSlider";
import BoardTabs, { type BoardTab } from "./BoardTabs";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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
interface BoardPost {
  id: number;
  title: string;
  created_at: string;
}
interface BoardPostList { posts: BoardPost[] }
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
async function getBoardPosts(slug: string): Promise<BoardPost[]> {
  try {
    const r = await fetch(`${API}/api/boards/${slug}/posts?page=1`, { next: { revalidate: 300 } });
    if (!r.ok) return [];
    const data: BoardPostList = await r.json();
    return data.posts ?? [];
  } catch { return []; }
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
  const [parish, notices, gospel, newsPosts, youthPosts] = await Promise.all([
    getParish(),
    getNotices(),
    getGospelToday(),
    getBoardPosts("news"),
    getBoardPosts("youth_council"),
  ]);

  const entries = parish?.mass_schedule?.entries ?? [];
  const massRows = buildMassRows(entries);

  // 공지: 핀 우선 + 최신순
  const sortedNotices = [...notices].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    return b.created_at.localeCompare(a.created_at);
  });

  const boardTabs: BoardTab[] = [
    {
      key: "notice",
      label: "공지사항",
      moreHref: "/boards/notice",
      itemBase: "/boards/notice",
      items: sortedNotices,
    },
    {
      key: "news",
      label: "공동체 소식",
      moreHref: "/boards/news",
      itemBase: "/boards/news",
      items: newsPosts.map((p) => ({ id: p.id, title: p.title, is_pinned: false, created_at: p.created_at })),
    },
    {
      key: "youth",
      label: "청년회",
      moreHref: "/boards/youth_council",
      itemBase: "/boards/youth_council",
      items: youthPosts.map((p) => ({ id: p.id, title: p.title, is_pinned: false, created_at: p.created_at })),
    },
  ];

  return (
    <div>
      {/* ── 메인 3단 ── */}
      <section>
        <div className={`${CONTAINER} py-5 sm:py-7`}>
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
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent p-3.5">
                <p className="text-white font-serif font-bold text-sm leading-tight tracking-tight">
                  {parish?.name ?? "세종성베드로성당"}
                </p>
                <p className="text-white/80 text-[10.3px] mt-0.5 tracking-wider">
                  ST. PETER&apos;S CATHEDRAL · SEJONG
                </p>
              </div>
            </div>

            {/* 오늘의 복음 */}
            <div className="border border-[var(--color-border)] rounded-xl p-4 flex flex-col bg-white hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between mb-2.5 pb-2.5 border-b border-[var(--color-border)]">
                <h2 className="font-serif font-bold text-[var(--color-primary)] text-xs flex items-center gap-1.5">
                  <span className="text-[var(--color-accent)]">✝</span>
                  오늘의 복음
                </h2>
                {gospel?.liturgical_season && (
                  <span className="text-[10.3px] text-[var(--color-text-muted)] truncate ml-2">
                    {gospel.liturgical_season}
                  </span>
                )}
              </div>
              {gospel?.gospel_text ? (
                <>
                  <blockquote
                    className="text-xs text-[var(--color-text)] leading-relaxed flex-1 italic overflow-hidden"
                    style={{ display: "-webkit-box", WebkitLineClamp: 7, WebkitBoxOrient: "vertical" } as React.CSSProperties}
                  >
                    &ldquo;{gospel.gospel_text}&rdquo;
                  </blockquote>
                  {gospel.gospel_reference && (
                    <cite className="block text-[10.8px] text-[var(--color-text-muted)] mt-2 not-italic">
                      — {gospel.gospel_reference}
                    </cite>
                  )}
                  <Link
                    href="/word"
                    className="inline-block mt-2 text-[10.8px] font-medium text-[var(--color-primary)] hover:underline"
                  >
                    전체 보기 →
                  </Link>
                </>
              ) : (
                <p className="text-[11.3px] text-[var(--color-text-muted)] flex-1 flex items-center justify-center">
                  오늘의 말씀을 불러오는 중입니다…
                </p>
              )}
            </div>

            {/* 미사 시간 */}
            <div className="border border-[var(--color-border)] rounded-xl p-4 flex flex-col bg-white hover:shadow-sm transition-shadow">
              <div className="mb-2.5 pb-2.5 border-b border-[var(--color-border)]">
                <h2 className="font-serif font-bold text-[var(--color-primary)] text-xs flex items-center gap-1.5">
                  <span className="text-[var(--color-accent)]">⏰</span>
                  미사 시간
                </h2>
              </div>
              {massRows.length > 0 ? (
                <table className="text-[11.8px] w-full flex-1">
                  <tbody>
                    {massRows.map((row) => (
                      <tr key={row.label} className="align-top">
                        <td className="text-[var(--color-text-muted)] pr-2 pb-1.5 whitespace-nowrap w-9 font-medium">
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
                <p className="text-[11.3px] text-[var(--color-text-muted)] flex-1 flex items-center justify-center">
                  미사 시간 정보가 없습니다.
                </p>
              )}
              {parish?.mass_schedule?.note && (
                <p className="text-[10.3px] text-[var(--color-text-muted)] mt-1.5 leading-relaxed">
                  ※ {parish.mass_schedule.note}
                </p>
              )}
              <Link
                href="/info"
                className="inline-block mt-2 text-[10.8px] font-medium text-[var(--color-primary)] hover:underline"
              >
                찾아오시는 길 →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── 빠른 메뉴 6개 ── */}
      <section>
        <div className={CONTAINER}>
          <div className="border-t border-[var(--color-border)] py-6">
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2.5 sm:gap-3">
              {QUICK_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex flex-col items-center justify-center gap-1.5 px-2 py-3.5 border border-[var(--color-border)] rounded-xl bg-white hover:border-[var(--color-primary)] hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200"
                >
                  <span className="text-2xl leading-none">{item.icon}</span>
                  <span className="text-[10.8px] sm:text-[11.3px] font-medium text-[var(--color-text)] text-center leading-tight">
                    {item.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 게시판 탭(좌) + 미니 캘린더(우) ── */}
      <section>
        <div className={CONTAINER}>
          <div className="border-t border-[var(--color-border)] py-6">
            <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-4">
              <BoardTabs tabs={boardTabs} />
              <MiniCalendar />
            </div>
          </div>
        </div>
      </section>

      {/* ── 사진 슬라이더 (자동 회전) ── */}
      <section>
        <div className={CONTAINER}>
          <div className="border-t border-[var(--color-border)] py-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-serif font-bold text-[var(--color-primary)] text-sm flex items-center gap-1.5">
                <span className="text-[var(--color-accent)]">📷</span>
                사진 갤러리
              </h2>
              <div className="flex items-center gap-3 text-[10.8px]">
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
        </div>
      </section>

      {/* ── 마무리 인용 ── */}
      <section>
        <div className={CONTAINER}>
          <div className="border-t border-[var(--color-border)] py-9 text-center">
            <span className="text-[var(--color-accent)] text-xl">✝</span>
            <blockquote className="font-serif italic text-[var(--color-primary)] text-xs sm:text-sm mt-2 leading-relaxed">
              &ldquo;너는 베드로이다. 나는 이 반석 위에 내 교회를 세우겠다.&rdquo;
            </blockquote>
            <p className="text-[10.8px] text-[var(--color-text-muted)] mt-1">— 마태오 16,18</p>
          </div>
        </div>
      </section>
    </div>
  );
}
