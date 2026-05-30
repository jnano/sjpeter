import type { MetadataRoute } from "next";
import { fetchSiteConfig } from "@/lib/site-config";

// 검색엔진 크롤러 안내. /robots.txt 로 서빙됨.
// SITE_URL 은 본당마다 다르므로 site_settings 에서 동적으로 읽어 sitemap 위치를 지정.
export const revalidate = 3600;

export default async function robots(): Promise<MetadataRoute.Robots> {
  const config = await fetchSiteConfig();
  const siteUrl = (config.SITE_URL || "").trim().replace(/\/+$/, "");

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // 관리자·API·개인 회원 영역은 색인 제외
      disallow: ["/admin", "/api", "/members", "/setup", "/setup-check"],
    },
    // SITE_URL 이 설정된 본당만 sitemap 을 알림 (localhost 예시값은 절대 URL 이 안 되므로 생략)
    ...(siteUrl && /^https?:\/\//.test(siteUrl)
      ? { sitemap: `${siteUrl}/sitemap.xml` }
      : {}),
  };
}
