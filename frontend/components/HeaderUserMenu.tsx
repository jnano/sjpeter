"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useRef } from "react";
import type { Session } from "next-auth";

interface Props {
  session: Session;
  userMenuOpen: boolean;
  setUserMenuOpen: (v: boolean) => void;
  isAdminAuthed: boolean;
}

/**
 * 데스크탑 헤더의 사용자 메뉴(아바타 + 드롭다운).
 * v1.5.455 — Header.tsx 분할의 일환. 호버 + 클릭으로 열림.
 */
export default function HeaderUserMenu({ session, userMenuOpen, setUserMenuOpen, isAdminAuthed }: Props) {
  const router = useRouter();
  const userMenuRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className="relative"
      ref={userMenuRef}
      onMouseEnter={() => setUserMenuOpen(true)}
      onMouseLeave={() => setUserMenuOpen(false)}
    >
      <button
        onClick={() => setUserMenuOpen(!userMenuOpen)}
        className="flex items-center gap-1.5"
      >
        {session.user?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={session.user.image}
            alt=""
            className="w-5 h-5 rounded-full object-cover"
            referrerPolicy="no-referrer"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        ) : (
          <span className="w-5 h-5 rounded-full bg-[var(--color-surface-warm)] border border-[var(--color-border)] flex items-center justify-center text-[10px] font-bold text-[var(--color-text)]">
            {session.user?.name?.[0]}
          </span>
        )}
        <span>{session.user?.name}</span>
        <span className="text-[10px]">▾</span>
      </button>

      {userMenuOpen && (
        <div className="absolute right-0 top-full w-40 bg-white text-[var(--color-text)] shadow-xl border border-[var(--color-border)] rounded-lg z-50 overflow-hidden">
          <div className="py-1">
            <Link
              href="/members/me"
              onClick={() => setUserMenuOpen(false)}
              className="block px-4 py-2.5 text-sm hover:bg-[var(--color-surface-warm)] hover:text-[var(--color-primary)] transition-colors"
            >
              마이페이지
            </Link>
            {(session as { isAdmin?: boolean })?.isAdmin && (
              <Link
                href="/admin"
                onClick={() => setUserMenuOpen(false)}
                className="block px-4 py-2.5 text-sm hover:bg-[var(--color-surface-warm)] hover:text-[var(--color-primary)] transition-colors"
              >
                관리페이지
              </Link>
            )}
          </div>
          <div className="border-t border-[var(--color-border)]">
            <button
              onClick={() => { setUserMenuOpen(false); signOut({ callbackUrl: "/" }); }}
              className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-[var(--color-surface-warm)] transition-colors"
            >
              로그아웃
            </button>
          </div>
          {isAdminAuthed && (
            <div className="border-t border-[var(--color-border)]">
              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  document.cookie = "admin_authed=; Max-Age=0; path=/";
                  router.push("/admin");
                }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-warm)] transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span>Admin logout</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
