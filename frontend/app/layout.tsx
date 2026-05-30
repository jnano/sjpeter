import type { Metadata } from "next";
import { Noto_Sans_KR, Noto_Serif_KR, Playfair_Display } from "next/font/google";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import SessionTimeout from "@/components/SessionTimeout";
import SessionSync from "@/components/SessionSync";
import OnboardingGate from "@/components/OnboardingGate";
import { MenusProvider } from "@/components/MenusProvider";
import { fetchServerMenus } from "@/components/fetchServerMenus";
import { fetchParishMin, absoluteUrl } from "@/lib/parish";
import { fetchSiteConfig } from "@/lib/site-config";
import { fetchCurrentSeason } from "@/lib/season";
import { fetchCurrentSkin } from "@/lib/skin";
import { fetchCurrentInkColor, DEFAULT_INK } from "@/lib/ink-color";

const notoSansKR = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const notoSerifKR = Noto_Serif_KR({
  variable: "--font-noto-serif-kr",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  // 본당 정보(이름·로고)와 SITE_URL 을 함께 읽어 멀티 본당별 메타데이터를 동적 생성.
  // 로고가 있으면 favicon·OG 이미지로 함께 쓰고, 없으면 정적 app/favicon.ico 로 폴백.
  const [parish, config] = await Promise.all([fetchParishMin(), fetchSiteConfig()]);
  const dioceseLabel = parish.diocese ? `${parish.diocese} ` : "";
  const description = `${dioceseLabel}${parish.name} 공식 홈페이지. 미사 시간, 주보, 성당 소식을 확인하세요.`;
  const siteUrl = (config.SITE_URL || "").trim();
  const logo = absoluteUrl(parish.logo_url);

  const metadata: Metadata = {
    title: {
      default: parish.name,
      template: `%s | ${parish.name}`,
    },
    description,
    keywords: [parish.name, parish.diocese, "성당", "가톨릭"].filter(Boolean) as string[],
    openGraph: {
      type: "website",
      siteName: parish.name,
      title: parish.name,
      description,
      ...(siteUrl ? { url: siteUrl } : {}),
      ...(logo ? { images: [{ url: logo, alt: `${parish.name} 로고` }] } : {}),
    },
  };

  // SITE_URL 이 유효한 절대 URL 이면 metadataBase 로 지정 (OG 상대 URL 경고 방지).
  if (siteUrl) {
    try {
      metadata.metadataBase = new URL(siteUrl);
    } catch {
      // localhost 예시값 등 잘못된 URL 은 무시 — Next.js 기본 동작 유지
    }
  }

  // 로고가 업로드된 본당은 favicon 까지 로고로 교체. 미입력 본당은 app/favicon.ico 사용.
  if (logo) {
    metadata.icons = { icon: logo, shortcut: logo, apple: logo };
  }

  return metadata;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [initialMenus, season, skin, ink] = await Promise.all([
    fetchServerMenus(),
    fetchCurrentSeason(),
    fetchCurrentSkin(),
    fetchCurrentInkColor(),
  ]);
  // globals.css 의 모든 --ink 정의는 var(--site-ink, #2C2620) 를 통하므로
  // :root 에 --site-ink 한 줄만 주입하면 6개 스킨 스코프에 일괄 반영된다.
  const inkStyle = ink && ink !== DEFAULT_INK ? `:root{--site-ink:${ink}}` : "";
  return (
    <html
      lang="ko"
      data-season={season ?? undefined}
      data-skin={skin}
      className={`${notoSansKR.variable} ${notoSerifKR.variable} ${playfairDisplay.variable}`}
    >
      <head>
        {/* Pretendard Variable — 시안 원본 폰트 그대로. dynamic-subset 이라
            사용 글리프(unicode-range)만 on-demand 로드 → 용량 최소 (v1.5.365).
            CSS 의 font-family 는 'Pretendard Variable' 를 1순위로 둠 → 이 폰트로 해석. */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css"
        />
        {inkStyle && <style dangerouslySetInnerHTML={{ __html: inkStyle }} />}
      </head>
      <body className="bg-[var(--color-background)]">
        <SessionProvider>
          <MenusProvider initial={initialMenus}>
            {children}
            <SessionTimeout />
            <SessionSync />
            <OnboardingGate />
          </MenusProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
