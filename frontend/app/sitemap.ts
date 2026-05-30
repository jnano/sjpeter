import type { MetadataRoute } from "next";
import { fetchSiteConfig } from "@/lib/site-config";
import { fetchServerMenus } from "@/components/fetchServerMenus";
import type { MenuItem } from "@/components/useNavigation";

// /sitemap.xml 로 서빙됨. 활성 메뉴에 등록된 내부 페이지를 SITE_URL 기준 절대 URL 로 나열.
// 본당마다 메뉴 구성·도메인이 다르므로 모두 DB(site_settings·menu_items)에서 동적으로 읽는다.
export const revalidate = 3600;

/** children 포함 평평하게 펼친 뒤 활성·내부 링크만. (sitemap/page.tsx 와 동일 로직) */
function visiblePaths(items: MenuItem[]): string[] {
  const out: string[] = [];
  const walk = (list: MenuItem[]) => {
    for (const it of list) {
      if (it.is_active && !it.is_external && it.href?.startsWith("/")) out.push(it.href);
      if (it.children?.length) walk(it.children);
    }
  };
  walk(items);
  return out;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [config, groups] = await Promise.all([fetchSiteConfig(), fetchServerMenus()]);
  const siteUrl = (config.SITE_URL || "").trim().replace(/\/+$/, "");

  // SITE_URL 미설정(또는 localhost 예시값)이면 유효한 절대 URL 을 만들 수 없으므로 빈 sitemap 반환.
  if (!siteUrl || !/^https?:\/\//.test(siteUrl)) return [];

  const paths = new Set<string>(["/"]); // 홈은 항상 포함
  for (const g of groups) {
    if (!g.is_active) continue;
    for (const p of visiblePaths(g.items)) paths.add(p);
  }

  return [...paths].map((path) => ({
    url: `${siteUrl}${path === "/" ? "" : path}`,
    changeFrequency: "weekly" as const,
  }));
}
