import Link from "next/link";
import BannerSlider from "@/components/BannerSlider";
import PhotoSlider from "./PhotoSlider";
import BoardTabs, { type BoardTab } from "./BoardTabs";
import MeditationCredits from "./MeditationCredits";
import HomeHero from "./HomeHero";
import HomeConstructionWidget, { fetchConstructionSummary } from "./HomeConstructionWidget";
import TagCloud from "@/components/TagCloud";
import SearchHero from "@/components/SearchHero";
import ChurchIcon from "@/components/icons/ChurchIcon";
import GroupsIcon from "@/components/icons/GroupsIcon";
import BulletinIcon from "@/components/icons/BulletinIcon";
import CrossIcon from "@/components/icons/CrossIcon";
import ConstructionIcon from "@/components/icons/ConstructionIcon";
import { buildMassRows, type MassEntry } from "@/lib/mass";

// admin이 변경한 공지·일정·주보 등이 새로고침 없이 반영되도록
export const dynamic = "force-dynamic";

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Parish {
  name: string; phone: string | null; address: string | null;
  fax: string | null;
  mass_schedule: { entries: MassEntry[]; note: string; } | null;
}
interface Notice { id: number; title: string; is_pinned: boolean; created_at: string; }
interface CalendarEvent {
  id: number;
  title: string;
  event_date: string;
  end_date: string | null;
  event_kind: string | null;
}
interface GospelToday {
  date: string;
  liturgical_season: string | null;
  gospel_reference: string | null;
  gospel_text: string | null;
}

/** /api/home/blocks 응답 — admin/home 에서 ON/OFF·순서·payload 편집 가능. */
interface HomeBlock {
  id: number;
  kind: string;
  sort_order: number;
  is_active: boolean;
  payload: Record<string, unknown>;
}

async function getParish(): Promise<Parish | null> {
  try { const r = await fetch(`${API}/api/parish/`); return r.ok ? r.json() : null; } catch { return null; }
}
async function getNotices(): Promise<Notice[]> {
  try { const r = await fetch(`${API}/api/notices/`); return r.ok ? r.json() : []; } catch { return []; }
}
async function getUpcomingEvents(): Promise<CalendarEvent[]> {
  // 오늘부터 약 60일 — 이번 달 + 다음 달 fetch 후 다가오는 순으로 정렬
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const months = [
    { y: today.getFullYear(), m: today.getMonth() + 1 },
    { y: today.getMonth() === 11 ? today.getFullYear() + 1 : today.getFullYear(), m: today.getMonth() === 11 ? 1 : today.getMonth() + 2 },
  ];
  try {
    const lists = await Promise.all(
      months.map((mm) =>
        fetch(`${API}/api/events/?year=${mm.y}&month=${mm.m}`)
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
      ),
    );
    const all: CalendarEvent[] = lists.flat();
    return all
      .filter((e) => (e.end_date ?? e.event_date) >= todayKey)
      .sort((a, b) => a.event_date.localeCompare(b.event_date));
  } catch { return []; }
}
async function getGospelToday(): Promise<GospelToday | null> {
  try {
    const r = await fetch(`${API}/api/gospel/today`);
    if (!r.ok) return null;
    const json = await r.json();
    return json.success ? json.data : null;
  } catch { return null; }
}

async function getSiteConfig(): Promise<Record<string, string>> {
  try {
    const r = await fetch(`${API}/api/public/site-config`, { cache: "no-store" });
    if (!r.ok) return {};
    return (await r.json()) as Record<string, string>;
  } catch { return {}; }
}

async function getHomeBlocks(): Promise<HomeBlock[]> {
  try {
    const r = await fetch(`${API}/api/home/blocks`, { cache: "no-store" });
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

interface BoardMeta { slug: string; name: string; is_active: boolean; exclude_from_search: boolean; }
interface TagCloudItem { id: number; name: string; slug: string | null; count: number; }
async function getTagCloudItems(): Promise<TagCloudItem[]> {
  try {
    const r = await fetch(`${API}/api/content/community/post-counts`, { cache: "no-store" });
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data) ? data as TagCloudItem[] : [];
  } catch { return []; }
}

async function getBoardsCatalog(): Promise<BoardMeta[]> {
  try {
    const r = await fetch(`${API}/api/boards`);
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data) ? data as BoardMeta[] : [];
  } catch { return []; }
}

