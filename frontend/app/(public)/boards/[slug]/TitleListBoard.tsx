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
  like_count?: number;
  share_count?: number;
  created_at: string;
  thumbnail_url: string | null;
  is_pinned: boolean;
}

export interface TitleListCols {
  list_show_number: boolean;
  list_show_author: boolean;
  list_show_date: boolean;
  list_show_views: boolean;
  list_show_likes: boolean;
  list_show_comments: boolean;
  list_show_shares: boolean;
  share_enabled: boolean;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // YY.MM.DD
  return `${String(d.getFullYear()).slice(2)}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * 게시판 kind='titlelist' 전용 — 전통적 게시판 테이블 톤.
 * 컬럼 헤더(번호·제목·작성자·작성일·조회수·좋아요수·댓글수·공유수)가 있고
 * 그 아래 같은 그리드로 정렬된 행 목록. cols 토글에 따라 컬럼 동적 가감.
 */
export default function TitleListBoard({
  slug,
  posts,
  total,
  page,
  totalPages,
  searchQuery,
  showSearch,
  cols,
}: {
  slug: string;
  posts: Post[];
  total: number;
  page: number;
  totalPages: number;
  searchQuery?: string;
  showSearch: boolean;
  cols: TitleListCols;
}) {
  const empty = posts.length === 0;
  const showShares = cols.list_show_shares && cols.share_enabled;

  // 화면 구성: 활성화된 컬럼만 grid-template-columns 에 포함.
  const cells: { key: string; head: string; cls: string; cellCls: string }[] = [];
  if (cols.list_show_number) {
    cells.push({ key: "no", head: "번호", cls: "w-12 text-center", cellCls: "text-center tabular-nums text-[var(--color-text-muted)]" });
  }
  cells.push({ key: "title", head: "제목", cls: "flex-1 min-w-0 text-left", cellCls: "text-left min-w-0" });
  if (cols.list_show_author) {
    cells.push({ key: "author", head: "작성자", cls: "w-24 text-center", cellCls: "text-center truncate" });
  }
  if (cols.list_show_date) {
    cells.push({ key: "date", head: "작성일", cls: "w-20 text-center", cellCls: "text-center tabular-nums text-[var(--color-text-muted)]" });
  }
  if (cols.list_show_views) {
    cells.push({ key: "views", head: "조회수", cls: "w-14 text-center", cellCls: "text-center tabular-nums text-[var(--color-text-muted)]" });
  }
  if (cols.list_show_likes) {
    cells.push({ key: "likes", head: "좋아요수", cls: "w-16 text-center", cellCls: "text-center tabular-nums text-[var(--color-text-muted)]" });
  }
  if (cols.list_show_comments) {
    cells.push({ key: "comments", head: "댓글수", cls: "w-14 text-center", cellCls: "text-center tabular-nums text-[var(--color-text-muted)]" });
  }
  if (showShares) {
    cells.push({ key: "shares", head: "공유수", cls: "w-14 text-center", cellCls: "text-center tabular-nums text-[var(--color-text-muted)]" });
  }

  return (
    <div className="space-y-4">
      {/* 상단 요약 + 검색 */}
      <div className="flex items-baseline justify-between gap-3 pb-3 border-b border-[var(--color-text)]">
        <div className="text-[11px] tracking-[0.16em] uppercase font-bold text-[var(--color-primary)]">
          전체 목록
        </div>
        <span className="text-[12px] font-bold text-[var(--color-text-muted)] tabular-nums">
          {total}건
        </span>
      </div>

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

      {/* 테이블 — 헤더 + 행. 데스크탑/태블릿 grid, 모바일 가로 스크롤. */}
      <div className="bg-white border border-[var(--color-border)] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 sm:px-5 py-3 bg-[var(--color-surface-warm)] border-b border-[var(--color-border)] text-[11px] tracking-[0.08em] uppercase font-bold text-[var(--color-text-muted)]">
              {cells.map((c) => (
                <span key={c.key} className={c.cls}>
                  {c.head}
                </span>
              ))}
            </div>

            {/* Rows */}
            {empty ? (
              <div className="px-5 py-12 text-center text-sm text-[var(--color-text-muted)]">
                {searchQuery ? "검색 결과가 없습니다." : "등록된 글이 없습니다."}
              </div>
            ) : (
              posts.map((p, i) => {
                const rowNumber = total - (page - 1) * posts.length - i;
                return (
                  <Link
                    key={p.id}
                    href={`/boards/${slug}/${p.id}`}
                    className="flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-[var(--color-border)] last:border-b-0 text-[13px] hover:bg-[var(--color-surface-warm)]/60 transition-colors"
                  >
                    {cells.map((c) => {
                      switch (c.key) {
                        case "no":
                          return (
                            <span key={c.key} className={c.cellCls}>
                              {p.is_pinned ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-[var(--color-primary)] text-white">
                                  고정
                                </span>
                              ) : (
                                rowNumber
                              )}
                            </span>
                          );
                        case "title":
                          return (
                            <span key={c.key} className={`${c.cellCls} flex-1 min-w-0 inline-flex items-center gap-1.5`}>
                              {!cols.list_show_number && p.is_pinned && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-[var(--color-primary)] text-white shrink-0">
                                  고정
                                </span>
                              )}
                              <span className="font-medium text-[var(--color-text)] truncate">{p.title}</span>
                              {p.thumbnail_url && (
                                <span className="text-[10px] text-[var(--color-text-muted)] shrink-0" title="사진 첨부">
                                  📷
                                </span>
                              )}
                            </span>
                          );
                        case "author":
                          return (
                            <span key={c.key} className={c.cellCls}>
                              {p.member?.nickname ?? "성당"}
                            </span>
                          );
                        case "date":
                          return (
                            <span key={c.key} className={c.cellCls}>
                              {fmtDate(p.created_at)}
                            </span>
                          );
                        case "views":
                          return (
                            <span key={c.key} className={c.cellCls}>
                              {p.view_count}
                            </span>
                          );
                        case "likes":
                          return (
                            <span key={c.key} className={c.cellCls}>
                              {p.like_count ?? 0}
                            </span>
                          );
                        case "comments":
                          return (
                            <span key={c.key} className={c.cellCls}>
                              {p.comment_count}
                            </span>
                          );
                        case "shares":
                          return (
                            <span key={c.key} className={c.cellCls}>
                              {p.share_count ?? 0}
                            </span>
                          );
                      }
                      return null;
                    })}
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>

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
