import type { Metadata } from "next";
import { Noto_Sans_KR, Noto_Serif_KR, Playfair_Display } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SessionProvider from "@/components/SessionProvider";
import SessionTimeout from "@/components/SessionTimeout";

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

export const metadata: Metadata = {
  title: {
    default: "세종성베드로성당",
    template: "%s | 세종성베드로성당",
  },
  description:
    "대전교구 세종성베드로성당 공식 홈페이지. 미사 시간, 주보, 성당 소식을 확인하세요.",
  keywords: ["세종성베드로성당", "세종 성당", "대전교구", "가톨릭", "성당"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${notoSansKR.variable} ${notoSerifKR.variable} ${playfairDisplay.variable}`}
    >
      <body className="min-h-screen flex flex-col bg-[var(--color-background)]">
        <SessionProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <SessionTimeout />
        </SessionProvider>
      </body>
    </html>
  );
}
