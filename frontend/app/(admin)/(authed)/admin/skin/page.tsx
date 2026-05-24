"use client";
import { useCallback, useEffect, useState } from "react";
import { SKIN_OPTIONS, type SkinKey } from "@/lib/skin";

const API = process.env.NEXT_PUBLIC_API_URL;

export default function AdminSkinPage() {
  const [current, setCurrent] = useState<SkinKey>("basic");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<SkinKey | null>(null);
  const [msg, setMsg] = useState("");

  const headers = useCallback((): HeadersInit => {
    const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  useEffect(() => {
    fetch(`${API}/api/public/site-config`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: Record<string, string>) => {
        const v = (d.SKIN ?? "").trim().toLowerCase();
        if (SKIN_OPTIONS.some((s) => s.key === v)) setCurrent(v as SkinKey);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function apply(key: SkinKey) {
    setSaving(key);
    setMsg("");
    try {
      const res = await fetch(`${API}/api/settings/SKIN`, {
        method: "PATCH",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ value: key }),
      });
      if (res.ok) {
        setCurrent(key);
        setMsg("적용되었습니다. 페이지를 새로고침하면 사이트 전체에 반영됩니다.");
      } else {
        const err = await res.json().catch(() => ({}));
        setMsg(`저장 실패: ${err.detail ?? res.status}`);
      }
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">스킨</h1>
        <p className="text-sm text-gray-500 mt-1">
          사이트 전체 시각 톤(카드 형태·여백·그림자·폰트) 을 한 번에 전환합니다.
          선택 후 페이지를 새로고침하면 공개 사이트와 admin 모두에 반영됩니다.
        </p>
      </div>

      {msg && (
        <p className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          {msg}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-gray-500 text-center py-12">불러오는 중…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SKIN_OPTIONS.map((s) => {
            const isCurrent = s.key === current;
            const isSaving = saving === s.key;
            return (
              <div
                key={s.key}
                data-skin={s.key}
                className={`relative flex flex-col gap-4 p-5 border-2 transition-all ${
                  isCurrent ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5" : "border-gray-200 bg-white hover:border-gray-400"
                }`}
                style={{ borderRadius: "var(--radius-card)" }}
              >
                {isCurrent && (
                  <span className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-primary)] text-white font-semibold">
                    현재
                  </span>
                )}
                <div>
                  <h3 className="text-lg font-bold text-[var(--color-primary)]">{s.label}</h3>
                  <p className="text-xs text-gray-600 mt-1 leading-relaxed">{s.description}</p>
                </div>

                {/* 미리보기 — 카드 1개 + 버튼 1개 */}
                <div
                  className="bg-white border border-gray-200 p-4 flex flex-col gap-2"
                  style={{
                    borderRadius: "var(--radius-card)",
                    boxShadow: "var(--shadow-card)",
                    padding: "var(--card-padding)",
                  }}
                >
                  <p className="text-sm font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                    미리보기 카드
                  </p>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    카드 형태·그림자·여백·헤딩 폰트가 이 스킨에 맞춰 변합니다.
                  </p>
                  <button
                    className="self-start mt-1 px-3 py-1.5 text-xs bg-[var(--color-primary)] text-white"
                    style={{ borderRadius: "var(--radius-button)" }}
                    onClick={(e) => e.preventDefault()}
                    type="button"
                  >
                    예시 버튼
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => apply(s.key)}
                  disabled={isCurrent || isSaving}
                  className="w-full py-2 text-sm font-medium bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] disabled:opacity-40 transition-colors"
                >
                  {isCurrent ? "이미 선택됨" : isSaving ? "적용 중…" : "이 스킨 적용"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600 leading-relaxed">
        <p className="font-semibold mb-1">스킨 시스템 정보 (v1.5.345)</p>
        <ul className="list-disc pl-5 space-y-0.5">
          <li>전역 CSS 변수 (<code>--radius-card</code>, <code>--shadow-card</code>, <code>--card-padding</code>, <code>--font-display</code> 등) 를 통해 작동</li>
          <li>적용 즉시 site_settings.SKIN 에 저장. 페이지 새로고침 시 반영</li>
          <li>새 스킨 프리셋 추가는 코드 작업 — 회원님이 의뢰한 디자인 도착 시 별도 commit 으로 추가</li>
        </ul>
      </div>
    </div>
  );
}
