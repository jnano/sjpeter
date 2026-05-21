import Link from "next/link";
import SearchHero from "@/components/SearchHero";
import { buildMassRows, type MassEntry } from "@/lib/mass";

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL;
const LIMIT = 10;
const POPULAR_LIMIT = 5;

// 검색 폼이 비어있을 때 회전하며 검색 유도하는 placeholder 문구
const ROTATING_PLACEHOLDERS = ["오늘 미사시간은?", "오늘 복음 말씀은?", "주일 묵상글"];

// "미사" 인텐트 트리거. 본당 사이트 맥락에서 "미사"는 사실상 전례 의미만 통용.
function isMassIntent(q: string): boolean {
  return q.includes("미사");
}

interface ParishMass {
  name: string;
  mass_schedule: { entries: MassEntry[]; note: string } | null;
}

async function fetchParishForMass(): Promise<ParishMass | null> {
  try {
    const r = await fetch(`${API}/api/parish/`, { cache: "no-store" });
    if (!r.ok) return null;
    return r.json();
  } catch {
    return null;
  }
}

interface Author {
  id: number;
  nickname: string;
  avatar_url?: string | null;
}

interface BoardInfo {
  id: number;
  name: string;
  slug: string;
}

interface PostResult {
  id: number;
  title: string;
  excerpt: string;
  view_count: number;
  created_at: string;
  comment_count: number;
  board: BoardInfo;
  member: Author | null;
}

interface ContentResult {
  type: string;
  label: string;
  title: string;
  excerpt: string;
  url: string;
}

interface SearchOut {
  results: PostResult[];
  content_results: ContentResult[];
  total: number;
  page: number;
  limit: number;
}

interface PopularItem { term: string; count: number; }

async function fetchSearch(q: string, page: number): Promise<SearchOut> {
  const res = await fetch(
    `${API}/api/search?q=${encodeURIComponent(q)}&page=${page}&limit=${LIMIT}`,
    { cache: "no-store" }
  );
  if (!res.ok) return { results: [], content_results: [], total: 0, page, limit: LIMIT };
  return res.json();
}

