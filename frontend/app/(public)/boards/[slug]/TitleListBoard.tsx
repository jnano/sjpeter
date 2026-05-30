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
  return `${String(d.getFullYear()).slice(2)}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

interface Column {
  key: "no" | "title" | "author" | "date" | "views" | "likes" | "comments" | "shares";
  head: string;
  /** grid-template-columns 항목 — 제목은 1fr 로 가변, 나머지는 고정폭. */
  track: string;
  /** 헤더·셀 정렬 */
  align: "left" | "center";
}

/**
 * 게시판 kind='titlelist' — 전통적 게시판 표.
 * CSS Grid (grid-template-columns) 로 헤더와 모든 행이 동일 컬럼 폭으로 정렬됨.
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

  // 활성 컬럼 정의 (순서대로 출력).
  const columns: Column[] = [];
  if (cols.list_show_number) columns.push({ key: "no", head: "번호", track: "56px", align: "center" });
  columns.push({ key: "title", head: "제목", track: "1fr", align: "left" });
  if (cols.list_show_author) columns.push({ key: "author", head: "작성자", track: "96px", align: "center" });
  if (cols.list_show_date) columns.push({ key: "date", head: "작성일", track: "84px", align: "center" });
  if (cols.list_show_views) columns.push({ key: "views", head: "조회수", track: "60px", align: "center" });
  if (cols.list_show_likes) columns.push({ key: "likes", head: "좋아요수", track: "68px", align: "center" });
  if (cols.list_show_comments) columns.push({ key: "comments", head: "댓글수", track: "60px", align: "center" });
  if (showShares) columns.push({ key: "shares", head: "공유수", track: "60px", align: "center" });

  const gridStyle = { gridTemplateColumns: columns.map((c) => c.track).join(" ") };

  function alignCls(a: "left" | "center"): string {
    return a === "left" ? "text-left" : "text-center";
  }

  function cellContent(c: Column, p: Post, rowNumber: number) {
    switch (c.key) {
      case "no":
        return p.is_pinned ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-[var(--color-primary)] text-white">고정</span>
        ) : (
          <span className="tabular-nums text-[var(--color-text-muted)]">{rowNumber}</span>
        );
      case "title":
        return (
          <span className="inline-flex items-center gap-1.5 min-w-0 max-w-full">
            {!cols.list_show_number && p.is_pinned && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-[var(--color-primary)] text-white shrink-0">고정</span>
            )}
            <span className="font-medium text-[var(--color-text)] truncate">{p.title}</span>
            {p.thumbnail_url && (
              <span className="text-[10px] text-[var(--color-text-muted)] shrink-0" title="사진 첨부">📷</span>
            )}
          </span>
        );
      case "author":
        return <span className="truncate text-[var(--color-text)] text-[12px]">{p.member?.nickname ?? "성당"}</span>;
      case "date":
        return <span className="tabular-nums text-[var(--color-text-muted)] text-[12px]">{fmtDate(p.created_at)}</span>;
      case "views":
        return <span className="tabular-nums text-[var(--color-text-muted)] text-[12px]">{p.view_count}</span>;
      case "likes":
        return <span className="tabular-nums text-[var(--color-text-muted)] text-[12px]">{p.like_count ?? 0}</span>;
      case "comments":
        return <span className="tabular-nums text-[var(--color-text-muted)] text-[12px]">{p.comment_count}</span>;
      case "shares":
        return <span className="tabular-nums text-[var(--color-text-muted)] text-[12px]">{p.share_count ?? 0}</span>;
    }
  }

  return (
    <div className="space-y-4">
      {/* 상단 요약 */}
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

      {/* 테이블 — 헤더와 모든 행이 동일 grid-template-columns 로 정렬. */}
      <div className="bg-white border border-[var(--color-border)] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            {/* Header row */}
            <div
              className="grid items-center gap-3 px-4 sm:px-5 py-3 bg-[var(--color-surface-warm)] border-b border-[var(--color-border)] text-[11px] tracking-[0.08em] uppercase font-bold text-[var(--color-text-muted)]"
              style={gridStyle}
            >
              {columns.map((c) => (
                <span key={c.key} className={alignCls(c.align)}>
                  {c.head}
                </span>
              ))}
            </div>

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
                    className="grid items-center gap-3 px-4 sm:px-5 py-3 border-b border-[var(--color-border)] last:border-b-0 text-[13px] hover:bg-[var(--color-surface-warm)]/60 transition-colors"
                    style={gridStyle}
                  >
                    {columns.map((c) => (
                      <span key={c.key} className={`${alignCls(c.align)} min-w-0`}>
                        {cellContent(c, p, rowNumber)}
                      </span>
                    ))}
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