interface BoardPostBrief { id: number; title: string; is_pinned: boolean; created_at: string; }
async function getBoardPosts(slug: string, limit = 10): Promise<BoardPostBrief[]> {
  try {
    const r = await fetch(`${API}/api/boards/${encodeURIComponent(slug)}/posts?limit=${limit}`);
    if (!r.ok) return [];
    const data = await r.json();
    const posts = Array.isArray(data?.posts) ? data.posts : [];
    return posts.map((p: { id: number; title: string; is_pinned?: boolean; created_at: string }) => ({
      id: p.id,
      title: p.title,
      is_pinned: !!p.is_pinned,
      created_at: p.created_at,
    }));
  } catch { return []; }
}

/** board_tabs payload 구조 — admin/home 에서 편집. */
interface BoardTabConfig {
  source?: "board" | "events";
  board_slug?: string;
  label?: string;
}


interface QuickLink { href: string; label: string; icon_key: string; }

// icon_key → React 컴포넌트 매핑. admin/home 의 QUICK_LINK_ICONS 와 동기 유지.
const ICON_BY_KEY: Record<string, React.ReactNode> = {
  church:       <ChurchIcon className="w-14 h-14 text-[var(--color-primary)]" />,
  groups:       <GroupsIcon className="w-14 h-14 text-[var(--color-primary)]" />,
  bulletin:     <BulletinIcon className="w-14 h-14 text-[var(--color-primary)]" />,
  cross:        <CrossIcon className="w-14 h-14 text-[var(--color-primary)]" />,
  construction: <ConstructionIcon className="w-14 h-14 text-[var(--color-primary)]" />,
};

// quick_links 블록 payload.items 가 비어 있으면 사용되는 default 3개.
const DEFAULT_QUICK_LINKS: QuickLink[] = [
  { href: "/about",    label: "성당 안내",   icon_key: "church" },
  { href: "/groups",   label: "분과와 단체", icon_key: "groups" },
  { href: "/bulletin", label: "주보 보기",   icon_key: "bulletin" },
];

const CONTAINER = "max-w-5xl mx-auto px-4";

