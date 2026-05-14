import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { fetchParishMin } from "@/lib/parish";
import { fetchCurrentSeason } from "@/lib/season";

export default async function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [parish, season] = await Promise.all([
    fetchParishMin(),
    fetchCurrentSeason(),
  ]);
  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-background)]">
      <Header
        parishName={parish.name}
        logoUrl={parish.logo_url}
        season={season}
      />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
