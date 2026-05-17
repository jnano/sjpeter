"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL;

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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-primary)]">대시보드</h1>
        <p className="text-sm text-gray-500 mt-1">사이트 현황을 한눈에 확인합니다.</p>
      </div>

      {/* 임시저장 알림 (있을 때만) */}
      {draftCount > 0 && (
        <Link
          href="/admin/drafts"
          className="block mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔔</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">
                임시저장 게시글 <strong>{draftCount}건</strong> 검토 대기 중
              </p>
              <p className="text-xs text-amber-700 mt-0.5">AI 추출 결과를 확인하고 게시 또는 삭제해 주세요.</p>
            </div>
            <span className="text-amber-600 text-sm">검토하기 →</span>
          </div>
        </Link>
      )}

      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "전체 회원", value: stats.total_members, sub: `활성 ${stats.active_members}명`, icon: "👥" },
            { label: "게시글", value: stats.total_posts, sub: "전체", icon: "📝" },
            { label: "댓글", value: stats.total_comments, sub: "전체", icon: "💬" },
            {
              label: "최근 가입",
              value: stats.recent_members.length > 0
                ? (stats.recent_members[0].name
                    ? `${stats.recent_members[0].name}(${stats.recent_members[0].nickname})`
                    : stats.recent_members[0].nickname)
                : "없음",
              sub: stats.recent_members[0]
                ? new Date(stats.recent_members[0].created_at).toLocaleDateString("ko-KR")
                : "",
              icon: "🆕",
            },
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
        <div className="bg-white border border-[var(--color-border)] rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-[var(--color-primary)]">최근 가입 회원</h2>
            <Link href="/admin/members" className="text-xs text-blue-500 hover:underline">
              전체 회원 →
            </Link>
          </div>
          <ul className="divide-y divide-gray-100">
            {stats.recent_members.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium">
                  {m.name ? `${m.name}(${m.nickname})` : m.nickname}
                </span>
                <span className="text-[var(--color-text-muted)] text-xs hidden sm:inline">{m.email}</span>
                <span className="text-[var(--color-text-muted)] text-xs">
                  {new Date(m.created_at).toLocaleDateString("ko-KR")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-8 text-center">
        좌측 메뉴에서 관리할 항목을 선택하세요.
      </p>
    </div>
  );
}
