"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type SeasonValue =
  | ""
  | "advent"
  | "christmas"
  | "lent"
  | "easter"
  | "ordinary"
  | "pentecost";

interface Option {
  value: SeasonValue;
  label: string;
  description: string;
  primary: string;
  surface: string;
}

const OPTIONS: Option[] = [
  {
    value: "",
    label: "끄기 (평시)",
    description: "기본 마리아 블루·전례 금색 톤을 유지합니다.",
    primary: "#1a365d",
    surface: "#f8f8f6",
  },
  {
    value: "advent",
    label: "대림 (Advent)",
    description: "보라색 자색 — 회개와 기다림의 시기.",
    primary: "#4a2c5a",
    surface: "#f6f3f8",
  },
  {
    value: "christmas",
    label: "성탄 (Christmas)",
    description: "흰색·금색 영광 + 따뜻한 와인 포인트.",
    primary: "#5a2424",
    surface: "#fffaf2",
  },
  {
    value: "lent",
    label: "사순 (Lent)",
    description: "짙은 자주색 — 회개와 금욕의 40일.",
    primary: "#3d2148",
    surface: "#f3f1f5",
  },
  {
    value: "easter",
    label: "부활 (Easter)",
    description: "새벽빛 초록·금색 — 부활의 영광 50일.",
    primary: "#2e5a3b",
    surface: "#f4f9f1",
  },
  {
    value: "ordinary",
    label: "연중시기 (Ordinary Time)",
    description: "초록색 — 성장과 희망의 가장 긴 시기.",
    primary: "#2c4a3e",
    surface: "#f3f5f1",
  },
  {
    value: "pentecost",
    label: "성령강림·순교축일 (Pentecost)",
    description: "빨간색 — 성령의 불, 순교자 축일.",
    primary: "#8b1c2e",
    surface: "#faf2f3",
  },
];

