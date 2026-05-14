"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
import { useArchiveCounts, isArchiveLinkHidden } from "./useArchiveCounts";
import { useNavigation } from "./useNavigation";
import { SEASON_LABELS_KO, type LiturgicalSeason } from "@/lib/season";

interface Breadcrumb { group: string; title: string }

interface HeaderProps {
  parishName?: string;
  logoUrl?: string | null;
  season?: LiturgicalSeason | null;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function Header({ parishName = "세종성베드로성당", logoUrl = null, season = null }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<number | null>(null);
  const [hoveredItem, setHoveredItem] = useState<number | null>(null);
  const closeGroupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openGroupNow = (idx: number) => {
    if (closeGroupTimer.current) clearTimeout(closeGroupTimer.current);
    if (openGroup !== idx) setHoveredItem(null); // 다른 그룹으로 이동 시 자식 미리보기 리셋
    setOpenGroup(idx);
  };
  const scheduleGroupClose = () => {
    if (closeGroupTimer.current) clearTimeout(closeGroupTimer.current);
    closeGroupTimer.current = setTimeout(() => {
      setOpenGroup(null);
      setHoveredItem(null);
    }, 250);
  };
  useEffect(() => () => {
    if (closeGroupTimer.current) clearTimeout(closeGroupTimer.current);
  }, []);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [breadcrumb, setBreadcrumb] = useState<Breadcrumb | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isAdminAuthed, setIsAdminAuthed] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const archiveCounts = useArchiveCounts();
  const { groups } = useNavigation();

