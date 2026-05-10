import Link from "next/link";
import Image from "next/image";
import type { Bulletin } from "@/lib/api";
import HomeBoards from "./HomeBoards";

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

export default async function HomePage() {
  const [parish, notices, bulletins, gospel] = await Promise.all([
    getParish(), getNotices(), getBulletins(), getGospelToday(),
  ]);

  const entries = parish?.mass_schedule?.entries ?? [];
  const massRows = buildMassRows(entries);

  return (
    <div>
      {/* ── 메인 3단 — 큰 사진 + 오늘의 복음 + 미사 시간 ── */}
      <section className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">

          {/* 큰 사진 */}
          <div className="relative w-full aspect-[4/3] md:aspect-auto md:min-h-[300px] rounded-xl overflow-hidden border border-[var(--color-border)]">
            <Image
              src="/yakhoun.jpg"
              alt="세종성베드로성당"
              fill
              priority
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 33vw"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent p-4">
              <p className="text-white font-serif font-bold text-lg leading-tight tracking-tight">
                {parish?.name ?? "세종성베드로성당"}
              </p>
              <p className="text-white/80 text-xs mt-0.5">St. Peter&apos;s Cathedral, Sejong</p>
            </div>
          </div>

          {/* 오늘의 복음 */}
          <div className="border border-[var(--color-border)] rounded-xl p-5 flex flex-col bg-white">
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-[var(--color-border)]">
              <h2 className="font-serif font-bold text-[var(--color-primary)] text-base">
                오늘의 복음
              </h2>
              {gospel?.liturgical_season && (
                <span className="text-[11px] text-[var(--color-text-muted)] truncate ml-2">
                  {gospel.liturgical_season}
                </span>
              )}
            </div>
            {gospel?.gospel_text ? (
              <>
                <blockquote
                  className="text-[13.5px] text-[var(--color-text)] leading-relaxed flex-1 italic overflow-hidden"
                  style={{ display: "-webkit-box", WebkitLineClamp: 7, WebkitBoxOrient: "vertical" } as React.CSSProperties}
                >
                  &ldquo;{gospel.gospel_text}&rdquo;
                </blockquote>
                {gospel.gospel_reference && (
                  <cite className="block text-xs text-[var(--color-text-muted)] mt-3 not-italic">
                    — {gospel.gospel_reference}
                  </cite>
                )}
                <Link
                  href="/word"
                  className="inline-block mt-3 text-xs font-medium text-[var(--color-primary)] hover:underline"
                >
                  전체 보기 →
                </Link>
              </>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)] flex-1 flex items-center justify-center">
                오늘의 말씀을 불러오는 중입니다…
              </p>
            )}
          </div>

          {/* 미사 시간 */}
          <div className="border border-[var(--color-border)] rounded-xl p-5 flex flex-col bg-white">
            <div className="mb-3 pb-3 border-b border-[var(--color-border)]">
              <h2 className="font-serif font-bold text-[var(--color-primary)] text-base">
                미사 시간
              </h2>
            </div>
            {massRows.length > 0 ? (
              <table className="text-sm w-full flex-1">
                <tbody>
                  {massRows.map((row) => (
                    <tr key={row.label} className="align-top">
                      <td className="text-[var(--color-text-muted)] pr-3 pb-2 whitespace-nowrap w-12 text-xs font-medium">
                        {row.label}
                      </td>
                      <td className="pb-2 text-[13px] text-[var(--color-text)] leading-relaxed">
                        {row.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)] flex-1 flex items-center justify-center">
                미사 시간 정보가 없습니다.
              </p>
            )}
            {parish?.mass_schedule?.note && (
              <p className="text-[11px] text-[var(--color-text-muted)] mt-2 leading-relaxed">
                ※ {parish.mass_schedule.note}
              </p>
            )}
            <Link
              href="/info"
              className="inline-block mt-3 text-xs font-medium text-[var(--color-primary)] hover:underline"
            >
              찾아오시는 길 →
            </Link>
          </div>
        </div>
      </section>

      {/* ── 빠른 메뉴 6개 ── */}
      <section className="border-t border-[var(--color-border)]">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4">
            {QUICK_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center gap-2 px-2 py-5 border border-[var(--color-border)] rounded-xl bg-white hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-warm)] transition-colors"
              >
                <span className="text-3xl leading-none">{item.icon}</span>
                <span className="text-xs sm:text-sm font-medium text-[var(--color-text)] text-center">
                  {item.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── 게시판 ── */}
      <section className="border-t border-[var(--color-border)]">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <div className="mb-5">
            <h2 className="font-serif font-bold text-[var(--color-primary)] text-xl">소식</h2>
          </div>
          <HomeBoards notices={notices.slice(0, 10)} bulletins={bulletins.slice(0, 7)} />
        </div>
      </section>
    </div>
  );
}
