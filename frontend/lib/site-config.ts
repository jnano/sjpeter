/**
 * /api/public/site-config 단일 fetch wrapper (v1.5.461 최적화).
 *
 * 기존: lib/season.ts·lib/skin.ts·lib/ink-color.ts·lib/parish.ts 가 각자
 * /api/public/site-config 를 별도 fetch → 한 페이지 SSR 에 동일 endpoint
 * 4~5 회 호출. React `cache()` 로 같은 URL·옵션은 dedup 되지만 옵션이
 * 미세하게 달라도 dedup 깨짐.
 *
 * 개선: 이 모듈이 단일 진입점. tag 기반 ISR 60s + revalidateTag("parish")
 * 로 admin 변경 즉시 무효화. 다른 lib 들은 이 결과를 공유.
 */
import { cache } from "react";

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type SiteConfig = Record<string, string | undefined>;

/** SSR 단일 요청 내 deduplication. revalidate 60s + tag = admin 변경 시 즉시 무효화. */
export const fetchSiteConfig = cache(async (): Promise<SiteConfig> => {
  try {
    const res = await fetch(`${API}/api/public/site-config`, {
      next: { revalidate: 60, tags: ["parish", "site-config"] },
    });
    if (!res.ok) return {};
    return res.json();
  } catch {
    return {};
  }
});
