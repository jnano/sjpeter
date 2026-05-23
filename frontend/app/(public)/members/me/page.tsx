"use client";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";

const API = process.env.NEXT_PUBLIC_API_URL;

interface MemberInfo {
  id: number;
  email: string;
  name: string | null;
  nickname: string;
  avatar_url: string | null;
  has_password: boolean;
  is_admin: boolean;
  is_email_verified: boolean;
  social_provider: string | null;
  created_at: string;
}

export default function MypagePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [member, setMember] = useState<MemberInfo | null>(null);
  const [postCount, setPostCount] = useState<number | null>(null);
  const [interestCount, setInterestCount] = useState<number | null>(null);
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/members/login?callbackUrl=/members/me");
    }
  }, [status, router]);

  useEffect(() => {
    const token = session?.accessToken;
    if (!token) { if (status !== "loading") setLoading(false); return; }
    const headers = { Authorization: `Bearer ${token}` };
    const safeJson = async (r: Response) => (r.ok ? r.json() : null);
    Promise.all([
      fetch(`${API}/api/members/me`, { headers }).then(safeJson).catch(() => null),
      fetch(`${API}/api/members/me/posts`, { headers }).then(safeJson).catch(() => null),
      fetch(`${API}/api/members/me/interests`, { headers }).then(safeJson).catch(() => null),
      fetch(`${API}/api/members/me/notifications/unread-count`, { headers }).then(safeJson).catch(() => null),
    ]).then(([m, posts, ints, unread]) => {
      if (m?.id) setMember(m);
      setPostCount(Array.isArray(posts) ? posts.length : 0);
      setInterestCount(Array.isArray(ints?.groups) ? ints.groups.length : 0);
      setUnreadCount(typeof unread?.count === "number" ? unread.count : 0);
      setLoading(false);
    });
  }, [session?.accessToken, status]);

  const avatarSrc = member?.avatar_url
    ? member.avatar_url.startsWith("http") ? member.avatar_url : `${API}${member.avatar_url}`
    : null;

  function handleLogout() {
    if (member?.is_admin) {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_display_name");
      localStorage.removeItem("admin_role");
      localStorage.removeItem("admin_is_super");
      document.cookie = "admin_authed=; path=/; max-age=0";
      document.cookie = "admin_token=; path=/; max-age=0";
    }
    signOut({ callbackUrl: "/" });
  }

  async function goAdmin() {
    if (!session?.accessToken) return;
    const res = await fetch(`${API}/api/auth/admin-session`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem("admin_token", data.access_token);
      localStorage.setItem("admin_display_name", data.display_name);
      localStorage.setItem("admin_role", data.role);
      localStorage.setItem("admin_is_super", String(data.is_super_admin));
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `admin_authed=1; path=/; max-age=${7 * 24 * 3600}; SameSite=Lax${secure}`;
      document.cookie = `admin_token=${data.access_token}; path=/; max-age=${7 * 24 * 3600}; SameSite=Lax${secure}`;
    }
    router.push("/admin/dashboard");
  }

  if (loading) {
    return <div className="min-h-[70vh] flex items-center justify-center"><p className="text-[var(--color-text-muted)]">불러오는 중...</p></div>;
  }
  if (!member) return null;

  return (
    <>
      <PageHeader group="회원" title="마이페이지" subtitle="내 정보와 활동을 한눈에 봅니다." />
      <SectionLayout>
        <div className="max-w-3xl mx-auto space-y-4">
          {/* 이름 미입력 안내 */}
          {!member.name && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
              <span className="text-amber-500 text-lg mt-0.5">✏️</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-800">이름과 세례명을 입력해 주세요</p>
                <p className="text-xs text-amber-700 mt-0.5">홈페이지 전체에서 올바른 이름으로 표시됩니다.</p>
              </div>
              <Link href="/members/me/profile" className="shrink-0 text-xs font-medium text-amber-800 underline underline-offset-2 hover:text-amber-900 whitespace-nowrap">
                지금 입력하기
              </Link>
            </div>
          )}

          {/* 이메일 미인증 안내 */}
          {!member.is_email_verified && member.has_password && !member.social_provider && (
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-5 py-4">
              <span className="text-blue-500 text-lg mt-0.5">📧</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-blue-800">이메일 인증이 필요합니다</p>
                <p className="text-xs text-blue-700 mt-0.5">
                  {verificationSent ? `${member.email}로 인증 메일을 발송했습니다.` : "가입 이메일을 인증하면 계정이 더 안전해집니다."}
                </p>
              </div>
              {!verificationSent && (
                <button onClick={async () => {
                  if (!session?.accessToken) return;
                  setSendingVerification(true);
                  try {
                    await fetch(`${API}/api/members/send-verification`, {
                      method: "POST",
                      headers: { Authorization: `Bearer ${session.accessToken}` },
                    });
                    setVerificationSent(true);
                  } finally { setSendingVerification(false); }
                }} disabled={sendingVerification}
                  className="shrink-0 text-xs font-medium text-blue-800 underline underline-offset-2 hover:text-blue-900 whitespace-nowrap disabled:opacity-50">
                  {sendingVerification ? "발송 중…" : "인증 메일 발송"}
                </button>
              )}
            </div>
          )}

          {/* 회원 카드 */}
          <div className="bg-white border border-[var(--color-border)] rounded-xl p-6">
            <div className="flex items-center gap-5">
              {avatarSrc ? (
                <img src={avatarSrc} alt={member.nickname}
                  className="w-20 h-20 rounded-full object-cover border-2 border-[var(--color-border)]" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-[var(--color-primary)]/15 flex items-center justify-center text-3xl font-bold text-[var(--color-primary)]">
                  {(member.name ?? member.nickname ?? "?").charAt(0)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-lg font-semibold truncate">
                  {member.name ? `${member.name} (${member.nickname})` : member.nickname}
                </p>
                <p className="text-sm text-[var(--color-text-muted)] mt-0.5 truncate">{member.email}</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  가입일: {new Date(member.created_at).toLocaleDateString("ko-KR")}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-5">
              {member.is_admin && (
                <button onClick={goAdmin}
                  className="px-4 py-2 text-sm bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors">
                  관리자 페이지
                </button>
              )}
              <button onClick={handleLogout}
                className="px-4 py-2 text-sm border border-[var(--color-border)] rounded-lg hover:bg-gray-50 transition-colors">
                로그아웃
              </button>
            </div>
          </div>

          {/* 빠른 메뉴 — 분리된 페이지로 이동 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link href="/members/me/profile"
              className="block bg-white border border-[var(--color-border)] rounded-xl p-5 hover:border-[var(--color-primary)] hover:shadow-sm transition-all">
              <p className="font-semibold text-[var(--color-primary)]">프로필 편집</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">이름·세례명·전화·비밀번호 등</p>
            </Link>

            <Link href="/members/me/interests"
              className="block bg-white border border-[var(--color-border)] rounded-xl p-5 hover:border-[var(--color-primary)] hover:shadow-sm transition-all">
              <p className="font-semibold text-[var(--color-primary)]">
                관심 분과·콘텐츠 알림
                {interestCount !== null && interestCount > 0 && (
                  <span className="ml-2 text-xs font-normal text-[var(--color-text-muted)]">({interestCount}개 분과)</span>
                )}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">분과·단체, 사목지표·주일말씀 알림</p>
            </Link>

            <Link href="/members/me/posts"
              className="block bg-white border border-[var(--color-border)] rounded-xl p-5 hover:border-[var(--color-primary)] hover:shadow-sm transition-all">
              <p className="font-semibold text-[var(--color-primary)]">
                내가 쓴 글
                {postCount !== null && postCount > 0 && (
                  <span className="ml-2 text-xs font-normal text-[var(--color-text-muted)]">({postCount}건)</span>
                )}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">내 글과 댓글 목록</p>
            </Link>

            <Link href="/members/notifications"
              className="block bg-white border border-[var(--color-border)] rounded-xl p-5 hover:border-[var(--color-primary)] hover:shadow-sm transition-all">
              <p className="font-semibold text-[var(--color-primary)]">
                알림함
                {unreadCount !== null && unreadCount > 0 && (
                  <span className="ml-2 text-xs font-normal text-red-500">읽지 않음 {unreadCount}건</span>
                )}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">받은 알림 모아보기</p>
            </Link>
          </div>
        </div>
      </SectionLayout>
    </>
  );
}
