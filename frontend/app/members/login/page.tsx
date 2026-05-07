"use client";
import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"google" | "kakao" | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
    } else {
      router.push(callbackUrl);
    }
  }

  async function handleSocial(provider: "google" | "kakao") {
    setSocialLoading(provider);
    await signIn(provider, { callbackUrl });
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      {/* 소셜 로그인 버튼 */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => handleSocial("google")}
          disabled={!!socialLoading}
          className="w-full flex items-center justify-center gap-3 py-2.5 border border-[var(--color-border)] rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 text-sm font-medium"
        >
          <GoogleIcon />
          {socialLoading === "google" ? "연결 중…" : "Google로 계속하기"}
        </button>

        <button
          type="button"
          onClick={() => handleSocial("kakao")}
          disabled={!!socialLoading}
          className="w-full flex items-center justify-center gap-3 py-2.5 bg-[#FEE500] hover:bg-[#FDD835] rounded-lg transition-colors disabled:opacity-50 text-sm font-medium text-[#3C1E1E]"
        >
          <KakaoIcon />
          {socialLoading === "kakao" ? "연결 중…" : "카카오로 계속하기"}
        </button>
      </div>

      {/* 구분선 */}
      <div className="flex items-center gap-3 my-2">
        <div className="flex-1 h-px bg-[var(--color-border)]" />
        <span className="text-xs text-[var(--color-text-muted)]">또는 이메일로 로그인</span>
        <div className="flex-1 h-px bg-[var(--color-border)]" />
      </div>

      {/* 이메일 로그인 */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text)] mb-1">이메일</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
            placeholder="example@email.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--color-text)] mb-1">비밀번호</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
            placeholder="비밀번호를 입력하세요"
          />
        </div>

        <div className="flex justify-end">
          <Link
            href="/members/forgot-password"
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
          >
            비밀번호를 잊으셨나요?
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-[var(--color-primary)] text-white font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50"
        >
          {loading ? "로그인 중..." : "이메일로 로그인"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[var(--color-primary)]">회원 로그인</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            성당 회원으로 로그인하여 게시판을 이용하세요.
          </p>
        </div>

        <Suspense fallback={<div className="text-center py-4">불러오는 중...</div>}>
          <LoginForm />
        </Suspense>

        <p className="mt-6 text-center text-sm text-[var(--color-text-muted)]">
          계정이 없으신가요?{" "}
          <Link href="/members/register" className="text-[var(--color-primary)] hover:underline font-medium">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.96L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function KakaoIcon() {
  return (
    <svg width="18" height="17" viewBox="0 0 18 17" fill="none">
      <path fillRule="evenodd" clipRule="evenodd" d="M9 0C4.029 0 0 3.134 0 7c0 2.491 1.623 4.677 4.076 5.933L3.04 16.608a.281.281 0 0 0 .437.301L7.97 13.94C8.31 13.98 8.653 14 9 14c4.971 0 9-3.134 9-7s-4.029-7-9-7z" fill="#3C1E1E"/>
    </svg>
  );
}
