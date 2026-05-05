"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API = "http://localhost:8000";

interface Member {
  id: number;
  email: string;
  nickname: string;
  avatar_url: string | null;
  social_provider: string | null;
  is_active: boolean;
  post_count: number;
  created_at: string;
}

interface ListResponse {
  items: Member[];
  total: number;
  page: number;
  size: number;
}

const PROVIDER_LABEL: Record<string, string> = {
  google: "Google",
  kakao: "카카오",
};

export default function AdminMembersPage() {
  const router = useRouter();
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [inputQ, setInputQ] = useState("");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const [processing, setProcessing] = useState<Record<number, boolean>>({});

  const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;

  const fetchMembers = useCallback(async () => {
    if (!token) { router.push("/admin"); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), size: "20" });
      if (q) params.set("q", q);
      if (filterActive !== "all") params.set("is_active", filterActive === "active" ? "true" : "false");

      const res = await fetch(`${API}/api/members/admin/list?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { router.push("/admin"); return; }
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [token, page, q, filterActive, router]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setQ(inputQ);
  }

  async function toggleActive(member: Member) {
    setProcessing((p) => ({ ...p, [member.id]: true }));
    const action = member.is_active ? "deactivate" : "activate";
    try {
      const res = await fetch(`${API}/api/members/admin/${member.id}/${action}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                items: prev.items.map((m) =>
                  m.id === member.id ? { ...m, is_active: !m.is_active } : m
                ),
              }
            : prev
        );
      }
    } finally {
      setProcessing((p) => ({ ...p, [member.id]: false }));
    }
  }

  async function deleteMember(member: Member) {
    if (!confirm(`"${member.nickname}" 회원을 삭제하시겠습니까?\n작성한 게시글(${member.post_count}건)도 함께 삭제됩니다.`)) return;
    setProcessing((p) => ({ ...p, [member.id]: true }));
    try {
      const res = await fetch(`${API}/api/members/admin/${member.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setData((prev) =>
          prev
            ? { ...prev, items: prev.items.filter((m) => m.id !== member.id), total: prev.total - 1 }
            : prev
        );
      }
    } finally {
      setProcessing((p) => ({ ...p, [member.id]: false }));
    }
  }

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  return (
    <div className="min-h-screen bg-[var(--color-surface-warm)]">
      {/* 헤더 */}
      <div className="bg-[var(--color-primary)] text-white px-6 py-4 flex items-center gap-4">
        <Link href="/admin/dashboard" className="text-white/70 hover:text-white text-sm transition-colors">
          ← 대시보드
        </Link>
        <span className="text-white/30">|</span>
        <span className="font-serif font-bold">회원 관리</span>
        {data && (
          <span className="text-white/60 text-sm">전체 {data.total}명</span>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-5">
        {/* 검색 + 필터 */}
        <div className="flex flex-col sm:flex-row gap-3">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1">
            <input
              type="text"
              value={inputQ}
              onChange={(e) => setInputQ(e.target.value)}
              placeholder="이메일 또는 닉네임 검색"
              className="flex-1 border border-[var(--color-border)] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--color-primary)]"
            />
            <button
              type="submit"
              className="px-4 py-2.5 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--color-primary-light)] transition-colors"
            >
              검색
            </button>
          </form>

          <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden text-sm">
            {(["all", "active", "inactive"] as const).map((v) => (
              <button
                key={v}
                onClick={() => { setFilterActive(v); setPage(1); }}
                className={`px-4 py-2.5 transition-colors ${
                  filterActive === v
                    ? "bg-[var(--color-primary)] text-white"
                    : "bg-[var(--color-surface)] hover:bg-[var(--color-surface-warm)]"
                }`}
              >
                {v === "all" ? "전체" : v === "active" ? "활성" : "비활성"}
              </button>
            ))}
          </div>
        </div>

        {/* 목록 */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-[var(--color-text-muted)]">불러오는 중…</div>
          ) : !data || data.items.length === 0 ? (
            <div className="p-12 text-center text-[var(--color-text-muted)]">
              {q ? `"${q}"에 해당하는 회원이 없습니다.` : "등록된 회원이 없습니다."}
            </div>
          ) : (
            <>
              {/* 테이블 헤더 */}
              <div className="hidden md:grid grid-cols-[2fr_2fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b border-[var(--color-border)] text-xs font-medium text-[var(--color-text-muted)] bg-[var(--color-surface-warm)]">
                <span>회원</span>
                <span>이메일</span>
                <span>가입방법</span>
                <span>게시글</span>
                <span>상태</span>
                <span>관리</span>
              </div>

              <div className="divide-y divide-[var(--color-border)]">
                {data.items.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    processing={!!processing[member.id]}
                    onToggle={() => toggleActive(member)}
                    onDelete={() => deleteMember(member)}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm disabled:opacity-40 hover:bg-[var(--color-surface)] transition-colors"
            >
              이전
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const p = totalPages <= 7 ? i + 1 : Math.max(1, Math.min(page - 3, totalPages - 6)) + i;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-10 py-2 rounded-lg text-sm transition-colors ${
                    p === page
                      ? "bg-[var(--color-primary)] text-white"
                      : "border border-[var(--color-border)] hover:bg-[var(--color-surface)]"
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm disabled:opacity-40 hover:bg-[var(--color-surface)] transition-colors"
            >
              다음
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MemberRow({
  member,
  processing,
  onToggle,
  onDelete,
}: {
  member: Member;
  processing: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[2fr_2fr_1fr_1fr_1fr_auto] gap-2 md:gap-4 px-5 py-4 items-center hover:bg-[var(--color-surface-warm)] transition-colors">
      {/* 회원 */}
      <div className="flex items-center gap-3">
        {member.avatar_url ? (
          <img src={member.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-[var(--color-border)] flex items-center justify-center text-xs text-[var(--color-text-muted)] font-medium">
            {member.nickname[0]}
          </div>
        )}
        <div>
          <p className="text-sm font-medium">{member.nickname}</p>
          <p className="text-xs text-[var(--color-text-muted)]">#{member.id}</p>
        </div>
      </div>

      {/* 이메일 */}
      <p className="text-sm text-[var(--color-text-muted)] truncate">{member.email}</p>

      {/* 가입방법 */}
      <div>
        {member.social_provider ? (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            member.social_provider === "google"
              ? "bg-blue-50 text-blue-600"
              : "bg-yellow-50 text-yellow-700"
          }`}>
            {PROVIDER_LABEL[member.social_provider] ?? member.social_provider}
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">이메일</span>
        )}
      </div>

      {/* 게시글 수 */}
      <p className="text-sm text-[var(--color-text-muted)]">{member.post_count}건</p>

      {/* 상태 */}
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
        member.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
      }`}>
        {member.is_active ? "활성" : "비활성"}
      </span>

      {/* 관리 버튼 */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggle}
          disabled={processing}
          className="text-xs px-3 py-1.5 border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-warm)] disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {processing ? "…" : member.is_active ? "비활성화" : "활성화"}
        </button>
        <button
          onClick={onDelete}
          disabled={processing}
          className="text-xs px-3 py-1.5 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
        >
          삭제
        </button>
      </div>
    </div>
  );
}
