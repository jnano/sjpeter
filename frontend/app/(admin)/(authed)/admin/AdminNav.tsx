"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import CrossIcon from "@/components/icons/CrossIcon";
import { adminRoleLabel } from "@/lib/adminRole";

interface Props {
  onMobileMenuClick?: () => void;
  onDesktopPinClick?: () => void;
  pinned?: boolean;
  mounted?: boolean;
}

export default function AdminNav({
  onMobileMenuClick,
  onDesktopPinClick,
  pinned = true,
  mounted = false,
}: Props) {
  const router = useRouter();
  const [isSuper, setIsSuper] = useState(false);
  const [displayRole, setDisplayRole] = useState<string>("");
  const [username, setUsername] = useState<string>("");

  useEffect(() => {
    setIsSuper(localStorage.getItem("admin_is_super") === "true");
    setDisplayRole(localStorage.getItem("admin_display_role") ?? "");
    setUsername(localStorage.getItem("admin_username") ?? "");
  }, []);

  function handleLogout() {
    if (!confirm("로그아웃하시겠습니까?")) return;
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_is_super");
    localStorage.removeItem("admin_username");
    document.cookie = "admin_authed=; Max-Age=0; path=/";
    document.cookie = "admin_token=; Max-Age=0; path=/";
    router.push("/admin");
  }

  // 데스크톱 핀 버튼은 collapsed 상태일 때만 노출
  // SSR/CSR 차이로 마운트 전에는 숨김(hydration mismatch 회피)
  const showDesktopPin = mounted && !pinned && !!onDesktopPinClick;

  return (
    <header className="sticky top-0 z-50 h-14 bg-[var(--color-primary)] text-white flex items-center justify-between px-4 shadow-sm">
      <div className="flex items-center gap-3 min-w-0">
        {/* 모바일 햄버거 */}
        {onMobileMenuClick && (
          <button
            type="button"
            aria-label="메뉴"
            onClick={onMobileMenuClick}
            className="md:hidden p-2.5 -ml-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded hover:bg-white/10"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}
        {/* 데스크톱 핀 버튼 — collapsed 상태일 때만 */}
        {showDesktopPin && (
          <button
            type="button"
            aria-label="사이드바 고정"
            title="사이드바 고정 (⌘\)"
            onClick={onDesktopPinClick}
            className="hidden md:inline-flex p-1.5 -ml-1.5 rounded hover:bg-white/10"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="13 17 18 12 13 7" />
              <polyline points="6 17 11 12 6 7" />
            </svg>
          </button>
        )}
        <Link href="/admin/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity min-w-0">
          <CrossIcon className="text-[var(--color-accent-light)] text-xl" />
          <span className="font-serif font-bold whitespace-nowrap">관리자</span>
          <span className="hidden md:inline text-white/50 text-sm whitespace-nowrap">— 본당 홈페이지</span>
        </Link>
        {isSuper ? (
          <span className="hidden sm:inline text-xs px-2 py-0.5 rounded-full font-medium bg-yellow-400/20 text-yellow-300 border border-yellow-400/30 shrink-0">
            슈퍼관리자
          </span>
        ) : displayRole ? (
          <span className="hidden sm:inline text-xs px-2 py-0.5 rounded-full font-medium bg-amber-400/20 text-amber-200 border border-amber-400/30 shrink-0">
            {adminRoleLabel(displayRole)}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5">
        {username && (
          <span className="hidden sm:inline text-xs text-white/70 mr-2">{username}</span>
        )}
        <Link
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs px-2.5 py-1.5 rounded hover:bg-white/10 transition-colors whitespace-nowrap"
          title="공개 사이트 보기"
        >
          공개 사이트 ↗
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="text-xs px-2.5 py-1.5 rounded hover:bg-white/10 transition-colors whitespace-nowrap"
        >
          로그아웃
        </button>
      </div>
    </header>
  );
}
