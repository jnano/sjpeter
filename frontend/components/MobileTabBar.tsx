"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** 모바일 하단 탭바 (시안 모바일 공통). 전 페이지 노출, md 미만. */
const TABS: { href: string; label: string; icon: React.ReactNode }[] = [
  { href: "/", label: "홈", icon: <><path d="M3 11l9-7 9 7v10H3V11z" /><path d="M9 21V13h6v8" strokeLinejoin="round" /></> },
  { href: "/bulletin", label: "주보", icon: <><rect x="4" y="5" width="16" height="14" /><line x1="4" y1="10" x2="20" y2="10" /></> },
  { href: "/prayers", label: "기도", icon: <><circle cx="12" cy="9" r="4" /><path d="M8 15l4 6 4-6" /></> },
  { href: "/calendar", label: "행사", icon: <><rect x="3" y="5" width="18" height="16" rx="1.5" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="8" y1="3" x2="8" y2="7" /><line x1="16" y1="3" x2="16" y2="7" /></> },
  { href: "/members/me", label: "내정보", icon: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-4 3-7 7-7s7 3 7 7" /></> },
];

export default function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav className="tabbar md:hidden">
      {TABS.map((t) => {
        const on = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className={`tab-item${on ? " on" : ""}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">{t.icon}</svg>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
