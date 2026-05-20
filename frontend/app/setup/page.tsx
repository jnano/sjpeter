"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { resolveClientApi } from "@/lib/api";

type Step = "welcome" | "admin" | "parish" | "done";

interface FormState {
  admin_username: string;
  admin_password: string;
  admin_password_confirm: string;
  parish_name: string;
  parish_name_en: string;
  site_url: string;
}

const initialForm: FormState = {
  admin_username: "",
  admin_password: "",
  admin_password_confirm: "",
  parish_name: "",
  parish_name_en: "",
  site_url: typeof window !== "undefined" ? window.location.origin : "",
};

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [form, setForm] = useState<FormState>(initialForm);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);

  // setup 이 이미 완료된 상태면 / 로 리다이렉트 (URL 직접 접근 방어)
  useEffect(() => {
    const API = resolveClientApi();
    fetch(`${API}/api/setup/status`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.setup_completed) {
          router.replace("/");
        } else {
          setChecking(false);
          // 브라우저에서만 동작하므로 useEffect 안에서 site_url 기본값 재설정
          setForm((f) => ({ ...f, site_url: window.location.origin }));
        }
      })
      .catch(() => setChecking(false));
  }, [router]);

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit() {
    setError("");
    if (form.admin_password !== form.admin_password_confirm) {
      setError("비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    setSubmitting(true);
    try {
      const API = resolveClientApi();
      const res = await fetch(`${API}/api/setup/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_username: form.admin_username,
          admin_password: form.admin_password,
          parish_name: form.parish_name,
          parish_name_en: form.parish_name_en,
          site_url: form.site_url,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || "설정 저장에 실패했습니다.");
      } else {
        setStep("done");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-stone-500">확인 중…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
        <div className="px-8 py-6 border-b border-stone-100 bg-gradient-to-br from-stone-50 to-white">
          <div className="text-3xl mb-2">✝</div>
          <h1 className="text-xl font-bold text-stone-800">초기 설정</h1>
          <p className="text-sm text-stone-500 mt-1">
            본당 홈페이지를 사용하기 위한 첫 설정입니다. 5분이면 끝납니다.
          </p>
        </div>

        {/* 진행 단계 */}
        <div className="px-8 pt-5">
          <div className="flex items-center gap-2 text-xs text-stone-400">
            {(["welcome", "admin", "parish", "done"] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                    step === s
                      ? "bg-stone-700 text-white"
                      : ["welcome", "admin", "parish", "done"].indexOf(step) > i
                      ? "bg-stone-300 text-white"
                      : "bg-stone-100"
                  }`}
                >
                  {i + 1}
                </div>
                {i < 3 && <div className="w-8 h-px bg-stone-200" />}
              </div>
            ))}
          </div>
        </div>

        <div className="px-8 py-6">
          {step === "welcome" && (
            <div className="space-y-4">
              <h2 className="font-semibold text-stone-800">환영합니다</h2>
              <p className="text-sm text-stone-600 leading-relaxed">
                본당 홈페이지를 이 서버에서 처음 실행하셨습니다. 다음 두 단계를 거쳐 사용 준비를 마칩니다.
              </p>
              <ul className="text-sm text-stone-600 space-y-2 pl-4">
                <li>• <strong>관리자 계정</strong> 생성 — 사이트를 운영할 슈퍼관리자 1명</li>
                <li>• <strong>본당 정보</strong> 입력 — 본당 이름과 사이트 주소</li>
              </ul>
              <p className="text-xs text-stone-500 mt-4 leading-relaxed">
                Google·카카오 로그인, 주보 AI 분석, 이메일 발송 등 외부 서비스는 설정 완료 후
                관리자 페이지에서 입력할 수 있습니다. 모두 선택 사항입니다.
              </p>
            </div>
          )}

          {step === "admin" && (
            <div className="space-y-4">
              <h2 className="font-semibold text-stone-800">관리자 계정</h2>
              <p className="text-xs text-stone-500">
                슈퍼관리자 계정 1개를 만듭니다. 이후 추가 운영자는 회원가입 후 권한 부여 방식으로 늘립니다.
              </p>
              <Field
                label="관리자 아이디"
                hint="영문·숫자·언더스코어 4~50자"
                value={form.admin_username}
                onChange={(v) => setField("admin_username", v)}
              />
              <Field
                label="비밀번호"
                type="password"
                hint="최소 8자 + 영문 + 숫자"
                value={form.admin_password}
                onChange={(v) => setField("admin_password", v)}
              />
              <Field
                label="비밀번호 확인"
                type="password"
                value={form.admin_password_confirm}
                onChange={(v) => setField("admin_password_confirm", v)}
              />
            </div>
          )}

          {step === "parish" && (
            <div className="space-y-4">
              <h2 className="font-semibold text-stone-800">본당 정보</h2>
              <p className="text-xs text-stone-500">
                사이트 헤더·푸터·이메일 발신자에 사용됩니다. 나중에 관리자 설정에서 변경할 수 있습니다.
              </p>
              <Field
                label="본당 이름"
                hint="예: 세종성베드로성당"
                value={form.parish_name}
                onChange={(v) => setField("parish_name", v)}
              />
              <Field
                label="본당 영문명 (선택)"
                hint="예: St. Peter's Cathedral"
                value={form.parish_name_en}
                onChange={(v) => setField("parish_name_en", v)}
              />
              <Field
                label="사이트 URL"
                hint="이메일 인증·재설정 링크에 사용됨. https:// 또는 http:// 포함"
                value={form.site_url}
                onChange={(v) => setField("site_url", v)}
              />
            </div>
          )}

          {step === "done" && (
            <div className="space-y-4 text-center py-6">
              <div className="text-5xl mb-2">🎉</div>
              <h2 className="font-semibold text-stone-800">설정 완료</h2>
              <p className="text-sm text-stone-600 leading-relaxed">
                초기 설정이 완료되었습니다. 관리자 페이지에 로그인하여 사용을 시작하세요.
              </p>
              <button
                onClick={() => router.push("/admin")}
                className="mt-4 px-6 py-2.5 bg-stone-800 text-white rounded-lg text-sm font-medium hover:bg-stone-900 transition"
              >
                관리자 로그인 →
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        {step !== "done" && (
          <div className="px-8 py-4 bg-stone-50 border-t border-stone-100 flex justify-between">
            <button
              onClick={() => {
                if (step === "admin") setStep("welcome");
                else if (step === "parish") setStep("admin");
              }}
              disabled={step === "welcome" || submitting}
              className="px-4 py-2 text-sm text-stone-600 hover:text-stone-800 disabled:opacity-40 transition"
            >
              ← 이전
            </button>
            {step === "welcome" && (
              <button
                onClick={() => setStep("admin")}
                className="px-6 py-2 bg-stone-800 text-white rounded-lg text-sm font-medium hover:bg-stone-900 transition"
              >
                시작하기 →
              </button>
            )}
            {step === "admin" && (
              <button
                onClick={() => setStep("parish")}
                disabled={!form.admin_username || !form.admin_password || !form.admin_password_confirm}
                className="px-6 py-2 bg-stone-800 text-white rounded-lg text-sm font-medium hover:bg-stone-900 disabled:opacity-40 transition"
              >
                다음 →
              </button>
            )}
            {step === "parish" && (
              <button
                onClick={handleSubmit}
                disabled={!form.parish_name || !form.site_url || submitting}
                className="px-6 py-2 bg-stone-800 text-white rounded-lg text-sm font-medium hover:bg-stone-900 disabled:opacity-40 transition"
              >
                {submitting ? "저장 중…" : "설정 완료"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-stone-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-stone-400 mb-1">{hint}</p>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:border-stone-500 focus:ring-1 focus:ring-stone-500"
      />
    </div>
  );
}
