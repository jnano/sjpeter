import Link from "next/link";
import SearchHero from "./SearchHero";

const API = process.env.NEXT_PUBLIC_API_URL;
const LIMIT = 10;
const POPULAR_LIMIT = 5;

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
              기도문·묵상·공지·주보·행사·본당 가족·게시판 글을 한 번에 검색합니다.
            </p>
            <div className="mb-8">
              <SearchHero initialQ="" />
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

  const [data, popular] = await Promise.all([fetchSearch(q, page), popularPromise]);
  const totalPages = Math.ceil(data.total / LIMIT);

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-8">
        <div className="min-w-0">
          <div className="mb-6">
            <SearchHero initialQ={q} />
          </div>
          <p className="text-sm text-[var(--color-text-muted)] mb-6">
            <span className="font-medium text-[var(--color-primary)]">&ldquo;{q}&rdquo;</span>
            {" "}검색 결과{" "}
            {page === 1
              ? `${(data.total + data.content_results.length).toLocaleString()}건`
              : `${data.total.toLocaleString()}건`}
          </p>

          {data.content_results.length === 0 && data.results.length === 0 ? (
            <div className="text-center py-16 text-[var(--color-text-muted)]">
              <p className="text-4xl mb-4">🔍</p>
              <p>검색 결과가 없습니다.</p>
              <p className="text-sm mt-1">다른 검색어로 시도해 보세요.</p>
            </div>
          ) : (
            <>
              {/* 페이지 콘텐츠 결과 (page 1에만 표시) */}
              {page === 1 && data.content_results.length > 0 && (
                <section className="mb-6">
                  <h2 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3 px-1">
                    페이지 콘텐츠
                  </h2>
                  <ul className="divide-y divide-[var(--color-border)] border border-[var(--color-border)] rounded-xl overflow-hidden">
                    {data.content_results.map((item, i) => (
                      <li key={i}>
                        <Link
                          href={item.url}
                          className="group flex items-start gap-4 px-5 py-4 hover:bg-[var(--color-surface-warm)] transition-colors"
                        >
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-medium shrink-0 mt-0.5">
                            {item.label}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors mb-0.5">
                              <HighlightText text={item.title} keyword={q} />
                            </p>
                            {item.excerpt && (
                              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed line-clamp-1">
                                <HighlightText text={item.excerpt} keyword={q} />
                              </p>
                            )}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* 게시글 결과 */}
              {data.results.length > 0 && (
                <section>
                  {page === 1 && data.content_results.length > 0 && (
                    <h2 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3 px-1">
                      게시판 게시글
                    </h2>
                  )}
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
