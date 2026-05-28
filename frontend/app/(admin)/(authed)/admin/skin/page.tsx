"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SKIN_OPTIONS, type SkinKey } from "@/lib/skin";
import {
  INK_PRESETS,
  DEFAULT_INK,
  isValidHex,
  normalizeHex,
  relativeLuminance,
} from "@/lib/ink-color";

const API = process.env.NEXT_PUBLIC_API_URL;

// 잉크는 흰 글씨 배경으로 쓰이므로 휘도가 낮아야 한다.
// 0.35 = 대략 회색-중간. 그 이상이면 흰 글씨 가독성 경고.
const INK_LUMINANCE_WARN = 0.35;

export default function AdminSkinPage() {
  const [currentSkin, setCurrentSkin] = useState<SkinKey>("basic");
  const [currentInk, setCurrentInk] = useState<string>(DEFAULT_INK);
  const [draftInk, setDraftInk] = useState<string>(DEFAULT_INK); // 직접 입력 패널의 임시값
  const [loading, setLoading] = useState(true);
  const [savingSkin, setSavingSkin] = useState<SkinKey | null>(null);
  const [savingInk, setSavingInk] = useState(false);
  const [msg, setMsg] = useState("");

  const headers = useCallback((): HeadersInit => {
    const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  useEffect(() => {
    fetch(`${API}/api/public/site-config`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: Record<string, string>) => {
        const s = (d.SKIN ?? "").trim().toLowerCase();
        if (SKIN_OPTIONS.some((o) => o.key === s)) setCurrentSkin(s as SkinKey);
        const ink = (d.INK_COLOR ?? "").trim();
        if (isValidHex(ink)) {
          const n = normalizeHex(ink);
          setCurrentInk(n);
          setDraftInk(n);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function patchSetting(key: string, value: string) {
    const res = await fetch(`${API}/api/admin/settings/${key}`, {
      method: "PATCH",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail ?? String(res.status));
    }
  }

  async function applySkin(key: SkinKey) {
    setSavingSkin(key);
    setMsg("");
    try {
      await patchSetting("SKIN", key);
      setCurrentSkin(key);
      setMsg("스킨이 적용되었습니다. 페이지를 새로고침하면 사이트 전체에 반영됩니다.");
    } catch (e) {
      setMsg(`저장 실패: ${e instanceof Error ? e.message : "알 수 없는 오류"}`);
    } finally {
      setSavingSkin(null);
    }
  }

  async function applyInk(hex: string) {
    const n = normalizeHex(hex);
    if (!isValidHex(n)) {
      setMsg("올바른 hex 코드가 아닙니다 (예: #1F4E5F).");
      return;
    }
    setSavingInk(true);
    setMsg("");
    try {
      await patchSetting("INK_COLOR", n);
      setCurrentInk(n);
      setDraftInk(n);
      setMsg("잉크 컬러가 적용되었습니다. 페이지를 새로고침하면 사이트 전체에 반영됩니다.");
    } catch (e) {
      setMsg(`저장 실패: ${e instanceof Error ? e.message : "알 수 없는 오류"}`);
    } finally {
      setSavingInk(false);
    }
  }

  async function resetInk() {
    // "" 저장 → fetchCurrentInkColor 가 DEFAULT_INK 로 fallback
    setSavingInk(true);
    setMsg("");
    try {
      await patchSetting("INK_COLOR", "");
      setCurrentInk(DEFAULT_INK);
      setDraftInk(DEFAULT_INK);
      setMsg("잉크 컬러를 기본값으로 되돌렸습니다.");
    } catch (e) {
      setMsg(`저장 실패: ${e instanceof Error ? e.message : "알 수 없는 오류"}`);
    } finally {
      setSavingInk(false);
    }
  }

  const draftValid = isValidHex(draftInk);
  const draftLuminance = useMemo(() => (draftValid ? relativeLuminance(draftInk) : 0), [draftInk, draftValid]);
  const tooBright = draftValid && draftLuminance > INK_LUMINANCE_WARN;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">스킨</h1>
        <p className="text-sm text-gray-500 mt-1">
          사이트 전체의 시각 톤을 한 곳에서 결정합니다. <b>잉크 컬러</b>(다크 블록 배경)와 <b>스킨</b>(카드 형태·여백·그림자·폰트)은 별개 차원이며 자유롭게 조합할 수 있습니다.
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
        <>
          {/* ── 잉크 컬러 ─────────────────────────────────────────── */}
          <section className="mb-10">
            <div className="mb-3 flex items-end justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-lg font-bold">잉크 컬러</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  성전건축 카드·푸터·notice 탭 활성 등 <b>다크 블록의 배경색</b>으로 쓰입니다. 와인·골드·크림은 변경되지 않습니다.
                </p>
              </div>
              <div className="text-xs text-gray-500">
                현재: <code className="font-mono">{currentInk}</code>
                <span
                  className="inline-block ml-2 align-middle w-4 h-4 rounded border border-gray-300"
                  style={{ background: currentInk }}
                />
              </div>
            </div>

            {/* 프리셋 5종 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
              {INK_PRESETS.map((p) => {
                const isCurrent = normalizeHex(p.hex) === currentInk;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => applyInk(p.hex)}
                    disabled={isCurrent || savingInk}
                    className={`relative text-left p-3 border-2 rounded-lg transition-all disabled:cursor-not-allowed ${
                      isCurrent ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5" : "border-gray-200 bg-white hover:border-gray-400"
                    }`}
                  >
                    {isCurrent && (
                      <span className="absolute top-1.5 right-1.5 text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--color-primary)] text-white font-semibold">
                        현재
                      </span>
                    )}
                    <div className="h-12 rounded mb-2 border border-gray-200" style={{ background: p.hex }} />
                    <div className="text-[11px] font-bold leading-tight">{p.label}</div>
                    <div className="text-[10px] text-gray-500 font-mono mt-0.5">{p.hex.toUpperCase()}</div>
                    <div className="text-[10px] text-gray-500 mt-1 leading-snug">{p.description}</div>
                  </button>
                );
              })}
            </div>

            {/* 직접 입력 */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-start gap-4 flex-wrap">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">직접 입력</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={draftValid ? normalizeHex(draftInk) : "#000000"}
                      onChange={(e) => setDraftInk(e.target.value)}
                      className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                      aria-label="색상 선택기"
                    />
                    <input
                      type="text"
                      value={draftInk}
                      onChange={(e) => setDraftInk(e.target.value)}
                      placeholder="#1F4E5F"
                      className="font-mono w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => applyInk(draftInk)}
                      disabled={!draftValid || normalizeHex(draftInk) === currentInk || savingInk}
                      className="px-4 py-2 text-sm font-medium bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] disabled:opacity-40"
                    >
                      {savingInk ? "적용 중…" : "이 색 적용"}
                    </button>
                    <button
                      type="button"
                      onClick={resetInk}
                      disabled={currentInk === DEFAULT_INK || savingInk}
                      className="px-3 py-2 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-white disabled:opacity-40"
                    >
                      기본값으로
                    </button>
                  </div>
                  {!draftValid && draftInk && (
                    <p className="text-[11px] text-red-600 mt-2">
                      hex 형식이 아닙니다. 예: <code>#1F4E5F</code>
                    </p>
                  )}
                  {tooBright && (
                    <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-2">
                      ⚠ 잉크는 흰 글씨가 올라가는 다크 배경입니다. 이 색은 너무 밝아 본문이 안 보일 수 있습니다.
                    </p>
                  )}
                </div>

                {/* 미니 미리보기 */}
                {draftValid && (
                  <div className="flex-1 min-w-[260px] flex gap-2">
                    <div
                      className="flex-1 rounded p-3 text-white text-[11px] leading-snug"
                      style={{ background: draftInk }}
                    >
                      <div className="opacity-70 text-[9px] tracking-widest uppercase mb-1" style={{ color: "#C9A961" }}>
                        함께 짓는 성전
                      </div>
                      <div className="font-bold">한 단계씩, 함께 짓는 성전.</div>
                      <div className="opacity-60 text-[10px] mt-2">80% · 외장 마감</div>
                    </div>
                    <div className="flex-1 rounded p-3 text-[11px] flex items-center justify-center" style={{ background: draftInk, color: "#FFF" }}>
                      <span style={{ color: "#C9A961", fontWeight: 700 }}>한 줄 봉헌</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ── 스킨 (카드 형태·여백·그림자·폰트) ─────────────────── */}
          <section>
            <div className="mb-3">
              <h2 className="text-lg font-bold">스킨</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                카드 형태·여백·그림자·헤딩 폰트 톤을 결정합니다. 선택 후 새로고침하면 공개 사이트와 admin 모두에 반영됩니다.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {SKIN_OPTIONS.map((s) => {
                const isCurrent = s.key === currentSkin;
                const isSaving = savingSkin === s.key;
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
                      onClick={() => applySkin(s.key)}
                      disabled={isCurrent || isSaving}
                      className="w-full py-2 text-sm font-medium bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] disabled:opacity-40 transition-colors"
                    >
                      {isCurrent ? "이미 선택됨" : isSaving ? "적용 중…" : "이 스킨 적용"}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600 leading-relaxed">
        <p className="font-semibold mb-1">스킨 시스템 정보 (v1.5.395)</p>
        <ul className="list-disc pl-5 space-y-0.5">
          <li>잉크 컬러는 <code>:root</code> 의 <code>--site-ink</code> CSS 변수로 주입 — globals.css 의 6개 스킨 스코프가 모두 이 값을 따름</li>
          <li>스킨은 전역 CSS 변수 (<code>--radius-card</code>, <code>--shadow-card</code>, <code>--card-padding</code>, <code>--font-display</code> 등) 를 통해 작동</li>
          <li>적용 즉시 <code>site_settings.INK_COLOR</code> / <code>site_settings.SKIN</code> 에 저장. 페이지 새로고침 시 사이트 전체에 반영</li>
        </ul>
      </div>
    </div>
  );
}
