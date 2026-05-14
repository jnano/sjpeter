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
import { prayerCategoryLabel } from "@/lib/prayer";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface PrayerOut extends MeditationContent {
  category: string;
  display_order: number;
  is_featured: boolean;
}

interface NeighborItem {
  id: number;
  title: string;
}

interface NeighborsOut {
  prev: NeighborItem | null;
  next: NeighborItem | null;
}

async function getPrayer(id: number): Promise<PrayerOut | null> {
  try {
    const res = await fetch(`${API}/api/content/prayers/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getNeighbors(id: number): Promise<NeighborsOut> {
  try {
    const res = await fetch(`${API}/api/content/prayers/${id}/neighbors`, {
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
    return { title: "기도문" };
  }
  const [p, m] = await Promise.all([fetchParishMin(), getPrayer(numId)]);
  if (!m) {
    return { title: "기도문", description: `${p.name} 기도문` };
  }
  const description = excerpt(m.body, 120);
  const ogImage = absoluteImageUrl(m.background_image_url);
  return {
    title: `${m.title} — 기도문`,
    description,
    openGraph: {
      title: m.title,
      description,
      type: "article",
      authors: m.author ? [m.author] : undefined,
      images: ogImage ? [{ url: ogImage }] : undefined,
      siteName: p.name,
    },
  };
}

function DetailFooter({
  currentId,
  neighbors,
  category,
}: {
  currentId: number;
  neighbors: NeighborsOut;
  category: string;
}) {
  const { prev, next } = neighbors;
  // 카테고리가 유지된 archive 링크 — 사용자가 둘러보던 카테고리로 자연 복귀
  const archiveHref = category
    ? `/prayer?focus=${currentId}&category=${encodeURIComponent(category)}`
    : `/prayer?focus=${currentId}`;
  return (
    <div className="space-y-4">
      {(prev || next) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {prev ? (
            <Link
              href={`/prayer/${prev.id}`}
              className="group block border border-[var(--color-border)] rounded-lg p-3 hover:border-[var(--color-primary)]/30 hover:bg-[var(--color-surface-warm)] transition-colors"
            >
              <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest mb-1">
                ← 같은 카테고리 이전
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
              href={`/prayer/${next.id}`}
              className="group block border border-[var(--color-border)] rounded-lg p-3 hover:border-[var(--color-primary)]/30 hover:bg-[var(--color-surface-warm)] transition-colors sm:text-right"
            >
              <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest mb-1">
                같은 카테고리 다음 →
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
          href={archiveHref}
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
        >
          ← 기도문 목록
        </Link>
        {category && (
          <span className="text-[10px] text-[var(--color-text-muted)]">
            {prayerCategoryLabel(category)}
          </span>
        )}
      </div>
    </div>
  );
}

export default async function PrayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isFinite(numId) || numId <= 0) notFound();

  const [prayer, neighbors] = await Promise.all([
    getPrayer(numId),
    getNeighbors(numId),
  ]);
  if (!prayer) notFound();

  // published_date 없음 — MeditationCard가 필요로 하므로 빈 문자열 placeholder.
  // 카드 내부 formatDate가 invalid date를 받으면 NaN 출력하므로 회피용:
  const cardData: MeditationContent = {
    ...prayer,
    published_date: "",  // 표시 안 됨 (아래에서 author와 빈 날짜 모두 카드가 처리)
  };

  return (
    <>
      <PageHeader
        group="말씀과 기도"
        title="기도문"
        subtitle={prayerCategoryLabel(prayer.category) || "함께 바치는 기도"}
      />
      <SectionLayout group="word">
        <div className="mb-4">
          <Link
            href={`/prayer?focus=${numId}${
              prayer.category ? `&category=${encodeURIComponent(prayer.category)}` : ""
            }`}
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
          >
            ← 기도문 목록
          </Link>
        </div>

        <MeditationCard
          meditation={cardData}
          footer={
            <DetailFooter
              currentId={numId}
              neighbors={neighbors}
              category={prayer.category}
            />
          }
        />
      </SectionLayout>
    </>
  );
}
