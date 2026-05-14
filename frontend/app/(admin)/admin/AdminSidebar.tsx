"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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
      { href: "/admin/settings", label: "사이트 설정" },
      { href: "/admin/logs", label: "활동 로그" },
      { href: "/admin/docs", label: "기술문서" },
    ],
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AdminSidebar({ open, onClose }: Props) {
  const pathname = usePathname();
  const [draftCount, setDraftCount] = useState(0);
  const [extractionCount, setExtractionCount] = useState(0);
  const [visionCount, setVisionCount] = useState(0);

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

    // 사목지표 미처리가 섞여 있으면 빨강(놓치면 안 되는 일), 그 외는 지정 톤
    const hasVisionInside = item.badgeKey === "extractions" && visionCount > 0;
    const tone = hasVisionInside ? "red" : item.badgeTone ?? "amber";

    return { count, tone };
  }

  const toneClass: Record<string, string> = {
    amber: "bg-amber-500 text-white",
    violet: "bg-violet-600 text-white",
    red: "bg-red-600 text-white",
  };

  return (
    <>
      {/* 모바일 오버레이 */}
      {open && (
        <button
          type="button"
          aria-label="사이드바 닫기"
          onClick={onClose}
          className="md:hidden fixed inset-0 bg-black/40 z-40"
        />
      )}

      <aside
        className={`fixed md:sticky top-0 left-0 h-screen md:h-[calc(100vh-3.5rem)] w-64 bg-white border-r border-gray-200 flex flex-col z-50 transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* 모바일 헤더 (사이드바 내부) */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="font-serif font-bold text-[var(--color-primary)]">관리자 메뉴</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="text-gray-400 hover:text-gray-700 text-xl leading-none px-2"
          >
            ×
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          {/* 대시보드 (단독) */}
          <Link
            href="/admin/dashboard"
            onClick={onClose}
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
                        onClick={onClose}
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
