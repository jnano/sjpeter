import { redirect } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { fetchParishMin, fetchParishNameEn } from "@/lib/parish";
import { fetchCurrentSeason } from "@/lib/season";

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default async function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // setup 미완 시 모든 공개 페이지를 /setup 으로 강제 리다이렉트.
  // redirect()는 NEXT_REDIRECT 를 throw 하므로 try 밖에서 호출.
  // 백엔드 페치 실패 시 fail-open — 백엔드가 안 떠 있어도 공개 사이트는 그대로 노출 (어차피 데이터 없음).
  let setupCompleted = true;
  try {
    const res = await fetch(`${API}/api/setup/status`, { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { setup_completed?: boolean };
      setupCompleted = data.setup_completed !== false;
    }
  } catch {
    // 백엔드 미기동 시 그대로 통과
  }
  if (!setupCompleted) {
    redirect("/setup");
  }

  const [parish, parishNameEn, season] = await Promise.all([
    fetchParishMin(),
    fetchParishNameEn(),
    fetchCurrentSeason(),
  ]);
  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-background)]">
      <Header
        parishName={parish.name}
        parishNameEn={parishNameEn}
        logoUrl={parish.logo_url}
        season={season}
      />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
