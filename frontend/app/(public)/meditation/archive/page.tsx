import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import PageHeader from "@/components/PageHeader";
import { fetchParishMin } from "@/lib/parish";
import MeditationArchiveList from "./MeditationArchiveList";

export async function generateMetadata(): Promise<Metadata> {
  const p = await fetchParishMin();
  return { title: "묵상 아카이브", description: `${p.name} 묵상 아카이브` };
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const PAGE_SIZE = 12;

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

async function getMeditations(page: number, q: string): Promise<MeditationListOut> {
  try {
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (q) params.set("q", q);
    const res = await fetch(`${API}/api/content/meditations?${params}`, {
      cache: "no-store",
    });
    if (!res.ok) return { items: [], total: 0 };
    return res.json();
  } catch {
    return { items: [], total: 0 };
  }
}

/** 압축 페이지네이션: 양끝 + 현재±1 만 노출, 사이는 ... */
function compressedRange(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set<number>([1, total, current - 1, current, current + 1]);
  const nums = Array.from(set).filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const result: (number | "…")[] = [];
  let prev = 0;
  for (const n of nums) {
    if (prev && n - prev > 1) result.push("…");
    result.push(n);
    prev = n;
  }
  return result;
}

function pageHref(page: number, q: string): string {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (q) params.set("q", q);
  const qs = params.toString();
  return qs ? `/meditation/archive?${qs}` : "/meditation/archive";
}

export default async function MeditationArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1") || 1);
  const q = (sp.q ?? "").trim();
  const { items, total } = await getMeditations(page, q);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showLatestBadge = page === 1 && !q;

  return (
    <>
      <PageHeader
        group="말씀과 기도"
        title="묵상 아카이브"
        subtitle="지나온 묵상 글을 모아두었습니다"
      />
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* 검색 + 카운트 + 오늘 묵상 링크 */}
        <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <form
            action="/meditation/archive"
            method="get"
            className="flex items-center gap-2 flex-1 max-w-sm"
            role="search"
            aria-label="묵상 검색"
          >
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="제목·본문·말씀·필자 검색"
              className="flex-1 min-w-0 border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--color-primary)]"
            />
            {q && (
              <Link
                href="/meditation/archive"
                className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] whitespace-nowrap"
              >
                지우기
              </Link>
            )}
            <button
              type="submit"
              className="text-xs bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors"
            >
              검색
            </button>
          </form>
          <Link
            href="/meditation"
            className="text-xs text-[var(--color-primary)] hover:underline whitespace-nowrap"
          >
            ← 현재 묵상으로
          </Link>
        </div>

        {/* 검색 결과 안내 */}
        {q && (
          <p className="text-sm text-[var(--color-text-muted)] mb-3">
            <span className="text-[var(--color-primary)] font-medium">&quot;{q}&quot;</span>{" "}
            검색 결과 {total}편
          </p>
        )}
        {!q && (
          <p className="text-sm text-[var(--color-text-muted)] mb-3">총 {total}편</p>
        )}

        {items.length === 0 ? (
          <div className="text-center py-20 text-[var(--color-text-muted)]">
            <p className="text-lg font-serif text-[var(--color-primary)] mb-2">
              {q ? "검색 결과가 없습니다" : "아직 묵상 글이 없습니다"}
            </p>
            {q && (
              <p className="text-sm">다른 단어로 검색해 보세요.</p>
            )}
          </div>
        ) : (
          <Suspense fallback={<div className="text-sm text-[var(--color-text-muted)]">불러오는 중…</div>}>
            <MeditationArchiveList items={items} showLatestBadge={showLatestBadge} />
          </Suspense>
        )}

        {/* 압축 페이지네이션 */}
        {totalPages > 1 && (
          <nav className="flex justify-center items-center gap-1 mt-8" aria-label="페이지 이동">
            {page > 1 && (
              <Link
                href={pageHref(page - 1, q)}
                className="px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-lg hover:bg-gray-50 transition-colors"
                aria-label="이전 페이지"
              >
                ←
              </Link>
            )}
            {compressedRange(page, totalPages).map((p, idx) =>
              p === "…" ? (
                <span
                  key={`gap-${idx}`}
                  className="px-2 text-sm text-[var(--color-text-muted)] select-none"
                  aria-hidden
                >
                  …
                </span>
              ) : (
                <Link
                  key={p}
                  href={pageHref(p, q)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    p === page
                      ? "bg-[var(--color-primary)] text-white"
                      : "border border-[var(--color-border)] hover:bg-gray-50"
                  }`}
                  aria-current={p === page ? "page" : undefined}
                >
                  {p}
                </Link>
              ),
            )}
            {page < totalPages && (
              <Link
                href={pageHref(page + 1, q)}
                className="px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-lg hover:bg-gray-50 transition-colors"
                aria-label="다음 페이지"
              >
                →
              </Link>
            )}
          </nav>
        )}
      </div>
    </>
  );
}
