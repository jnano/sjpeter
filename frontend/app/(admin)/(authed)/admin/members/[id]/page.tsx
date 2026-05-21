"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { formatErrorDetail } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL;

interface InterestGroup {
  id: number;
  label: string;
}

interface MemberDetail {
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
  comment_count: number;
  interest_groups: InterestGroup[];
  receive_notification: boolean;
  notify_kakao: boolean;
  name_day_month: number | null;
  name_day_day: number | null;
  last_login_at: string | null;
  created_at: string;
}

const PROVIDER_LABEL: Record<string, string> = {
  google: "Google",
  kakao: "Kakao",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function AdminMemberDetailPage() {
  const params = useParams();
  const router = useRouter();
  const memberId = Number(params?.id);

  const [token, setToken] = useState<string | null>(null);
  const [member, setMember] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [form, setForm] = useState({
    email: "",
    name: "",
    nickname: "",
    phone: "",
    name_day_month: "",
    name_day_day: "",
  });

  useEffect(() => {
    setToken(localStorage.getItem("admin_token"));
  }, []);

  const fetchMember = useCallback(async () => {
    if (!token) { router.push("/admin"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/members/admin/${memberId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { router.push("/admin"); return; }
      if (res.status === 404) { setError("회원을 찾을 수 없습니다."); return; }
      if (res.ok) {
        const data: MemberDetail = await res.json();
        setMember(data);
        setForm({
          email: data.email,
          name: data.name ?? "",
          nickname: data.nickname,
          phone: data.phone ?? "",
          name_day_month: data.name_day_month?.toString() ?? "",
          name_day_day: data.name_day_day?.toString() ?? "",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [memberId, token, router]);

  useEffect(() => { if (token) fetchMember(); }, [fetchMember, token]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !member) return;
    setSaving(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        email: form.email.trim(),
        name: form.name.trim() || null,
        nickname: form.nickname.trim(),
        phone: form.phone.trim() || null,
        name_day_month: form.name_day_month ? parseInt(form.name_day_month) : null,
        name_day_day: form.name_day_day ? parseInt(form.name_day_day) : null,
      };
      const res = await fetch(`${API}/api/members/admin/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(formatErrorDetail(data.detail) || "수정에 실패했습니다.");
        return;
      }
      setSaved("저장되었습니다.");
      setTimeout(() => setSaved(""), 2500);
      setEditing(false);
      await fetchMember();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="max-w-3xl mx-auto px-6 py-8 text-[var(--color-text-muted)]">불러오는 중…</div>;
  }
  if (!member) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        <p className="text-red-600">{error || "회원을 찾을 수 없습니다."}</p>
        <Link href="/admin/members" className="text-sm text-[var(--color-primary)] underline mt-3 inline-block">
          ← 목록으로
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <div>
        <Link href="/admin/members" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
          ← 회원 목록
        </Link>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-3">
            {member.avatar_url ? (
              <img
                src={member.avatar_url.startsWith("http") ? member.avatar_url : `${API}${member.avatar_url}`}
                alt=""
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[var(--color-border)] flex items-center justify-center text-lg text-[var(--color-text-muted)] font-medium">
                {member.nickname[0]}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                {member.nickname}
                {member.is_admin && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">운영자</span>
                )}
                {!member.is_active && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-medium">비활성</span>
                )}
              </h1>
              <p className="text-sm text-[var(--color-text-muted)]">#{member.id} · {member.email}</p>
            </div>
          </div>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:opacity-90"
            >
              정보 수정
            </button>
          )}
        </div>
      </div>

      {saved && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{saved}</p>
      )}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* 수정 폼 */}
      {editing ? (
        <form onSubmit={handleSave} className="p-5 bg-white border border-[var(--color-border)] rounded-xl space-y-4">
          <h2 className="font-semibold">정보 수정</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="이메일">
              <input type="email" required value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className={inputCls} />
            </Field>
            <Field label="세례명 (닉네임)">
              <input type="text" required value={form.nickname}
                onChange={(e) => setForm((p) => ({ ...p, nickname: e.target.value }))}
                className={inputCls} />
            </Field>
            <Field label="이름">
              <input type="text" value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className={inputCls} />
            </Field>
            <Field label="전화">
              <input type="tel" value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                className={inputCls} />
            </Field>
            <Field label="영명축일 (월)">
              <input type="number" min={1} max={12} value={form.name_day_month}
                onChange={(e) => setForm((p) => ({ ...p, name_day_month: e.target.value }))}
                className={inputCls} />
            </Field>
            <Field label="영명축일 (일)">
              <input type="number" min={1} max={31} value={form.name_day_day}
                onChange={(e) => setForm((p) => ({ ...p, name_day_day: e.target.value }))}
                className={inputCls} />
            </Field>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => { setEditing(false); setError(""); }}
              className="px-4 py-2 border border-[var(--color-border)] text-sm rounded-lg">취소</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-[var(--color-primary)] text-white text-sm rounded-lg disabled:opacity-50">
              {saving ? "저장 중…" : "저장"}
            </button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoCard title="기본 정보">
            <Row label="이메일" value={member.email} />
            <Row label="이름" value={member.name || "—"} />
            <Row label="세례명" value={member.nickname} />
            <Row label="전화" value={member.phone || "—"} />
            <Row label="영명축일" value={
              member.name_day_month && member.name_day_day
                ? `${member.name_day_month}월 ${member.name_day_day}일`
                : "—"
            } />
          </InfoCard>

          <InfoCard title="계정 상태">
            <Row label="가입 방법" value={
              member.social_provider
                ? PROVIDER_LABEL[member.social_provider] ?? member.social_provider
                : "이메일"
            } />
            <Row label="이메일 인증" value={member.is_email_verified ? "✓ 인증됨" : "미인증"} />
            <Row label="비밀번호" value={member.has_password ? "설정됨" : "미설정"} />
            <Row label="활성" value={member.is_active ? "활성" : "비활성"} />
            <Row label="운영자" value={member.is_admin ? "예" : "아니오"} />
            <Row label="카톡 알림" value={member.notify_kakao ? "동의" : "미동의"} />
          </InfoCard>

          <InfoCard title="활동 통계">
            <Row label="작성한 글" value={`${member.post_count}건`} />
            <Row label="작성한 댓글" value={`${member.comment_count}건`} />
            <Row label="마지막 로그인" value={formatDateTime(member.last_login_at)} />
            <Row label="가입일" value={formatDateTime(member.created_at)} />
          </InfoCard>

          <InfoCard title="관심 분과·단체">
            {member.interest_groups.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">선택한 항목 없음</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {member.interest_groups.map((g) => (
                  <span key={g.id} className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-surface-warm)] text-[var(--color-text)]">
                    {g.label}
                  </span>
                ))}
              </div>
            )}
          </InfoCard>
        </div>
      )}
    </div>
  );
}

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[var(--color-border)] rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-3 text-[var(--color-text)]">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-sm gap-3">
      <span className="text-xs text-[var(--color-text-muted)] shrink-0">{label}</span>
      <span className="text-right break-all">{value}</span>
    </div>
  );
}
