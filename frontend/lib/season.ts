import { cache } from "react";

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type LiturgicalSeason =
  | "advent"
  | "christmas"
  | "lent"
  | "easter"
  | "ordinary"
  | "pentecost";

export const SEASON_LABELS: Record<LiturgicalSeason, string> = {
  advent: "대림 (Advent)",
  christmas: "성탄 (Christmas)",
  lent: "사순 (Lent)",
  easter: "부활 (Easter)",
  ordinary: "연중시기 (Ordinary Time)",
  pentecost: "성령강림 (Pentecost)",
};

/** Header 칩 등 짧은 표시용 — 한국어 라벨. */
export const SEASON_LABELS_KO: Record<LiturgicalSeason, string> = {
  advent: "대림",
  christmas: "성탄",
  lent: "사순",
  easter: "부활",
  ordinary: "연중시기",
  pentecost: "성령강림·순교축일",
};

const VALID = new Set<string>(Object.keys(SEASON_LABELS));

/**
 * 현재 활성 전례 시기를 server-side에서 가져옵니다.
 * site_settings.CURRENT_SEASON을 백엔드 public-config 엔드포인트로 조회.
 * - 빈 값이거나 유효하지 않은 값이면 null (스킨 꺼짐)
 * - v1.5.461 — fetchSiteConfig 공통 wrapper 사용 (4중복 → 1 fetch)
 */
export const fetchCurrentSeason = cache(async (): Promise<LiturgicalSeason | null> => {
  const { fetchSiteConfig } = await import("./site-config");
  const data = await fetchSiteConfig();
  const value = data.CURRENT_SEASON?.trim().toLowerCase();
  if (value && VALID.has(value)) return value as LiturgicalSeason;
  return null;
});
