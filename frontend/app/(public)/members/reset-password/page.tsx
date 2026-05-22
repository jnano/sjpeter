"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL;
const SPECIAL = /[!@#$%^&*()_+\-=\[\]{}|;':",.<>?/~`\\]/;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  function validatePassword(pw: string): string {
    // backend _validate_password 와 동일 — 8자 + 영문/숫자/특수 중 2종
    if (pw.length < 8) return "8자 이상 입력해 주세요.";
    const hasAlpha = /[a-zA-Z]/.test(pw);
    const hasDigit = /\d/.test(pw);
    const hasSpecial = SPECIAL.test(pw);
    if ([hasAlpha, hasDigit, hasSpecial].filter(Boolean).length < 2) {
      return "영문·숫자·특수문자 중 2종류 이상을 포함해야 합니다.";
    }
    return "";
  }

  const pwError = password ? validatePassword(password) : "";
  const mismatch = confirm && password !== confirm;
  const canSubmit = !pwError && !mismatch && password && confirm && token;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/members/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setDone(true);
        setTimeout(() => router.push("/members/login"), 2500);
      } else {
        setError(data.detail || "오류가 발생했습니다.");
      }
    } catch {
      setError("서버에 연결할 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="text-center text-[var(--color-text-muted)] py-8">
        <p>유효하지 않은 링크입니다.</p>
        <Link href="/members/forgot-password" className="mt-3 inline-block text-[var(--color-primary)] hover:underline text-sm">
          비밀번호 찾기
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center space-y-3">
        <div className="text-4xl">✅</div>
        <p className="font-medium text-green-800">비밀번호가 변경되었습니다</p>
        <p className="text-sm text-green-700">잠시 후 로그인 페이지로 이동합니다.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
          새 비밀번호 <span className="text-red-500">*</span>
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="8자 이상 · 영문·숫자·특수문자 중 2종"
          className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent ${
            pwError ? "border-red-400" : "border-[var(--color-border)]"
          }`}
        />
        {pwError && <p className="mt-1 text-xs text-red-500">{pwError}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
          비밀번호 확인 <span className="text-red-500">*</span>
        </label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          placeholder="비밀번호를 한 번 더 입력"
          className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent ${
            mismatch ? "border-red-400" : "border-[var(--color-border)]"
          }`}
        />
        {mismatch && <p className="mt-1 text-xs text-red-500">비밀번호가 일치하지 않습니다.</p>}
      </div>

      <button
        type="submit"
        disabled={!canSubmit || loading}
        className="w-full py-3 bg-[var(--color-primary)] text-white font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50"
      >
        {loading ? "변경 중..." : "비밀번호 변경"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[var(--color-primary)]">새 비밀번호 설정</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            사용할 새 비밀번호를 입력해 주세요.
          </p>
        </div>
        <Suspense fallback={<div className="text-center py-4">불러오는 중...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
