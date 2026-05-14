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
  const initialMenus = await fetchServerMenus();
  return (
    <html
      lang="ko"
      className={`${notoSansKR.variable} ${notoSerifKR.variable} ${playfairDisplay.variable}`}
    >
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
