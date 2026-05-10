"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
import { useArchiveCounts, isArchiveLinkHidden } from "./useArchiveCounts";

const navGroups = [
  {
    label: "성당 소개",
    subtitle: "본당과 사목자",
    items: [
      { href: "/about", label: "성당 안내" },
      { href: "/pastor", label: "주임신부" },
      { href: "/saint", label: "수호성인 성 베드로" },
      { href: "/history", label: "본당 연혁" },
      { href: "/pastors", label: "역대 신부님" },
      { href: "/sisters", label: "역대 수녀님" },
      { href: "/priests", label: "본당 출신 사제" },
      { href: "/info", label: "찾아오시는 길" },
    ],
  },
  {
    label: "본당 공동체",
    subtitle: "조직과 활동",
    items: [
      { href: "/council", label: "사목평의회" },
      { href: "/groups", label: "분과와 단체" },
      { href: "/vision", label: "올해의 사목 방향" },
    ],
  },
  {
    label: "말씀과 기도",
    subtitle: "전례와 영성",
    items: [
      { href: "/word", label: "오늘의 복음" },
      { href: "/bulletin", label: "주보 아카이브" },
      { href: "/meditation", label: "묵상 글" },
      { href: "/prayer", label: "기도문" },
    ],
  },
  {
    label: "알림과 게시판",
    subtitle: "공지와 소통",
    items: [
      { href: "/boards/notice", label: "공지·알림" },
      { href: "/calendar", label: "행사 일정" },
      { href: "/boards", label: "자유 게시판" },
    ],
  },
  {
    label: "사진 갤러리",
    subtitle: "전례·행사 사진",
    items: [
      { href: "/gallery/liturgy", label: "전례 사진" },
      { href: "/gallery/events", label: "행사 사진" },
    ],
  },
];

interface Breadcrumb { group: string; title: string }

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<number | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [breadcrumb, setBreadcrumb] = useState<Breadcrumb | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isAdminAuthed, setIsAdminAuthed] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const archiveCounts = useArchiveCounts();

  const visibleNavGroups = navGroups
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => !isArchiveLinkHidden(i.href, archiveCounts)),
    }))
    .filter((g) => g.items.length > 0);

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
      {/* 상단 정보 바 — 로그인/사용자 메뉴 */}
      <div className="border-b border-[var(--color-border)]/60 text-sm">
        <div className="max-w-6xl mx-auto px-4 py-1.5 flex justify-end items-center">
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
                      <Link
                        href="/admin"
                        onClick={() => setUserMenuOpen(false)}
                        className="block px-4 py-2.5 text-sm hover:bg-[var(--color-surface-warm)] hover:text-[var(--color-primary)] transition-colors"
                      >
                        관리페이지
                      </Link>
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
              <span className="text-[var(--color-accent)] text-2xl leading-none">✝</span>
              <div>
                <div className="font-serif font-bold text-lg leading-tight tracking-tight text-[var(--color-primary)]">
                  세종성베드로성당
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
                key={group.label}
                className="relative h-full flex items-center"
                onMouseEnter={() => setOpenGroup(idx)}
                onMouseLeave={() => setOpenGroup(null)}
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

                {/* 드롭다운 */}
                {openGroup === idx && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-48 bg-white text-[var(--color-text)] shadow-lg z-50 border border-[var(--color-border)] rounded-b">
                    {/* 서사형 부제 */}
                    <div className="px-4 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-surface-warm)]">
                      <span className="text-[11px] text-[var(--color-text-muted)] tracking-wide">
                        {group.subtitle}
                      </span>
                    </div>
                    {/* 항목 */}
                    <ul>
                      {group.items.map((item) => (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setOpenGroup(null)}
                            className={`block px-4 py-2.5 text-sm transition-colors hover:bg-[var(--color-surface-warm)] hover:text-[var(--color-primary)] ${
                              pathname === item.href
                                ? "text-[var(--color-primary)] font-semibold bg-[var(--color-surface-warm)]"
                                : "text-[var(--color-text)]"
                            }`}
                          >
                            {item.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}

            {/* 검색 */}
            {searchOpen ? (
              <form onSubmit={handleSearch} className="flex items-center ml-2">
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Escape" && setSearchOpen(false)}
                  placeholder="검색어 입력..."
                  className="w-40 px-3 py-1.5 text-sm rounded-l bg-[var(--color-surface-warm)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-primary)]"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 text-sm bg-[var(--color-surface-warm)] hover:bg-[var(--color-border)] rounded-r border border-l-0 border-[var(--color-border)] transition-colors"
                  aria-label="검색"
                >
                  🔍
                </button>
              </form>
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                className="p-2 ml-2 rounded text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface-warm)] transition-colors"
                aria-label="검색"
              >
                🔍
              </button>
            )}
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
              <div key={group.label}>
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
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => { setMenuOpen(false); setOpenGroup(null); }}
                        className={`block px-7 py-2.5 text-sm transition-colors ${
                          pathname === item.href
                            ? "text-[var(--color-primary)] font-semibold"
                            : "text-[var(--color-text)] hover:text-[var(--color-primary)]"
                        }`}
                      >
                        {item.label}
                      </Link>
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
