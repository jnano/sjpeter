import { cache } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

/** Header 칩 등 짧은 표시용 — 한국어 한 단어 라벨. */
export const SEASON_LABELS_KO: Record<LiturgicalSeason, string> = {
  advent: "대림",
  christmas: "성탄",
  lent: "사순",
  easter: "부활",
  ordinary: "연중시기",
  pentecost: "성령강림",
};

const VALID = new Set<string>(Object.keys(SEASON_LABELS));

/**
 * 현재 활성 전례 시기를 server-side에서 가져옵니다.
 * site_settings.CURRENT_SEASON을 백엔드 public-config 엔드포인트로 조회.
 * - 빈 값이거나 유효하지 않은 값이면 null (스킨 꺼짐)
 * - admin 변경이 즉시 반영되도록 cache: "no-store"
 * - React cache로 한 요청 사이클 내 dedup
 */
export const fetchCurrentSeason = cache(async (): Promise<LiturgicalSeason | null> => {
  try {
    const res = await fetch(`${API}/api/public/site-config`, { cache: "no-store" });
    if (!res.ok) return null;
    const data: Record<string, string> = await res.json();
    const value = data.CURRENT_SEASON?.trim().toLowerCase();
    if (value && VALID.has(value)) return value as LiturgicalSeason;
    return null;
  } catch {
    return null;
  }
});
