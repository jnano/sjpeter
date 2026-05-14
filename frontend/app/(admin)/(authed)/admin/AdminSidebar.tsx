"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { DataEvent, useInvalidationListener } from "@/components/dataEvents";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface NavItem {
  href: string;
  label: string;
  badgeKey?: "drafts" | "extractions" | "vision";
  // vision 뱃지는 빨강 (사목지표 자동 등록 안 되므로 누락 방지 강조)
  badgeTone?: "amber" | "violet" | "red";
}

interface NavGroup {
  label: string;
  icon: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "성당 소개",
    icon: "⛪",
    items: [
      { href: "/admin/parish", label: "성당 정보" },
      { href: "/admin/content", label: "페이지 콘텐츠" },
      { href: "/admin/pages", label: "동적 페이지" },
      { href: "/admin/construction", label: "성전 건축" },
    ],
  },
  {
    label: "본당 인물",
    icon: "👤",
    items: [
      { href: "/admin/parish-staff", label: "본당 가족" },
      { href: "/admin/pastors", label: "역대 신부님·수녀님" },
      { href: "/admin/priests", label: "본당 출신 사제" },
    ],
  },
  {
    label: "주보·소식",
    icon: "📰",
    items: [
      { href: "/admin/bulletin", label: "주보 관리" },
      { href: "/admin/bulletin/extractions", label: "AI 추출 검토", badgeKey: "extractions", badgeTone: "violet" },
      { href: "/admin/drafts", label: "AI 임시저장", badgeKey: "drafts", badgeTone: "amber" },
      { href: "/admin/notices", label: "공지 관리" },
      { href: "/admin/calendar", label: "행사 캘린더" },
      { href: "/admin/prayers", label: "기도문 관리" },
    ],
  },
  {
    label: "사진",
    icon: "🖼",
    items: [
      { href: "/admin/home-banner", label: "홈 배너" },
      { href: "/admin/page-photos", label: "페이지 사진" },
      { href: "/admin/gallery", label: "갤러리" },
    ],
  },
  {
    label: "게시판·회원",
    icon: "💬",
    items: [
      { href: "/admin/boards", label: "게시판 관리" },
      { href: "/admin/members", label: "회원 관리" },
      { href: "/admin/event-mapping", label: "분류 설정" },
    ],
  },
  {
    label: "시스템",
    icon: "⚙",
    items: [
      { href: "/admin/menus", label: "메뉴 관리" },
      { href: "/admin/season", label: "전례 시기 스킨" },
      { href: "/admin/settings", label: "사이트 설정" },
      { href: "/admin/logs", label: "활동 로그" },
      { href: "/admin/docs", label: "기술문서" },
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

export default function AdminSidebar({
  mobileOpen,
  onMobileClose,
  pinned,
  onPinToggle,
  mounted,
}: Props) {
  const pathname = usePathname();
  const [draftCount, setDraftCount] = useState(0);
  const [extractionCount, setExtractionCount] = useState(0);
  const [visionCount, setVisionCount] = useState(0);

  // peek 상태 — collapsed(=!pinned)에서 좌측 hover로 일시 펼침
  const [peeking, setPeeking] = useState(false);
  const peekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPeekTimer = useCallback(() => {
    if (peekTimerRef.current) {
      clearTimeout(peekTimerRef.current);
      peekTimerRef.current = null;
    }
  }, []);

  // collapsed 상태에서 화면 좌측 가장자리(0~12px) hover 시 peek 패널 펼침
  useEffect(() => {
    if (!mounted || pinned) {
      setPeeking(false);
      clearPeekTimer();
      return;
    }
    function onMove(e: MouseEvent) {
      // 상단 nav(h-14=56px) 아래 영역에서만 트리거
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

  // 라우트 이동 시 peek 닫기 (네비게이션이 끝나면 패널이 떠 있을 이유가 없음)
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

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

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

  // 데스크톱 가시성 — pinned거나 peek 중이면 보임
  // peek 시에는 본문 위에 떠 있는 floating 효과(shadow)
  const desktopVisible = mounted && (pinned || peeking);
  const isFloating = mounted && !pinned && peeking;

  return (
    <>
      {/* 모바일 오버레이 */}
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

        {/* 데스크톱 헤더 — 핀 토글 버튼 */}
        <div className="hidden md:flex items-center justify-end px-2 py-1.5 border-b border-gray-100">
          <button
            type="button"
            onClick={handlePinClick}
            aria-label={pinned ? "사이드바 접기" : "사이드바 고정"}
            title={`${pinned ? "사이드바 접기" : "사이드바 고정"} (⌘\\)`}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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

        <nav className="flex-1 overflow-y-auto py-4">
          {/* 대시보드 (단독) */}
          <Link
            href="/admin/dashboard"
            onClick={onMobileClose}
            className={`flex items-center gap-2.5 px-5 py-2.5 mb-2 text-sm transition-colors ${
              pathname === "/admin/dashboard"
                ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-semibold border-l-4 border-[var(--color-primary)]"
                : "text-gray-700 hover:bg-gray-50 border-l-4 border-transparent"
            }`}
          >
            <span className="text-base">📊</span>
            <span>대시보드</span>
          </Link>

          {/* 그룹별 메뉴 */}
          {NAV_GROUPS.map((g) => (
            <div key={g.label} className="mb-1">
              <p className="px-5 pt-3 pb-1 text-[11px] font-semibold tracking-wider text-gray-400 uppercase flex items-center gap-1.5">
                <span className="text-sm">{g.icon}</span>
                <span>{g.label}</span>
              </p>
              <ul>
                {g.items.map((it) => {
                  const active = isActive(it.href);
                  const badge = badgeFor(it);
                  return (
                    <li key={it.href}>
                      <Link
                        href={it.href}
                        onClick={onMobileClose}
                        className={`flex items-center justify-between gap-2 pl-9 pr-5 py-2 text-sm transition-colors ${
                          active
                            ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-semibold border-l-4 border-[var(--color-primary)] pl-8"
                            : "text-gray-700 hover:bg-gray-50 border-l-4 border-transparent"
                        }`}
                      >
                        <span>{it.label}</span>
                        {badge && (
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${toneClass[badge.tone] ?? toneClass.amber}`}
                          >
                            {badge.count}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
