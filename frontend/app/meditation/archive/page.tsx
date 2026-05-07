import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "묵상 아카이브",
  description: "세종성베드로성당 묵상 아카이브",
};

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Meditation {
  id: number;
  title: string;
  scripture: string | null;
  body: string;
  author: string | null;
  published_date: string;
}

interface MeditationListOut {
  items: Meditation[];
  total: number;
}

async function getMeditations(page: number): Promise<MeditationListOut> {
  try {
    const res = await fetch(`${API}/api/content/meditations?page=${page}&limit=12`, {
      next: { revalidate: 1800 },
    });
    if (!res.ok) return { items: [], total: 0 };
    return res.json();
  } catch {
    return { items: [], total: 0 };
  }
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

function excerpt(body: string, len = 80) {
  const clean = body.replace(/\n+/g, " ").trim();
  return clean.length > len ? clean.slice(0, len) + "…" : clean;
}

export default async function MeditationArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? "1") || 1);
  const { items, total } = await getMeditations(page);
  const totalPages = Math.ceil(total / 12);

  return (
    <>
      <PageHeader
        group="말씀과 기도"
        title="묵상 아카이브"
        subtitle="지나온 묵상 글을 모아두었습니다"
      />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-[var(--color-text-muted)]">총 {total}편</p>
          <Link
            href="/meditation"
            className="text-xs text-[var(--color-primary)] hover:underline"
          >
            ← 현재 묵상으로
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-20 text-[var(--color-text-muted)]">
            <p className="text-lg font-serif text-[var(--color-primary)] mb-2">아직 묵상 글이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, idx) => {
              const isLatest = page === 1 && idx === 0;
              return (
                <div
                  key={item.id}
                  className={`bg-[var(--color-surface)] border rounded-xl p-6 ${
                    isLatest
                      ? "border-[var(--color-primary)]/30 bg-[var(--color-primary)]/[0.02]"
                      : "border-[var(--color-border)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      {item.scripture && (
                        <p className="text-[10px] font-medium text-[var(--color-accent)] uppercase tracking-widest mb-1">
                          {item.scripture}
                        </p>
                      )}
                      <h3 className="font-serif font-semibold text-[var(--color-text)] text-base leading-snug mb-1">
                        {isLatest && (
                          <span className="inline-block text-[10px] font-sans font-medium bg-[var(--color-primary)] text-white px-1.5 py-0.5 rounded mr-2 align-middle">
                            최신
                          </span>
                        )}
                        {item.title}
                      </h3>
                      <p className="text-xs text-[var(--color-text-muted)] leading-relaxed line-clamp-2">
                        {excerpt(item.body)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">
                        {formatDate(item.published_date)}
                      </p>
                      {item.author && (
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{item.author}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-1 mt-8">
            {page > 1 && (
              <Link
                href={`/meditation/archive?page=${page - 1}`}
                className="px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-lg hover:bg-gray-50 transition-colors"
              >
                ←
              </Link>
            )}
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={`/meditation/archive?page=${p}`}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  p === page
                    ? "bg-[var(--color-primary)] text-white"
                    : "border border-[var(--color-border)] hover:bg-gray-50"
                }`}
              >
                {p}
              </Link>
            ))}
            {page < totalPages && (
              <Link
                href={`/meditation/archive?page=${page + 1}`}
                className="px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-lg hover:bg-gray-50 transition-colors"
              >
                →
              </Link>
            )}
          </div>
        )}
      </div>
    </>
  );
}
