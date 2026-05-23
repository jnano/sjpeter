"use client";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";

const API = process.env.NEXT_PUBLIC_API_URL;
const SPECIAL = /[!@#$%^&*()_+\-=\[\]{}|;':",.<>?/~`\\]/;

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "비밀번호는 8자 이상이어야 합니다.";
  const hasAlpha = /[a-zA-Z]/.test(pw);
  const hasDigit = /\d/.test(pw);
  const hasSpecial = SPECIAL.test(pw);
  if ([hasAlpha, hasDigit, hasSpecial].filter(Boolean).length < 2) {
    return "비밀번호는 영문·숫자·특수문자 중 2종류 이상을 포함해야 합니다.";
  }
  return null;
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
  social_provider: string | null;
  name_day_month: number | null;
  name_day_day: number | null;
  created_at: string;
}

function NicknameForm({ member, token, onSaved }: {
  member: MemberInfo; token: string;
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
    setSaving(true); setMessage(null);
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
    } catch { setMessage({ type: "err", text: "네트워크 오류가 발생했습니다." }); }
    finally { setSaving(false); }
  }
  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase mb-1.5">이름</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={50}
            className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
            placeholder="이름을 입력하세요" />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase mb-1.5">세례명</label>
          <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} minLength={2} maxLength={30} required
            className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
            placeholder="세례명" />
        </div>
        <button type="submit" disabled={saving || unchanged || invalid}
          className="px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] disabled:opacity-40 transition-colors shrink-0">
          {saving ? "저장 중…" : "저장"}
        </button>
      </div>
      {message && <p className={`text-xs px-3 py-2 rounded-lg ${message.type === "ok" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>{message.text}</p>}
    </form>
  );
}

function PhoneForm({ member, token, onSaved }: {
  member: MemberInfo; token: string; onSaved: (m: MemberInfo) => void;
}) {
  const [phone, setPhone] = useState(member.phone ?? "");
  const [notify, setNotify] = useState(member.receive_notification);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const unchanged = phone.trim() === (member.phone ?? "") && notify === member.receive_notification;
  function formatPhone(raw: string) {
    const digits = raw.replace(/\D/g, "");
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  }
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (unchanged) return;
    setSaving(true); setMessage(null);
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
    } catch { setMessage({ type: "err", text: "네트워크 오류가 발생했습니다." }); }
    finally { setSaving(false); }
  }
  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase mb-1.5">전화번호</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} maxLength={13}
            className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
            placeholder="010-0000-0000" />
        </div>
        <button type="submit" disabled={saving || unchanged}
          className="px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] disabled:opacity-40 transition-colors shrink-0">
          {saving ? "저장 중…" : "저장"}
        </button>
      </div>
      <label className="flex items-start gap-2.5 cursor-pointer select-none">
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-[var(--color-border)] accent-[var(--color-primary)] cursor-pointer shrink-0" />
        <span className="text-sm text-[var(--color-text)] leading-relaxed">
          이메일 알림 수신 동의
          <span className="block text-xs text-[var(--color-text-muted)] mt-0.5">새 주보가 등록될 때 이메일로 알림을 받습니다.</span>
        </span>
      </label>
      {message && <p className={`text-xs px-3 py-2 rounded-lg ${message.type === "ok" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>{message.text}</p>}
    </form>
  );
}

