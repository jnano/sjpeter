import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";
import {
  MeditationCard,
  CurrentMeditationFooter,
  type MeditationContent,
} from "@/components/MeditationCard";
import { fetchParishMin } from "@/lib/parish";

export async function generateMetadata(): Promise<Metadata> {
  const p = await fetchParishMin();
  return { title: "묵상 글", description: `${p.name} 묵상 글` };
}

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function getCurrentMeditation(): Promise<MeditationContent | null> {
  try {
    const res = await fetch(`${API}/api/content/meditations/current`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function MeditationPage() {
  const meditation = await getCurrentMeditation();

  return (
    <>
      <PageHeader
        group="말씀과 기도"
        title="묵상 글"
        subtitle="말씀 앞에 잠시 멈추는 시간"
      />
      <SectionLayout group="word">
        {meditation ? (
          <MeditationCard meditation={meditation} footer={<CurrentMeditationFooter />} />
        ) : (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-8">
            <div className="text-center py-16 text-[var(--color-text-muted)]">
              <div className="text-5xl mb-4">✝</div>
              <p className="font-serif text-lg text-[var(--color-primary)] mb-2">준비 중입니다</p>
              <p className="text-sm">곧 묵상 글이 올라올 예정입니다.</p>
            </div>
          </div>
        )}
      </SectionLayout>
    </>
  );
}
