import type { Metadata } from "next";
import { Noto_Sans_KR, Noto_Serif_KR, Playfair_Display } from "next/font/google";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import SessionTimeout from "@/components/SessionTimeout";
import SessionSync from "@/components/SessionSync";
import OnboardingGate from "@/components/OnboardingGate";
import { MenusProvider } from "@/components/MenusProvider";
import { fetchServerMenus } from "@/components/fetchServerMenus";
import { fetchParishMin } from "@/lib/parish";
import { fetchCurrentSeason } from "@/lib/season";
import { fetchCurrentSkin } from "@/lib/skin";

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
  const parish = await fetchParishMin();
  const dioceseLabel = parish.diocese ? `${parish.diocese} ` : "";
  return {
    title: {
      default: parish.name,
      template: `%s | ${parish.name}`,
    },
    description: `${dioceseLabel}${parish.name} 공식 홈페이지. 미사 시간, 주보, 성당 소식을 확인하세요.`,
    keywords: [parish.name, parish.diocese, "성당", "가톨릭"].filter(Boolean) as string[],
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [initialMenus, season, skin] = await Promise.all([
    fetchServerMenus(),
    fetchCurrentSeason(),
    fetchCurrentSkin(),
  ]);
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