function NameDayForm({ member, token, onSaved }: {
  member: MemberInfo; token: string; onSaved: (m: MemberInfo) => void;
}) {
  const [month, setMonth] = useState<string>(member.name_day_month ? String(member.name_day_month) : "");
  const [day, setDay] = useState<string>(member.name_day_day ? String(member.name_day_day) : "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const origMonth = member.name_day_month ? String(member.name_day_month) : "";
  const origDay = member.name_day_day ? String(member.name_day_day) : "";
  const unchanged = month === origMonth && day === origDay;
  const halfFilled = (month && !day) || (!month && day);
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (unchanged) return;
    if (halfFilled) { setMessage({ type: "err", text: "영명축일은 월·일을 함께 선택해 주세요." }); return; }
    setSaving(true); setMessage(null);
    try {
      const both = month && day;
      const url = `${API}/api/members/me${both ? "" : "/name-day"}`;
      const init: RequestInit = {
        method: both ? "PUT" : "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      };
      if (both) init.body = JSON.stringify({ name_day_month: parseInt(month), name_day_day: parseInt(day) });
      const res = await fetch(url, init);
      const data = await res.json();
      if (!res.ok) { setMessage({ type: "err", text: data.detail ?? "저장 실패" }); return; }
      onSaved(data);
      setMessage({ type: "ok", text: "저장되었습니다." });
    } catch { setMessage({ type: "err", text: "네트워크 오류가 발생했습니다." }); }
    finally { setSaving(false); }
  }
  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase mb-1.5">월</label>
          <select value={month} onChange={(e) => setMonth(e.target.value)}
            className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]">
            <option value="">선택 안 함</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (<option key={m} value={m}>{m}월</option>))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase mb-1.5">일</label>
          <select value={day} onChange={(e) => setDay(e.target.value)}
            className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]">
            <option value="">선택 안 함</option>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (<option key={d} value={d}>{d}일</option>))}
          </select>
        </div>
        <button type="submit" disabled={saving || unchanged}
          className="px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] disabled:opacity-40 transition-colors shrink-0">
          {saving ? "저장 중…" : "저장"}
        </button>
      </div>
      <p className="text-xs text-[var(--color-text-muted)]">세례명 성인의 축일. 둘 다 &quot;선택 안 함&quot;으로 두면 영명축일이 지워집니다.</p>
      {message && <p className={`text-xs px-3 py-2 rounded-lg ${message.type === "ok" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>{message.text}</p>}
    </form>
  );
}

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
    if (newPw !== confirmPw) { setMessage({ type: "err", text: "새 비밀번호가 일치하지 않습니다." }); return; }
    setSaving(true); setMessage(null);
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
    } catch { setMessage({ type: "err", text: "네트워크 오류가 발생했습니다." }); }
    finally { setSaving(false); }
  }
  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {hasPassword && (
        <div>
          <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase mb-1.5">현재 비밀번호</label>
          <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} required
            className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
            placeholder="현재 비밀번호 입력" />
        </div>
      )}
      <div>
        <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase mb-1.5">새 비밀번호</label>
        <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required
          className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 ${newPw && validatePassword(newPw) ? "border-red-300 focus:border-red-400 focus:ring-red-300" : "border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]"}`}
          placeholder="8자 이상 · 영문·숫자·특수문자 중 2종" />
        {newPw && validatePassword(newPw) && <p className="mt-1 text-xs text-red-500">{validatePassword(newPw)}</p>}
      </div>
      <div>
        <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase mb-1.5">새 비밀번호 확인</label>
        <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required
          className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 ${confirmPw && confirmPw !== newPw ? "border-red-300 focus:border-red-400 focus:ring-red-300" : "border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]"}`}
          placeholder="새 비밀번호 재입력" />
      </div>
      {message && <p className={`text-xs px-3 py-2 rounded-lg ${message.type === "ok" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>{message.text}</p>}
      <button type="submit" disabled={saving || !newPw || !confirmPw || (hasPassword && !currentPw)}
        className="w-full py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] disabled:opacity-40 transition-colors">
        {saving ? "처리 중…" : hasPassword ? "비밀번호 변경" : "비밀번호 설정"}
      </button>
    </form>
  );
}

