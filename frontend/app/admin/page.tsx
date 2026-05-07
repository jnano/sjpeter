"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API = "http://localhost:8000";

export default function AdminLoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API}/api/auth/admin-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail ?? "로그인 실패");
      }

      const data = await res.json();
      localStorage.setItem("admin_token", data.access_token);
      localStorage.setItem("admin_display_name", data.display_name);
      localStorage.setItem("admin_role", data.role);
      localStorage.setItem("admin_is_super", String(data.is_super_admin));
      document.cookie = `admin_authed=1; path=/; max-age=${7 * 24 * 3600}; SameSite=Lax`;
      router.push("/admin/dashboard");
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
          <span className="text-[var(--color-primary)] text-4xl">✝</span>
          <h1 className="font-serif text-2xl font-bold text-[var(--color-primary)] mt-2">
            관리자 로그인
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            세종성베드로성당
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
              placeholder="admin 또는 이메일"
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
