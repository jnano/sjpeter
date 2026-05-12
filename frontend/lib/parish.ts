import { cache } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface ParishMin {
  name: string;
  logo_url: string | null;
  diocese: string | null;
  address: string | null;
}

const FALLBACK: ParishMin = {
  name: "세종성베드로성당",
  logo_url: null,
  diocese: "대전교구",
  address: null,
};

/**
 * 성당 기본 정보를 server-side에서 가져옵니다.
 * Header/Footer/layout metadata/페이지가 동일한 데이터를 공유하기 위한 공통 헬퍼.
 * - admin에서 성당명/로고를 변경하면 즉시 반영되도록 cache: "no-store"
 * - 같은 요청 사이클에선 React cache로 dedup (한 페이지 렌더에서 N번 호출해도 1회만 fetch)
 * - 실패 시 안전한 fallback 반환 (홈페이지 깨짐 방지)
 */
export const fetchParishMin = cache(async (): Promise<ParishMin> => {
  try {
    const res = await fetch(`${API}/api/parish/`, { cache: "no-store" });
    if (!res.ok) return FALLBACK;
    const data = await res.json();
    return {
      name: data.name || FALLBACK.name,
      logo_url: data.logo_url ?? null,
      diocese: data.diocese ?? null,
      address: data.address ?? null,
    };
  } catch {
    return FALLBACK;
  }
});

/** 절대 URL로 변환 (로고가 /uploads/... 같은 상대 경로일 때) */
export function absoluteUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API}${path}`;
}
