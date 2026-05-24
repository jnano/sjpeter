import { cache } from "react";

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type SkinKey = "basic" | "classic" | "modern";

export const SKIN_OPTIONS: { key: SkinKey; label: string; description: string; preview: { radius: string; shadow: string; padding: string } }[] = [
  {
    key: "basic",
    label: "기본",
    description: "현재 톤. 부드러운 둥근 카드, 옅은 그림자, 본문 산세리프 + 헤딩 세리프.",
    preview: { radius: "0.75rem", shadow: "0 1px 2px rgba(15,23,42,0.04)", padding: "1.5rem" },
  },
  {
    key: "classic",
    label: "고전",
    description: "거의 사각 카드, 묵직한 그림자, 세리프 강조, 컴팩트 여백. 묵직한 본당 분위기.",
    preview: { radius: "0.25rem", shadow: "0 2px 4px rgba(15,23,42,0.08), 0 1px 2px rgba(15,23,42,0.06)", padding: "1.25rem" },
  },
  {
    key: "modern",
    label: "현대",
    description: "큰 둥근 카드, 옅은 그림자, 넓은 여백, 산세리프 헤딩. 깔끔·여유 있는 톤.",
    preview: { radius: "1.5rem", shadow: "0 1px 3px rgba(15,23,42,0.03)", padding: "2rem" },
  },
];

const VALID = new Set<string>(SKIN_OPTIONS.map((s) => s.key));

/** site_settings.SKIN 값을 server-side 에서 fetch.
 *  - 빈 값/유효하지 않은 값이면 "basic" fallback.
 *  - admin 변경이 즉시 반영되도록 cache: "no-store".
 */
export const fetchCurrentSkin = cache(async (): Promise<SkinKey> => {
  try {
    const res = await fetch(`${API}/api/public/site-config`, { cache: "no-store" });
    if (!res.ok) return "basic";
    const data: Record<string, string> = await res.json();
    const v = (data.SKIN ?? "").trim().toLowerCase();
    return v && VALID.has(v) ? (v as SkinKey) : "basic";
  } catch {
    return "basic";
  }
});