export default function ProfileEditPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [member, setMember] = useState<MemberInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/members/login?callbackUrl=/members/me/profile");
    }
  }, [status, router]);

  useEffect(() => {
    const token = session?.accessToken;
    if (!token) { if (status !== "loading") setLoading(false); return; }
    fetch(`${API}/api/members/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.id) setMember(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [session?.accessToken, status]);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !session?.accessToken) return;
    const MAX_SIZE = 5 * 1024 * 1024;
    const ALLOWED_EXTS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (!ALLOWED_EXTS.includes(ext)) { alert("JPEG·PNG·GIF·WebP 이미지만 업로드할 수 있습니다."); if (fileInputRef.current) fileInputRef.current.value = ""; return; }
    if (file.size > MAX_SIZE) { alert(`파일 크기는 5MB 이하여야 합니다. (현재 ${(file.size / 1024 / 1024).toFixed(1)}MB)`); if (fileInputRef.current) fileInputRef.current.value = ""; return; }
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`${API}/api/members/me/avatar`, { method: "POST", headers: { Authorization: `Bearer ${session.accessToken}` }, body: formData });
      if (res.ok) {
        const updated: MemberInfo = await res.json();
        setMember(updated);
        await update({ picture: updated.avatar_url ? `${API}${updated.avatar_url}` : null });
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.detail || "업로드에 실패했습니다.");
      }
    } catch { alert("네트워크 오류가 발생했습니다."); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  }

  async function handleAvatarDelete() {
    if (!session?.accessToken || !confirm("프로필 사진을 삭제하시겠습니까?")) return;
    const res = await fetch(`${API}/api/members/me/avatar`, { method: "DELETE", headers: { Authorization: `Bearer ${session.accessToken}` } });
    if (res.ok) {
      const updated: MemberInfo = await res.json();
      setMember(updated);
      await update({ picture: null });
    }
  }

  async function handleWithdraw() {
    if (!session?.accessToken) return;
    if (!confirm("정말 탈퇴하시겠습니까?\n\n• 프로필 정보(이름·세례명·전화번호·아바타)는 삭제됩니다.\n• 작성한 글·댓글은 '탈퇴 회원'으로 표시되며 보존됩니다.\n• 같은 이메일로 다시 가입할 수 있습니다.")) return;
    const res = await fetch(`${API}/api/members/me`, { method: "DELETE", headers: { Authorization: `Bearer ${session.accessToken}` } });
    if (res.ok) {
      if (member?.is_admin) {
        localStorage.removeItem("admin_token"); localStorage.removeItem("admin_display_name");
        localStorage.removeItem("admin_role"); localStorage.removeItem("admin_is_super");
        document.cookie = "admin_authed=; path=/; max-age=0";
        document.cookie = "admin_token=; path=/; max-age=0";
      }
      signOut({ callbackUrl: "/" });
    }
  }

  const avatarSrc = member?.avatar_url
    ? member.avatar_url.startsWith("http") ? member.avatar_url : `${API}${member.avatar_url}`
    : null;

  if (loading) {
    return <div className="min-h-[70vh] flex items-center justify-center"><p className="text-[var(--color-text-muted)]">불러오는 중...</p></div>;
  }
  if (!member) return null;

  return (
    <>
      <PageHeader group="회원" title="프로필 편집" subtitle="이름·세례명·전화번호·비밀번호 등 회원 정보를 관리합니다." />
      <SectionLayout>
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="mb-2">
            <Link href="/members/me" className="text-sm text-[var(--color-primary)] hover:underline">← 마이페이지</Link>
          </div>

          {/* 아바타 */}
          <div className="bg-white border border-[var(--color-border)] rounded-xl p-6">
            <h2 className="text-sm font-bold text-[var(--color-primary)] mb-4">프로필 사진</h2>
            <div className="flex items-center gap-5">
              <div className="relative group">
                {avatarSrc ? (
                  <img src={avatarSrc} alt={member.nickname} className="w-20 h-20 rounded-full object-cover border-2 border-[var(--color-border)]" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-[var(--color-primary)]/15 flex items-center justify-center text-3xl font-bold text-[var(--color-primary)]">
                    {(member.name ?? member.nickname ?? "?").charAt(0)}
                  </div>
                )}
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                  className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium">
                  {uploading ? "..." : "변경"}
                </button>
              </div>
              <div>
                <div className="flex gap-2">
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                    className="text-xs text-[var(--color-primary)] hover:underline disabled:opacity-50">
                    {uploading ? "업로드 중..." : "사진 변경"}
                  </button>
                  {member.avatar_url?.startsWith("/uploads/avatars/") && (
                    <button onClick={handleAvatarDelete} className="text-xs text-red-400 hover:underline">사진 삭제</button>
                  )}
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">JPEG·PNG·GIF·WebP · 5MB 이하</p>
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleAvatarChange} />
          </div>

          {/* 이름·세례명 */}
          <div className="bg-white border border-[var(--color-border)] rounded-xl p-6">
            <h2 className="text-sm font-bold text-[var(--color-primary)] mb-3">이름 / 세례명</h2>
            <NicknameForm member={member} token={session?.accessToken as string}
              onSaved={(updated, displayName) => { setMember(updated); update({ name: displayName }); }} />
          </div>

          {/* 전화번호 */}
          <div className="bg-white border border-[var(--color-border)] rounded-xl p-6">
            <h2 className="text-sm font-bold text-[var(--color-primary)] mb-3">전화번호 · 이메일 알림</h2>
            <PhoneForm member={member} token={session?.accessToken as string} onSaved={(updated) => setMember(updated)} />
          </div>

          {/* 영명축일 */}
          <div className="bg-white border border-[var(--color-border)] rounded-xl p-6">
            <h2 className="text-sm font-bold text-[var(--color-primary)] mb-3">영명축일</h2>
            <NameDayForm member={member} token={session?.accessToken as string} onSaved={(updated) => setMember(updated)} />
          </div>

          {/* 비밀번호 */}
          <div className="bg-white border border-[var(--color-border)] rounded-xl p-6">
            <h2 className="text-sm font-bold text-[var(--color-primary)] mb-1">
              {member.has_password ? "비밀번호 변경" : "비밀번호 설정"}
            </h2>
            {!member.has_password && (
              <p className="text-xs text-[var(--color-text-muted)] mb-3">
                소셜 계정으로 가입하셨습니다. 비밀번호를 설정하면 이메일로도 로그인할 수 있습니다.
              </p>
            )}
            <PasswordForm hasPassword={member.has_password} token={session?.accessToken as string} />
          </div>

          {/* 위험 영역 */}
          <div className="bg-white border border-red-200 rounded-xl p-6">
            <h2 className="text-sm font-bold text-red-500 mb-3">계정 관리</h2>
            <button onClick={handleWithdraw}
              className="px-4 py-2 text-sm text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
              회원 탈퇴
            </button>
            <p className="text-xs text-[var(--color-text-muted)] mt-2">
              탈퇴 시 프로필 정보는 삭제되고 작성하신 글·댓글은 &apos;탈퇴 회원&apos;으로 보존됩니다.
            </p>
          </div>
        </div>
      </SectionLayout>
    </>
  );
}
