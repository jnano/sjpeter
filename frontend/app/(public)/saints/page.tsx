import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";
import CrossIcon from "@/components/icons/CrossIcon";
import { fetchParishMin } from "@/lib/parish";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const p = await fetchParishMin();
  return {
    title: "세례명·축일 사전",
    description: `${p.name} 세례명 축일 조회`,
  };
}

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const PAGE_SIZE = 30;

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

interface Saint {
  id: number;
  korean_name: string;
  latin_name: string | null;
  feast_month: number;
  feast_day: number;
  title: string | null;
  bio_short: string | null;
  patronage: string | null;
  popularity: number;
}

const SORT_OPTIONS = ["popular", "name", "feast"] as const;
type SortOption = (typeof SORT_OPTIONS)[number];
const SORT_LABEL: Record<SortOption, string> = {
  popular: "인기순",
  name: "이름순",
  feast: "축일순",
};

interface SaintListOut {
  items: Saint[];
  total: number;
  page: number;
  limit: number;
}

async function getSaints(params: URLSearchParams): Promise<SaintListOut> {
  try {
    const res = await fetch(`${API}/api/saints/?${params}`, { cache: "no-store" });
    if (!res.ok) return { items: [], total: 0, page: 1, limit: PAGE_SIZE };
    return res.json();
  } catch {
    return { items: [], total: 0, page: 1, limit: PAGE_SIZE };
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

function pageHref(page: number, q: string, month: string, sort: SortOption): string {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (q) params.set("q", q);
  if (month) params.set("month", month);
  if (sort !== "popular") params.set("sort", sort);
  const qs = params.toString();
  return qs ? `/saints?${qs}` : "/saints";
}

function formatFeast(m: number, d: number): string {
  return `${m}월 ${d}일`;
}

export default async function SaintsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; month?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1") || 1);
  const q = (sp.q ?? "").trim();
  const monthNum = parseInt(sp.month ?? "");
  const month = Number.isFinite(monthNum) && monthNum >= 1 && monthNum <= 12 ? String(monthNum) : "";
  const sortRaw = (sp.sort ?? "popular") as SortOption;
  const sort: SortOption = (SORT_OPTIONS as readonly string[]).includes(sortRaw) ? sortRaw : "popular";

  const params = new URLSearchParams({
    page: String(page),
    limit: String(PAGE_SIZE),
    sort,
  });
  if (q) params.set("q", q);
  if (month) params.set("month", month);

  const { items, total } = await getSaints(params);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        group="말씀과 기도"
        title="세례명·축일 사전"
        subtitle="세례명으로 축일과 라틴 원어명을 찾아보세요"
      />
      <SectionLayout group="word">
        {/* 정렬 토글 */}
        <div className="mb-3 flex items-center gap-2 text-xs">
          <span className="text-[var(--color-text-muted)]">정렬</span>
          {SORT_OPTIONS.map((s) => (
            <Link
              key={s}
              href={pageHref(1, q, month, s)}
              className={`px-2.5 py-1 rounded-full border transition-colors ${
                sort === s
                  ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                  : "border-[var(--color-border)] hover:bg-[var(--color-surface-warm)]"
              }`}
            >
              {SORT_LABEL[s]}
            </Link>
          ))}
        </div>

        {/* 월 필터 칩 */}
        <nav className="mb-4 flex flex-wrap gap-1.5" aria-label="축일 월 필터">
          <Link
            href={pageHref(1, q, "", sort)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              !month
                ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                : "border-[var(--color-border)] hover:bg-[var(--color-surface-warm)]"
            }`}
          >
            전체
          </Link>
          {MONTHS.map((m) => (
            <Link
              key={m}
              href={pageHref(1, q, String(m), sort)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                month === String(m)
                  ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                  : "border-[var(--color-border)] hover:bg-[var(--color-surface-warm)]"
              }`}
            >
              {m}월
            </Link>
          ))}
        </nav>

        {/* 검색 */}
        <form
          action="/saints"
          method="get"
          className="mb-4 flex items-center gap-2 max-w-sm"
          role="search"
          aria-label="세례명 검색"
        >
          {month && <input type="hidden" name="month" value={month} />}
          {sort !== "popular" && <input type="hidden" name="sort" value={sort} />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="세례명 또는 라틴명 (예: 베드로, Peter)"
            className="flex-1 min-w-0 border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--color-primary)]"
          />
          {q && (
            <Link
              href={pageHref(1, "", month, sort)}
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
          {month && (
            <span className="text-[var(--color-primary)] font-medium">{month}월 </span>
          )}
          {q || month ? "결과 " : "총 "}
          {total}명
        </p>

        {items.length === 0 ? (
          <div className="text-center py-20 text-[var(--color-text-muted)]">
            <div className="text-5xl mb-4"><CrossIcon /></div>
            <p className="font-serif text-lg text-[var(--color-primary)] mb-2">
              결과가 없습니다
            </p>
            <p className="text-sm">다른 검색어 또는 다른 월을 선택해 보세요.</p>
          </div>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((s) => (
              <li
                key={s.id}
                className="border border-[var(--color-border)] rounded-lg px-4 py-3 bg-white hover:border-[var(--color-primary)] transition-colors"
              >
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <h3 className="font-serif text-lg text-[var(--color-primary)] leading-tight flex items-center gap-1.5">
                    {s.korean_name}
                    {s.popularity >= 80 && (
                      <span
                        title="대표 성인"
                        aria-label="대표 성인"
                        className="text-amber-500 text-sm"
                      >
                        ★
                      </span>
                    )}
                  </h3>
                  <span className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">
                    {formatFeast(s.feast_month, s.feast_day)}
                  </span>
                </div>
                {s.latin_name && (
                  <p className="text-xs text-[var(--color-text-muted)] italic mb-1">
                    {s.latin_name}
                  </p>
                )}
                {s.title && (
                  <p className="text-xs text-[var(--color-text)]">{s.title}</p>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* 압축 페이지네이션 */}
        {totalPages > 1 && (
          <nav className="flex justify-center items-center gap-1 mt-8" aria-label="페이지 이동">
            {page > 1 && (
              <Link
                href={pageHref(page - 1, q, month, sort)}
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
                  href={pageHref(p, q, month, sort)}
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
                href={pageHref(page + 1, q, month, sort)}
                className="px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-lg hover:bg-gray-50 transition-colors"
                aria-label="다음 페이지"
              >
                →
              </Link>
            )}
          </nav>
        )}

        {/* 출처 표기 */}
        <p className="mt-10 text-xs text-[var(--color-text-muted)] text-center">
          데이터: 한국 천주교 보편 전례력 사실(이름·축일·신분) — 가톨릭교리통신교육회(CDCC) 자료 참고
        </p>
      </SectionLayout>
    </>
  );
}
