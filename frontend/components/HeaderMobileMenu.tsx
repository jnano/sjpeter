"use client";

import Link from "next/link";
import { useNavigation } from "./useNavigation";

interface MenuItemLite {
  id: number;
  href: string;
  label: string;
  is_external?: boolean;
  children?: MenuItemLite[];
}

interface MenuGroupLite {
  key: string;
  id: number;
  label: string;
  subtitle?: string | null;
  items: MenuItemLite[];
}

interface Props {
  menuOpen: boolean;
  setMenuOpen: (v: boolean) => void;
  openGroup: number | null;
  setOpenGroup: (v: number | null) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  handleSearch: (e: React.FormEvent) => void;
  visibleNavGroups: MenuGroupLite[];
  pathname: string;
}

/**
 * 모바일 헤더 드로어 (md 미만) — 햄버거 메뉴 아래 펼침형 네비게이션.
 * v1.5.454 — Header.tsx 442 줄 분할의 일환으로 추출 (76 줄 이동).
 * 데스크탑 동시 렌더는 유지: Header 가 md:hidden 컨테이너로 감싸 모바일에서만 노출.
 */
export default function HeaderMobileMenu({
  menuOpen,
  setMenuOpen,
  openGroup,
  setOpenGroup,
  searchQuery,
  setSearchQuery,
  handleSearch,
  visibleNavGroups,
  pathname,
}: Props) {
  const { currentGroup } = useNavigation();

  if (!menuOpen) return null;

  return (
    <nav className="md:hidden border-t border-[var(--color-border)] py-2 pb-4 bg-white">
      <form onSubmit={handleSearch} className="px-3 py-2 flex gap-2">
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="기도문·공지·주보 검색"
          className="flex-1 px-3 py-2 text-sm rounded-full bg-[var(--color-surface-warm)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-primary)]"
        />
        <button type="submit" className="px-4 py-2 text-sm bg-[var(--color-primary)] text-white rounded-full">검색</button>
      </form>
      {visibleNavGroups.map((group, idx) => {
        const isActiveGroup = currentGroup?.id === group.id;
        return (
          <div key={group.key}>
            <button
              onClick={() => setOpenGroup(openGroup === idx ? null : idx)}
              aria-current={isActiveGroup ? "page" : undefined}
              className={`w-full flex items-center justify-between px-3 py-3 text-sm font-medium transition-colors hover:bg-[var(--color-surface-warm)] ${
                isActiveGroup
                  ? "text-[var(--color-primary)] border-l-[3px] border-[var(--color-primary)] bg-[var(--color-surface-warm)]/40"
                  : "text-[var(--color-text)] border-l-[3px] border-transparent"
              }`}
            >
              <span>{group.label}</span>
              <span className={`text-[var(--color-text-muted)] text-xs transition-transform duration-200 ${openGroup === idx ? "rotate-180" : ""}`}>▾</span>
            </button>
            {openGroup === idx && (
              <div className="bg-[var(--color-surface-warm)]/60 border-t border-b border-[var(--color-border)]">
                {group.subtitle && (
                  <div className="px-5 py-2">
                    <span className="text-[11px] text-[var(--color-text-muted)] tracking-wide">{group.subtitle}</span>
                  </div>
                )}
                {group.items.map((item) => (
                  <div key={item.id}>
                    <Link
                      href={item.href}
                      target={item.is_external ? "_blank" : undefined}
                      rel={item.is_external ? "noopener noreferrer" : undefined}
                      onClick={() => { setMenuOpen(false); setOpenGroup(null); }}
                      className={`block px-7 py-2.5 text-sm transition-colors ${
                        pathname === item.href ? "text-[var(--color-primary)] font-semibold" : "text-[var(--color-text)] hover:text-[var(--color-primary)]"
                      }`}
                    >
                      {item.label}
                      {item.is_external && <span className="text-xs text-gray-400 ml-1">↗</span>}
                    </Link>
                    {(item.children?.length ?? 0) > 0 && (
                      <div className="bg-white/60">
                        {item.children!.map((c) => (
                          <Link
                            key={c.id}
                            href={c.href}
                            target={c.is_external ? "_blank" : undefined}
                            rel={c.is_external ? "noopener noreferrer" : undefined}
                            onClick={() => { setMenuOpen(false); setOpenGroup(null); }}
                            className={`block px-11 py-2 text-xs transition-colors ${
                              pathname === c.href ? "text-[var(--color-primary)] font-semibold" : "text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                            }`}
                          >
                            └ {c.label}
                            {c.is_external && <span className="text-xs text-gray-400 ml-1">↗</span>}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
