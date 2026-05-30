import Link from "next/link";

interface Author {
  id: number;
  nickname: string;
}

interface Post {
  id: number;
  title: string;
  member: Author | null;
  view_count: number;
  comment_count: number;
  created_at: string;
  thumbnail_url: string | null;
  is_pinned: boolean;
}

function mmdd(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * TitleListBoard — 게시판 kind='titlelist' 전용 단순 타이틀 리스트.
 * 공지사항 톤(home 대시보드의 notice-list-card)을 풀폭으로 옮긴 형태.
 * 작성자/조회수/댓글/썸네일은 노출하지 않고 [고정] + 제목 + 날짜 3 컬럼만.
 */
export default function TitleListBoard({
  slug,
  posts,
  total,
  page,
  totalPages,
  searchQuery,
  showSearch,
}: {
  slug: string;
  posts: Post[];
  total: number;
  page: number;
  totalPages: number;
  searchQuery?: string;
  showSearch: boolean;
}) {
  const empty = posts.length === 0;

  return (
    <div className="space-y-4">
      {/* Section title bar — 풀폭 헤더 (게시판 이름 + 전체 N건) */}
      <div className="flex items-baseline justify-between gap-3 pb-3 border-b border-[var(--color-text)]">
        <div className="text-[11px] tracking-[0.16em] uppercase font-bold text-[var(--color-primary)]">
          전체 목록
        </div>
        <span className="text-[12px] font-bold text-[var(--color-text-muted)] tabular-nums">
          {total}건
        </span>
      </div>

      {/* 검색 폼 (켜둔 경우만) — 단순 텍스트 q 파라미터 */}
      {showSearch && (
        <form action={`/boards/${slug}`} method="get" className="flex items-center gap-2">
          <input
            type="text"
            name="q"
            defaultValue={searchQuery ?? ""}
            placeholder="제목 검색"
            className="flex-1 px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)]"
          >
            검색
          </button>
        </form>
      )}

      {/* 리스트 */}
      <ul className="bg-white border border-[var(--color-border)] rounded-2xl divide-y divide-[var(--color-border)] overflow-hidden">
        {empty ? (
          <li className="px-5 py-12 text-center text-sm text-[var(--color-text-muted)]">
            {searchQuery ? "검색 결과가 없습니다." : "등록된 글이 없습니다."}
          </li>
        ) : (
          posts.map((p) => (
            <li key={p.id} className="grid grid-cols-[auto_1fr_auto] gap-3 items-center px-4 sm:px-5 py-3.5">
              {p.is_pinned ? (
                <span className="text-[10px] px-2 py-0.5 rounded font-bold tracking-wider bg-[var(--color-primary)] text-white">
                  고정
                </span>
              ) : (
                <span aria-hidden className="w-1 h-1 rounded-full bg-[var(--color-border-dark)] mx-auto" />
              )}
              <Link
                href={`/boards/${slug}/${p.id}`}
                className="text-[14px] font-medium text-[var(--color-text)] hover:text-[var(--color-primary)] truncate"
              >
                {p.title}
                {p.comment_count > 0 && (
                  <span className="ml-1.5 text-[11px] font-bold text-[var(--color-primary)] tabular-nums">
                    [{p.comment_count}]
                  </span>
                )}
              </Link>
              <span className="text-[12px] text-[var(--color-text-muted)] tabular-nums whitespace-nowrap">
                {mmdd(p.created_at)}
              </span>
            </li>
          ))
        )}
      </ul>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <nav className="flex justify-center items-center gap-1.5 mt-4" aria-label="페이지">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
            const isCur = p === page;
            const qp = new URLSearchParams();
            qp.set("page", String(p));
            if (searchQuery) qp.set("q", searchQuery);
            return (
              <Link
                key={p}
                href={`/boards/${slug}?${qp.toString()}`}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg border tabular-nums transition-colors ${
                  isCur
                    ? "bg-[var(--ink)] text-white border-[var(--ink)]"
                    : "bg-white border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                }`}
              >
                {p}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