async function fetchPopular(): Promise<PopularItem[]> {
  try {
    const res = await fetch(`${API}/api/search/popular?limit=${POPULAR_LIMIT}`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.items ?? [];
  } catch {
    return [];
  }
}

async function fetchRecommended(): Promise<string[]> {
  try {
    const res = await fetch(`${API}/api/search/recommended`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return data.items ?? [];
  } catch {
    return [];
  }
}

function PopularCard({ items }: { items: PopularItem[] }) {
  if (items.length === 0) {
    return (
      <aside className="self-start md:sticky md:top-28 bg-white border border-[var(--color-border)] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[var(--color-text)] mb-3 flex items-center gap-1.5">
          <span aria-hidden>🔥</span> 인기 검색어
        </h2>
        <p className="text-xs text-[var(--color-text-muted)]">
          아직 집계된 검색어가 없습니다.
        </p>
      </aside>
    );
  }
  return (
    <aside className="self-start md:sticky md:top-28 bg-white border border-[var(--color-border)] rounded-xl p-5">
      <h2 className="text-sm font-semibold text-[var(--color-text)] mb-3 flex items-center gap-1.5">
        <span aria-hidden>🔥</span> 인기 검색어
      </h2>
      <ol className="space-y-1.5">
        {items.map((it, i) => (
          <li key={it.term}>
            <Link
              href={`/search?q=${encodeURIComponent(it.term)}`}
              className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-[var(--color-surface-warm)] transition-colors group"
            >
              <span
                className={`w-5 text-center text-sm font-bold ${
                  i < 3 ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"
                }`}
              >
                {i + 1}
              </span>
              <span className="text-sm text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors flex-1 min-w-0 truncate">
                {it.term}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </aside>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q: qParam = "", page: pageParam = "1" } = await searchParams;
  const q = qParam.trim();
  const page = Math.max(1, parseInt(pageParam, 10));

  // 사이드 카드 데이터는 어느 상태에서나 항상 노출
  const popularPromise = fetchPopular();

  // ── 빈 검색 상태: hero + 추천 검색어 칩 (왼쪽) + 인기 검색어 (오른쪽) ──
  if (!q) {
    const [popular, recommended] = await Promise.all([popularPromise, fetchRecommended()]);
    return (
      <main className="max-w-6xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-8">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[var(--color-text)] mb-2">
              무엇을 찾고 계신가요?
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] mb-6">
              기도문·묵상·공지·주보·행사·사목자·게시판 글을 한 번에 검색합니다.
            </p>
            <div className="mb-8">
              <SearchHero initialQ="" rotatingPlaceholders={ROTATING_PLACEHOLDERS} />
            </div>
            {recommended.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3 px-1">
                  추천 검색어
                </h2>
                <ul className="flex flex-wrap gap-2">
                  {recommended.map((kw) => (
                    <li key={kw}>
                      <Link
                        href={`/search?q=${encodeURIComponent(kw)}`}
                        className="inline-flex items-center px-3 py-1.5 rounded-full border border-[var(--color-border)] text-sm text-[var(--color-text)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface-warm)] transition-colors"
                      >
                        {kw}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
          <PopularCard items={popular} />
        </div>
      </main>
    );
  }

  // 미사 인텐트면 본당 정보까지 병렬로 fetch — 검색 결과 상단에 미사 시간표 카드 노출
  const massIntent = isMassIntent(q);
  const [data, popular, parishMass] = await Promise.all([
    fetchSearch(q, page),
    popularPromise,
    massIntent ? fetchParishForMass() : Promise.resolve(null),
  ]);
  const totalPages = Math.ceil(data.total / LIMIT);
  const massRows = parishMass?.mass_schedule?.entries
    ? buildMassRows(parishMass.mass_schedule.entries)
    : [];

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-8">
        <div className="min-w-0">
          {/* 검색 전과 동일한 헤더 유지 — 일관된 진입 경험 */}
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[var(--color-text)] mb-2">
            무엇을 찾고 계신가요?
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mb-6">
            기도문·묵상·공지·주보·행사·사목자·게시판 글을 한 번에 검색합니다.
          </p>
          <div className="mb-6">
            <SearchHero initialQ={q} rotatingPlaceholders={ROTATING_PLACEHOLDERS} />
          </div>
          <p className="text-sm text-[var(--color-text-muted)] mb-6">
            <span className="font-medium text-[var(--color-primary)]">&ldquo;{q}&rdquo;</span>
            {" "}검색 결과{" "}
            {`${data.total.toLocaleString()}건`}
          </p>

          {/* 미사 인텐트 카드 — "미사" 키워드 검색 시 본당 미사 시간표를 결과 상단에 노출 */}
          {massIntent && massRows.length > 0 && (
            <section className="mb-6 border border-[var(--color-primary)]/30 bg-[var(--color-surface-warm)] rounded-xl p-5">
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-[var(--color-border)]">
                <h2 className="font-serif font-bold text-[var(--color-primary)] text-base flex items-center gap-2">
                  <span className="text-[var(--color-accent)]">⏰</span>
                  미사 시간
                </h2>
                <Link
                  href="/info"
                  className="text-xs text-[var(--color-primary)] font-medium hover:underline"
                >
                  찾아오시는 길 →
                </Link>
              </div>
              <table className="text-sm w-full">
                <tbody>
                  {massRows.map((row) => (
                    <tr key={row.label} className="align-top">
                      <td className="text-[var(--color-text-muted)] pr-3 pb-1.5 whitespace-nowrap w-12 font-medium">
                        {row.label}
                      </td>
                      <td className="pb-1.5 text-[var(--color-text)] leading-relaxed">
                        {row.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parishMass?.mass_schedule?.note && (
                <p className="text-xs text-[var(--color-text-muted)] mt-2 leading-relaxed">
                  ※ {parishMass.mass_schedule.note}
                </p>
              )}
            </section>
          )}

          {data.results.length === 0 ? (
            <div className="text-center py-16 text-[var(--color-text-muted)]">
              <p className="text-4xl mb-4">🔍</p>
              <p>검색 결과가 없습니다.</p>
              <p className="text-sm mt-1">다른 검색어로 시도해 보세요.</p>
            </div>
          ) : (
            <>
              {/* 게시글 결과 */}
              {data.results.length > 0 && (
                <section>
                  <ul className="divide-y divide-[var(--color-border)]">
                    {data.results.map((item) => (
                      <li key={item.id} className="py-5">
                        <Link
                          href={`/boards/${item.board.slug}/${item.id}`}
                          className="group block"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-medium">
                              {item.board.name}
                            </span>
                          </div>
                          <h2 className="text-base font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors mb-1">
                            <HighlightText text={item.title} keyword={q} />
                          </h2>
                          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed line-clamp-2">
                            <HighlightText text={item.excerpt} keyword={q} />
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-[var(--color-text-muted)]">
                            {item.member && <span>{item.member.nickname}</span>}
                            <span>
                              {new Date(item.created_at).toLocaleDateString("ko-KR", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })}
                            </span>
                            <span>조회 {item.view_count}</span>
                            {item.comment_count > 0 && (
                              <span>댓글 {item.comment_count}</span>
                            )}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* 게시글 결과가 없고 콘텐츠만 있는 경우 */}
              {data.results.length === 0 && page > 1 && (
                <p className="text-center py-8 text-[var(--color-text-muted)] text-sm">
                  더 이상 결과가 없습니다.
                </p>
              )}
            </>
          )}

          {totalPages > 1 && (
            <div className="flex justify-center gap-1 mt-8">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={`/search?q=${encodeURIComponent(q)}&page=${p}`}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    p === page
                      ? "bg-[var(--color-primary)] text-white"
                      : "text-[var(--color-text-muted)] hover:bg-gray-100"
                  }`}
                >
                  {p}
                </Link>
              ))}
            </div>
          )}
        </div>
        <PopularCard items={popular} />
      </div>
    </main>
  );
}

function HighlightText({ text, keyword }: { text: string; keyword: string }) {
  if (!keyword) return <>{text}</>;
  const parts = text.split(new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === keyword.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 text-[var(--color-text)] rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
