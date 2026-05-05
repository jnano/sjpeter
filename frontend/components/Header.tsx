"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";

const navItems = [
  { href: "/bulletin", label: "주보" },
  { href: "/about", label: "성당 소개" },
  { href: "/pastor", label: "신부님" },
  { href: "/history", label: "우리의 역사" },
  { href: "/vision", label: "사목지표" },
  { href: "/community", label: "함께하는 이들" },
  { href: "/boards", label: "게시판" },
  { href: "/word", label: "오늘의 말씀" },
  { href: "/info", label: "오시는 길" },
];

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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
      <div className="border-b border-white/10 text-sm">
        <div className="max-w-6xl mx-auto px-4 py-1.5 flex justify-between items-center">
          <span className="text-white/70">대전교구 세종성베드로성당</span>
          <div className="flex items-center gap-4 text-white/70">
            <a href="tel:044-000-0000" className="hover:text-white transition-colors">
              ☏ 044-000-0000
            </a>
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
          {/* 로고 */}
          <Link
            href="/"
            className="flex items-center gap-2.5 group"
          >
            <span className="text-[var(--color-accent-light)] text-2xl leading-none">✝</span>
            <div>
              <div className="font-serif font-bold text-lg leading-tight tracking-tight">
                세종성베드로성당
              </div>
              <div className="text-white/60 text-xs leading-none">
                St. Peter&apos;s Cathedral, Sejong
              </div>
            </div>
          </Link>

          {/* 데스크톱 네비게이션 */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                  pathname === item.href
                    ? "bg-white/20 text-white"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                }`}
              >
                {item.label}
              </Link>
            ))}
            {/* 데스크톱 검색 */}
            {searchOpen ? (
              <form onSubmit={handleSearch} className="flex items-center ml-1">
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Escape" && setSearchOpen(false)}
                  placeholder="검색어 입력..."
                  className="w-44 px-3 py-1.5 text-sm rounded-l bg-white/10 text-white placeholder-white/50 border border-white/30 focus:outline-none focus:bg-white/20"
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
                className="p-2 rounded text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="검색"
              >
                🔍
              </button>
            )}
          </nav>

          {/* 모바일 햄버거 버튼 */}
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
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={menuOpen}
          >
            <span className="block w-6 h-0.5 bg-white mb-1.5 transition-transform" />
            <span
              className={`block w-6 h-0.5 bg-white mb-1.5 transition-opacity ${menuOpen ? "opacity-0" : ""}`}
            />
            <span className="block w-6 h-0.5 bg-white transition-transform" />
          </button>
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

        {/* 모바일 메뉴 */}
        {menuOpen && (
          <nav className="md:hidden border-t border-white/10 py-3 pb-4">
            <div className="grid grid-cols-2 gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`px-3 py-2.5 rounded text-sm font-medium transition-colors ${
                    pathname === item.href
                      ? "bg-white/20 text-white"
                      : "text-white/80 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