export default async function HomePage() {
  const [parish, notices, gospel, upcomingEvents, constructionSummary, siteConfig, blocks, boardsCatalog, tagItems] =
    await Promise.all([
      getParish(),
      getNotices(),
      getGospelToday(),
      getUpcomingEvents(),
      fetchConstructionSummary(),
      getSiteConfig(),
      getHomeBlocks(),
      getBoardsCatalog(),
      getTagCloudItems(),
    ]);

  // board_tabs 블록들이 참조하는 게시판 slug 들을 수집해서 일괄 fetch (two_column/three_column 슬롯 안에 있는 것도 포함).
  const referencedBoardSlugs = new Set<string>();
  const collectFromPayload = (payload: Record<string, unknown> | undefined) => {
    if (!payload) return;
    const tabs = Array.isArray(payload.tabs) ? (payload.tabs as BoardTabConfig[]) : null;
    if (!tabs || tabs.length === 0) {
      // legacy default 는 notice 게시판 사용
      referencedBoardSlugs.add("notice");
    } else {
      tabs.forEach((t) => {
        if (t.source === "board" && t.board_slug) referencedBoardSlugs.add(t.board_slug);
      });
    }
  };
  blocks.forEach((b) => {
    if (b.kind === "board_tabs") collectFromPayload(b.payload);
    if (b.kind === "two_column" || b.kind === "three_column") {
      ["left", "middle", "right"].forEach((side) => {
        const slot = b.payload?.[side] as { kind?: string; payload?: Record<string, unknown> } | undefined;
        if (slot?.kind === "board_tabs") collectFromPayload(slot.payload);
      });
    }
  });
  const boardPostsBySlug = new Map<string, BoardPostBrief[]>();
  await Promise.all(
    Array.from(referencedBoardSlugs).map(async (slug) => {
      boardPostsBySlug.set(slug, await getBoardPosts(slug, 10));
    }),
  );
  const boardMetaBySlug = new Map(boardsCatalog.map((b) => [b.slug, b]));

  // v1.5.337: hero 안 모바일 전용 construction 카드 중복 회피 — 블록 빌더 어디든
  // construction 슬롯이 있으면 hero 의 모바일 카드 숨김.
  const hasConstructionInBlocks = blocks.some((b) => {
    if (b.kind === "construction") return true;
    const p = b.payload as Record<string, unknown> | undefined;
    if (b.kind === "two_column") {
      const left = p?.left as { kind?: string } | undefined;
      const right = p?.right as { kind?: string } | undefined;
      return left?.kind === "construction" || right?.kind === "construction";
    }
    if (b.kind === "three_column") {
      const left = p?.left as { kind?: string } | undefined;
      const middle = p?.middle as { kind?: string } | undefined;
      const right = p?.right as { kind?: string } | undefined;
      return [left, middle, right].some((s) => s?.kind === "construction");
    }
    return false;
  });

  // home_blocks 에 hero 블록이 있으면 그 payload.layout 을 우선 — 없으면 site_settings.HOME_HERO_LAYOUT fallback.
  const heroBlock = blocks.find((b) => b.kind === "hero");
  const heroLayoutFromBlock = heroBlock?.payload?.["layout"] as string | undefined;
  const heroLayoutRaw = heroLayoutFromBlock ?? siteConfig.HOME_HERO_LAYOUT ?? "wide";
  const heroLayout = (["wide", "wide-plain", "even", "even-plain"].includes(heroLayoutRaw)
    ? heroLayoutRaw
    : "wide") as "wide" | "wide-plain" | "even" | "even-plain";

  // 홈 테마 — admin/home 에서 선택. 'warm'(기본·current) | 'modern'(여유 흰 톤) | 'classic'(컴팩트 네이비)
  const homeThemeRaw = siteConfig.HOME_THEME ?? "warm";
  const homeTheme = (["warm", "modern", "classic"].includes(homeThemeRaw) ? homeThemeRaw : "warm");
  const heroIsWide = heroLayout.startsWith("wide");
  const showBanner = !heroLayout.endsWith("-plain");
  const gridColsClass = heroIsWide ? "md:grid-cols-[2fr_1fr]" : "md:grid-cols-3";

  const entries = parish?.mass_schedule?.entries ?? [];
  const massRows = buildMassRows(entries);

  // 공지: 핀 우선 + 최신순
  const sortedNotices = [...notices].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    return b.created_at.localeCompare(a.created_at);
  });

  // ── 메인 3단 카드 마크업 (모드별 wrapper 분기 위해 변수로 추출) ──
  const gospelCardEl = (
    // 카드 전체가 /word 로 가는 단일 링크. 내부에는 중첩 a 금지(nested anchor)이므로 ⋯ 표시는 span 으로.
    <Link
      href="/word"
      aria-label="오늘의 복음 전체 보기"
      className="border border-[var(--color-border)] rounded-xl p-4 pb-[27px] flex flex-col bg-white hover:bg-[var(--color-primary)]/10 hover:shadow-sm hover:border-[var(--color-primary)]/40 transition-all h-full relative group"
    >
      <div className="flex items-center justify-between mb-2.5 pb-2.5 border-b border-[var(--color-border)]">
        <h2 className="font-serif font-bold text-[var(--color-primary)] text-[13px] flex items-center gap-1.5">
          <CrossIcon className="text-[var(--color-accent)]" />
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
          {/* flex 확장은 wrapper, line-clamp는 blockquote — 둘이 같은 요소에 있으면
              일부 환경에서 display:-webkit-box vs flex-item 충돌로 clamp가 무효화됨. */}
          <div className="flex-1 min-h-0">
            <blockquote className="text-[13px] text-[var(--color-text)] leading-relaxed italic line-clamp-2">
              &ldquo;{gospel.gospel_text}&rdquo;
            </blockquote>
          </div>
          {gospel.gospel_reference && (
            <cite className="block text-[11px] text-[var(--color-text-muted)] mt-2 not-italic">
              — {gospel.gospel_reference}
            </cite>
          )}
          {/* 카드 전체가 링크이므로 ⋯ 은 시각 단서용 span (별도 anchor 아님) */}
          <span
            aria-hidden
            className="absolute bottom-1.5 right-3 text-[16px] leading-none text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] transition-colors"
          >
            ⋯
          </span>
        </>
      ) : (
        <p className="text-[13px] text-[var(--color-text-muted)] flex-1 flex items-center justify-center">
          오늘의 말씀을 불러오는 중입니다…
        </p>
      )}
    </Link>
  );

  // 시즌 배너 — /admin/banners 에서 placement="home_main" 으로 등록한
  // 활성 그룹의 이미지를 슬라이더로 노출. 1장이면 정적, 2장+ 시 5초 auto + 인디케이터.
  const bannerCardEl = <BannerSlider placement="home_main" />;

  // 미사 카드 — 카드 자연 height 가 사진과 비슷해지도록 컴팩트하게.
  // 핵심: table 의 flex-1 제거 (빈 공간 균등 분배로 행간이 부풀어 오르는 현상 차단).
  const massCardEl = (
    <div className="border border-[var(--color-border)] rounded-xl p-3 flex flex-col bg-white hover:shadow-sm transition-shadow h-full">
      <div className="mb-2 pb-2 border-b border-[var(--color-border)]">
        <h2 className="font-serif font-bold text-[var(--color-primary)] text-[13px] flex items-center gap-1.5">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-4 h-4"
            aria-hidden
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M11.0055 2H12.9945C14.3805 1.99999 15.4828 1.99999 16.3716 2.0738C17.2819 2.14939 18.0575 2.30755 18.7658 2.67552C19.8617 3.24477 20.7552 4.13829 21.3245 5.23415C21.6925 5.94253 21.8506 6.71811 21.9262 7.62839C22 8.51722 22 9.6195 22 11.0055V12.9945C22 14.3805 22 15.4828 21.9262 16.3716C21.8506 17.2819 21.6925 18.0575 21.3245 18.7658C20.7552 19.8617 19.8617 20.7552 18.7658 21.3245C18.0575 21.6925 17.2819 21.8506 16.3716 21.9262C15.4828 22 14.3805 22 12.9945 22H11.0055C9.6195 22 8.51722 22 7.62839 21.9262C6.71811 21.8506 5.94253 21.6925 5.23415 21.3245C4.13829 20.7552 3.24477 19.8617 2.67552 18.7658C2.30755 18.0575 2.14939 17.2819 2.0738 16.3716C1.99999 15.4828 1.99999 14.3805 2 12.9945V11.0055C1.99999 9.61949 1.99999 8.51721 2.0738 7.62839C2.14939 6.71811 2.30755 5.94253 2.67552 5.23415C3.24477 4.13829 4.13829 3.24477 5.23415 2.67552C5.94253 2.30755 6.71811 2.14939 7.62839 2.0738C8.51721 1.99999 9.61949 1.99999 11.0055 2ZM7.79391 4.06694C7.00955 4.13207 6.53142 4.25538 6.1561 4.45035C5.42553 4.82985 4.82985 5.42553 4.45035 6.1561C4.25538 6.53142 4.13207 7.00955 4.06694 7.79391C4.0008 8.59025 4 9.60949 4 11.05V12.95C4 14.3905 4.0008 15.4097 4.06694 16.2061C4.13207 16.9905 4.25538 17.4686 4.45035 17.8439C4.82985 18.5745 5.42553 19.1702 6.1561 19.5497C6.53142 19.7446 7.00955 19.8679 7.79391 19.9331C8.59025 19.9992 9.60949 20 11.05 20H12.95C14.3905 20 15.4097 19.9992 16.2061 19.9331C16.9905 19.8679 17.4686 19.7446 17.8439 19.5497C18.5745 19.1702 19.1702 18.5745 19.5497 17.8439C19.7446 17.4686 19.8679 16.9905 19.9331 16.2061C19.9992 15.4097 20 14.3905 20 12.95V11.05C20 9.60949 19.9992 8.59025 19.9331 7.79391C19.8679 7.00955 19.7446 6.53142 19.5497 6.1561C19.1702 5.42553 18.5745 4.82985 17.8439 4.45035C17.4686 4.25538 16.9905 4.13207 16.2061 4.06694C15.4097 4.0008 14.3905 4 12.95 4H11.05C9.60949 4 8.59025 4.0008 7.79391 4.06694ZM11.8284 6.75736C12.3807 6.75736 12.8284 7.20507 12.8284 7.75736V12.7245L16.3553 14.0653C16.8716 14.2615 17.131 14.8391 16.9347 15.3553C16.7385 15.8716 16.1609 16.131 15.6447 15.9347L11.4731 14.349C11.085 14.2014 10.8284 13.8294 10.8284 13.4142V7.75736C10.8284 7.20507 11.2761 6.75736 11.8284 6.75736Z"
              fill="#AE938D"
            />
          </svg>
          미사 시간
        </h2>
      </div>
      {massRows.length > 0 ? (
        <table className="text-[13px] w-full">
          <tbody>
            {massRows.map((row) => (
              <tr key={row.label} className="align-top">
                <td className="text-[var(--color-text-muted)] pr-2 pb-1 whitespace-nowrap w-9 font-medium">
                  {row.label}
                </td>
                <td className="pb-1 text-[var(--color-text)] leading-snug">
                  {row.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-[13px] text-[var(--color-text-muted)] flex items-center justify-center py-2">
          미사 시간 정보가 없습니다.
        </p>
      )}
      {parish?.mass_schedule?.note && (
        <p className="text-[11px] text-[var(--color-text-muted)] mt-1 leading-snug">
          ※ {parish.mass_schedule.note}
        </p>
      )}
      <Link
        href="/info"
        className="inline-block mt-1.5 text-[11px] font-medium text-[var(--color-primary)] hover:underline"
      >
        찾아오시는 길 →
      </Link>
    </div>
  );

  // legacy default 탭 — payload 가 비어 있을 때 사용 (현재 동작 유지)
  const eventsTab: BoardTab = {
    key: "events",
    label: "행사·모임",
    moreHref: "/calendar",
    itemBase: "/calendar",
    items: upcomingEvents.map((e) => ({
      id: e.id,
      title: e.event_kind ? `[${e.event_kind}] ${e.title}` : e.title,
      is_pinned: false,
      created_at: e.event_date,
      href: "/calendar",
    })),
  };
  const noticeDefaultTab: BoardTab = {
    key: "notice",
    label: "공지사항",
    moreHref: "/boards/notice",
    itemBase: "/boards/notice",
    items: sortedNotices,
  };

  /** board_tabs payload 를 BoardTab[] 로 변환. payload 가 비어 있으면 legacy default (notice + events). */
  function buildBoardTabsForPayload(payload: Record<string, unknown> | undefined): BoardTab[] {
    const raw = Array.isArray(payload?.tabs) ? (payload!.tabs as BoardTabConfig[]) : null;
    if (!raw || raw.length === 0) return [noticeDefaultTab, eventsTab];
    return raw
      .map<BoardTab | null>((t, i) => {
        if (t.source === "events") {
          return { ...eventsTab, key: `events-${i}`, label: t.label?.trim() || eventsTab.label };
        }
        if (t.source === "board" && t.board_slug) {
          const meta = boardMetaBySlug.get(t.board_slug);
          const posts = boardPostsBySlug.get(t.board_slug) ?? [];
          return {
            key: `board-${t.board_slug}-${i}`,
            label: t.label?.trim() || meta?.name || t.board_slug,
            moreHref: `/boards/${t.board_slug}`,
            itemBase: `/boards/${t.board_slug}`,
            items: posts,
          };
        }
        return null;
      })
      .filter((x): x is BoardTab => x !== null);
  }

  // ── 블록별 JSX 정의 — admin/home 의 home_blocks 배열에 따라 render 선택됨 ──
  const heroSection = (
    <section>
      <div className={`${CONTAINER} py-5 sm:py-7`}>
        <div className={`grid grid-cols-1 ${gridColsClass} gap-4`}>
          <div className="min-w-0 flex flex-col gap-3">
            <div className="md:hidden">
              <SearchHero
                initialQ=""
                autoFocus={false}
                variant="pill"
                placeholder="무엇을 찾으시나요?"
              />
            </div>
            <HomeHero parishName={parish?.name ?? "본당 홈페이지"} />
          </div>

          {/* wide(±배너) | even+배너 | even-plain */}
          {heroIsWide ? (
            <div className="flex flex-col gap-4 min-w-0">
              {gospelCardEl}
              {showBanner && <div className="order-3 md:order-2">{bannerCardEl}</div>}
              <div className="order-2 md:order-3">{massCardEl}</div>
            </div>
          ) : showBanner ? (
            <>
              <div className="min-w-0 flex flex-col gap-4">
                <div className="flex-1 min-h-0">{gospelCardEl}</div>
                <div>{bannerCardEl}</div>
              </div>
              <div className="min-w-0">{massCardEl}</div>
              {/* v1.5.337: 블록 빌더(home_blocks)에 construction 이 어디에도 없을 때만
                  hero 안 모바일 전용 카드 노출. 있으면 그쪽에서만 1회 표시되어 중복 회피. */}
              {!hasConstructionInBlocks && (
                <div className="md:hidden min-w-0">
                  <HomeConstructionWidget summary={constructionSummary} embedded />
                </div>
              )}
            </>
          ) : (
            <>
              {gospelCardEl}
              {massCardEl}
            </>
          )}
        </div>
      </div>
    </section>
  );

  // 각 블록 콘텐츠는 inner(naked) + section wrapper 로 분리.
  // - top-level dispatch 는 section wrapper (border-t + CONTAINER) 로 감싸 노출
  // - two_column 슬롯 은 inner 만 렌더 — 슬롯끼리 가로선이 끊기지 않도록 two_column 자신이 통합 border-t 를 한 번만 그음
  function quickLinksInner(payload: Record<string, unknown>) {
    const rawItems = Array.isArray(payload?.items) ? (payload.items as QuickLink[]) : [];
    const items = rawItems.length > 0 ? rawItems : DEFAULT_QUICK_LINKS;
    return (
      <div className={`grid gap-2.5 sm:gap-3 max-w-2xl mx-auto`} style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, minmax(0, 1fr))` }}>
        {items.map((item, i) => (
          <Link
            key={`${item.href}-${i}`}
            href={item.href}
            className="group flex flex-col items-center justify-center gap-1 py-1 hover:-translate-y-0.5 transition-transform duration-200"
          >
            <span className="flex items-center justify-center h-14 text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] transition-colors">
              {ICON_BY_KEY[item.icon_key] ?? ICON_BY_KEY.church}
            </span>
            <span className="text-sm font-medium text-[var(--color-text)] text-center leading-tight group-hover:text-[var(--color-primary)] transition-colors">
              {item.label}
            </span>
          </Link>
        ))}
      </div>
    );
  }
  function renderQuickLinksBlock(payload: Record<string, unknown>) {
    return wrapSection(quickLinksInner(payload), "py-3");
  }

  const meditationInner = (
    <div className="flex">
      <MeditationCredits />
    </div>
  );
  const meditationSection = wrapSection(meditationInner, "py-3");

  const constructionInner = <HomeConstructionWidget summary={constructionSummary} embedded />;
  const constructionSection = wrapSection(constructionInner, "py-6");

  function boardTabsInner(payload: Record<string, unknown> | undefined) {
    return <BoardTabs tabs={buildBoardTabsForPayload(payload)} />;
  }
  function renderBoardTabsBlock(payload: Record<string, unknown> | undefined) {
    return wrapSection(boardTabsInner(payload), "py-6");
  }

  const galleryInner = (
    <>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-serif font-bold text-[var(--color-primary)] text-[13px] flex items-center gap-1.5">
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
    </>
  );
  const gallerySection = wrapSection(galleryInner, "py-6");

  function bannerInner(placement: string) {
    return <BannerSlider placement={placement} className="my-2" />;
  }
  function renderBannerBlock(placement: string) {
    // banner 는 원래 border-t 없이 my-2 만 가지던 블록이라 wrapper 분기 처리
    return <div className={CONTAINER}>{bannerInner(placement)}</div>;
  }

  function tagCloudInner(payload: Record<string, unknown> | undefined) {
    const customTitle = (payload?.title as string) ?? "";
    return (
      <div>
        {customTitle ? (
          <h2 className="font-serif font-bold text-[var(--color-primary)] text-[13px] mb-2 text-center">
            {customTitle}
          </h2>
        ) : null}
        <TagCloud items={tagItems} />
      </div>
    );
  }
  function renderTagCloudBlock(payload: Record<string, unknown> | undefined) {
    return wrapSection(tagCloudInner(payload), "py-6");
  }

  function quoteInner(text: string, source: string) {
    return (
      <div className="text-center">
        <ConstructionIcon className="w-10 h-10 mx-auto block" />
        <blockquote className="font-serif italic text-[var(--color-primary)] text-xs sm:text-sm mt-2 leading-relaxed">
          &ldquo;{text}&rdquo;
        </blockquote>
        {source && <p className="text-[11px] text-[var(--color-text-muted)] mt-1">— {source}</p>}
      </div>
    );
  }
  function renderQuoteBlock(text: string, source: string) {
    return wrapSection(quoteInner(text, source), "py-9");
  }

  /** 표준 wrapper — border-t + max-w-5xl CONTAINER + 지정 py. inner 콘텐츠를 한 줄로 감싸 일관된 섹션 형태 보장. */
  function wrapSection(inner: React.ReactNode, pyClass: string) {
    return (
      <section>
        <div className={CONTAINER}>
          <div className={`border-t border-[var(--color-border)] ${pyClass}`}>{inner}</div>
        </div>
      </section>
    );
  }

  /** slotMode=true: wrapper 없는 inner 만 — two_column 슬롯 안 렌더용. */
  function renderSlotInner(kind: string, payload: Record<string, unknown>): React.ReactNode {
    switch (kind) {
      case "quick_links":  return quickLinksInner(payload);
      case "meditation":   return meditationInner;
      case "construction": return constructionInner;
      case "board_tabs":   return boardTabsInner(payload);
      case "gallery":      return galleryInner;
      case "banner":       return bannerInner((payload?.placement as string) ?? "home_main");
      case "quote":        return quoteInner((payload?.text as string) ?? "", (payload?.source as string) ?? "");
      case "tag_cloud":    return tagCloudInner(payload);
      // hero 는 자체 grid layout 이 복잡해 슬롯 부적합 — 통째로 fallback
      case "hero":         return heroSection;
      default:             return null;
    }
  }

  // top-level map 용 — wrapper 포함 정규 dispatch.
  function renderBlockBody(kind: string, payload: Record<string, unknown>): React.ReactNode {
    switch (kind) {
      case "hero":          return heroSection;
      case "quick_links":   return renderQuickLinksBlock(payload);
      case "meditation":    return meditationSection;
      case "construction":  return constructionSection;
      case "board_tabs":    return renderBoardTabsBlock(payload);
      case "gallery":       return gallerySection;
      case "banner":        return renderBannerBlock((payload?.placement as string) ?? "home_main");
      case "quote":         return renderQuoteBlock((payload?.text as string) ?? "", (payload?.source as string) ?? "");
      case "two_column":    return renderTwoColumnBlock(payload);
      case "three_column":  return renderThreeColumnBlock(payload);
      case "tag_cloud":     return renderTagCloudBlock(payload);
      default:              return null;
    }
  }

  /** 컨테이너 류 kind 는 슬롯에 들어갈 수 없음 — 중첩 무한루프 방지. */
  const CONTAINER_KINDS = new Set(["two_column", "three_column"]);

  type SlotDef = { kind?: string; payload?: Record<string, unknown> };
  function renderSlot(slot: SlotDef): React.ReactNode {
    if (!slot.kind || CONTAINER_KINDS.has(slot.kind)) return null;
    return renderSlotInner(slot.kind, slot.payload ?? {});
  }

  function renderTwoColumnBlock(payload: Record<string, unknown>) {
    const left = (payload?.left ?? {}) as SlotDef;
    const right = (payload?.right ?? {}) as SlotDef;
    // 좌측 비율 (10~90, default 50). 우측 = 100 - leftRatio. 모바일은 1열로 떨어지므로 비율 무관.
    const rawRatio = Number(payload?.left_ratio ?? 50);
    const leftRatio = Math.min(90, Math.max(10, Number.isFinite(rawRatio) ? rawRatio : 50));
    const rightRatio = 100 - leftRatio;
    return (
      <section>
        <div className={CONTAINER}>
          <div
            className="border-t border-[var(--color-border)] py-3 grid grid-cols-1 md:[grid-template-columns:var(--two-col-cols)] gap-6"
            style={{ ["--two-col-cols" as string]: `${leftRatio}fr ${rightRatio}fr` }}
          >
            <div className="min-w-0">{renderSlot(left)}</div>
            <div className="min-w-0">{renderSlot(right)}</div>
          </div>
        </div>
      </section>
    );
  }

  function renderThreeColumnBlock(payload: Record<string, unknown>) {
    const left = (payload?.left ?? {}) as SlotDef;
    const middle = (payload?.middle ?? {}) as SlotDef;
    const right = (payload?.right ?? {}) as SlotDef;
    // ratios: [n, n, n] fr 단위. default [1,1,1]. 합이 무엇이든 grid 가 fr 비례 분배.
    const rawRatios = Array.isArray(payload?.ratios) ? (payload.ratios as unknown[]) : [];
    const ratios = [0, 1, 2].map((i) => {
      const v = Number(rawRatios[i]);
      return Number.isFinite(v) && v > 0 ? v : 1;
    });
    return (
      <section>
        <div className={CONTAINER}>
          <div
            className="border-t border-[var(--color-border)] py-3 grid grid-cols-1 md:[grid-template-columns:var(--three-col-cols)] gap-6"
            style={{ ["--three-col-cols" as string]: `${ratios[0]}fr ${ratios[1]}fr ${ratios[2]}fr` }}
          >
            <div className="min-w-0">{renderSlot(left)}</div>
            <div className="min-w-0">{renderSlot(middle)}</div>
            <div className="min-w-0">{renderSlot(right)}</div>
          </div>
        </div>
      </section>
    );
  }

  // v1.5.339: 모바일 전용 순서 (PC 는 home_blocks 그대로). 사용자 요구 11단계:
  //   검색 → 메인사진 → 빠른메뉴 → 복음 → 주일말씀 → 미사시간 → 성전건축 → 배너 → 공지 → 갤러리 → 인용
  const mobileQuickLinksPayload = (() => {
    for (const b of blocks) {
      if (b.kind === "quick_links") return b.payload ?? {};
      if (b.kind === "two_column") {
        const left = (b.payload as { left?: { kind?: string; payload?: Record<string, unknown> } } | undefined)?.left;
        const right = (b.payload as { right?: { kind?: string; payload?: Record<string, unknown> } } | undefined)?.right;
        if (left?.kind === "quick_links") return left.payload ?? {};
        if (right?.kind === "quick_links") return right.payload ?? {};
      }
    }
    return {};
  })();
  const mobileQuoteBlock = blocks.find((b) => b.kind === "quote");

  const mobileLayout = (
    <div className="md:hidden">
      {/* 1. 검색 */}
      <div className={`${CONTAINER} py-3`}>
        <SearchHero initialQ="" autoFocus={false} variant="pill" placeholder="무엇을 찾으시나요?" />
      </div>
      {/* 2. 메인사진 */}
      <div className={`${CONTAINER} py-3`}>
        <HomeHero parishName={parish?.name ?? "본당 홈페이지"} />
      </div>
      {/* 3. 빠른 메뉴 (성당소개/새항목/주보아카이브) */}
      {wrapSection(quickLinksInner(mobileQuickLinksPayload), "py-3")}
      {/* 4. 오늘의 복음 */}
      {wrapSection(gospelCardEl, "py-3")}
      {/* 5. 주일말씀 */}
      {meditationSection}
      {/* 6. 미사시간 */}
      {wrapSection(massCardEl, "py-3")}
      {/* 7. 성전건축 */}
      {constructionSection}
      {/* 8. 배너 */}
      {wrapSection(bannerCardEl, "py-3")}
      {/* 9. 공지사항 */}
      {wrapSection(boardTabsInner({}), "py-6")}
      {/* 10. 사진갤러리 */}
      {gallerySection}
      {/* 11. 인용 */}
      {mobileQuoteBlock && wrapSection(
        quoteInner(
          (mobileQuoteBlock.payload?.text as string) ?? "",
          (mobileQuoteBlock.payload?.source as string) ?? "",
        ),
        "py-9",
      )}
    </div>
  );

  return (
    <div data-home-theme={homeTheme}>
      {mobileLayout}
      <div className="hidden md:block">
        {blocks.map((b) => (
          <div key={b.id}>{renderBlockBody(b.kind, b.payload ?? {})}</div>
        ))}
      </div>
    </div>
  );
}
