"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useBulkSelect } from "@/components/useBulkSelect";
import BulkActionBar from "@/components/BulkActionBar";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatErrorDetail } from "@/lib/api";

function relativeFromNow(iso: string | null): string {
  if (!iso) return "로그인 기록 없음";
  const t = new Date(iso).getTime();
  const diffSec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (diffSec < 60) return "방금 전";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}분 전`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}시간 전`;
  const days = Math.floor(diffSec / 86400);
  if (days < 7) return `${days}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

const API = process.env.NEXT_PUBLIC_API_URL;

interface Member {
  id: number;
  email: string;
  nickname: string;
  name: string | null;
  phone: string | null;
  avatar_url: string | null;
  social_provider: string | null;
  is_active: boolean;
  is_admin: boolean;
  is_email_verified: boolean;
  has_password: boolean;
  post_count: number;
  last_login_at: string | null;
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

const EMPTY_FORM = { email: "", name: "", nickname: "", password: "" };

export default function AdminMembersPage() {
  const router = useRouter();
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [inputQ, setInputQ] = useState("");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const [processing, setProcessing] = useState<Record<number, boolean>>({});
  const [isSuper, setIsSuper] = useState(false);
  // 본인 행 보호 — admin_token 이 운영자(role=member) JWT 이면 sub 가 자기 member id.
  // 슈퍼관리자는 Admin 테이블이라 Member 목록에 등장하지 않음(보호 불요).
  const [currentMemberId, setCurrentMemberId] = useState<number | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const memberIds = useMemo(() => data?.items.map((m) => m.id) ?? [], [data]);
  const select = useBulkSelect(memberIds);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;

  useEffect(() => {
    setIsSuper(localStorage.getItem("admin_is_super") === "true");
    try {
      const t = localStorage.getItem("admin_token");
      if (t) {
        const payload = JSON.parse(atob(t.split(".")[1]));
        if (payload?.role === "member") setCurrentMemberId(Number(payload.sub));
      }
    } catch {}
  }, []);

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

  async function downloadCsv() {
    if (!token) { router.push("/admin"); return; }
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (filterActive !== "all") params.set("is_active", filterActive === "active" ? "true" : "false");
    const res = await fetch(`${API}/api/members/admin/export.csv?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      alert("CSV 다운로드에 실패했습니다.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `members_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCreateMember(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);
    try {
      const res = await fetch(`${API}/api/members/admin/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(formatErrorDetail(data.detail, "등록에 실패했습니다.")); return; }
      setForm({ ...EMPTY_FORM });
      setShowForm(false);
      setPage(1);
      setQ("");
      fetchMembers();
    } finally {
      setFormLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPage(1);
    setQ(inputQ);
  }

  async function resetPassword(member: Member) {
    if (!confirm(`"${member.nickname}" 회원의 비밀번호를 초기값(0629)으로 초기화하시겠습니까?`)) return;
    setProcessing((p) => ({ ...p, [member.id]: true }));
    try {
      const res = await fetch(`${API}/api/members/admin/${member.id}/reset-password`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) alert("초기화에 실패했습니다.");
    } finally {
      setProcessing((p) => ({ ...p, [member.id]: false }));
    }
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

  async function toggleAdminRole(member: Member) {
    const action = member.is_admin ? "revoke-admin" : "grant-admin";
    const label = member.is_admin ? "운영자 권한을 회수" : "운영자 권한을 부여";
    const needsPwWarning = !member.is_admin && member.social_provider && !member.has_password;
    const confirmMsg = needsPwWarning
      ? `"${member.nickname}" 회원에게 ${label}하시겠습니까?\n\n⚠️ 소셜 로그인 전용 계정입니다. 관리자 패널 로그인은 해당 회원이 비밀번호를 설정한 후에 가능합니다.`
      : `"${member.nickname}" 회원에게 ${label}하시겠습니까?`;
    if (!confirm(confirmMsg)) return;
    setProcessing((p) => ({ ...p, [member.id]: true }));
    try {
      const res = await fetch(`${API}/api/members/admin/${member.id}/${action}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                items: prev.items.map((m) =>
                  m.id === member.id ? { ...m, is_admin: !m.is_admin } : m
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
        select.remove(member.id);
      }
    } finally {
      setProcessing((p) => ({ ...p, [member.id]: false }));
    }
  }

  async function handleBulkDelete() {
    const ids = Array.from(select.selected);
    if (ids.length === 0 || !data) return;
    const targets = data.items.filter((m) => ids.includes(m.id));
    const totalPosts = targets.reduce((sum, m) => sum + (m.post_count ?? 0), 0);
    if (!confirm(`선택한 회원 ${ids.length}명을 삭제하시겠습니까?\n작성한 게시글 총 ${totalPosts}건도 함께 삭제됩니다.`)) return;
    setBulkDeleting(true);
    try {
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            const res = await fetch(`${API}/api/members/admin/${id}`, {
              method: "DELETE", headers: { Authorization: `Bearer ${token}` },
            });
            return { id, ok: res.ok };
          } catch { return { id, ok: false }; }
        }),
      );
      const succeeded = new Set(results.filter((r) => r.ok).map((r) => r.id));
      const failedCount = results.filter((r) => !r.ok).length;
      if (succeeded.size > 0) {
        setData((prev) =>
          prev
            ? { ...prev, items: prev.items.filter((m) => !succeeded.has(m.id)), total: prev.total - succeeded.size }
            : prev,
        );
        select.removeMany(succeeded);
      }
      if (failedCount > 0) alert(`${failedCount}건 삭제 실패`);
    } finally {
      setBulkDeleting(false);
    }
  }

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  const inputCls = "px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">회원 관리</h1>
          {data && <span className="text-sm text-[var(--color-text-muted)]">전체 {data.total}명</span>}
        </div>
        <div className="flex items-center gap-2">
          {isSuper && (
            <button
              onClick={downloadCsv}
              className="px-3 py-2 border border-[var(--color-border)] text-sm rounded-lg hover:bg-[var(--color-surface)] transition-colors"
              title="현재 필터의 회원을 CSV 로 다운로드 (슈퍼 관리자 전용)"
            >
              📥 CSV 다운로드
            </button>
          )}
          <button
            onClick={() => { setShowForm((v) => !v); setFormError(""); setForm({ ...EMPTY_FORM }); }}
            className="px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
          >
            {showForm ? "취소" : "회원 등록"}
          </button>
        </div>
      </div>

      {/* 회원 등록 폼 */}
      {showForm && (
        <form onSubmit={handleCreateMember} className="p-5 bg-white border border-[var(--color-border)] rounded-xl space-y-4">
          <h2 className="font-semibold text-gray-800">새 회원 등록</h2>
          {formError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">이메일 *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className={`w-full ${inputCls}`}
                placeholder="example@email.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">이름 (선택)</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className={`w-full ${inputCls}`}
                placeholder="본명"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">세례명 * (2자 이상)</label>
              <input
                type="text"
                required
                value={form.nickname}
                onChange={(e) => setForm((p) => ({ ...p, nickname: e.target.value }))}
                className={`w-full ${inputCls}`}
                placeholder="베드로"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">비밀번호 * (8자 이상)</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                className={`w-full ${inputCls}`}
                placeholder="••••••••"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setShowForm(false); setFormError(""); }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={formLoading}
              className="px-5 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {formLoading ? "등록 중..." : "등록"}
            </button>
          </div>
        </form>
      )}

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

        <BulkActionBar
          selectedCount={select.selectedCount}
          total={select.total}
          allSelected={select.allSelected}
          someSelected={select.someSelected}
          onToggleAll={select.toggleAll}
          onDelete={handleBulkDelete}
          deleting={bulkDeleting}
        />

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
              {/* 테이블 헤더 — 의미별로 6그룹 재배치 (v1.5.271) */}
              <div className="hidden md:grid grid-cols-[auto_2.5fr_1fr_1.5fr_0.8fr_0.8fr_auto] gap-4 px-5 py-3 border-b border-[var(--color-border)] text-xs font-medium text-[var(--color-text-muted)] bg-[var(--color-surface-warm)]">
                <span className="w-4"></span>
                <span>회원 정보</span>
                <span>가입</span>
                <span>활동</span>
                <span>운영자</span>
                <span>상태</span>
                <span>관리</span>
              </div>

              <div className="divide-y divide-[var(--color-border)]">
                {data.items.map((member) => (
                  <MemberRow
                    isSelf={currentMemberId !== null && member.id === currentMemberId}
                    key={member.id}
                    member={member}
                    processing={!!processing[member.id]}
                    isSuper={isSuper}
                    isSelected={select.isSelected(member.id)}
                    onSelect={() => select.toggle(member.id)}
                    onToggle={() => toggleActive(member)}
                    onToggleAdmin={() => toggleAdminRole(member)}
                    onResetPassword={() => resetPassword(member)}
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
  );
}

function MemberRow({
  member,
  processing,
  isSuper,
  isSelf,
  isSelected,
  onSelect,
  onToggle,
  onToggleAdmin,
  onResetPassword,
  onDelete,
}: {
  member: Member;
  processing: boolean;
  isSuper: boolean;
  isSelf: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onToggleAdmin: () => void;
  onResetPassword: () => void;
  onDelete: () => void;
}) {
  const selfBlockedTitle = "자신에게는 적용할 수 없습니다.";
  return (
    <div className={`grid grid-cols-1 md:grid-cols-[auto_2.5fr_1fr_1.5fr_0.8fr_0.8fr_auto] gap-2 md:gap-4 px-5 py-4 items-center transition-colors ${isSelected ? "bg-red-50/30" : "hover:bg-[var(--color-surface-warm)]"}`}>
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onSelect}
        className="rounded"
        aria-label={`${member.nickname} 선택`}
      />
      {/* 회원 정보 — 아바타 + 닉네임 + 이메일 + #ID */}
      <div className="flex items-center gap-3 min-w-0">
        {member.avatar_url ? (
          /* 자체 업로드(상대 경로 /uploads/...)면 API 호스트를 prepend.
             소셜 아바타(http로 시작)는 그대로 사용. */
          <img
            src={member.avatar_url.startsWith("http") ? member.avatar_url : `${API}${member.avatar_url}`}
            alt=""
            className="w-8 h-8 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-[var(--color-border)] flex items-center justify-center text-xs text-[var(--color-text-muted)] font-medium shrink-0">
            {member.nickname[0]}
          </div>
        )}
        <div className="min-w-0">
          {isSuper ? (
            <Link
              href={`/admin/members/${member.id}`}
              className="text-sm font-medium hover:text-[var(--color-primary)] hover:underline block truncate"
            >
              {member.nickname}
            </Link>
          ) : (
            <p className="text-sm font-medium truncate">{member.nickname}</p>
          )}
          <p className="text-xs text-[var(--color-text-muted)] truncate">{member.email}</p>
          <p className="text-[11px] text-[var(--color-text-muted)]">#{member.id}</p>
        </div>
      </div>

      {/* 가입 — provider 배지 */}
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

      {/* 활동 — 게시글 수 · 마지막 로그인 */}
      <div className="text-xs text-[var(--color-text-muted)] space-y-0.5">
        <p>글 {member.post_count}건</p>
        <p>마지막 로그인: {relativeFromNow(member.last_login_at)}</p>
      </div>

      {/* 운영자 — 권한 배지 (+ 비밀번호 미설정 경고) */}
      <div className="flex flex-col items-start gap-1">
        {member.is_admin ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">운영자</span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">일반</span>
        )}
        {member.is_admin && !member.has_password && (
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-medium" title="관리자 패널 로그인을 위해 비밀번호 설정 필요">
            비밀번호 미설정
          </span>
        )}
      </div>

      {/* 상태 — 활성/비활성 */}
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium w-fit ${
        member.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
      }`}>
        {member.is_active ? "활성" : "비활성"}
      </span>

      {/* 관리 버튼 */}
      <div className="flex items-center gap-2 flex-wrap">
        {isSuper && (
          <button
            onClick={onToggleAdmin}
            disabled={processing || isSelf}
            title={isSelf ? selfBlockedTitle : undefined}
            className={`text-xs px-3 py-1.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap border ${
              member.is_admin
                ? "border-amber-300 text-amber-700 hover:bg-amber-50"
                : "border-blue-200 text-blue-600 hover:bg-blue-50"
            }`}
          >
            {member.is_admin ? "권한 회수" : "운영자 지정"}
          </button>
        )}
        <button
          onClick={onToggle}
          disabled={processing || isSelf}
          title={isSelf ? selfBlockedTitle : undefined}
          className="text-xs px-3 py-1.5 border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-warm)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          {processing ? "…" : member.is_active ? "비활성화" : "활성화"}
        </button>
        <button
          onClick={onResetPassword}
          disabled={processing}
          className="text-xs px-3 py-1.5 border border-orange-200 text-orange-600 rounded-lg hover:bg-orange-50 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          비밀번호 초기화
        </button>
        <button
          onClick={onDelete}
          disabled={processing || isSelf}
          title={isSelf ? selfBlockedTitle : undefined}
          className="text-xs px-3 py-1.5 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          삭제
        </button>
      </div>
    </div>
  );
}
