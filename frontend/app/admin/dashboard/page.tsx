"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API = "http://localhost:8000";

interface Stats {
  total_members: number;
  active_members: number;
  total_posts: number;
  total_comments: number;
  recent_members: { id: number; name: string | null; nickname: string; email: string; created_at: string }[];
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [draftCount, setDraftCount] = useState(0);
  const fetchAll = useCallback(async () => {
    const token = localStorage.getItem("admin_token");
    if (!token) { router.push("/admin"); return; }
    const headers = { Authorization: `Bearer ${token}` };
    const [statsRes, draftRes] = await Promise.all([
      fetch(`${API}/api/members/admin/stats`, { headers }),
      fetch(`${API}/api/boards/drafts/count`, { headers }),
    ]);
    if (statsRes.ok) setStats(await statsRes.json());
    if (draftRes.ok) { const d = await draftRes.json(); setDraftCount(d.count ?? 0); }
  }, [router]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "전체 회원", value: stats.total_members, sub: `활성 ${stats.active_members}명`, icon: "👥" },
            { label: "게시글", value: stats.total_posts, sub: "전체", icon: "📝" },
            { label: "댓글", value: stats.total_comments, sub: "전체", icon: "💬" },
            { label: "최근 가입", value: stats.recent_members.length > 0
                ? (stats.recent_members[0].name
                    ? `${stats.recent_members[0].name}(${stats.recent_members[0].nickname})`
                    : stats.recent_members[0].nickname)
                : "없음",
              sub: stats.recent_members[0]
                ? new Date(stats.recent_members[0].created_at).toLocaleDateString("ko-KR")
                : "", icon: "🆕" },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-[var(--color-border)] rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-[var(--color-text-muted)]">{s.label}</span>
                <span className="text-lg">{s.icon}</span>
              </div>
              <p className="text-2xl font-bold text-[var(--color-primary)] truncate">{s.value}</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* 최근 가입 회원 */}
      {stats && stats.recent_members.length > 0 && (
        <div className="bg-white border border-[var(--color-border)] rounded-xl p-4 mb-6">
          <h2 className="text-sm font-bold text-[var(--color-primary)] mb-3">최근 가입 회원</h2>
          <div className="space-y-2">
            {stats.recent_members.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {m.name ? `${m.name}(${m.nickname})` : m.nickname}
                </span>
                <span className="text-[var(--color-text-muted)] text-xs">{m.email}</span>
                <span className="text-[var(--color-text-muted)] text-xs">
                  {new Date(m.created_at).toLocaleDateString("ko-KR")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 액션 카드들 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {/* 임시저장 카드 (배지 포함) */}
        <Link
          href="/admin/drafts"
          className="relative bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 text-center hover:border-[var(--color-primary)] hover:shadow-sm transition-all"
        >
          {draftCount > 0 && (
            <span className="absolute top-3 right-3 bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {draftCount}
            </span>
          )}
          <div className="text-3xl mb-2">📝</div>
          <div className="font-medium text-sm text-[var(--color-primary)]">임시저장 게시글</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-0.5">AI 초안 검토·게시</div>
        </Link>

        {[
          { href: "/admin/bulletin", icon: "📋", label: "주보 관리", desc: "목록·등록·삭제" },
          { href: "/admin/notices", icon: "📢", label: "공지 관리", desc: "작성·수정·삭제" },
          { href: "/admin/parish", icon: "⛪", label: "성당 정보", desc: "미사 시간·신부님" },
          { href: "/admin/boards", icon: "💬", label: "게시판 관리", desc: "생성·활성화" },
          { href: "/admin/members", icon: "👥", label: "회원 관리", desc: "활성화·비활성화·삭제" },
          { href: "/admin/content", icon: "📄", label: "페이지 콘텐츠", desc: "연혁·지표·단체" },
          { href: "/admin/gallery", icon: "🖼️", label: "갤러리 관리", desc: "사진 업로드·삭제" },
          { href: "/admin/calendar", icon: "📅", label: "행사 캘린더", desc: "행사 등록·수정·삭제" },
          { href: "/admin/pastors", icon: "⛪", label: "역대 사목자", desc: "사목자 등록·수정·삭제" },
          { href: "/admin/priests", icon: "✝️", label: "본당 출신 사제", desc: "사제 등록·수정·삭제" },
          { href: "/admin/logs", icon: "📋", label: "활동 로그", desc: "관리자 행동 기록" },
          { href: "/admin/docs", icon: "📖", label: "기술문서·도움말", desc: "기능 가이드·API·변경 이력" },
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

    </div>
  );
}
