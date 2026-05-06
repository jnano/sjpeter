import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL;
const LIMIT = 10;

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

interface SearchResult {
  id: number;
  title: string;
  excerpt: string;
  view_count: number;
  created_at: string;
  comment_count: number;
  board: BoardInfo;
  member: Author | null;
}

interface SearchOut {
  results: SearchResult[];
  total: number;
  page: number;
  limit: number;
}

async function fetchSearch(q: string, page: number): Promise<SearchOut> {
  const res = await fetch(
    `${API}/api/search?q=${encodeURIComponent(q)}&page=${page}&limit=${LIMIT}`,
    { cache: "no-store" }
  );
  if (!res.ok) return { results: [], total: 0, page, limit: LIMIT };
  return res.json();
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q: qParam = "", page: pageParam = "1" } = await searchParams;
  const q = qParam.trim();
  const page = Math.max(1, parseInt(pageParam, 10));

  if (!q) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-12 text-center text-[var(--color-text-muted)]">
        검색어를 입력해 주세요.
      </main>
    );
  }

  const data = await fetchSearch(q, page);
  const totalPages = Math.ceil(data.total / LIMIT);

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-xl font-bold text-[var(--color-text)] mb-1">
        검색 결과
      </h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-6">
        <span className="font-medium text-[var(--color-primary)]">&ldquo;{q}&rdquo;</span>
        {" "}검색 결과 {data.total.toLocaleString()}건
      </p>

      {data.results.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-text-muted)]">
          <p className="text-4xl mb-4">🔍</p>
          <p>검색 결과가 없습니다.</p>
          <p className="text-sm mt-1">다른 검색어로 시도해 보세요.</p>
        </div>
      ) : (
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
