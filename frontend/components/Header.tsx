"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect } from "react";

const navGroups = [
  {
    label: "우리 성당",
    subtitle: "반석 위에",
    items: [
      { href: "/about", label: "성당 안내" },
      { href: "/saint", label: "성 베드로" },
      { href: "/community", label: "우리 가족" },
      { href: "/history", label: "걸어온 길" },
      { href: "/pastor", label: "사제의 발자취" },
      { href: "/info", label: "찾아오시는 길" },
    ],
  },
  {
    label: "본당 가족",
    subtitle: "어부의 뜰",
    items: [
      { href: "/council", label: "사목평의회" },
      { href: "/groups", label: "분과와 단체" },
      { href: "/vision", label: "이 해의 사목 방향" },
    ],
  },
  {
    label: "말씀과 기도",
    subtitle: "말씀의 그물",
    items: [
      { href: "/word", label: "오늘의 복음" },
      { href: "/bulletin", label: "주보 아카이브" },
      { href: "/meditation", label: "작은 묵상" },
      { href: "/prayer", label: "기도문 모음" },
    ],
  },
  {
    label: "알림과 나눔",
    subtitle: "열린 문",
    items: [
      { href: "/boards/notice", label: "공지·알림" },
      { href: "/boards", label: "자유 글터" },
      { href: "/boards/news", label: "공동체 소식" },
    ],
  },
  {
    label: "사진 기록",
    subtitle: "갈릴래아의 기억",
    items: [
      { href: "/gallery/liturgy", label: "전례의 순간" },
      { href: "/gallery/events", label: "함께한 시간" },
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
    <header className="bg-[var(--color-primary)] text-white shadow-lg sticky top-0 z-50">
      {/* 상단 정보 바 */}
      <div className="border-b border-white/10 text-sm bg-[#9B2335]">
        <div className="max-w-6xl mx-auto px-4 py-1.5 flex justify-between items-center">
          <span className="text-white/70">대전교구 세종성베드로성당</span>
          <div className="flex items-center gap-4 text-white/70">
            {session ? (
              <div className="flex items-center gap-3">
                <Link href="/members/me" className="flex items-center gap-1.5 hover:text-white transition-colors">
                  {session.user?.image ? (
                    <img src={session.user.image} alt="" className="w-5 h-5 rounded-full object-cover" />
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold">
                      {session.user?.name?.[0]}
                    </span>
                  )}
                  {session.user?.name}
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="hover:text-white transition-colors"
                >
                  로그아웃
                </button>
              </div>
            ) : (
              <Link href="/members/login" className="hover:text-white transition-colors">
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
              <span className="text-[var(--color-accent-light)] text-2xl leading-none">✝</span>
              <div>
                <div className="font-serif font-bold text-lg leading-tight tracking-tight">
                  세종성베드로성당
                </div>
                {/* 모바일: 스크롤 시 서브타이틀 → 페이지 제목으로 전환 */}
                <div className="relative text-xs leading-none h-[1.1em] overflow-hidden">
                  <span className={`absolute inset-0 text-white/60 transition-opacity duration-300 ${breadcrumb ? "opacity-0" : "opacity-100"}`}>
                    St. Peter&apos;s Cathedral, Sejong
                  </span>
                  <span className={`absolute inset-0 text-white/90 font-medium whitespace-nowrap overflow-hidden text-ellipsis transition-opacity duration-300 ${breadcrumb ? "opacity-100" : "opacity-0"}`}>
                    {breadcrumb?.title}
                  </span>
                </div>
              </div>
            </Link>

            {/* 데스크톱 breadcrumb — 로고 옆 */}
            <span
              className={`hidden md:flex items-center gap-1.5 text-xs text-white/60 transition-all duration-300 overflow-hidden whitespace-nowrap ${
                breadcrumb
                  ? "opacity-100 max-w-xs translate-x-0"
                  : "opacity-0 max-w-0 -translate-x-2 pointer-events-none"
              }`}
            >
              <span className="text-white/30 text-sm">›</span>
              <span>{breadcrumb?.group}</span>
              <span className="text-white/30 text-sm">›</span>
              <span className="text-white font-medium">{breadcrumb?.title}</span>
            </span>
          </div>

          {/* 데스크톱 네비게이션 */}
          <nav className="hidden md:flex items-center h-full">
            {navGroups.map((group, idx) => (
              <div
                key={group.label}
                className="relative h-full flex items-center"
                onMouseEnter={() => setOpenGroup(idx)}
                onMouseLeave={() => setOpenGroup(null)}
              >
                <button
                  className={`px-4 h-full text-sm font-medium transition-colors whitespace-nowrap ${
                    openGroup === idx
                      ? "text-white bg-white/10"
                      : "text-white/80 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {group.label}
                </button>

                {/* 드롭다운 */}
                {openGroup === idx && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-44 bg-white text-[var(--color-text)] shadow-xl z-50 border border-[var(--color-border)]">
                    {/* 서사형 부제 */}
                    <div className="px-4 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-surface-warm)]">
                      <span className="text-[11px] italic text-[var(--color-accent)] font-medium tracking-wide">
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
                  className="w-40 px-3 py-1.5 text-sm rounded-l bg-white/10 text-white placeholder-white/50 border border-white/30 focus:outline-none focus:bg-white/20"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 text-sm bg-white/20 hover:bg-white/30 rounded-r border border-l-0 border-white/30 transition-colors"
                  aria-label="검색"
                >
                  🔍
                </button>
              </form>
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                className="p-2 ml-2 rounded text-white/80 hover:text-white hover:bg-white/10 transition-colors"
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
              className="p-2 rounded hover:bg-white/10 transition-colors text-white/80"
              aria-label="검색"
            >
              🔍
            </button>
            <button
              className="p-2 rounded hover:bg-white/10 transition-colors"
              onClick={() => { setMenuOpen(!menuOpen); setOpenGroup(null); }}
              aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
              aria-expanded={menuOpen}
            >
              <span className="block w-6 h-0.5 bg-white mb-1.5 transition-transform" />
              <span className={`block w-6 h-0.5 bg-white mb-1.5 transition-opacity ${menuOpen ? "opacity-0" : ""}`} />
              <span className="block w-6 h-0.5 bg-white transition-transform" />
            </button>
          </div>
        </div>

        {/* 모바일 검색창 */}
        {searchOpen && !menuOpen && (
          <form onSubmit={handleSearch} className="md:hidden border-t border-white/10 py-3 px-1 flex gap-2">
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setSearchOpen(false)}
              placeholder="검색어 입력..."
              className="flex-1 px-3 py-2 text-sm rounded bg-white/10 text-white placeholder-white/50 border border-white/30 focus:outline-none focus:bg-white/20"
            />
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-white/20 hover:bg-white/30 rounded border border-white/30 transition-colors"
            >
              검색
            </button>
          </form>
        )}

        {/* 모바일 메뉴 — 그룹 아코디언 */}
        {menuOpen && (
          <nav className="md:hidden border-t border-white/10 py-2 pb-4">
            {navGroups.map((group, idx) => (
              <div key={group.label}>
                <button
                  onClick={() => setOpenGroup(openGroup === idx ? null : idx)}
                  className="w-full flex items-center justify-between px-3 py-3 text-sm font-medium text-white/90 hover:bg-white/10 transition-colors"
                >
                  <span>{group.label}</span>
                  <span
                    className={`text-white/50 text-xs transition-transform duration-200 ${
                      openGroup === idx ? "rotate-180" : ""
                    }`}
                  >
                    ▾
                  </span>
                </button>
                {openGroup === idx && (
                  <div className="bg-white/5 border-t border-b border-white/10">
                    <div className="px-5 py-2">
                      <span className="text-[11px] italic text-[var(--color-accent-light)] tracking-wide">
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
                            ? "text-white font-semibold"
                            : "text-white/75 hover:text-white"
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
