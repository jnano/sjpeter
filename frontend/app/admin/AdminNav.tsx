"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AdminNav() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [isSuper, setIsSuper] = useState(false);
  const [draftCount, setDraftCount] = useState(0);

  useEffect(() => {
    setDisplayName(localStorage.getItem("admin_display_name") ?? "");
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

  function handleLogout() {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_display_name");
    localStorage.removeItem("admin_role");
    localStorage.removeItem("admin_is_super");
    document.cookie = "admin_authed=; path=/; max-age=0";
    router.push("/admin");
  }

  return (
    <div className="bg-[var(--color-primary)] text-white px-6 py-4 flex items-center justify-between">
      <Link href="/admin/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
        <span className="text-[var(--color-accent-light)] text-xl">✝</span>
        <span className="font-serif font-bold">관리자</span>
        <span className="text-white/50 text-sm">— 세종성베드로성당</span>
      </Link>
      <div className="flex items-center gap-4">
        <Link href="/admin/drafts" className="relative text-sm text-white/70 hover:text-white transition-colors">
          임시저장
          {draftCount > 0 && (
            <span className="absolute -top-2 -right-4 bg-amber-400 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
              {draftCount}
            </span>
          )}
        </Link>
        <Link href="/admin/event-mapping" className="text-sm text-white/70 hover:text-white transition-colors">
          분류 설정
        </Link>
        <Link href="/admin/docs" className="text-sm text-white/70 hover:text-white transition-colors">
          문서
        </Link>
        {isSuper && displayName && (
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-yellow-400/20 text-yellow-300 border border-yellow-400/30">
              최고관리자
            </span>
            <span className="text-sm text-white/90 font-medium">{displayName}</span>
          </div>
        )}
        {isSuper ? (
          <button
            onClick={handleLogout}
            className="text-sm text-white/70 hover:text-white transition-colors"
          >
            로그아웃
          </button>
        ) : (
          displayName && (
            <span className="text-sm text-white/70">
              {displayName}님 관리자 페이지에 접속하셨습니다.
            </span>
          )
        )}
      </div>
    </div>
  );
}
