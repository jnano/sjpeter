import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL;
const LIMIT = 10;

// 빈 검색 상태에서 보여 줄 추천 검색어 (통합 검색으로 라우팅)
const SUGGESTED_KEYWORDS = [
  "성모송",
  "사순",
  "묵주기도",
  "평화",
  "성령",
  "사목지표",
  "성가정",
  "건축",
];

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

async function fetchSearch(q: string, page: number): Promise<SearchOut> {
  const res = await fetch(
    `${API}/api/search?q=${encodeURIComponent(q)}&page=${page}&limit=${LIMIT}`,
    { cache: "no-store" }
  );
  if (!res.ok) return { results: [], content_results: [], total: 0, page, limit: LIMIT };
  return res.json();
}

function SearchHero({ q }: { q: string }) {
  return (
    <form
      action="/search"
      method="get"
      role="search"
      aria-label="통합 검색"
      className="relative mb-8"
    >
      <span
        aria-hidden
        className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl pointer-events-none"
      >
        🔍
      </span>
      <input
        type="search"
        name="q"
        defaultValue={q}
        autoFocus={!q}
        placeholder="기도문·공지·주보·행사·본당 가족을 한 번에 검색"
        aria-label="검색어"
        className="w-full pl-14 pr-28 py-4 text-base sm:text-lg rounded-2xl bg-white text-[var(--color-text)] placeholder-[var(--color-text-muted)] border border-[var(--color-border)] shadow-sm focus:outline-none focus:border-[var(--color-primary)] focus:shadow-md transition-all"
      />
      <button
        type="submit"
        className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2.5 text-sm font-medium bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white rounded-xl transition-colors"
      >
        검색
      </button>
    </form>
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

  // ── 빈 검색 상태: 큰 검색폼 + 추천 검색어 칩 ──
  if (!q) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[var(--color-text)] mb-2">
          무엇을 찾고 계신가요?
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mb-6">
          기도문·묵상·공지·주보·행사·본당 가족·게시판 글을 한 번에 검색합니다.
        </p>
        <SearchHero q="" />
        <section>
          <h2 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3 px-1">
            추천 검색어
          </h2>
          <ul className="flex flex-wrap gap-2">
            {SUGGESTED_KEYWORDS.map((kw) => (
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
      </main>
    );
  }

  const data = await fetchSearch(q, page);
  const totalPages = Math.ceil(data.total / LIMIT);

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <SearchHero q={q} />
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
