"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AdminNav() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [isSuper, setIsSuper] = useState(false);

  useEffect(() => {
    setDisplayName(localStorage.getItem("admin_display_name") ?? "");
    setIsSuper(localStorage.getItem("admin_is_super") === "true");
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
        {displayName && (
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              isSuper ? "bg-yellow-400/20 text-yellow-300 border border-yellow-400/30" : "bg-white/10 text-white/70 border border-white/20"
            }`}>
              {isSuper ? "최고관리자" : "관리자"}
            </span>
            <span className="text-sm text-white/90 font-medium">{displayName}</span>
          </div>
        )}
        <Link href="/" className="text-sm text-white/70 hover:text-white transition-colors">
          사이트 보기
        </Link>
        <button
          onClick={handleLogout}
          className="text-sm text-white/70 hover:text-white transition-colors"
        >
          로그아웃
        </button>
      </div>
    </div>
  );
}
