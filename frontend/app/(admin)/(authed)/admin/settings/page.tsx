"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Setting {
  key: string;
  value: string | null;
  label: string;
  description: string | null;
  is_secret: boolean;
  is_set: boolean;
  group_name: string;
}

const GROUP_ORDER = ["사이트", "이메일", "AI", "OAuth", "보안"];
const GROUP_ICON: Record<string, string> = {
  "사이트": "🌐",
  "이메일": "📧",
  "AI": "🤖",
  "OAuth": "🔐",
  "보안": "🛡️",
};
// OAuth·보안 항목은 서버 환경변수(.env.local)에도 설정해야 반영됨
const GROUP_RESTART_NOTICE = new Set(["OAuth", "보안"]);

// 텍스트 input 대신 select 로 렌더링할 키들의 옵션 목록
const SELECT_OPTIONS: Record<string, { value: string; label: string }[]> = {
  HOME_HERO_LAYOUT: [
    { value: "wide",       label: "사진 크게 + 우측 2단 · 시즌 배너 표시" },
    { value: "wide-plain", label: "사진 크게 + 우측 2단 (배너 없음)" },
    { value: "even",       label: "3등분 · 시즌 배너 표시" },
    { value: "even-plain", label: "3등분 (배너 없음)" },
  ],
  PHOTOS_VIEW_SCOPE: [
    { value: "public",  label: "공개 — 누구나 접근 가능" },
    { value: "members", label: "회원만 — 비로그인은 안내 후 로그인 필요" },
  ],
};

