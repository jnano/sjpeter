"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL;
const SPECIAL = /[!@#$%^&*()_+\-=\[\]{}|;':",.<>?/~`\\]/;

function validatePassword(pw: string): string | null {
  // backend _validate_password 와 동일 — 8자 + 영문/숫자/특수 중 2종
  if (pw.length < 8) return "비밀번호는 8자 이상이어야 합니다.";
  const hasAlpha = /[a-zA-Z]/.test(pw);
  const hasDigit = /\d/.test(pw);
  const hasSpecial = SPECIAL.test(pw);
  if ([hasAlpha, hasDigit, hasSpecial].filter(Boolean).length < 2) {
    return "비밀번호는 영문·숫자·특수문자 중 2종류 이상을 포함해야 합니다.";
  }
  return null;
}

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: "",
    name: "",
    nickname: "",
    phone: "",
    receiveNotification: false,
    password: "",
    passwordConfirm: "",
    nameDayMonth: "",  // "" | "1"~"12"
    nameDayDay: "",    // "" | "1"~"31"
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const target = e.target as HTMLInputElement;
    const { name, value, type } = target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? target.checked : value }));
  }

  function formatPhone(raw: string) {
    const digits = raw.replace(/\D/g, "");
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  }

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, phone: formatPhone(e.target.value) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const pwError = validatePassword(form.password);
    if (pwError) { setError(pwError); return; }
    if (form.password !== form.passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    // 영명축일은 둘 다 선택 또는 둘 다 비움
    const ndm = form.nameDayMonth ? parseInt(form.nameDayMonth) : null;
    const ndd = form.nameDayDay ? parseInt(form.nameDayDay) : null;
    if ((ndm === null) !== (ndd === null)) {
      setError("영명축일은 월·일을 함께 선택해 주세요.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/members/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          name: form.name.trim(),
          nickname: form.nickname,
          phone: form.phone.trim() || null,
          receive_notification: form.receiveNotification,
          password: form.password,
          name_day_month: ndm,
          name_day_day: ndd,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "회원가입에 실패했습니다.");
        return;
      }

      // 가입 직후 자동 로그인 — NextAuth credentials 로 backend 한 번 더 호출.
      // (register 응답의 access_token 을 NextAuth session 에 직접 박는 경로가 없어
      //  같은 자격으로 signIn. 첫 로그인이라 온보딩 페이지로 이동.)
      const signInResult = await signIn("credentials", {
        email: form.email,
        password: form.password,
        remember: "0",
        redirect: false,
      });
      if (signInResult?.ok) {
        router.push("/onboarding/interests");
      } else {
        // 자동 로그인 실패해도 가입은 성공 — 로그인 페이지로 fallback
        router.push("/members/login?registered=1");
      }
    } catch {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent text-sm";

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[var(--color-primary)]">회원가입</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            성당 회원으로 가입하여 게시판을 이용하세요.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          {/* 이메일 */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
              이메일 <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              className={inputClass}
              placeholder="example@email.com"
            />
          </div>

          {/* 이름 + 세례명 */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
                이름 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                maxLength={50}
                className={inputClass}
                placeholder="이름을 입력하세요"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
                세례명 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                name="nickname"
                value={form.nickname}
                onChange={handleChange}
                required
                minLength={2}
                maxLength={30}
                className={inputClass}
                placeholder="세례명"
              />
            </div>
          </div>

          {/* 전화번호 + 알림 동의 */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">전화번호</label>
            <input
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handlePhoneChange}
              maxLength={13}
              className={inputClass}
              placeholder="010-0000-0000"
            />
            <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
              <input
                type="checkbox"
                name="receiveNotification"
                checked={form.receiveNotification}
                onChange={handleChange}
                className="w-4 h-4 rounded border-[var(--color-border)] accent-[var(--color-primary)] cursor-pointer"
              />
              <span className="text-sm text-[var(--color-text)]">
                본당 채널 알림을 받으시려면 체크하세요
              </span>
            </label>
          </div>

          {/* 비밀번호 */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
              비밀번호 <span className="text-red-400">*</span>
            </label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              className={`${inputClass} ${
                form.password && validatePassword(form.password)
                  ? "border-red-300 focus:ring-red-300"
                  : ""
              }`}
              placeholder="8자 이상 · 영문·숫자·특수문자 중 2종"
            />
            {form.password && validatePassword(form.password) && (
              <p className="mt-1 text-xs text-red-500">{validatePassword(form.password)}</p>
            )}
          </div>

          {/* 비밀번호 확인 */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
              비밀번호 확인 <span className="text-red-400">*</span>
            </label>
            <input
              type="password"
              name="passwordConfirm"
              value={form.passwordConfirm}
              onChange={handleChange}
              required
              className={`${inputClass} ${
                form.passwordConfirm && form.passwordConfirm !== form.password
                  ? "border-red-300 focus:ring-red-300"
                  : ""
              }`}
              placeholder="비밀번호를 다시 입력하세요"
            />
            {form.passwordConfirm && form.passwordConfirm !== form.password && (
              <p className="mt-1 text-xs text-red-500">비밀번호가 일치하지 않습니다.</p>
            )}
          </div>

          {/* 영명축일 (선택) — 월·일 함께 선택 또는 둘 다 비움 */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
              영명축일 <span className="text-xs text-[var(--color-text-muted)] font-normal">(선택)</span>
            </label>
            <div className="flex gap-2">
              <select
                name="nameDayMonth"
                value={form.nameDayMonth}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="">월</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>{m}월</option>
                ))}
              </select>
              <select
                name="nameDayDay"
                value={form.nameDayDay}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="">일</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{d}일</option>
                ))}
              </select>
            </div>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">세례명 성인의 축일을 선택하세요. 나중에 프로필에서 수정할 수 있습니다.</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[var(--color-primary)] text-white font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50"
          >
            {loading ? "가입 중..." : "회원가입"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--color-text-muted)]">
          이미 계정이 있으신가요?{" "}
          <Link href="/members/login" className="text-[var(--color-primary)] hover:underline font-medium">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
