"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { DataEvent, useInvalidationListener } from "@/components/dataEvents";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface NavItem {
  href: string;
  label: string;
  badgeKey?: "drafts" | "extractions" | "vision";
  badgeTone?: "amber" | "violet" | "red";
  aiTag?: boolean;
  children?: NavItem[];
  /** super-admin 전용 항목 — 운영자(member.is_admin)에게는 숨김 */
  superOnly?: boolean;
  /** pathname 완전 일치일 때만 active (형제가 하위 경로를 가진 부모 메뉴용) */
  exact?: boolean;
}

interface NavGroup {
  label: string;
  icon: string;
  items: NavItem[];
}

interface NavSolo {
  href: string;
  label: string;
  icon: string;
}

// 그룹 헤더 없이 대시보드 아래 단독으로 표시되는 항목
const SOLO_TOP: NavSolo[] = [
  { href: "/admin/construction", label: "성전 건축", icon: "🏗" },
];

const NAV_GROUPS: NavGroup[] = [
  {
    label: "성당 정보",
    icon: "⛪",
    items: [
      { href: "/admin/parish/info", label: "기본 정보" },
      { href: "/admin/parish/mass-times", label: "미사 시간" },
      { href: "/admin/history", label: "연혁 관리" },
    ],
  },
  {
    label: "신부님·수녀님",
    icon: "👤",
    items: [
      { href: "/admin/parish-staff", label: "사목자" },
      { href: "/admin/pastors", label: "역대 신부님·수녀님" },
      { href: "/admin/priests", label: "본당 출신 사제" },
    ],
  },
  {
    label: "말씀·기도",
    icon: "🙏",
    items: [
      { href: "/admin/vision", label: "사목지표" },
      { href: "/admin/meditation", label: "주일 말씀" },
      { href: "/admin/prayers", label: "기도문 관리" },
      { href: "/admin/saints", label: "성인 사전" },
    ],
  },
  {
    label: "주보 관리",
    icon: "📖",
    items: [
      { href: "/admin/bulletin", label: "주보 업로드·목록", exact: true },
      { href: "/admin/bulletin/extractions", label: "AI 추출 검토", badgeKey: "extractions", badgeTone: "violet", aiTag: true },
      { href: "/admin/drafts", label: "AI 임시저장", badgeKey: "drafts", badgeTone: "amber", aiTag: true },
      { href: "/admin/event-mapping", label: "AI 분류설정", aiTag: true },
      { href: "/admin/bulletin/stats", label: "AI 분석 통계", aiTag: true },
    ],
  },
  {
    label: "소식·일정",
    icon: "📰",
    items: [
      { href: "/admin/notices", label: "공지 관리" },
      { href: "/admin/calendar", label: "본당 일정 관리" },
    ],
  },
  {
    label: "공동체",
    icon: "💬",
    items: [
      { href: "/admin/council", label: "사목평의회" },
      { href: "/admin/community", label: "단체·분과" },
      { href: "/admin/boards", label: "게시판 관리" },
      { href: "/admin/members", label: "회원 관리" },
    ],
  },
  {
    label: "페이지·사진·배너",
    icon: "🖼",
    items: [
      { href: "/admin/pages", label: "페이지 만들기" },
      { href: "/admin/page-photos", label: "페이지 사진" },
      { href: "/admin/banners", label: "광고 배너" },
      { href: "/admin/home-banner", label: "메인 사진" },
    ],
  },
  {
    label: "레이아웃",
    icon: "🧩",
    items: [
      { href: "/admin/home", label: "홈 페이지" },
      { href: "/admin/menus", label: "메뉴" },
      { href: "/admin/season", label: "전례 시기 테마" },
    ],
  },
  {
    label: "시스템",
    icon: "⚙",
    items: [
      { href: "/admin/settings", label: "사이트 설정", superOnly: true },
      { href: "/admin/reports", label: "장애 신고" },
      { href: "/admin/logs", label: "활동 로그" },
      { href: "/admin/docs", label: "기술 문서" },
    ],
  },
];

interface Props {
  mobileOpen: boolean;
  onMobileClose: () => void;
  pinned: boolean;
  onPinToggle: () => void;
  mounted: boolean;
}

const PEEK_TRIGGER_WIDTH_PX = 12;
const PEEK_OPEN_DELAY_MS = 200;
const PEEK_CLOSE_DELAY_MS = 300;

