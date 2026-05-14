import Link from "next/link";
import { fetchServerMenus } from "./fetchServerMenus";
import type { MenuItem } from "./useNavigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function flattenServer(items: MenuItem[]): MenuItem[] {
  const out: MenuItem[] = [];
  for (const it of items) {
    out.push(it);
    if (it.children?.length) out.push(...flattenServer(it.children));
  }
  return out;
}

interface MassEntry { day: string; time: string; note: string; }
interface Parish {
  name: string;
  diocese: string | null;
  address: string | null;
  phone: string | null;
  fax: string | null;
  mass_schedule: { entries: MassEntry[]; note: string } | null;
}

async function getParish(): Promise<Parish | null> {
  try {
    const res = await fetch(`${API}/api/parish/`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h < 12 ? "오전" : "오후";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0
    ? `${period} ${hour}시`
    : `${period} ${hour}시 ${String(m).padStart(2, "0")}분`;
}

function formatTimesRow(times: string[]): string {
  const am = times.filter((t) => parseInt(t) < 12).map(formatTime);
  const pm = times.filter((t) => parseInt(t) >= 12).map(formatTime);
  return [...am, ...pm].join(", ");
}

const WEEKDAYS = ["월요일", "화요일", "수요일", "목요일", "금요일"];
const SHORT: Record<string, string> = {
  "월요일": "월", "화요일": "화", "수요일": "수", "목요일": "목", "금요일": "금",
};

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

/** Footer "바로가기"는 의도된 큐레이션(전체가 아닌 6개)이라 href는 고정.
    label은 메뉴 라벨에서 resolve — 메뉴에 없는 경우만 fallback 사용. */
const QUICK_LINKS: { href: string; fallback: string }[] = [
  { href: "/bulletin", fallback: "주보" },
  { href: "/about",   fallback: "성당 소개" },
  { href: "/pastor",  fallback: "주임신부님" },
  { href: "/history", fallback: "본당 연혁" },
  { href: "/word",    fallback: "오늘의 복음" },
  { href: "/info",    fallback: "찾아오시는 길" },
];

export default async function Footer() {
  const [parish, menus] = await Promise.all([getParish(), fetchServerMenus()]);
  const entries = parish?.mass_schedule?.entries ?? [];
  const massRows = buildMassRows(entries);

  // 메뉴 라벨이 단일 진실 소스. 메뉴에 등록 안 된 href만 fallback 사용.
  const allItems = menus.flatMap((g) => flattenServer(g.items));
  const quickLinks = QUICK_LINKS.map((q) => ({
    href: q.href,
    label: allItems.find((it) => it.href === q.href)?.label ?? q.fallback,
  }));

  return (
    <footer className="bg-white border-t border-[var(--color-border)] text-[var(--color-text)] mt-16">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

          {/* 성당 정보 */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[var(--color-accent)] text-xl">✝</span>
              <span className="font-serif font-bold text-[var(--color-primary)] text-lg">
                {parish?.name ?? "세종성베드로성당"}
              </span>
            </div>
            <address className="not-italic text-sm leading-relaxed space-y-1 text-[var(--color-text-muted)]">
              {parish?.address && <p>{parish.address}</p>}
              {(parish?.phone || parish?.fax) && (
                <p>
                  {parish.phone && <>☏ {parish.phone}</>}
                  {parish.phone && parish.fax && <span className="mx-1.5 text-[var(--color-border-dark)]">|</span>}
                  {parish.fax && <>팩스 {parish.fax}</>}
                </p>
              )}
              {parish?.diocese && <p>{parish.diocese} 소속</p>}
            </address>
          </div>

          {/* 미사 시간 */}
          <div>
            <h3 className="font-serif font-bold text-[var(--color-primary)] mb-4">미사 시간</h3>
            {massRows.length > 0 ? (
              <table className="text-sm w-full">
                <tbody>
                  {massRows.map((row) => (
                    <tr key={row.label}>
                      <td className="text-[var(--color-text-muted)] pr-4 pb-1.5 whitespace-nowrap align-top w-12">
                        {row.label}
                      </td>
                      <td className="pb-1.5 text-[var(--color-text)]">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)]">미사 시간 정보 없음</p>
            )}
            {parish?.mass_schedule?.note && (
              <p className="text-xs text-[var(--color-text-muted)] mt-3">※ {parish.mass_schedule.note}</p>
            )}
          </div>

          {/* 바로가기 */}
          <div>
            <h3 className="font-serif font-bold text-[var(--color-primary)] mb-4">바로가기</h3>
            <nav className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {quickLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        <div className="border-t border-[var(--color-border)] mt-8 pt-6 text-center text-xs text-[var(--color-text-muted)]">
          © {new Date().getFullYear()} {parish?.name ?? "세종성베드로성당"}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