export default function SeasonPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [current, setCurrent] = useState<SeasonValue>("");
  const [selected, setSelected] = useState<SeasonValue>("");
  const [autoMode, setAutoMode] = useState(false);   // SEASON_AUTO_MODE
  const [autoComputed, setAutoComputed] = useState<SeasonValue>("");  // 오늘 자동 계산 결과

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      router.push("/admin");
      return;
    }
    Promise.all([
      fetch(`${API}/api/admin/settings`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API}/api/public/site-config`, { cache: "no-store" }),
    ])
      .then(async ([resSettings, resPublic]) => {
        if (!resSettings.ok) {
          router.push("/admin");
          return;
        }
        const data: { key: string; value: string | null }[] = await resSettings.json();
        const row = data.find((d) => d.key === "CURRENT_SEASON");
        const value = (row?.value?.trim().toLowerCase() ?? "") as SeasonValue;
        const valid = OPTIONS.some((o) => o.value === value);
        const normalized = valid ? value : "";
        setCurrent(normalized);
        setSelected(normalized);

        const autoRow = data.find((d) => d.key === "SEASON_AUTO_MODE");
        const autoOn = (autoRow?.value?.trim().toLowerCase() ?? "") === "true";
        setAutoMode(autoOn);

        // 자동 계산 결과: public-config의 CURRENT_SEASON(자동 모드일 때 계산값으로 덮어쓰여 있음)
        // 자동 OFF일 때는 별도 확인이 어려우므로, 자동 ON일 때만 표시.
        if (resPublic.ok) {
          const pub: Record<string, string> = await resPublic.json();
          const computed = (pub.CURRENT_SEASON ?? "") as SeasonValue;
          if (autoOn && OPTIONS.some((o) => o.value === computed)) {
            setAutoComputed(computed);
          }
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function patchSetting(key: string, value: string | null): Promise<boolean> {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      router.push("/admin");
      return false;
    }
    const res = await fetch(`${API}/api/admin/settings/${key}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ value }),
    });
    return res.ok;
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const ok = await patchSetting("CURRENT_SEASON", selected || null);
      if (!ok) {
        alert("저장에 실패했습니다.");
        return;
      }
      setCurrent(selected);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleAuto() {
    setSaving(true);
    setSaved(false);
    try {
      const nextAuto = !autoMode;
      const ok = await patchSetting("SEASON_AUTO_MODE", nextAuto ? "true" : "");
      if (!ok) {
        alert("자동 모드 토글 저장 실패.");
        return;
      }
      setAutoMode(nextAuto);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);

      // 자동 켰을 때: 계산값을 즉시 표시하려고 public-config 재조회
      if (nextAuto) {
        try {
          const r = await fetch(`${API}/api/public/site-config`, { cache: "no-store" });
          if (r.ok) {
            const pub: Record<string, string> = await r.json();
            const computed = (pub.CURRENT_SEASON ?? "") as SeasonValue;
            if (OPTIONS.some((o) => o.value === computed)) setAutoComputed(computed);
          }
        } catch {}
      } else {
        setAutoComputed("");
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const dirty = selected !== current;
  const currentLabel = OPTIONS.find((o) => o.value === current)?.label ?? "끄기 (평시)";
  const autoLabel = OPTIONS.find((o) => o.value === autoComputed)?.label ?? "";

  if (loading) {
    return (
      <div className="p-8 text-center text-sm text-[var(--color-text-muted)]">
        불러오는 중…
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-serif text-2xl font-bold text-[var(--color-primary)] mb-1">
        전례 시기 테마
      </h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-6">
        선택한 시기의 전례색이 사이트 전체에 적용됩니다. 평시로 돌리려면 "끄기"를 선택하세요.
      </p>

      {/* 자동 모드 토글 */}
      <div className={`mb-4 p-4 border rounded-lg ${autoMode ? "bg-[var(--color-primary)]/5 border-[var(--color-primary)]/30" : "bg-[var(--color-surface-warm)] border-[var(--color-border)]"}`}>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={autoMode}
            onChange={handleToggleAuto}
            disabled={saving}
            className="mt-1 accent-[var(--color-primary)] w-4 h-4"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-[var(--color-text)]">전례 시기 자동 모드</span>
              {autoMode && (
                <span className="text-[10px] px-1.5 py-0.5 bg-[var(--color-primary)] text-white rounded-full font-semibold">
                  AUTO
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
              켜면 오늘 날짜로 전례 시기를 자동 계산해 적용합니다 (아래 수동 선택은 무시).
              부활절(Gauss 알고리즘)을 기준으로 사순·부활·성령강림·대림·성탄·연중을 자동 결정.
            </p>
            {autoMode && autoLabel && (
              <p className="text-sm mt-2">
                <span className="text-[var(--color-text-muted)]">오늘 자동 적용: </span>
                <strong className="text-[var(--color-primary)]">{autoLabel}</strong>
              </p>
            )}
          </div>
        </label>
      </div>

      <div className="mb-4 p-3 bg-[var(--color-surface-warm)] border border-[var(--color-border)] rounded-lg text-sm">
        <span className="text-[var(--color-text-muted)]">수동 저장값: </span>
        <strong className="text-[var(--color-primary)]">{currentLabel}</strong>
        {autoMode && (
          <span className="ml-2 text-xs text-[var(--color-text-muted)]">
            (자동 모드 켜져 있어 현재 사이트에는 자동 계산값이 적용 중)
          </span>
        )}
      </div>

      <ul className={`space-y-2 mb-6 ${autoMode ? "opacity-50 pointer-events-none" : ""}`}>
        {OPTIONS.map((opt) => {
          const isSelected = selected === opt.value;
          const isCurrent = current === opt.value;
          return (
            <li key={opt.value || "off"}>
              <label
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  isSelected
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5"
                    : "border-[var(--color-border)] hover:bg-gray-50"
                }`}
              >
                <input
                  type="radio"
                  name="season"
                  value={opt.value}
                  checked={isSelected}
                  onChange={() => setSelected(opt.value)}
                  className="mt-1 accent-[var(--color-primary)]"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-[var(--color-text)]">{opt.label}</span>
                    {isCurrent && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-[var(--color-primary)] text-white rounded-full font-semibold">
                        현재
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {opt.description}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0 mt-1" aria-hidden>
                  <span
                    className="w-5 h-5 rounded-full border border-black/10"
                    style={{ background: opt.primary }}
                    title="primary"
                  />
                  <span
                    className="w-5 h-5 rounded-full border border-black/10"
                    style={{ background: opt.surface }}
                    title="surface"
                  />
                </div>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || saving}
          className="px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-light)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "저장 중…" : "저장"}
        </button>
        {saved && (
          <span className="text-sm text-green-600 font-medium">✓ 저장되었습니다.</span>
        )}
        {dirty && !saving && !saved && (
          <span className="text-xs text-[var(--color-text-muted)]">변경됨</span>
        )}
      </div>

      <p className="text-xs text-[var(--color-text-muted)] mt-6 leading-relaxed">
        저장 후 사이트 새로고침 시 즉시 반영됩니다. 페이지 전체의 헤더·사이드바·버튼·강조 색이 자동으로 시기 톤으로 바뀝니다.
      </p>
    </div>
  );
}
