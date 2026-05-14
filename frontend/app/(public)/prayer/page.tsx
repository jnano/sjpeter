import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";
import { fetchParishMin } from "@/lib/parish";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const p = await fetchParishMin();
  return { title: "기도문", description: `${p.name} 기도문` };
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface StaticPage {
  slug: string;
  title: string;
  subtitle: string | null;
  body: string | null;
}

async function getPage(): Promise<StaticPage | null> {
  try {
    const res = await fetch(`${API}/api/content/pages/prayer`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function PrayerPage() {
  const page = await getPage();

  const title = page?.title ?? "기도문";
  const subtitle = page?.subtitle ?? "함께 바치는 기도";
  const body = page?.body;

  return (
    <>
      <PageHeader group="말씀과 기도" title={title} subtitle={subtitle} />
      <SectionLayout group="word">

      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-8">
        {body ? (
          <div className="text-[var(--color-text)] leading-loose whitespace-pre-line text-sm font-serif">
            {body}
          </div>
        ) : (
          <div className="text-center py-16 text-[var(--color-text-muted)]">
            <div className="text-5xl mb-4">✝</div>
            <p className="font-serif text-lg text-[var(--color-primary)] mb-2">준비 중입니다</p>
            <p className="text-sm">관리자 페이지에서 기도문을 입력해 주세요.</p>
          </div>
        )}
      </div>
    </SectionLayout>
    </>
  );
}