  const visibleNavGroups = groups
    .filter((g) => g.show_in_header)
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => !isArchiveLinkHidden(i.href, archiveCounts)),
    }));

  useEffect(() => {
    setIsAdminAuthed(document.cookie.split(";").some((c) => c.trim().startsWith("admin_authed=")));
  }, []);

  useEffect(() => {
    const onHide = (e: Event) => setBreadcrumb((e as CustomEvent<Breadcrumb>).detail);
    const onShow = () => setBreadcrumb(null);
    window.addEventListener("breadcrumb-hide", onHide);
    window.addEventListener("breadcrumb-show", onShow);
    return () => {
      window.removeEventListener("breadcrumb-hide", onHide);
      window.removeEventListener("breadcrumb-show", onShow);
    };
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setSearchOpen(false);
    setSearchQuery("");
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <header className="bg-white text-[var(--color-text)] border-b border-[var(--color-border)] sticky top-0 z-50">
      {/* 상단 정보 바 — 전례 시기 칩(좌) / 로그인·사용자 메뉴(우)
          배경은 var(--color-surface-warm) → 시즌별로 미세하게 톤이 갈림.
          평시엔 베이지, 부활이면 연초록, 대림이면 연보라 등. */}
      <div className="bg-[var(--color-surface-warm)] border-b border-[var(--color-border)]/60 text-sm transition-colors">
        <div className="max-w-6xl mx-auto px-4 py-1.5 flex justify-between items-center gap-3">
          <div className="flex items-center text-[var(--color-text-muted)] min-w-0">
            {season && (
              <span
                className="flex items-center gap-1.5 text-xs"
                title={`현재 전례 시기: ${SEASON_LABELS_KO[season]}`}
              >
                <span
                  aria-hidden
                  className="w-2.5 h-2.5 rounded-full ring-1 ring-black/5"
                  style={{ background: "var(--color-primary)" }}
                />
                <span>{SEASON_LABELS_KO[season]}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-[var(--color-text-muted)]">
            {session ? (
              <div
                className="relative"
                ref={userMenuRef}
                onMouseEnter={() => setUserMenuOpen(true)}
                onMouseLeave={() => setUserMenuOpen(false)}
              >
                <button
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex items-center gap-1.5 hover:text-[var(--color-primary)] transition-colors">
                  {session.user?.image ? (
                    <img src={session.user.image} alt="" className="w-5 h-5 rounded-full object-cover" />
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-[var(--color-surface-warm)] border border-[var(--color-border)] flex items-center justify-center text-[10px] font-bold text-[var(--color-text)]">
                      {session.user?.name?.[0]}
                    </span>
                  )}
                  <span>{session.user?.name}</span>
                  <span className="text-[var(--color-text-muted)] text-[10px]">▾</span>
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
            ) : (
              <Link href="/members/login" className="hover:text-[var(--color-primary)] transition-colors">
                로그인
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* 메인 헤더 */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* 로고 + 스크롤 breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
              {logoUrl ? (
                <img
                  src={logoUrl.startsWith("http") ? logoUrl : `${API}${logoUrl}`}
                  alt={parishName}
                  className="h-8 w-8 object-contain"
                />
              ) : (
                <span className="text-[var(--color-accent)] text-2xl leading-none">✝</span>
              )}
              <div>
                <div className="font-serif font-bold text-lg leading-tight tracking-tight text-[var(--color-primary)]">
                  {parishName}
                </div>
                {/* 모바일: 스크롤 시 서브타이틀 → 페이지 제목으로 전환 */}
                <div className="relative text-xs leading-none h-[1.1em] overflow-hidden">
                  <span className={`absolute inset-0 text-[var(--color-text-muted)] transition-opacity duration-300 ${breadcrumb ? "opacity-0" : "opacity-100"}`}>
                    St. Peter&apos;s Cathedral, Sejong
                  </span>
                  <span className={`absolute inset-0 text-[var(--color-text)] font-medium whitespace-nowrap overflow-hidden text-ellipsis transition-opacity duration-300 ${breadcrumb ? "opacity-100" : "opacity-0"}`}>
                    {breadcrumb?.title}
                  </span>
                </div>
              </div>
            </Link>

            {/* 데스크톱 breadcrumb — 로고 옆 */}
            <span
              className={`hidden md:flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] transition-all duration-300 overflow-hidden whitespace-nowrap ${
                breadcrumb
                  ? "opacity-100 max-w-xs translate-x-0"
                  : "opacity-0 max-w-0 -translate-x-2 pointer-events-none"
              }`}
            >
              <span className="text-[var(--color-border-dark)] text-sm">›</span>
              <span>{breadcrumb?.group}</span>
              <span className="text-[var(--color-border-dark)] text-sm">›</span>
              <span className="text-[var(--color-text)] font-medium">{breadcrumb?.title}</span>
            </span>
          </div>

          {/* 데스크톱 네비게이션 */}
          <nav className="hidden md:flex items-center h-full">
            {visibleNavGroups.map((group, idx) => (
              <div
                key={group.key}
                className="relative h-full flex items-center"
                onMouseEnter={() => openGroupNow(idx)}
                onMouseLeave={scheduleGroupClose}
              >
                <button
                  className={`px-4 h-full text-sm font-medium transition-colors whitespace-nowrap ${
                    openGroup === idx
                      ? "text-[var(--color-primary)] bg-[var(--color-surface-warm)]"
                      : "text-[var(--color-text)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface-warm)]"
                  }`}
                >
                  {group.label}
                </button>

                {/* dropdown — 1열, 자식 있으면 hover 시 우측 popup */}
                {openGroup === idx && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 bg-white text-[var(--color-text)] shadow-lg z-50 border border-[var(--color-border)] rounded-b w-48">
                    {group.items.length === 0 ? (
                      <p className="px-4 py-3 text-xs text-gray-400">항목이 없습니다</p>
                    ) : (
                    <ul>
                      {group.items.map((item) => {
                        const itemHasChildren = (item.children?.length ?? 0) > 0;
                        const isHovered = hoveredItem === item.id;
                        return (
                          <li
                            key={item.id}
                            className="relative"
                            onMouseEnter={() => itemHasChildren && setHoveredItem(item.id)}
                            onMouseLeave={() => itemHasChildren && setHoveredItem(null)}
                          >
                            <Link
                              href={item.href}
                              target={item.is_external ? "_blank" : undefined}
                              rel={item.is_external ? "noopener noreferrer" : undefined}
                              onClick={() => { setOpenGroup(null); setHoveredItem(null); }}
                              className={`flex items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-[var(--color-surface-warm)] hover:text-[var(--color-primary)] ${
                                pathname === item.href || isHovered
                                  ? "text-[var(--color-primary)] font-semibold bg-[var(--color-surface-warm)]"
                                  : "text-[var(--color-text)]"
                              }`}
                            >
                              <span>
                                {item.label}
                                {item.is_external && <span className="text-xs text-gray-400 ml-1">↗</span>}
                              </span>
                              {itemHasChildren && <span className="text-xs text-gray-400">▸</span>}
                            </Link>

                            {/* 자식 popup (사이드바와 동일 패턴) */}
                            {itemHasChildren && isHovered && (
                              <div
                                className="absolute top-0 left-full z-50 pl-1"
                                onMouseEnter={() => setHoveredItem(item.id)}
                                onMouseLeave={() => setHoveredItem(null)}
                              >
                                <ul className="w-56 bg-white border border-[var(--color-border)] rounded-lg shadow-lg py-1 max-h-[440px] overflow-y-auto">
                                  {item.children!.map((c) => {
                                    const cActive = pathname === c.href;
                                    return (
                                      <li key={c.id}>
                                        <Link
                                          href={c.href}
                                          target={c.is_external ? "_blank" : undefined}
                                          rel={c.is_external ? "noopener noreferrer" : undefined}
                                          onClick={() => { setOpenGroup(null); setHoveredItem(null); }}
                                          className={`block px-4 py-2 text-sm transition-colors hover:bg-[var(--color-surface-warm)] hover:text-[var(--color-primary)] ${
                                            cActive
                                              ? "text-[var(--color-primary)] font-semibold bg-[var(--color-surface-warm)]"
                                              : "text-[var(--color-text)]"
                                          }`}
                                        >
                                          {c.label}
                                          {c.is_external && <span className="text-xs text-gray-400 ml-1">↗</span>}
                                        </Link>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* 검색 — 데스크톱 상시 노출 */}
            <form
              onSubmit={handleSearch}
              role="search"
              aria-label="사이트 검색"
              className="flex items-center ml-3"
            >
              <div className="relative">
                <span
                  aria-hidden
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] text-sm pointer-events-none"
                >
                  🔍
                </span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setSearchQuery("");
                      (e.currentTarget as HTMLInputElement).blur();
                    }
                  }}
                  placeholder="기도문·공지·주보 검색"
                  aria-label="검색어"
                  className="w-56 lg:w-72 pl-8 pr-3 py-1.5 text-sm rounded-full bg-[var(--color-surface-warm)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-primary)] focus:bg-white transition-colors"
                />
              </div>
            </form>
          </nav>

          {/* 모바일 버튼 */}
          <div className="md:hidden flex items-center gap-1">
            <button
              onClick={() => { setSearchOpen(!searchOpen); setMenuOpen(false); }}
              className="p-2 rounded hover:bg-[var(--color-surface-warm)] transition-colors text-[var(--color-text-muted)]"
              aria-label="검색"
            >
              🔍
            </button>
            <button
              className="p-2 rounded hover:bg-[var(--color-surface-warm)] transition-colors"
              onClick={() => { setMenuOpen(!menuOpen); setOpenGroup(null); }}
              aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
              aria-expanded={menuOpen}
            >
              <span className="block w-6 h-0.5 bg-[var(--color-text)] mb-1.5 transition-transform" />
              <span className={`block w-6 h-0.5 bg-[var(--color-text)] mb-1.5 transition-opacity ${menuOpen ? "opacity-0" : ""}`} />
              <span className="block w-6 h-0.5 bg-[var(--color-text)] transition-transform" />
            </button>
          </div>
        </div>

        {/* 모바일 검색창 */}
        {searchOpen && !menuOpen && (
          <form onSubmit={handleSearch} className="md:hidden border-t border-[var(--color-border)] py-3 px-1 flex gap-2">
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setSearchOpen(false)}
              placeholder="검색어 입력..."
              className="flex-1 px-3 py-2 text-sm rounded bg-[var(--color-surface-warm)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-primary)]"
            />
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white rounded transition-colors"
            >
              검색
            </button>
          </form>
        )}

        {/* 모바일 메뉴 — 그룹 아코디언 */}
        {menuOpen && (
          <nav className="md:hidden border-t border-[var(--color-border)] py-2 pb-4 bg-white">
            {visibleNavGroups.map((group, idx) => (
              <div key={group.key}>
                <button
                  onClick={() => setOpenGroup(openGroup === idx ? null : idx)}
                  className="w-full flex items-center justify-between px-3 py-3 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-warm)] transition-colors"
                >
                  <span>{group.label}</span>
                  <span
                    className={`text-[var(--color-text-muted)] text-xs transition-transform duration-200 ${
                      openGroup === idx ? "rotate-180" : ""
                    }`}
                  >
                    ▾
                  </span>
                </button>
                {openGroup === idx && (
                  <div className="bg-[var(--color-surface-warm)]/60 border-t border-b border-[var(--color-border)]">
                    <div className="px-5 py-2">
                      <span className="text-[11px] text-[var(--color-text-muted)] tracking-wide">
                        {group.subtitle}
                      </span>
                    </div>
                    {group.items.map((item) => (
                      <div key={item.id}>
                        <Link
                          href={item.href}
                          target={item.is_external ? "_blank" : undefined}
                          rel={item.is_external ? "noopener noreferrer" : undefined}
                          onClick={() => { setMenuOpen(false); setOpenGroup(null); }}
                          className={`block px-7 py-2.5 text-sm transition-colors ${
                            pathname === item.href
                              ? "text-[var(--color-primary)] font-semibold"
                              : "text-[var(--color-text)] hover:text-[var(--color-primary)]"
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
                                  pathname === c.href
                                    ? "text-[var(--color-primary)] font-semibold"
                                    : "text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
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
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
