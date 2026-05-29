import { Suspense } from "react";
import Link from "next/link";
import { fetchServerMenus } from "./fetchServerMenus";
import ReportLink from "./ReportLink";
import type { MenuItem } from "./useNavigation";
import LogoFallback from "@/components/icons/LogoFallback";

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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
  logo_url: string | null;
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
      // 같은 시간 패턴을 가진 평일끼리 묶어 한 행으로 (예: "화·목" → 오후 7시 30분)
      const seen = new Set<string>();
      for (const day of wdKeys) {
        const key = JSON.stringify(wdMap[day]);
        if (seen.has(key)) continue;
        seen.add(key);
        const sameDays = wdKeys.filter((d) => JSON.stringify(wdMap[d]) === key);
        rows.push({
          label: sameDays.map((d) => SHORT[d]).join("·"),
          value: formatTimesRow(wdMap[day]),
        });
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

  // footer 전용 그룹(show_in_footer=true) — '관련 사이트' 같은 외부 링크 모음.
  // admin/menus 에서 토글로 켠 그룹만 노출. 항목이 없으면 영역 자체 미렌더.
  const footerGroups = menus.filter((g) => g.show_in_footer && g.items.length > 0);

  const labelOf = (href: string, fallback: string) =>
    quickLinks.find((q) => q.href === href)?.label ?? fallback;
  const logoSrc = parish?.logo_url
    ? (parish.logo_url.startsWith("http") ? parish.logo_url : `${API}${parish.logo_url}`)
    : null;

  return (
    <footer className="site-foot">
      <div className="site-foot-inner">

        {/* 브랜드 */}
        <div className="site-foot-brand">
          <Link href="/" className="site-logo">
            {logoSrc ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={logoSrc} alt={parish?.name ?? "본당 홈페이지"} className="site-logo-mark" style={{ objectFit: "contain" }} />
            ) : (
              <LogoFallback className="site-logo-mark" />
            )}
            <span className="site-logo-text">{parish?.name ?? "본당 홈페이지"}</span>
          </Link>
          {parish?.address && <p>{parish.address}</p>}
          {(parish?.phone || parish?.fax) && (
            <div className="phones">
              {parish.phone && <>☎ {parish.phone}</>}
              {parish.phone && parish.fax && " · "}
              {parish.fax && <>팩스 {parish.fax}</>}
            </div>
          )}
          {parish?.diocese && <div className="diocese">{parish.diocese} 소속</div>}
        </div>

        {/* 미사 시간 */}
        <div>
          <h4>미사 시간</h4>
          {massRows.length > 0 ? (
            <dl className="site-foot-mass">
              {massRows.map((row) => (
                <div key={row.label} style={{ display: "contents" }}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>미사 시간 정보 없음</p>
          )}
        </div>

        {/* 바로가기 */}
        <div>
          <h4>바로가기</h4>
          <ul>
            <li><Link href="/bulletin">{labelOf("/bulletin", "주보 아카이브")}</Link></li>
            <li><Link href="/pastor">{labelOf("/pastor", "주임신부님")}</Link></li>
            <li><Link href="/word">{labelOf("/word", "오늘의 복음")}</Link></li>
            <li>
              <Suspense fallback={null}>
                <ReportLink>장애 신고</ReportLink>
              </Suspense>
            </li>
          </ul>
        </div>

        {/* 둘러보기 */}
        <div>
          <h4>둘러보기</h4>
          <ul>
            <li><Link href="/about">{labelOf("/about", "성당 안내")}</Link></li>
            <li><Link href="/history">{labelOf("/history", "본당 연혁")}</Link></li>
            <li><Link href="/info">{labelOf("/info", "찾아오시는 길")}</Link></li>
            {footerGroups.flatMap((g) =>
              flattenServer(g.items).map((it) => {
                const href = it.is_external ? (it.external_url ?? it.href) : it.href;
                return (
                  <li key={it.id}>
                    <a
                      href={href}
                      target={it.is_external ? "_blank" : undefined}
                      rel={it.is_external ? "noopener noreferrer" : undefined}
                    >
                      {it.label}
                      {it.is_external && <span aria-hidden style={{ fontSize: 10, opacity: 0.6, marginLeft: 4 }}>↗</span>}
                    </a>
                  </li>
                );
              }),
            )}
          </ul>
        </div>
      </div>

      <div className="site-foot-bottom">
        <span>© {new Date().getFullYear()} {parish?.name ?? "본당 홈페이지"}. All rights reserved.</span>
        <div className="site-foot-bottom-links">
          <Link href="/p/terms">이용약관</Link>
          <Link href="/p/privacy">개인정보 처리방침</Link>
        </div>
      </div>
    </footer>
  );
}