// admin/settings UI 에서 표시하지 않을 키. DB row·API·fallback 동작은 그대로 유지하고
// 화면에서만 가린다. (HOME_HERO_LAYOUT 은 /admin/home 의 hero 블록 payload.layout 으로 단일화)
const HIDDEN_KEYS = new Set<string>([
  "HOME_HERO_LAYOUT",
]);

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<Record<string, string>>({});
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const authHeaders = () => {
    const token = localStorage.getItem("admin_token");
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  };

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) { router.push("/admin"); return; }

    fetch(`${API}/api/admin/settings`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (!res.ok) { router.push("/admin"); return; }
        const data: Setting[] = await res.json();
        setSettings(data);
        // 비밀값은 빈 문자열로 초기화 (placeholder로 표시)
        const init: Record<string, string> = {};
        data.forEach((s) => { init[s.key] = s.is_secret ? "" : (s.value ?? ""); });
        setValues(init);
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function handleSave(key: string) {
    const setting = settings.find((s) => s.key === key);
    if (!setting) return;
    // 비밀값: 빈 문자열이면 변경 없음
    if (setting.is_secret && !values[key]) return;

    setSaving((p) => ({ ...p, [key]: true }));
    setSaved((p) => ({ ...p, [key]: false }));
    try {
      const res = await fetch(`${API}/api/admin/settings/${key}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ value: values[key] || null }),
      });
      if (res.ok) {
        const updated: Setting = await res.json();
        setSettings((prev) => prev.map((s) => s.key === key ? updated : s));
        if (setting.is_secret) setValues((v) => ({ ...v, [key]: "" }));
        setSaved((p) => ({ ...p, [key]: true }));
        setTimeout(() => setSaved((p) => ({ ...p, [key]: false })), 2500);
      } else {
        alert("저장에 실패했습니다.");
      }
    } finally {
      setSaving((p) => ({ ...p, [key]: false }));
    }
  }

  async function handleTestSmtp() {
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API}/api/admin/settings/test-smtp`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        setTestResult({ ok: true, message: data.message });
      } else {
        setTestResult({ ok: false, message: data.detail ?? "연결 실패" });
      }
    } finally {
      setTestLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="text-center py-16 text-[var(--color-text-muted)]">불러오는 중…</div>
      </div>
    );
  }

  const grouped = GROUP_ORDER.map((group) => ({
    group,
    items: settings.filter((s) => s.group_name === group && !HIDDEN_KEYS.has(s.key)),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-bold text-[var(--color-primary)]">사이트 설정</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          외부 서비스 연동 및 사이트 정보를 관리합니다. 저장 즉시 적용됩니다.
        </p>
      </div>

      {grouped.map(({ group, items }) => (
        <div key={group} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden">
          {/* 그룹 헤더 */}
          <div className="px-6 py-3 bg-[var(--color-surface-warm)] border-b border-[var(--color-border)] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span>{GROUP_ICON[group] ?? "⚙️"}</span>
              <span className="font-semibold text-sm text-[var(--color-text)]">{group}</span>
            </div>
            {GROUP_RESTART_NOTICE.has(group) && (
              <span className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
                저장 후 서버 재시작 필요
              </span>
            )}
          </div>

          {/* 설정 항목들 */}
          <div className="divide-y divide-[var(--color-border)]">
            {items.map((s) => (
              <div key={s.key} className="px-6 py-4">
                {s.key === "AUTH_SECRET" && (
                  <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 leading-relaxed">
                    ⚠️ <strong>AUTH_SECRET 변경 주의</strong> — JWT 서명 키입니다. 변경하는 즉시 <strong>모든 회원의 로그인 세션이 무효화</strong>되어 강제 로그아웃됩니다. 첫 설치 시 자동 발급된 값이며, 키 유출 등 보안 사고가 아니면 변경하지 마세요. 변경 후에는 서버 재시작이 필요합니다.
                  </div>
                )}
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="min-w-0">
                    <label className="block text-sm font-medium text-[var(--color-text)]">
                      {s.label}
                      {s.is_secret && (
                        <span className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-600 border border-amber-200 rounded font-normal">
                          비밀
                        </span>
                      )}
                    </label>
                    {s.description && (
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{s.description}</p>
                    )}
                  </div>
                  {/* 저장 상태 */}
                  <span className="text-xs shrink-0 mt-1">
                    {saving[s.key] ? (
                      <span className="text-[var(--color-text-muted)]">저장 중…</span>
                    ) : saved[s.key] ? (
                      <span className="text-green-600 font-medium">✓ 저장됨</span>
                    ) : s.is_secret && s.is_set ? (
                      <span className="text-blue-500 text-[11px]">설정됨</span>
                    ) : null}
                  </span>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    {SELECT_OPTIONS[s.key] ? (
                      <select
                        value={values[s.key] ?? s.value ?? SELECT_OPTIONS[s.key][0].value}
                        onChange={(e) => setValues((v) => ({ ...v, [s.key]: e.target.value }))}
                        className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)] bg-white"
                      >
                        {SELECT_OPTIONS[s.key].map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={s.is_secret && !showSecret[s.key] ? "password" : "text"}
                        value={values[s.key] ?? ""}
                        onChange={(e) => setValues((v) => ({ ...v, [s.key]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && handleSave(s.key)}
                        placeholder={
                          s.is_secret
                            ? s.is_set ? "변경하려면 새 값을 입력하세요" : "값을 입력하세요"
                            : s.value ?? ""
                        }
                        className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)] pr-10"
                      />
                    )}
                    {s.is_secret && !SELECT_OPTIONS[s.key] && (
                      <button
                        type="button"
                        onClick={() => setShowSecret((p) => ({ ...p, [s.key]: !p[s.key] }))}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-xs"
                        tabIndex={-1}
                      >
                        {showSecret[s.key] ? "숨김" : "표시"}
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => handleSave(s.key)}
                    disabled={saving[s.key] || (s.is_secret && !values[s.key])}
                    className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] disabled:opacity-40 text-white text-sm rounded-lg transition-colors shrink-0"
                  >
                    저장
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* 이메일 그룹 하단: SMTP 테스트 버튼 */}
          {group === "이메일" && (
            <div className="px-6 py-4 border-t border-[var(--color-border)] bg-gray-50/50 flex items-center gap-3">
              <button
                onClick={handleTestSmtp}
                disabled={testLoading}
                className="px-4 py-2 text-sm border border-[var(--color-border)] hover:bg-white disabled:opacity-40 rounded-lg transition-colors"
              >
                {testLoading ? "테스트 중…" : "📨 SMTP 연결 테스트"}
              </button>
              {testResult && (
                <span className={`text-sm ${testResult.ok ? "text-green-600" : "text-red-500"}`}>
                  {testResult.ok ? "✓ " : "✗ "}{testResult.message}
                </span>
              )}
            </div>
          )}
        </div>
      ))}

      <p className="text-xs text-[var(--color-text-muted)]">
        여기서 저장한 값은 서버 .env보다 우선 적용됩니다. 비밀 항목은 화면에 표시되지 않으며 DB에만 저장됩니다.
      </p>
    </div>
  );
}
