"use client";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";

const API = process.env.NEXT_PUBLIC_API_URL;
const SPECIAL = /[!@#$%^&*()_+\-=\[\]{}|;':",.<>?/~`\\]/;

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "비밀번호는 8자 이상이어야 합니다.";
  if (!SPECIAL.test(pw)) return "비밀번호에 특수문자를 포함해야 합니다.";
  return null;
}

interface BoardInfo {
  id: number;
  name: string;
  slug: string;
}

interface MyPost {
  id: number;
  title: string;
  view_count: number;
  created_at: string;
  comment_count: number;
  board: BoardInfo;
}

interface MyComment {
  id: number;
  content: string;
  created_at: string;
  post_id: number;
  post_title: string;
  board_slug: string;
}

interface MemberInfo {
  id: number;
  email: string;
  name: string | null;
  nickname: string;
  phone: string | null;
  receive_notification: boolean;
  avatar_url: string | null;
  has_password: boolean;
  is_admin: boolean;
  is_email_verified: boolean;
  created_at: string;
}

// ── 이름/세례명 편집 폼 ────────────────────────────────────
function NicknameForm({ member, token, onSaved }: {
  member: MemberInfo;
  token: string;
  onSaved: (m: MemberInfo, displayName: string) => void;
}) {
  const [name, setName] = useState(member.name ?? "");
  const [nickname, setNickname] = useState(member.nickname);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const unchanged = name.trim() === (member.name ?? "") && nickname.trim() === member.nickname;
  const invalid = name.trim().length === 0 || nickname.trim().length < 2;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (unchanged) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API}/api/members/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim(), nickname: nickname.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setMessage({ type: "err", text: data.detail ?? "저장 실패" }); return; }
      const displayName = data.name ? `${data.name}(${data.nickname})` : data.nickname;
      onSaved(data, displayName);
      setMessage({ type: "ok", text: "저장되었습니다." });
    } catch {
      setMessage({ type: "err", text: "네트워크 오류가 발생했습니다." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase mb-1.5">
            이름
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
            placeholder="이름을 입력하세요"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase mb-1.5">
            세례명
          </label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            minLength={2}
            maxLength={30}
            required
            className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
            placeholder="세례명"
          />
        </div>
        <button
          type="submit"
          disabled={saving || unchanged || invalid}
          className="px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] disabled:opacity-40 transition-colors shrink-0"
        >
          {saving ? "저장 중…" : "저장"}
        </button>
      </div>
      {message && (
        <p className={`text-xs px-3 py-2 rounded-lg ${
          message.type === "ok"
            ? "bg-green-50 text-green-700 border border-green-200"
            : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {message.text}
        </p>
      )}
    </form>
  );
}

// ── 전화번호 편집 폼 ───────────────────────────────────────
function PhoneForm({ member, token, onSaved }: {
  member: MemberInfo;
  token: string;
  onSaved: (m: MemberInfo) => void;
}) {
  const [phone, setPhone] = useState(member.phone ?? "");
  const [notify, setNotify] = useState(member.receive_notification);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const unchanged =
    phone.trim() === (member.phone ?? "") && notify === member.receive_notification;

  function formatPhone(raw: string) {
    const digits = raw.replace(/\D/g, "");
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (unchanged) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API}/api/members/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone: phone.trim() || null, receive_notification: notify }),
      });
      const data = await res.json();
      if (!res.ok) { setMessage({ type: "err", text: data.detail ?? "저장 실패" }); return; }
      onSaved(data);
      setMessage({ type: "ok", text: "저장되었습니다." });
    } catch {
      setMessage({ type: "err", text: "네트워크 오류가 발생했습니다." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase mb-1.5">
            전화번호
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            maxLength={13}
            className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
            placeholder="010-0000-0000"
          />
        </div>
        <button
          type="submit"
          disabled={saving || unchanged}
          className="px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] disabled:opacity-40 transition-colors shrink-0"
        >
          {saving ? "저장 중…" : "저장"}
        </button>
      </div>
      <label className="flex items-start gap-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={notify}
          onChange={(e) => setNotify(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-[var(--color-border)] accent-[var(--color-primary)] cursor-pointer shrink-0"
        />
        <span className="text-sm text-[var(--color-text)] leading-relaxed">
          이메일 알림 수신 동의
          <span className="block text-xs text-[var(--color-text-muted)] mt-0.5">
            새 주보가 등록될 때 이메일로 알림을 받습니다.
          </span>
        </span>
      </label>
      {message && (
        <p className={`text-xs px-3 py-2 rounded-lg ${
          message.type === "ok"
            ? "bg-green-50 text-green-700 border border-green-200"
            : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {message.text}
        </p>
      )}
    </form>
  );
}

// ── 비밀번호 변경 폼 ───────────────────────────────────────
function PasswordForm({ hasPassword, token }: { hasPassword: boolean; token: string }) {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pwError = validatePassword(newPw);
    if (pwError) { setMessage({ type: "err", text: pwError }); return; }
    if (newPw !== confirmPw) {
      setMessage({ type: "err", text: "새 비밀번호가 일치하지 않습니다." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const body: Record<string, string> = { password: newPw };
      if (hasPassword) body.current_password = currentPw;
      const res = await fetch(`${API}/api/members/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setMessage({ type: "err", text: data.detail ?? "변경 실패" }); return; }
      setMessage({ type: "ok", text: hasPassword ? "비밀번호가 변경되었습니다." : "비밀번호가 설정되었습니다." });
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch {
      setMessage({ type: "err", text: "네트워크 오류가 발생했습니다." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {hasPassword && (
        <div>
          <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase mb-1.5">
            현재 비밀번호
          </label>
          <input
            type="password"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            required
            className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
            placeholder="현재 비밀번호 입력"
          />
        </div>
      )}
      <div>
        <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase mb-1.5">
          새 비밀번호
        </label>
        <input
          type="password"
          value={newPw}
          onChange={(e) => setNewPw(e.target.value)}
          required
          className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
            newPw && validatePassword(newPw)
              ? "border-red-300 focus:border-red-400 focus:ring-red-300"
              : "border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]"
          }`}
          placeholder="8자 이상, 특수문자 포함"
        />
        {newPw && validatePassword(newPw) && (
          <p className="mt-1 text-xs text-red-500">{validatePassword(newPw)}</p>
        )}
      </div>
      <div>
        <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase mb-1.5">
          새 비밀번호 확인
        </label>
        <input
          type="password"
          value={confirmPw}
          onChange={(e) => setConfirmPw(e.target.value)}
          required
          className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
            confirmPw && confirmPw !== newPw
              ? "border-red-300 focus:border-red-400 focus:ring-red-300"
              : "border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]"
          }`}
          placeholder="새 비밀번호 재입력"
        />
      </div>
      {message && (
        <p className={`text-xs px-3 py-2 rounded-lg ${
          message.type === "ok"
            ? "bg-green-50 text-green-700 border border-green-200"
            : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {message.text}
        </p>
      )}
      <button
        type="submit"
        disabled={saving || !newPw || !confirmPw || (hasPassword && !currentPw)}
        className="w-full py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] disabled:opacity-40 transition-colors"
      >
        {saving ? "처리 중…" : hasPassword ? "비밀번호 변경" : "비밀번호 설정"}
      </button>
    </form>
  );
}

// ── 메인 페이지 ────────────────────────────────────────────
export default function MypagePage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [member, setMember] = useState<MemberInfo | null>(null);
  const [posts, setPosts] = useState<MyPost[]>([]);
  const [comments, setComments] = useState<MyComment[]>([]);
  const [tab, setTab] = useState<"posts" | "comments">("posts");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!session?.accessToken) return;
    const headers = { Authorization: `Bearer ${session.accessToken}` };
    Promise.all([
      fetch(`${API}/api/members/me`, { headers }).then((r) => r.json()),
      fetch(`${API}/api/members/me/posts`, { headers }).then((r) => r.json()),
      fetch(`${API}/api/members/me/comments`, { headers }).then((r) => r.json()),
    ]).then(([memberData, postsData, commentsData]) => {
      setMember(memberData);
      setPosts(Array.isArray(postsData) ? postsData : []);
      setComments(Array.isArray(commentsData) ? commentsData : []);
      setLoading(false);
    });
  }, [session]);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !session?.accessToken) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`${API}/api/members/me/avatar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.accessToken}` },
        body: formData,
      });
      if (res.ok) {
        const updated: MemberInfo = await res.json();
        setMember(updated);
        await update({ picture: updated.avatar_url ? `${API}${updated.avatar_url}` : null });
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleAvatarDelete() {
    if (!session?.accessToken || !confirm("프로필 사진을 삭제하시겠습니까?")) return;
    const res = await fetch(`${API}/api/members/me/avatar`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    if (res.ok) {
      const updated: MemberInfo = await res.json();
      setMember(updated);
      await update({ picture: null });
    }
  }

  const avatarSrc = member?.avatar_url
    ? member.avatar_url.startsWith("http") ? member.avatar_url : `${API}${member.avatar_url}`
    : null;

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <p className="text-[var(--color-text-muted)]">불러오는 중...</p>
      </div>
    );
  }

  return (
    <>
      <PageHeader group="회원" title="마이페이지" subtitle="내 정보와 활동을 관리합니다." />
      <div className="max-w-3xl mx-auto px-4 py-8">

      {member && (
        <>
          {/* 소셜 가입 후 이름 미입력 안내 */}
          {!member.name && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 mb-4">
              <span className="text-amber-500 text-lg mt-0.5">✏️</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-800">이름과 세례명을 입력해 주세요</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  이름과 세례명을 등록하면 홈페이지 전체에서 올바른 이름으로 표시됩니다.
                </p>
              </div>
              <button
                onClick={() => setEditOpen(true)}
                className="shrink-0 text-xs font-medium text-amber-800 underline underline-offset-2 hover:text-amber-900 whitespace-nowrap"
              >
                지금 입력하기
              </button>
            </div>
          )}

          {/* 이메일 미인증 안내 (소셜 가입자 제외) */}
          {!member.is_email_verified && member.has_password && (
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 mb-4">
              <span className="text-blue-500 text-lg mt-0.5">📧</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-blue-800">이메일 인증이 필요합니다</p>
                <p className="text-xs text-blue-700 mt-0.5">
                  {verificationSent
                    ? `${member.email}로 인증 메일을 발송했습니다. 메일함을 확인해 주세요.`
                    : "가입 이메일을 인증하면 계정이 더 안전해집니다."}
                </p>
              </div>
              {!verificationSent && (
                <button
                  onClick={async () => {
                    if (!session?.accessToken) return;
                    setSendingVerification(true);
                    try {
                      await fetch(`${API}/api/members/send-verification`, {
                        method: "POST",
                        headers: { Authorization: `Bearer ${session.accessToken}` },
                      });
                      setVerificationSent(true);
                    } finally {
                      setSendingVerification(false);
                    }
                  }}
                  disabled={sendingVerification}
                  className="shrink-0 text-xs font-medium text-blue-800 underline underline-offset-2 hover:text-blue-900 whitespace-nowrap disabled:opacity-50"
                >
                  {sendingVerification ? "발송 중…" : "인증 메일 발송"}
                </button>
              )}
            </div>
          )}

          {/* 프로필 카드 */}
          <div className="bg-white border border-[var(--color-border)] rounded-xl p-6 mb-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-5">
                <div className="relative group">
                  {avatarSrc ? (
                    <img src={avatarSrc} alt={member.nickname}
                      className="w-20 h-20 rounded-full object-cover border-2 border-[var(--color-border)]" />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-[var(--color-primary)]/15 flex items-center justify-center text-3xl font-bold text-[var(--color-primary)]">
                      {(member.name ?? member.nickname)[0]}
                    </div>
                  )}
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                    className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium">
                    {uploading ? "..." : "변경"}
                  </button>
                </div>
                <div>
                  <p className="text-lg font-semibold">
                    {member.name ? `${member.name} (${member.nickname})` : member.nickname}
                  </p>
                  <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{member.email}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    가입일: {new Date(member.created_at).toLocaleDateString("ko-KR")}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                      className="text-xs text-[var(--color-primary)] hover:underline disabled:opacity-50">
                      {uploading ? "업로드 중..." : "사진 변경"}
                    </button>
                    {member.avatar_url?.startsWith("/uploads/avatars/") && (
                      <button onClick={handleAvatarDelete} className="text-xs text-red-400 hover:underline">
                        사진 삭제
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                {member.is_admin && (
                  <button
                    onClick={async () => {
                      const res = await fetch(`${API}/api/auth/admin-session`, {
                        method: "POST",
                        headers: { Authorization: `Bearer ${session?.accessToken}` },
                      });
                      if (res.ok) {
                        const data = await res.json();
                        localStorage.setItem("admin_token", data.access_token);
                        localStorage.setItem("admin_display_name", data.display_name);
                        localStorage.setItem("admin_role", data.role);
                        localStorage.setItem("admin_is_super", String(data.is_super_admin));
                        document.cookie = `admin_authed=1; path=/; max-age=${7 * 24 * 3600}; SameSite=Lax`;
                      }
                      router.push("/admin/dashboard");
                    }}
                    className="px-4 py-2 text-sm bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
                  >
                    관리자 페이지
                  </button>
                )}
                <button onClick={() => setEditOpen((v) => !v)}
                  className="px-4 py-2 text-sm border border-[var(--color-primary)] text-[var(--color-primary)] rounded-lg hover:bg-[var(--color-primary)]/5 transition-colors">
                  {editOpen ? "편집 닫기" : "프로필 편집"}
                </button>
                <button
                  onClick={() => {
                    if (member.is_admin) {
                      localStorage.removeItem("admin_token");
                      localStorage.removeItem("admin_display_name");
                      localStorage.removeItem("admin_role");
                      localStorage.removeItem("admin_is_super");
                      document.cookie = "admin_authed=; path=/; max-age=0";
                    }
                    signOut({ callbackUrl: "/" });
                  }}
                  className="px-4 py-2 text-sm border border-[var(--color-border)] rounded-lg hover:bg-gray-50 transition-colors">
                  로그아웃
                </button>
                <button
                  onClick={async () => {
                    if (!confirm("정말 탈퇴하시겠습니까?\n작성한 게시글과 댓글이 모두 삭제됩니다.")) return;
                    const res = await fetch(`${API}/api/members/me`, {
                      method: "DELETE",
                      headers: { Authorization: `Bearer ${session?.accessToken}` },
                    });
                    if (res.ok) {
                      if (member.is_admin) {
                        localStorage.removeItem("admin_token");
                        document.cookie = "admin_authed=; path=/; max-age=0";
                      }
                      signOut({ callbackUrl: "/" });
                    }
                  }}
                  className="px-4 py-2 text-sm text-red-400 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                  회원 탈퇴
                </button>
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden" onChange={handleAvatarChange} />
          </div>

          {/* 프로필 편집 패널 */}
          {editOpen && (
            <div className="bg-white border border-[var(--color-border)] rounded-xl p-6 mb-4 space-y-6">
              {/* 이름/세례명 변경 */}
              <div>
                <h2 className="text-sm font-bold text-[var(--color-primary)] mb-3">이름 / 세례명 변경</h2>
                <NicknameForm
                  member={member}
                  token={session?.accessToken as string}
                  onSaved={(updated, displayName) => {
                    setMember(updated);
                    update({ name: displayName });
                  }}
                />
              </div>

              <div className="border-t border-[var(--color-border)]" />

              {/* 전화번호 */}
              <div>
                <h2 className="text-sm font-bold text-[var(--color-primary)] mb-3">전화번호</h2>
                <PhoneForm
                  member={member}
                  token={session?.accessToken as string}
                  onSaved={(updated) => setMember(updated)}
                />
              </div>

              <div className="border-t border-[var(--color-border)]" />

              {/* 비밀번호 변경 */}
              <div>
                <h2 className="text-sm font-bold text-[var(--color-primary)] mb-1">
                  {member.has_password ? "비밀번호 변경" : "비밀번호 설정"}
                </h2>
                {!member.has_password && (
                  <p className="text-xs text-[var(--color-text-muted)] mb-3">
                    소셜 계정으로 가입하셨습니다. 비밀번호를 설정하면 이메일로도 로그인할 수 있습니다.
                  </p>
                )}
                <PasswordForm
                  hasPassword={member.has_password}
                  token={session?.accessToken as string}
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* 활동 탭 */}
      <div className="flex gap-2 mb-6">
        {(["posts", "comments"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t
                ? "bg-[var(--color-primary)] text-white"
                : "border border-[var(--color-border)] hover:bg-gray-50"
            }`}>
            {t === "posts" ? `내 글 (${posts.length})` : `내 댓글 (${comments.length})`}
          </button>
        ))}
      </div>

      {tab === "posts" && (
        <div className="space-y-2">
          {posts.length === 0 ? (
            <p className="text-center py-12 text-[var(--color-text-muted)]">작성한 글이 없습니다.</p>
          ) : posts.map((post) => (
            <Link key={post.id} href={`/boards/${post.board.slug}/${post.id}`}
              className="block p-4 bg-white border border-[var(--color-border)] rounded-lg hover:border-[var(--color-primary)] transition-colors">
              <p className="font-medium">{post.title}</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                {post.board.name} · 조회 {post.view_count} · 댓글 {post.comment_count} ·{" "}
                {new Date(post.created_at).toLocaleDateString("ko-KR")}
              </p>
            </Link>
          ))}
        </div>
      )}

      {tab === "comments" && (
        <div className="space-y-2">
          {comments.length === 0 ? (
            <p className="text-center py-12 text-[var(--color-text-muted)]">작성한 댓글이 없습니다.</p>
          ) : comments.map((comment) => (
            <Link key={comment.id} href={`/boards/${comment.board_slug}/${comment.post_id}`}
              className="block p-4 bg-white border border-[var(--color-border)] rounded-lg hover:border-[var(--color-primary)] transition-colors">
              <p className="text-sm">{comment.content}</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                {comment.post_title} · {new Date(comment.created_at).toLocaleDateString("ko-KR")}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
    </>
  );
}
