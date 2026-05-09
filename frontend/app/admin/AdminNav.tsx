"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function AdminNav() {
  const [isSuper, setIsSuper] = useState(false);
  const [draftCount, setDraftCount] = useState(0);

  useEffect(() => {
    setIsSuper(localStorage.getItem("admin_is_super") === "true");
    const token = localStorage.getItem("admin_token");
    if (token) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/boards/drafts/count`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { if (d) setDraftCount(d.count ?? 0); })
        .catch(() => {});
    }
  }, []);

  return (
    <div className="bg-[var(--color-primary)] text-white">
      {/* 상단 행: 로고 + 사용자 */}
      <div className="px-4 py-3 flex items-center justify-between gap-4">
        <Link href="/admin/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0">
          <span className="text-[var(--color-accent-light)] text-xl">✝</span>
          <span className="font-serif font-bold">관리자</span>
          <span className="hidden sm:inline text-white/50 text-sm">— 세종성베드로성당</span>
        </Link>
        <div className="flex items-center gap-2 min-w-0">
          {isSuper && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-yellow-400/20 text-yellow-300 border border-yellow-400/30 shrink-0">
              최고관리자
            </span>
          )}
        </div>
      </div>

      {/* 하단 행: 메뉴 링크 (모바일 가로 스크롤) */}
      <div className="border-t border-white/10">
        <div className="flex items-center gap-1 px-4 overflow-x-auto scrollbar-hide">
          <Link href="/admin/dashboard" className="text-sm text-white/70 hover:text-white hover:bg-white/10 px-3 py-2 transition-colors whitespace-nowrap rounded">
            대시보드
          </Link>
          <Link href="/admin/boards" className="text-sm text-white/70 hover:text-white hover:bg-white/10 px-3 py-2 transition-colors whitespace-nowrap rounded">
            게시판
          </Link>
          <Link href="/admin/content" className="text-sm text-white/70 hover:text-white hover:bg-white/10 px-3 py-2 transition-colors whitespace-nowrap rounded">
            콘텐츠
          </Link>
          <Link href="/admin/members" className="text-sm text-white/70 hover:text-white hover:bg-white/10 px-3 py-2 transition-colors whitespace-nowrap rounded">
            회원
          </Link>
          <Link href="/admin/drafts" className="relative text-sm text-white/70 hover:text-white hover:bg-white/10 px-3 py-2 transition-colors whitespace-nowrap rounded">
            임시저장
            {draftCount > 0 && (
              <span className="absolute top-1 right-0 bg-amber-400 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {draftCount}
              </span>
            )}
          </Link>
          <Link href="/admin/event-mapping" className="text-sm text-white/70 hover:text-white hover:bg-white/10 px-3 py-2 transition-colors whitespace-nowrap rounded">
            분류 설정
          </Link>
          <Link href="/admin/settings" className="text-sm text-white/70 hover:text-white hover:bg-white/10 px-3 py-2 transition-colors whitespace-nowrap rounded">
            사이트 설정
          </Link>
          <Link href="/admin/docs" className="text-sm text-white/70 hover:text-white hover:bg-white/10 px-3 py-2 transition-colors whitespace-nowrap rounded">
            문서
          </Link>
        </div>
      </div>
    </div>
  );
}
