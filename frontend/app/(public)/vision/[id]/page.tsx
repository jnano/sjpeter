import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";
import MarkdownContent from "@/components/MarkdownContent";

export const dynamic = "force-dynamic";

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL;

interface VisionOut {
  id: number;
  year: number;
  motto: string;
  body: string | null;
  is_current: boolean;
}

async function getAllVisions(): Promise<VisionOut[]> {
  try {
    const res = await fetch(`${API}/api/content/visions`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params;
  const visions = await getAllVisions();
  const v = visions.find((x) => String(x.id) === id);
  if (!v) return { title: "사목지표" };
  return { title: `${v.year}년 사목지표 — ${v.motto}` };
}

export default async function VisionDetailPage(
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const visions = await getAllVisions();
  const sorted = [...visions].sort((a, b) => b.year - a.year || b.id - a.id);
  const v = sorted.find((x) => String(x.id) === id);
  if (!v) notFound();
  const idx = sorted.findIndex((x) => x.id === v.id);
  const prev = sorted[idx + 1]; // 더 오래된 항목
  const next = sorted[idx - 1]; // 더 최근 항목

  return (
    <>
      <PageHeader group="본당 공동체" title={`${v.year}년 사목지표`} subtitle={v.motto} />
      <SectionLayout group="community">
        <div className="mb-4 flex items-center justify-between gap-2 flex-wrap">
          <Link href="/vision" className="text-sm text-[var(--color-primary)] hover:underline">
            ← 역대 사목지표 목록
          </Link>
          {sorted[0]?.id === v.id && (
            <span className="text-xs bg-[var(--color-primary)] text-white px-2 py-0.5 rounded-full">올해</span>
          )}
        </div>

        <article className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 md:p-10 mb-6">
          <p className="text-xs text-[var(--color-text-muted)] tracking-widest uppercase mb-2">
            {v.year}
          </p>
          <h1 className="font-serif text-2xl md:text-3xl font-bold text-[var(--color-primary)] mb-6">
            &ldquo;{v.motto}&rdquo;
          </h1>
          {v.body ? (
            <MarkdownContent content={v.body} />
          ) : (
            <p className="text-sm text-[var(--color-text-muted)] italic">
              본문이 등록되지 않았습니다.
            </p>
          )}
        </article>

        {/* 이전·다음 사목지표 네비 */}
        <nav className="flex gap-3 justify-between text-sm">
          {prev ? (
            <Link
              href={`/vision/${prev.id}`}
              className="flex-1 max-w-[48%] block border border-[var(--color-border)] rounded-lg px-4 py-3 hover:border-[var(--color-primary)] transition-colors"
            >
              <p className="text-xs text-[var(--color-text-muted)]">← {prev.year}년</p>
              <p className="font-serif truncate">&ldquo;{prev.motto}&rdquo;</p>
            </Link>
          ) : <span className="flex-1 max-w-[48%]" />}
          {next ? (
            <Link
              href={`/vision/${next.id}`}
              className="flex-1 max-w-[48%] block border border-[var(--color-border)] rounded-lg px-4 py-3 text-right hover:border-[var(--color-primary)] transition-colors"
            >
              <p className="text-xs text-[var(--color-text-muted)]">{next.year}년 →</p>
              <p className="font-serif truncate">&ldquo;{next.motto}&rdquo;</p>
            </Link>
          ) : <span className="flex-1 max-w-[48%]" />}
        </nav>
      </SectionLayout>
    </>
  );
}
