import { cache } from "react";

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type SkinKey = "basic" | "classic" | "modern" | "editorial" | "dashboard" | "construction";

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
  {
    key: "editorial",
    label: "에디토리얼 미니멀",
    description: "와인+골드 팔레트, Pretendard, 큰 타이포·절제된 카드. 신문/잡지 톤. (홈 페이지 데스크탑 한정 — 시안 v1)",
    preview: { radius: "12px", shadow: "0 1px 2px rgba(44,38,32,0.04)", padding: "28px" },
  },
  {
    key: "dashboard",
    label: "대시보드 카드",
    description: "와인+골드 팔레트, Pretendard, 12-grid 카드 밀집형 정보 레이아웃. (홈 페이지 데스크탑 한정 — 시안 v2)",
    preview: { radius: "10px", shadow: "0 4px 16px rgba(44,38,32,0.06)", padding: "28px" },
  },
  {
    key: "construction",
    label: "함께 짓는 성전",
    description: "와인+골드 팔레트, Pretendard, 성전건축 프로젝트 강조 + 큰 헤드라인. (홈 페이지 데스크탑 한정 — 시안 v3)",
    preview: { radius: "12px", shadow: "0 12px 40px rgba(44,38,32,0.08)", padding: "28px" },
  },
];

const VALID = new Set<string>(SKIN_OPTIONS.map((s) => s.key));

/** site_settings.SKIN 값을 server-side 에서 fetch. v1.5.461 — site-config 공통 wrapper. */
export const fetchCurrentSkin = cache(async (): Promise<SkinKey> => {
  const { fetchSiteConfig } = await import("./site-config");
  const data = await fetchSiteConfig();
  const v = (data.SKIN ?? "").trim().toLowerCase();
  return v && VALID.has(v) ? (v as SkinKey) : "basic";
});

/** SKIN 이 Claude Design 시안 기반 본격 스킨인지 — page.tsx 에서 다른 home component 분기 */
export function isShowcaseSkin(skin: SkinKey | string): skin is "editorial" | "dashboard" | "construction" {
  return skin === "editorial" || skin === "dashboard" || skin === "construction";
}