const OPEN_GROUP_KEY = "admin_sidebar_open_group";
const OPEN_SUBGROUPS_KEY = "admin_sidebar_open_subgroups";

function parseStored(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.filter((v) => typeof v === "string")) : new Set();
  } catch {
    return new Set();
  }
}

export default function AdminSidebar({
  mobileOpen,
  onMobileClose,
  pinned,
  onPinToggle,
  mounted,
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [draftCount, setDraftCount] = useState(0);
  const [extractionCount, setExtractionCount] = useState(0);
  const [visionCount, setVisionCount] = useState(0);
  // super-admin 만 보여줄 메뉴 항목(superOnly:true) 필터용. mount 후 localStorage 동기화.
  const [isSuper, setIsSuper] = useState(false);
  useEffect(() => {
    setIsSuper(typeof window !== "undefined" && localStorage.getItem("admin_is_super") === "true");
  }, []);

  // 대분류는 accordion — 한 번에 하나만 열림. 중분류는 독립.
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [openSubGroups, setOpenSubGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!mounted) return;
    try {
      const saved = localStorage.getItem(OPEN_GROUP_KEY);
      setOpenGroup(saved && saved.length > 0 ? saved : null);
    } catch {}
    setOpenSubGroups(parseStored(OPEN_SUBGROUPS_KEY));
  }, [mounted]);

  function toggleGroup(label: string) {
    setOpenGroup((prev) => {
      const next = prev === label ? null : label;
      try {
        localStorage.setItem(OPEN_GROUP_KEY, next ?? "");
      } catch {}
      return next;
    });
  }

  function toggleSubGroup(href: string) {
    setOpenSubGroups((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      try {
        localStorage.setItem(OPEN_SUBGROUPS_KEY, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }

  // peek 상태 — collapsed(=!pinned)에서 좌측 hover로 일시 펼침
  const [peeking, setPeeking] = useState(false);
  const peekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPeekTimer = useCallback(() => {
    if (peekTimerRef.current) {
      clearTimeout(peekTimerRef.current);
      peekTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!mounted || pinned) {
      setPeeking(false);
      clearPeekTimer();
      return;
    }
    function onMove(e: MouseEvent) {
      if (e.clientX <= PEEK_TRIGGER_WIDTH_PX && e.clientY > 56) {
        if (peekTimerRef.current) return;
        peekTimerRef.current = setTimeout(() => {
          setPeeking(true);
          peekTimerRef.current = null;
        }, PEEK_OPEN_DELAY_MS);
      }
    }
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      clearPeekTimer();
    };
  }, [mounted, pinned, clearPeekTimer]);

  useEffect(() => {
    setPeeking(false);
    clearPeekTimer();
  }, [pathname, clearPeekTimer]);

  function handleSidebarEnter() {
    clearPeekTimer();
  }

  function handleSidebarLeave() {
    if (pinned) return;
    clearPeekTimer();
    peekTimerRef.current = setTimeout(() => {
      setPeeking(false);
      peekTimerRef.current = null;
    }, PEEK_CLOSE_DELAY_MS);
  }

  function handlePinClick() {
    setPeeking(false);
    clearPeekTimer();
    onPinToggle();
  }

  const fetchDraftCount = useCallback(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
    if (!token) return;
    fetch(`${API}/api/boards/drafts/count`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setDraftCount(d.count ?? 0); })
      .catch(() => {});
  }, []);

  const fetchExtractionCount = useCallback(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
    if (!token) return;
    fetch(`${API}/api/bulletins/extractions/pending/count`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setExtractionCount(d.total ?? 0);
          setVisionCount(d.vision ?? 0);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchDraftCount();
    fetchExtractionCount();
  }, [pathname, fetchDraftCount, fetchExtractionCount]);
  useInvalidationListener(DataEvent.DRAFTS_COUNT, fetchDraftCount);
  useInvalidationListener(DataEvent.EXTRACTIONS_COUNT, fetchExtractionCount);

  // ?tab=... 쿼리도 활성 판단에 사용
  const currentTab = searchParams?.get("tab") ?? null;

  const isActive = useCallback((href: string, exact = false) => {
    // href에 쿼리가 있으면 pathname + tab 비교
    const qIdx = href.indexOf("?");
    if (qIdx >= 0) {
      const path = href.slice(0, qIdx);
      const params = new URLSearchParams(href.slice(qIdx + 1));
      const tab = params.get("tab");
      if (pathname !== path) return false;
      return currentTab === tab;
    }
    if (pathname === href) return true;
    if (exact) return false;
    return pathname.startsWith(href + "/");
  }, [pathname, currentTab]);

  function badgeFor(item: NavItem): { count: number; tone: string } | null {
    let count = 0;
    if (item.badgeKey === "drafts") count = draftCount;
    else if (item.badgeKey === "extractions") count = extractionCount;
    else if (item.badgeKey === "vision") count = visionCount;
    if (count <= 0) return null;

    const hasVisionInside = item.badgeKey === "extractions" && visionCount > 0;
    const tone = hasVisionInside ? "red" : item.badgeTone ?? "amber";

    return { count, tone };
  }

  const toneClass: Record<string, string> = {
    amber: "bg-amber-500 text-white",
    violet: "bg-violet-600 text-white",
    red: "bg-red-600 text-white",
  };

  const desktopVisible = mounted && (pinned || peeking);
  const isFloating = mounted && !pinned && peeking;

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="사이드바 닫기"
          onClick={onMobileClose}
          className="md:hidden fixed inset-0 bg-black/40 z-40"
        />
      )}

      <aside
        onMouseEnter={handleSidebarEnter}
        onMouseLeave={handleSidebarLeave}
        className={`fixed top-14 left-0 h-[calc(100vh-3.5rem)] w-64 bg-white border-r border-gray-200 flex flex-col z-40 transition-transform duration-200 ease-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${
          desktopVisible ? "md:translate-x-0" : "md:-translate-x-full"
        } ${isFloating ? "md:shadow-2xl" : ""}`}
        aria-hidden={!mobileOpen && !desktopVisible}
        aria-label="관리자 메뉴"
      >
        {/* 모바일 헤더 */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="font-serif font-bold text-[var(--color-primary)]">관리자 메뉴</span>
          <button
            type="button"
            onClick={onMobileClose}
            aria-label="닫기"
            className="text-gray-400 hover:text-gray-700 text-xl leading-none px-2"
          >
            ×
          </button>
        </div>

        {/* 데스크톱 헤더 — 핀 토글 */}
        <div className="hidden md:flex items-center justify-end px-2 py-1.5 border-b border-gray-100">
          <button
            type="button"
            onClick={handlePinClick}
            aria-label={pinned ? "사이드바 접기" : "사이드바 고정"}
            title={`${pinned ? "사이드바 접기" : "사이드바 고정"} (⌘\\)`}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {pinned ? (
                <>
                  <polyline points="11 17 6 12 11 7" />
                  <polyline points="18 17 13 12 18 7" />
                </>
              ) : (
                <>
                  <polyline points="13 17 18 12 13 7" />
                  <polyline points="6 17 11 12 6 7" />
                </>
              )}
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4" aria-label="관리자 내비게이션">
          {/* 대시보드 (단독) */}
          <Link
            href="/admin/dashboard"
            onClick={onMobileClose}
            aria-current={pathname === "/admin/dashboard" ? "page" : undefined}
            className={`flex items-center gap-2.5 px-5 py-2.5 mb-1 text-sm transition-colors ${
              pathname === "/admin/dashboard"
                ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-semibold border-l-4 border-[var(--color-primary)]"
                : "text-gray-700 hover:bg-gray-50 border-l-4 border-transparent"
            }`}
          >
            <span className="text-base" aria-hidden="true">📊</span>
            <span>대시보드</span>
          </Link>

          {/* 그룹 헤더 없이 단독으로 표시되는 항목 */}
          {SOLO_TOP.map((s) => {
            const active = isActive(s.href);
            return (
              <Link
                key={s.href}
                href={s.href}
                onClick={onMobileClose}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2.5 px-5 py-2.5 mb-2 text-sm transition-colors ${
                  active
                    ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-semibold border-l-4 border-[var(--color-primary)]"
                    : "text-gray-700 hover:bg-gray-50 border-l-4 border-transparent"
                }`}
              >
                <span className="text-base" aria-hidden="true">{s.icon}</span>
                <span>{s.label}</span>
              </Link>
            );
          })}

          {/* 그룹별 메뉴 — superOnly 항목은 isSuper 일 때만, 그룹 자체가 비면 그룹도 숨김 */}
          {NAV_GROUPS.map((g) => {
            const filteredItems = g.items.filter((it) => !it.superOnly || isSuper);
            if (filteredItems.length === 0) return null;
            const open = openGroup === g.label;
            const headerId = `admin-group-${g.label}`;
            return (
              <div key={g.label} className="mb-1">
                <h2 className="px-2 pt-3 pb-0.5">
                  <button
                    type="button"
                    id={headerId}
                    onClick={() => toggleGroup(g.label)}
                    aria-expanded={open}
                    className="w-full flex items-center justify-between gap-1.5 px-3 py-1 rounded hover:bg-gray-50 text-[11px] font-semibold tracking-wider text-gray-400 uppercase transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="text-sm" aria-hidden="true">{g.icon}</span>
                      <span>{g.label}</span>
                    </span>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      className={`transition-transform ${open ? "" : "-rotate-90"}`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                </h2>
                {open && (
                  <ul aria-labelledby={headerId}>
                    {filteredItems.map((it) => {
                      const active = isActive(it.href, it.exact);
                      const badge = badgeFor(it);
                      const hasChildren = it.children && it.children.length > 0;

                      // 자식 펼침 상태: 사용자가 명시적으로 열어야만 열림
                      const subOpen = hasChildren && openSubGroups.has(it.href);

                      return (
                        <li key={it.href}>
                          {/* 부모(중분류 헤더 + 링크) */}
                          <div className={`flex items-stretch ${active ? "" : ""}`}>
                            <Link
                              href={it.href}
                              onClick={onMobileClose}
                              aria-current={active ? "page" : undefined}
                              className={`flex-1 flex items-center justify-between gap-2 pl-9 pr-3 py-2 text-sm transition-colors ${
                                active
                                  ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-semibold border-l-4 border-[var(--color-primary)] pl-8"
                                  : "text-gray-700 hover:bg-gray-50 border-l-4 border-transparent"
                              }`}
                            >
                              <span className="flex items-center gap-1.5">
                                <span>{it.label}</span>
                                {it.aiTag && (
                                  <>
                                    <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-violet-100 text-violet-700 leading-none" aria-hidden="true">AI</span>
                                    <span className="sr-only">AI 기능</span>
                                  </>
                                )}
                              </span>
                              {badge && (
                                <>
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${toneClass[badge.tone] ?? toneClass.amber}`}
                                    aria-hidden="true"
                                  >
                                    {badge.count}
                                  </span>
                                  <span className="sr-only">{it.label} 알림 {badge.count}건</span>
                                </>
                              )}
                            </Link>
                            {hasChildren && (
                              <button
                                type="button"
                                onClick={() => toggleSubGroup(it.href)}
                                aria-expanded={subOpen}
                                aria-label={`${it.label} 하위 메뉴 ${subOpen ? "접기" : "펼치기"}`}
                                className="px-2 text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
                              >
                                <svg
                                  width="12"
                                  height="12"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  aria-hidden="true"
                                  className={`transition-transform ${subOpen ? "" : "-rotate-90"}`}
                                >
                                  <polyline points="6 9 12 15 18 9" />
                                </svg>
                              </button>
                            )}
                          </div>

                          {/* 자식(소분류) */}
                          {hasChildren && subOpen && (
                            <ul className="ml-1">
                              {it.children!.map((c) => {
                                const cActive = isActive(c.href);
                                const cBadge = badgeFor(c);
                                return (
                                  <li key={c.href}>
                                    <Link
                                      href={c.href}
                                      onClick={onMobileClose}
                                      aria-current={cActive ? "page" : undefined}
                                      className={`flex items-center justify-between gap-2 pl-14 pr-5 py-1.5 text-[13px] transition-colors ${
                                        cActive
                                          ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-semibold border-l-4 border-[var(--color-primary)] pl-[3.25rem]"
                                          : "text-gray-600 hover:bg-gray-50 border-l-4 border-transparent"
                                      }`}
                                    >
                                      <span className="flex items-center gap-1.5">
                                        <span>{c.label}</span>
                                        {c.aiTag && (
                                          <>
                                            <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-violet-100 text-violet-700 leading-none" aria-hidden="true">AI</span>
                                            <span className="sr-only">AI 기능</span>
                                          </>
                                        )}
                                      </span>
                                      {cBadge && (
                                        <>
                                          <span
                                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${toneClass[cBadge.tone] ?? toneClass.amber}`}
                                            aria-hidden="true"
                                          >
                                            {cBadge.count}
                                          </span>
                                          <span className="sr-only">{c.label} 알림 {cBadge.count}건</span>
                                        </>
                                      )}
                                    </Link>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
