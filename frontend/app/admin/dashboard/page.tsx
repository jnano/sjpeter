"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Bulletin } from "@/lib/api";

const API = "http://localhost:8000";

export default function DashboardPage() {
  const router = useRouter();
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBulletins = useCallback(async () => {
    const token = localStorage.getItem("admin_token");
    if (!token) { router.push("/admin"); return; }

    try {
      const res = await fetch(`${API}/api/bulletins/`);
      if (res.ok) setBulletins(await res.json());
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchBulletins(); }, [fetchBulletins]);

  async function handleDelete(id: number) {
    if (!confirm("이 주보를 삭제하시겠습니까?")) return;
    const token = localStorage.getItem("admin_token");
    const res = await fetch(`${API}/api/bulletins/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) fetchBulletins();
    else alert("삭제에 실패했습니다.");
  }

  function handleLogout() {
    localStorage.removeItem("admin_token");
    document.cookie = "admin_authed=; path=/; max-age=0";
    router.push("/admin");
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface-warm)]">
      {/* 관리자 헤더 */}
      <div className="bg-[var(--color-primary)] text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[var(--color-accent-light)] text-xl">✝</span>
          <span className="font-serif font-bold">관리자 대시보드</span>
          <span className="text-white/50 text-sm">— 세종성베드로성당</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm text-white/70 hover:text-white transition-colors">
            사이트 보기 →
          </Link>
          <button
            onClick={handleLogout}
            className="text-sm text-white/70 hover:text-white transition-colors"
          >
            로그아웃
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* 액션 카드들 */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          {[
            { href: "/admin/bulletin/new", icon: "📤", label: "주보 업로드", desc: "PDF 등록" },
            { href: "/admin/notices", icon: "📢", label: "공지 관리", desc: "작성·수정·삭제" },
            { href: "/admin/parish", icon: "⛪", label: "성당 정보", desc: "미사 시간·신부님" },
            { href: "/admin/boards", icon: "💬", label: "게시판 관리", desc: "생성·활성화" },
            { href: "/admin/members", icon: "👥", label: "회원 관리", desc: "활성화·비활성화·삭제" },
            { href: "/admin/content", icon: "📄", label: "페이지 콘텐츠", desc: "연혁·지표·단체" },
          ].map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 text-center hover:border-[var(--color-primary)] hover:shadow-sm transition-all"
            >
              <div className="text-3xl mb-2">{card.icon}</div>
              <div className="font-medium text-sm text-[var(--color-primary)]">{card.label}</div>
              <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{card.desc}</div>
            </Link>
          ))}
        </div>

        {/* 주보 목록 */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
            <h2 className="font-serif font-bold text-[var(--color-primary)]">
              등록된 주보 ({bulletins.length}건)
            </h2>
            <Link
              href="/admin/bulletin/new"
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
            >
              + 새 주보 등록
            </Link>
          </div>

          {loading ? (
            <div className="p-12 text-center text-[var(--color-text-muted)]">불러오는 중…</div>
          ) : bulletins.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-[var(--color-text-muted)] mb-4">등록된 주보가 없습니다.</p>
              <Link
                href="/admin/bulletin/new"
                className="inline-block bg-[var(--color-primary)] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[var(--color-primary-light)] transition-colors"
              >
                첫 번째 주보 등록하기
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {bulletins.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between px-6 py-4 hover:bg-[var(--color-surface-warm)] transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium">
                        {b.issue_number ? `제${b.issue_number}호` : "주보"}
                      </span>
                      {b.liturgical_season && (
                        <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-warm)] border border-[var(--color-border)] px-2 py-0.5 rounded">
                          {b.liturgical_season}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-[var(--color-text-muted)] mt-0.5">
                      {b.published_date}
                      {b.gospel_reference && ` · ${b.gospel_reference}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {b.pdf_url && (
                      <a
                        href={`http://localhost:8000${b.pdf_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[var(--color-primary)] hover:underline"
                      >
                        PDF 보기
                      </a>
                    )}
                    <button
                      onClick={() => handleDelete(b.id)}
                      className="text-sm text-red-500 hover:text-red-700 transition-colors"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
