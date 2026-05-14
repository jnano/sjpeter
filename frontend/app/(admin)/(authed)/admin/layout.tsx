"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import AdminNav from "./AdminNav";
import AdminSidebar from "./AdminSidebar";

const PINNED_KEY = "admin_sidebar_pinned";

export default function AdminAuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  // SSR 기본값: pinned=true (펼침). 마운트 후 localStorage 값으로 보정.
  const [pinned, setPinnedState] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(PINNED_KEY);
      if (v === "false") setPinnedState(false);
    } catch {
      // localStorage 접근 실패 시 기본값 유지
    }
    setMounted(true);
  }, []);

  const setPinned = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      setPinnedState((prev) => {
        const value = typeof next === "function" ? next(prev) : next;
        try {
          localStorage.setItem(PINNED_KEY, String(value));
        } catch {
          // 영속화 실패는 무시
        }
        return value;
      });
    },
    [],
  );

  // 라우트 변경 시 모바일 사이드바 닫기
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // ⌘\ / Ctrl+\ — 데스크톱 사이드바 핀 토글
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName ?? "";
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
      if (target?.isContentEditable) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        setPinned((p) => !p);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPinned]);

  // 본문 padding 결정 — pinned 시 사이드바 너비(16rem)만큼 좌측 패딩
  const mainPadClass = mounted && pinned ? "md:pl-64" : "";

  return (
    <div className="min-h-screen bg-[var(--color-surface-warm)] flex flex-col">
      <AdminNav
        onMobileMenuClick={() => setMobileOpen(true)}
        onDesktopPinClick={() => setPinned(true)}
        pinned={pinned}
        mounted={mounted}
      />
      <AdminSidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        pinned={pinned}
        onPinToggle={() => setPinned((p) => !p)}
        mounted={mounted}
      />
      <main
        className={`flex-1 min-w-0 overflow-x-hidden transition-[padding] duration-200 ease-out ${mainPadClass}`}
      >
        {children}
      </main>
    </div>
  );
}
