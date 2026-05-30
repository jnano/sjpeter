"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
import { useArchiveCounts, isArchiveLinkHidden } from "./useArchiveCounts";
import { useNavigation } from "./useNavigation";
import { SEASON_LABELS_KO, type LiturgicalSeason } from "@/lib/season";
import LogoFallback from "@/components/icons/LogoFallback";
import NotificationBell from "@/components/NotificationBell";
import HeaderMobileMenu from "@/components/HeaderMobileMenu";

interface Breadcrumb { group: string; title: string }

interface HeaderProps {
  parishName?: string;
  parishNameEn?: string;
  logoUrl?: string | null;
  season?: LiturgicalSeason | null;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function Header({ parishName = "본당 홈페이지", parishNameEn = "", logoUrl = null, season = null }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<number | null>(null);
  const [hoveredItem, setHoveredItem] = useState<number | null>(null);
  const closeGroupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openGroupNow = (idx: number) => {
    if (closeGroupTimer.current) clearTimeout(closeGroupTimer.current);
    if (openGroup !== idx) setHoveredItem(null);
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
  const [today, setToday] = useState("");
  const userMenuRef = useRef<HTMLDivElement>(null);
  const archiveCounts = useArchiveCounts();
  const { groups, currentGroup } = useNavigation();

  const visibleNavGroups = groups
    .filter((g) => g.show_in_header)
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => !isArchiveLinkHidden(i.href, archiveCounts)),
    }));

  useEffect(() => {
    setIsAdminAuthed(document.cookie.split(";").some((c) => c.trim().startsWith("admin_authed=")));
    // 전례 시기 칩 날짜 — client 에서만 채워 hydration mismatch 회피
    setToday(new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\.\s/g, ".").replace(/\.$/, ""));
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
    <header className="site-header-root">
      {/* ══ 데스크탑 헤더 (md+) ══ */}
      <div className="hidden md:block">
      {/* ── topbar ── */}
      <div className="site-topbar">
        <div className="site-topbar-inner">
          <span className="liturgy" title={season ? `현재 전례 시기: ${SEASON_LABELS_KO[season]}` : undefined}>
            {season ? SEASON_LABELS_KO[season] : "오늘"}
            {today && <span> · {today}</span>}
          </span>
          <div className="site-topbar-right">
            {session && <NotificationBell />}
            {session ? (
              <div
                className="relative"
                ref={userMenuRef}
                onMouseEnter={() => setUserMenuOpen(true)}
                onMouseLeave={() => setUserMenuOpen(false)}
              >
                <button
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex items-center gap-1.5"
                >
                  {session.user?.image ? (
                    <img src={session.user.image} alt="" className="w-5 h-5 rounded-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => { e.currentTarget.style.display = "none"; }} />
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
                      <Link href="/members/me" onClick={() => setUserMenuOpen(false)}
                        className="block px-4 py-2.5 text-sm hover:bg-[var(--color-surface-warm)] hover:text-[var(--color-primary)] transition-colors">
                        마이페이지
                      </Link>
                      {(session as { isAdmin?: boolean })?.isAdmin && (
                        <Link href="/admin" onClick={() => setUserMenuOpen(false)}
                          className="block px-4 py-2.5 text-sm hover:bg-[var(--color-surface-warm)] hover:text-[var(--color-primary)] transition-colors">
                          관리페이지
                        </Link>
                      )}
                    </div>
                    <div className="border-t border-[var(--color-border)]">
                      <button onClick={() => { setUserMenuOpen(false); signOut({ callbackUrl: "/" }); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-[var(--color-surface-warm)] transition-colors">
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
              <Link href="/members/login">로그인</Link>
            )}
          </div>
        </div>
      </div>

      {/* ── main header ── */}
      <div className="site-shell-header">
        <div className="site-header-inner">
          {/* 로고 */}
          <Link href="/" className="site-logo">
            {logoUrl ? (
              <img
                src={logoUrl.startsWith("http") ? logoUrl : `${API}${logoUrl}`}
                alt={parishName}
                className="site-logo-mark"
                style={{ objectFit: "contain" }}
              />
            ) : (
              <LogoFallback className="site-logo-mark" />
            )}
            <span className="site-logo-text">
              {parishName}
              {parishNameEn && <span className="site-logo-en">{parishNameEn}</span>}
            </span>
          </Link>

          {/* 데스크톱 네비게이션 */}
          <nav className="site-nav">
            {visibleNavGroups.map((group, idx) => {
              const firstInternal = group.items.find((i) => !i.is_external);
              const groupHref = group.landing_href ?? firstInternal?.href ?? group.items[0]?.href ?? null;
              const groupTargetExternal = !group.landing_href && (firstInternal ? false : group.items[0]?.is_external);
              const isActiveGroup = currentGroup?.id === group.id;
              const linkCls = `site-nav-link${isActiveGroup ? " on" : ""}`;
              return (
                <div
                  key={group.key}
                  className="site-nav-item"
                  onMouseEnter={() => openGroupNow(idx)}
                  onMouseLeave={scheduleGroupClose}
                >
                  {groupHref ? (
                    <Link
                      href={groupHref}
                      target={groupTargetExternal ? "_blank" : undefined}
                      rel={groupTargetExternal ? "noopener noreferrer" : undefined}
                      onClick={() => { setOpenGroup(null); setHoveredItem(null); }}
                      aria-current={isActiveGroup ? "page" : undefined}
                      className={linkCls}
                    >
                      {group.label}
                    </Link>
                  ) : (
                    <button className={linkCls}>{group.label}</button>
                  )}

                  {openGroup === idx && group.items.length > 0 && (
                    <div className="site-nav-dropdown">
                      {group.items.map((item) => {
                        const itemHasChildren = (item.children?.length ?? 0) > 0;
                        const isHovered = hoveredItem === item.id;
                        return (
                          <div
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
                              style={pathname === item.href ? { color: "var(--color-primary)", fontWeight: 600 } : undefined}
                            >
                              {item.label}
                              {item.is_external && <span style={{ fontSize: 10, opacity: 0.5, marginLeft: 4 }}>↗</span>}
                              {itemHasChildren && <span style={{ float: "right", opacity: 0.5 }}>▸</span>}
                            </Link>
                            {itemHasChildren && isHovered && (
                              <div className="site-nav-dropdown" style={{ top: 0, left: "100%", transform: "none", marginTop: 0, marginLeft: 4 }}>
                                {item.children!.map((c) => (
                                  <Link
                                    key={c.id}
                                    href={c.href}
                                    target={c.is_external ? "_blank" : undefined}
                                    rel={c.is_external ? "noopener noreferrer" : undefined}
                                    onClick={() => { setOpenGroup(null); setHoveredItem(null); }}
                                    style={pathname === c.href ? { color: "var(--color-primary)", fontWeight: 600 } : undefined}
                                  >
                                    {c.label}
                                    {c.is_external && <span style={{ fontSize: 10, opacity: 0.5, marginLeft: 4 }}>↗</span>}
                                  </Link>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* 우측 — 검색 + 한 줄 봉헌 CTA + 모바일 토글 */}
          <div className="site-header-right">
            <form onSubmit={handleSearch} role="search" aria-label="사이트 검색" className="site-search-btn" suppressHydrationWarning>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="7" cy="7" r="5" /><line x1="11" y1="11" x2="14" y2="14" strokeLinecap="round" /></svg>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") { setSearchQuery(""); (e.currentTarget as HTMLInputElement).blur(); } }}
                placeholder="기도문·공지·주보 검색"
                aria-label="검색어"
                suppressHydrationWarning
              />
            </form>
            <Link href="/offering" className="site-cta">
              한 줄 봉헌
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6"><polyline points="4 2 8 6 4 10" /></svg>
            </Link>
            <button
              className="site-mobile-toggle"
              onClick={() => { setMenuOpen(!menuOpen); setOpenGroup(null); }}
              aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
              aria-expanded={menuOpen}
            >
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                {menuOpen ? (
                  <><line x1="5" y1="5" x2="17" y2="17" /><line x1="17" y1="5" x2="5" y2="17" /></>
                ) : (
                  <><line x1="3" y1="6" x2="19" y2="6" /><line x1="3" y1="11" x2="19" y2="11" /><line x1="3" y1="16" x2="19" y2="16" /></>
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* 데스크톱 breadcrumb — 스크롤 시 PageHeader 와 연동 (로고 아래 얇은 띠) */}
        {breadcrumb && (
          <div className="hidden md:block border-t border-[var(--color-border)] bg-[var(--color-background)]">
            <div style={{ maxWidth: 1320, margin: "0 auto", padding: "8px 56px" }} className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
              <span>{breadcrumb.group}</span>
              <span className="text-[var(--color-border-dark)]">›</span>
              <span className="text-[var(--color-text)] font-medium">{breadcrumb.title}</span>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* ══ 모바일 app-header (md 미만) ══ */}
      <div className="app-header md:hidden">
        <div className="app-header-inner">
          <button
            className="hamburger"
            onClick={() => { setMenuOpen(!menuOpen); setOpenGroup(null); }}
            aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={menuOpen}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              {menuOpen ? (
                <><line x1="5" y1="6" x2="19" y2="18" /><line x1="19" y1="6" x2="5" y2="18" /></>
              ) : (
                <><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></>
              )}
            </svg>
          </button>
          <Link href="/" className="logo-mini">
            {logoUrl ? (
              <img src={logoUrl.startsWith("http") ? logoUrl : `${API}${logoUrl}`} alt={parishName} className="mk" style={{ objectFit: "contain" }} />
            ) : (
              <LogoFallback className="mk" />
            )}
            <b>{parishName}</b>
          </Link>
          <div className="right-icons">
            {session ? (
              <NotificationBell />
            ) : (
              <Link href="/members/login" className="icon-btn" aria-label="로그인">
                <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="9" cy="6" r="3" /><path d="M3.5 16c0-3 2.5-5 5.5-5s5.5 2 5.5 5" /></svg>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* 모바일 메뉴 — 그룹 아코디언. v1.5.454 HeaderMobileMenu 로 분리. */}
      <HeaderMobileMenu
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        openGroup={openGroup}
        setOpenGroup={setOpenGroup}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        handleSearch={handleSearch}
        visibleNavGroups={visibleNavGroups}
        pathname={pathname ?? ""}
      />
    </header>
  );
}
