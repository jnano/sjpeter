import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";
import {
  MeditationCard,
  ArchiveDetailFooter,
  type MeditationContent,
} from "@/components/MeditationCard";
import { fetchParishMin } from "@/lib/parish";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function getMeditation(id: number): Promise<MeditationContent | null> {
  try {
    const res = await fetch(`${API}/api/content/meditations/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const [p, m] = await Promise.all([
    fetchParishMin(),
    getMeditation(Number(id)),
  ]);
  return {
    title: m ? `${m.title} — 묵상 아카이브` : "묵상 아카이브",
    description: m ? `${p.name} 묵상 글` : `${p.name} 묵상 아카이브`,
  };
}

export default async function MeditationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isFinite(numId) || numId <= 0) notFound();

  const meditation = await getMeditation(numId);
  if (!meditation) notFound();

  return (
    <>
      <PageHeader
        group="말씀과 기도"
        title="묵상 아카이브"
        subtitle="지난 묵상 글"
      />
      <SectionLayout group="word">
        <div className="mb-4">
          <Link
            href="/meditation/archive"
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
          >
            ← 아카이브 목록
          </Link>
        </div>

        <MeditationCard meditation={meditation} footer={<ArchiveDetailFooter />} />
      </SectionLayout>
    </>
  );
}
