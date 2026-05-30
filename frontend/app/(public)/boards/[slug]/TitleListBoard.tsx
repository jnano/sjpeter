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

/**
 * 게시판 kind='titlelist' — 전통적 게시판 표 (<table> 시맨틱).
 * <thead> 헤더와 <tbody> 행이 같은 colgroup 폭을 공유 → 자동 정렬.
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
  const colCount =
    1 + // 제목
    (cols.list_show_number ? 1 : 0) +
    (cols.list_show_author ? 1 : 0) +
    (cols.list_show_date ? 1 : 0) +
    (cols.list_show_views ? 1 : 0) +
    (cols.list_show_likes ? 1 : 0) +
    (cols.list_show_comments ? 1 : 0) +
    (showShares ? 1 : 0);

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

      {/* 표 */}
      <div className="bg-white border border-[var(--color-border)] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse" style={{ tableLayout: "fixed" }}>
            <colgroup>
              {cols.list_show_number && <col style={{ width: "56px" }} />}
              <col />{/* 제목 - 가변 */}
              {cols.list_show_author && <col style={{ width: "104px" }} />}
              {cols.list_show_date && <col style={{ width: "92px" }} />}
              {cols.list_show_views && <col style={{ width: "68px" }} />}
              {cols.list_show_likes && <col style={{ width: "72px" }} />}
              {cols.list_show_comments && <col style={{ width: "68px" }} />}
              {showShares && <col style={{ width: "68px" }} />}
            </colgroup>
            <thead>
              <tr className="bg-[var(--color-surface-warm)] border-b border-[var(--color-border)] text-[11px] tracking-[0.08em] uppercase font-bold text-[var(--color-text-muted)]">
                {cols.list_show_number && <th className="px-3 py-3 text-center">번호</th>}
                <th className="px-3 py-3 text-left">제목</th>
                {cols.list_show_author && <th className="px-3 py-3 text-center">작성자</th>}
                {cols.list_show_date && <th className="px-3 py-3 text-center">작성일</th>}
                {cols.list_show_views && <th className="px-3 py-3 text-center">조회수</th>}
                {cols.list_show_likes && <th className="px-3 py-3 text-center">좋아요수</th>}
                {cols.list_show_comments && <th className="px-3 py-3 text-center">댓글수</th>}
                {showShares && <th className="px-3 py-3 text-center">공유수</th>}
              </tr>
            </thead>
            <tbody>
              {empty ? (
                <tr>
                  <td colSpan={colCount} className="px-5 py-12 text-center text-sm text-[var(--color-text-muted)]">
                    {searchQuery ? "검색 결과가 없습니다." : "등록된 글이 없습니다."}
                  </td>
                </tr>
              ) : (
                posts.map((p, i) => {
                  const rowNumber = total - (page - 1) * posts.length - i;
                  const href = `/boards/${slug}/${p.id}`;
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-[var(--color-border)] last:border-b-0 text-[13px] hover:bg-[var(--color-surface-warm)]/60 transition-colors"
                    >
                      {cols.list_show_number && (
                        <td className="px-3 py-3 text-center tabular-nums text-[var(--color-text-muted)]">
                          {p.is_pinned ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-[var(--color-primary)] text-white">고정</span>
                          ) : (
                            rowNumber
                          )}
                        </td>
                      )}
                      <td className="px-3 py-3 text-left">
                        <Link href={href} className="flex items-center gap-1.5 min-w-0">
                          {!cols.list_show_number && p.is_pinned && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-[var(--color-primary)] text-white shrink-0">고정</span>
                          )}
                          <span className="font-medium text-[var(--color-text)] truncate hover:text-[var(--color-primary)]">{p.title}</span>
                          {p.thumbnail_url && (
                            <span className="text-[10px] text-[var(--color-text-muted)] shrink-0" title="사진 첨부">📷</span>
                          )}
                        </Link>
                      </td>
                      {cols.list_show_author && (
                        <td className="px-3 py-3 text-center text-[12px] text-[var(--color-text)] truncate">
                          {p.member?.nickname ?? "성당"}
                        </td>
                      )}
                      {cols.list_show_date && (
                        <td className="px-3 py-3 text-center text-[12px] tabular-nums text-[var(--color-text-muted)]">
                          {fmtDate(p.created_at)}
                        </td>
                      )}
                      {cols.list_show_views && (
                        <td className="px-3 py-3 text-center text-[12px] tabular-nums text-[var(--color-text-muted)]">
                          {p.view_count}
                        </td>
                      )}
                      {cols.list_show_likes && (
                        <td className="px-3 py-3 text-center text-[12px] tabular-nums text-[var(--color-text-muted)]">
                          {p.like_count ?? 0}
                        </td>
                      )}
                      {cols.list_show_comments && (
                        <td className="px-3 py-3 text-center text-[12px] tabular-nums text-[var(--color-text-muted)]">
                          {p.comment_count}
                        </td>
                      )}
                      {showShares && (
                        <td className="px-3 py-3 text-center text-[12px] tabular-nums text-[var(--color-text-muted)]">
                          {p.share_count ?? 0}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
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
