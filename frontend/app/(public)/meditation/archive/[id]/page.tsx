import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";
import {
  MeditationCard,
  type MeditationContent,
} from "@/components/MeditationCard";
import { fetchParishMin } from "@/lib/parish";

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface NeighborItem {
  id: number;
  title: string;
}

interface NeighborsOut {
  prev: NeighborItem | null;
  next: NeighborItem | null;
}

async function getMeditation(id: number): Promise<MeditationContent | null> {
  try {
    const res = await fetch(`${API}/api/content/meditations/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getNeighbors(id: number): Promise<NeighborsOut> {
  try {
    const res = await fetch(`${API}/api/content/meditations/${id}/neighbors`, {
      cache: "no-store",
    });
    if (!res.ok) return { prev: null, next: null };
    return res.json();
  } catch {
    return { prev: null, next: null };
  }
}

function excerpt(body: string, len = 120) {
  const clean = body.replace(/\n+/g, " ").trim();
  return clean.length > len ? clean.slice(0, len) + "…" : clean;
}

function absoluteImageUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API}${path}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isFinite(numId) || numId <= 0) {
    return { title: "묵상 아카이브" };
  }
  const [p, m] = await Promise.all([
    fetchParishMin(),
    getMeditation(numId),
  ]);
  if (!m) {
    return {
      title: "묵상 아카이브",
      description: `${p.name} 묵상 아카이브`,
    };
  }
  const description = excerpt(m.body, 120);
  const ogImage = absoluteImageUrl(m.background_image_url);
  return {
    title: `${m.title} — 묵상 아카이브`,
    description,
    openGraph: {
      title: m.title,
      description,
      type: "article",
      publishedTime: m.published_date,
      authors: m.author ? [m.author] : undefined,
      images: ogImage ? [{ url: ogImage }] : undefined,
      siteName: p.name,
    },
  };
}

function DetailFooter({
  currentId,
  neighbors,
}: {
  currentId: number;
  neighbors: NeighborsOut;
}) {
  const { prev, next } = neighbors;
  return (
    <div className="space-y-4">
      {(prev || next) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {prev ? (
            <Link
              href={`/meditation/archive/${prev.id}`}
              className="group block border border-[var(--color-border)] rounded-lg p-3 hover:border-[var(--color-primary)]/30 hover:bg-[var(--color-surface-warm)] transition-colors"
            >
              <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest mb-1">
                ← 최근 묵상
              </p>
              <p className="text-sm font-serif text-[var(--color-text)] line-clamp-2 group-hover:text-[var(--color-primary)] transition-colors">
                {prev.title}
              </p>
            </Link>
          ) : (
            <div aria-hidden className="hidden sm:block" />
          )}
          {next ? (
            <Link
              href={`/meditation/archive/${next.id}`}
              className="group block border border-[var(--color-border)] rounded-lg p-3 hover:border-[var(--color-primary)]/30 hover:bg-[var(--color-surface-warm)] transition-colors sm:text-right"
            >
              <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest mb-1">
                지난 묵상 →
              </p>
              <p className="text-sm font-serif text-[var(--color-text)] line-clamp-2 group-hover:text-[var(--color-primary)] transition-colors">
                {next.title}
              </p>
            </Link>
          ) : (
            <div aria-hidden className="hidden sm:block" />
          )}
        </div>
      )}

      <div className="flex justify-between items-center pt-3 border-t border-[var(--color-border)]/60">
        <Link
          href={`/meditation/archive?focus=${currentId}`}
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
        >
          ← 아카이브 목록
        </Link>
        <Link
          href="/meditation"
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
        >
          오늘의 묵상 →
        </Link>
      </div>
    </div>
  );
}

export default async function MeditationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isFinite(numId) || numId <= 0) notFound();

  const [meditation, neighbors] = await Promise.all([
    getMeditation(numId),
    getNeighbors(numId),
  ]);
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
            href={`/meditation/archive?focus=${numId}`}
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
          >
            ← 아카이브 목록
          </Link>
        </div>

        <MeditationCard
          meditation={meditation}
          footer={<DetailFooter currentId={numId} neighbors={neighbors} />}
        />
      </SectionLayout>
    </>
  );
}
