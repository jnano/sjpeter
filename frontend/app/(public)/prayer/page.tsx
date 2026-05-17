import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";
import { fetchParishMin } from "@/lib/parish";
import {
  PRAYER_CATEGORIES,
  PRAYER_CATEGORY_LABELS,
  type PrayerCategory,
} from "@/lib/prayer";
import PrayerList from "./PrayerList";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const p = await fetchParishMin();
  return { title: "기도문", description: `${p.name} 기도문 모음` };
}

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const PAGE_SIZE = 20;

interface Prayer {
  id: number;
  title: string;
  category: string;
  scripture: string | null;
  body: string;
  author: string | null;
  is_featured: boolean;
}

interface PrayerListOut {
  items: Prayer[];
  total: number;
}

async function getPrayers(params: URLSearchParams): Promise<PrayerListOut> {
  try {
    const res = await fetch(`${API}/api/content/prayers?${params}`, {
      cache: "no-store",
    });
    if (!res.ok) return { items: [], total: 0 };
    return res.json();
  } catch {
    return { items: [], total: 0 };
  }
}

function compressedRange(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set<number>([1, total, current - 1, current, current + 1]);
  const nums = Array.from(set).filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  let prev = 0;
  for (const n of nums) {
    if (prev && n - prev > 1) out.push("…");
    out.push(n);
    prev = n;
  }
  return out;
}

function pageHref(page: number, q: string, category: string): string {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (q) params.set("q", q);
  if (category) params.set("category", category);
  const qs = params.toString();
  return qs ? `/prayer?${qs}` : "/prayer";
}

export default async function PrayerPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; category?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1") || 1);
  const q = (sp.q ?? "").trim();
  const categoryRaw = (sp.category ?? "").trim();
  const category: PrayerCategory | "" = (PRAYER_CATEGORIES as readonly string[]).includes(
    categoryRaw,
  )
    ? (categoryRaw as PrayerCategory)
    : "";

  const params = new URLSearchParams({
    page: String(page),
    limit: String(PAGE_SIZE),
  });
  if (q) params.set("q", q);
  if (category) params.set("category", category);

  const { items, total } = await getPrayers(params);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        group="말씀과 기도"
        title="기도문"
        subtitle="함께 바치는 가톨릭 기도"
      />
      <SectionLayout group="word">
        {/* 카테고리 칩 */}
        <nav className="mb-4 flex flex-wrap gap-1.5" aria-label="카테고리 필터">
          <Link
            href={pageHref(1, q, "")}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              !category
                ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                : "border-[var(--color-border)] hover:bg-[var(--color-surface-warm)]"
            }`}
          >
            전체
          </Link>
          {PRAYER_CATEGORIES.map((c) => (
            <Link
              key={c}
              href={pageHref(1, q, c)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                category === c
                  ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                  : "border-[var(--color-border)] hover:bg-[var(--color-surface-warm)]"
              }`}
            >
              {PRAYER_CATEGORY_LABELS[c]}
            </Link>
          ))}
        </nav>

        {/* 검색 */}
        <form
          action="/prayer"
          method="get"
          className="mb-4 flex items-center gap-2 max-w-sm"
          role="search"
          aria-label="기도문 검색"
        >
          {category && <input type="hidden" name="category" value={category} />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="제목·본문·말씀·필자 검색"
            className="flex-1 min-w-0 border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--color-primary)]"
          />
          {q && (
            <Link
              href={pageHref(1, "", category)}
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

        {/* 카운트 */}
        <p className="text-sm text-[var(--color-text-muted)] mb-3">
          {q && (
            <>
              <span className="text-[var(--color-primary)] font-medium">&quot;{q}&quot;</span>{" "}
            </>
          )}
          {category && (
            <span className="text-[var(--color-primary)] font-medium">
              {PRAYER_CATEGORY_LABELS[category]}{" "}
            </span>
          )}
          {q || category ? "결과 " : "총 "}
          {total}편
        </p>

        {items.length === 0 ? (
          <div className="text-center py-20 text-[var(--color-text-muted)]">
            <div className="text-5xl mb-4">✝</div>
            <p className="font-serif text-lg text-[var(--color-primary)] mb-2">
              {q || category ? "결과가 없습니다" : "준비 중입니다"}
            </p>
            {!q && !category && (
              <p className="text-sm">관리자가 기도문을 등록하면 여기에 노출됩니다.</p>
            )}
          </div>
        ) : (
          <PrayerList items={items} />
        )}

        {/* 압축 페이지네이션 */}
        {totalPages > 1 && (
          <nav className="flex justify-center items-center gap-1 mt-8" aria-label="페이지 이동">
            {page > 1 && (
              <Link
                href={pageHref(page - 1, q, category)}
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
                  href={pageHref(p, q, category)}
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
                href={pageHref(page + 1, q, category)}
                className="px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-lg hover:bg-gray-50 transition-colors"
                aria-label="다음 페이지"
              >
                →
              </Link>
            )}
          </nav>
        )}
      </SectionLayout>
    </>
  );
}
