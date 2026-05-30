"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CrossIcon from "@/components/icons/CrossIcon";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/admin/dashboard";
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 이미 로그인된 경우 대시보드로 이동 — 단, 절대 만료가 지난 토큰은 정리
  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) return;
    const expStr = localStorage.getItem("admin_token_exp");
    const exp = expStr ? Number(expStr) : 0;
    if (!exp || Date.now() >= exp) {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_display_name");
      localStorage.removeItem("admin_role");
      localStorage.removeItem("admin_display_role");
      localStorage.removeItem("admin_is_super");
      localStorage.removeItem("admin_token_exp");
      localStorage.removeItem("admin_remember");
      document.cookie = "admin_authed=; path=/; max-age=0";
      document.cookie = "admin_token=; path=/; max-age=0";
      return;
    }
    router.replace("/admin/dashboard");
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API}/api/auth/admin-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password, remember }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail ?? "로그인 실패");
      }

      const data = await res.json();
      const expiresIn = Number(data.expires_in) || 12 * 3600;
      const absoluteExpiry = Date.now() + expiresIn * 1000;

      localStorage.setItem("admin_token", data.access_token);
      localStorage.setItem("admin_display_name", data.display_name);
      localStorage.setItem("admin_role", data.role);
      localStorage.setItem("admin_display_role", data.admin_role ?? "");
      localStorage.setItem("admin_is_super", String(data.is_super_admin));
      localStorage.setItem("admin_token_exp", String(absoluteExpiry));
      localStorage.setItem("admin_remember", remember ? "1" : "0");
      // admin_token 을 cookie 로도 set — <img>·<a href> 같이 fetch header 를 못 보내는
      // 요소에서 admin guard 라우트 자동 인증 (backend 가 cookie fallback 지원, v1.5.281).
      // httpOnly 불가능 (client 가 set) → localStorage 와 동일한 XSS 노출 수준이라 trade-off 없음.
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `admin_authed=1; path=/; max-age=${expiresIn}; SameSite=Lax${secure}`;
      document.cookie = `admin_token=${data.access_token}; path=/; max-age=${expiresIn}; SameSite=Lax${secure}`;
      router.push(nextPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface-warm)]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <CrossIcon className="text-[var(--color-primary)] text-[58px] block mx-auto" />
          <h1 className="font-serif text-2xl font-bold text-[var(--color-primary)] mt-2">
            관리자 로그인
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            본당 홈페이지
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-8 space-y-4 shadow-sm"
        >
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
              아이디 또는 이메일
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoFocus
              className="w-full border border-[var(--color-border)] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-[var(--color-border)] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] select-none cursor-pointer">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-4 h-4 accent-[var(--color-primary)]"
            />
            로그인 상태 유지 (7일)
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] disabled:opacity-60 text-white py-2.5 rounded-lg font-medium text-sm transition-colors mt-2"
          >
            {loading ? "로그인 중…" : "로그인"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
