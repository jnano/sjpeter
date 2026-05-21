"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Theme = "warm" | "modern" | "classic";

const THEMES: { value: Theme; label: string; description: string }[] = [
  { value: "warm",    label: "Warm (기본)",  description: "현재 따뜻한 톤 — 마리아 블루 + 금색 + 라운드 카드" },
  { value: "modern",  label: "Modern",       description: "여유 있는 흰 톤 — 섹션 간격 넓힘 + 부드러운 그림자" },
  { value: "classic", label: "Classic",      description: "컴팩트 네이비 — 섹션 간격 좁힘 + 샤프한 모서리" },
];

function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
}

export default function AdminHomePage() {
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>("warm");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    if (!getToken()) { router.push("/admin"); return; }
    try {
      const r = await fetch(`${API}/api/public/site-config`, { cache: "no-store" });
      if (r.ok) {
        const d = (await r.json()) as Record<string, string>;
        const t = (d.HOME_THEME ?? "warm") as Theme;
        setTheme(THEMES.some((x) => x.value === t) ? t : "warm");
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function saveTheme(next: Theme) {
    const token = getToken();
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/admin/settings/HOME_THEME`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ value: next }),
      });
      if (!res.ok) {
        alert("저장 실패");
        return;
      }
      setTheme(next);
      setMsg(`테마를 '${THEMES.find((x) => x.value === next)?.label}' 로 변경했습니다. 홈 새로고침 시 반영됩니다.`);
      setTimeout(() => setMsg(""), 3000);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-8 text-sm text-gray-500">불러오는 중…</div>;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-primary)]">홈 페이지 관리</h1>
        <p className="text-sm text-gray-500 mt-1">
          홈(`/`) 의 테마와 섹션 블록을 관리합니다. 변경은 즉시 반영됩니다.
        </p>
      </header>

      {msg && (
        <p className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{msg}</p>
      )}

      <section className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="text-base font-semibold mb-1">테마</h2>
        <p className="text-xs text-gray-500 mb-4">홈 페이지 전체의 시각 톤을 결정합니다. 미리보기는 새 창에서 <a href="/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">/</a> 를 여시면 됩니다.</p>
        <div className="grid sm:grid-cols-3 gap-3">
          {THEMES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => saveTheme(t.value)}
              disabled={saving}
              className={`text-left px-4 py-4 rounded-lg border transition-colors disabled:opacity-50 ${
                theme === t.value
                  ? "bg-blue-50 border-blue-400 text-blue-900"
                  : "bg-white border-gray-300 hover:bg-gray-50"
              }`}
            >
              <div className="font-semibold mb-1 flex items-center gap-2">
                {t.label}
                {theme === t.value && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">선택됨</span>}
              </div>
              <div className="text-[11px] text-gray-500 leading-snug">{t.description}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="bg-amber-50 border border-amber-200 rounded-xl p-6">
        <h2 className="text-base font-semibold mb-1">섹션 블록 관리</h2>
        <p className="text-xs text-gray-500">
          섹션 블록 빌더 (드래그 정렬·ON/OFF·블록별 편집) 는 다음 단계에서 추가됩니다.
          현재 홈은 7개 섹션이 고정 순서로 렌더링됩니다.
        </p>
      </section>
    </div>
  );
}
