import { cache } from "react";

/**
 * 잉크(=다크) 컬러 시스템.
 *
 * 잉크는 `--ink` CSS 변수로 globals.css 의 `.skin-dashboard`·`.skin-editorial`·`.skin-construction`
 * 스코프에 정의되어 있고, 다크 블록·푸터·notice 탭 활성·버튼 배경 등에 쓰인다.
 * 와인(--primary)·골드(--accent)·크림(--bg)은 본 시스템에서 건드리지 않는다.
 *
 * 저장: site_settings.INK_COLOR (hex 문자열, 예: "#1F4E5F"). 미설정 시 DEFAULT 사용.
 */

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const DEFAULT_INK = "#2C2620"; // 다크 브라운 — 시안 기본값

export type InkPreset = {
  key: string;
  hex: string;
  label: string;
  description: string;
};

/** color-compare.html 시안 큐레이션 — 현재 + 4종 */
export const INK_PRESETS: InkPreset[] = [
  {
    key: "current",
    hex: "#2C2620",
    label: "현재 · 다크 브라운",
    description: "묵직한 흙빛. 본당 전통 톤.",
  },
  {
    key: "teal",
    hex: "#1F4E5F",
    label: "A. 딥 틸",
    description: "차분한 청록. 골드와 가장 잘 어울림.",
  },
  {
    key: "navy",
    hex: "#1B3A5F",
    label: "B. 딥 네이비",
    description: "안정적인 청남. 정중한 분위기.",
  },
  {
    key: "forest",
    hex: "#1F3D2B",
    label: "C. 딥 포레스트",
    description: "깊은 숲. 자연·생명의 인상.",
  },
  {
    key: "indigo",
    hex: "#1D2D5F",
    label: "D. 잉크 인디고",
    description: "어두운 남보라. 인쇄 잉크 톤.",
  },
];

/** "#1F4E5F" 같은 hex 검증. 3자리(#abc) 와 6자리(#aabbcc) 모두 허용. */
export function isValidHex(s: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s.trim());
}

/** "#abc" → "#aabbcc" 정규화. 그 외는 그대로 반환. */
export function normalizeHex(s: string): string {
  const t = s.trim();
  if (/^#[0-9a-fA-F]{3}$/.test(t)) {
    return "#" + t.slice(1).split("").map((c) => c + c).join("").toLowerCase();
  }
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t.toLowerCase();
  return t;
}

/** sRGB 상대 휘도 (WCAG 식). 0(검정) ~ 1(흰색). */
export function relativeLuminance(hex: string): number {
  const m = normalizeHex(hex).match(/^#([0-9a-f]{6})$/);
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const toLin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

/** site_settings.INK_COLOR 를 server-side 에서 fetch. */
export const fetchCurrentInkColor = cache(async (): Promise<string> => {
  try {
    const res = await fetch(`${API}/api/public/site-config`, { cache: "no-store" });
    if (!res.ok) return DEFAULT_INK;
    const data: Record<string, string> = await res.json();
    const v = (data.INK_COLOR ?? "").trim();
    return isValidHex(v) ? normalizeHex(v) : DEFAULT_INK;
  } catch {
    return DEFAULT_INK;
  }
});
