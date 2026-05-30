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
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function daysSince(iso: string): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 999;
  return (Date.now() - d.getTime()) / 86_400_000;
}

/**
 * 게시판 kind='titlelist' — 전통적 본당 게시판 표.
 * 단순 가로선 테이블. 공지(고정)는 회색 배경 + "공지사항" 라벨. 7일 내 게시글에 New 뱃지.
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
    <div className="space-y-5">
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

      {/* 표 — 가로선만, 카드/보더 없음. table-layout:fixed + colgroup 으로 헤더-행 폭 동일. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse" style={{ tableLayout: "fixed" }}>
          <colgroup>
            {cols.list_show_number && <col style={{ width: "80px" }} />}
            <col />{/* 제목 - 가변 */}
            {cols.list_show_author && <col style={{ width: "120px" }} />}
            {cols.list_show_date && <col style={{ width: "120px" }} />}
            {cols.list_show_views && <col style={{ width: "70px" }} />}
            {cols.list_show_likes && <col style={{ width: "80px" }} />}
            {cols.list_show_comments && <col style={{ width: "70px" }} />}
            {showShares && <col style={{ width: "70px" }} />}
          </colgroup>
          <thead>
            <tr className="text-[13px] text-[var(--color-text-muted)] border-y border-[var(--color-border)]">
              {cols.list_show_number && <th className="px-4 py-3.5 text-left font-medium">번호</th>}
              <th className="px-4 py-3.5 text-left font-medium">제목</th>
              {cols.list_show_author && <th className="px-4 py-3.5 text-left font-medium">작성자</th>}
              {cols.list_show_date && <th className="px-4 py-3.5 text-left font-medium">작성일</th>}
              {cols.list_show_views && <th className="px-4 py-3.5 text-left font-medium">조회</th>}
              {cols.list_show_likes && <th className="px-4 py-3.5 text-left font-medium">좋아요</th>}
              {cols.list_show_comments && <th className="px-4 py-3.5 text-left font-medium">댓글</th>}
              {showShares && <th className="px-4 py-3.5 text-left font-medium">공유</th>}
            </tr>
          </thead>
          <tbody>
            {empty ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-16 text-center text-sm text-[var(--color-text-muted)]">
                  {searchQuery ? "검색 결과가 없습니다." : "등록된 글이 없습니다."}
                </td>
              </tr>
            ) : (
              posts.map((p, i) => {
                const rowNumber = total - (page - 1) * posts.length - i;
                const href = `/boards/${slug}/${p.id}`;
                const isNew = !p.is_pinned && daysSince(p.created_at) <= 2;
                const rowBg = p.is_pinned ? "bg-[var(--color-surface-warm)]/60" : "";
                return (
                  <tr
                    key={p.id}
                    className={`text-[14px] border-b border-[var(--color-border)] ${rowBg} hover:bg-[var(--color-surface-warm)]/40 transition-colors`}
                  >
                    {cols.list_show_number && (
                      <td className="px-4 py-4 text-left text-[var(--color-text-muted)] text-[13px] tabular-nums">
                        {p.is_pinned ? (
                          <span className="font-medium text-[var(--color-text-muted)]">공지사항</span>
                        ) : (
                          rowNumber
                        )}
                      </td>
                    )}
                    <td className="px-4 py-4 text-left">
                      <Link href={href} className="inline-flex items-center gap-2 min-w-0 max-w-full text-[var(--color-text)] hover:text-[var(--color-primary)]">
                        {!cols.list_show_number && p.is_pinned && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-[var(--color-primary)] text-white shrink-0">고정</span>
                        )}
                        {isNew && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-rose-100 text-rose-600 shrink-0">N</span>
                        )}
                        <span className="truncate">{p.title}</span>
                        {p.comment_count > 0 && cols.list_show_comments && (
                          <span className="text-[12px] text-[var(--color-primary)] tabular-nums shrink-0">
                            [{p.comment_count}]
                          </span>
                        )}
                        {p.thumbnail_url && (
                          <span className="text-[10px] text-[var(--color-text-muted)] shrink-0" title="사진 첨부">📷</span>
                        )}
                      </Link>
                    </td>
                    {cols.list_show_author && (
                      <td className="px-4 py-4 text-left text-[13px] text-[var(--color-text-muted)] truncate">
                        {p.member?.nickname ?? "성당"}
                      </td>
                    )}
                    {cols.list_show_date && (
                      <td className="px-4 py-4 text-left text-[13px] tabular-nums text-[var(--color-text-muted)]">
                        {fmtDate(p.created_at)}
                      </td>
                    )}
                    {cols.list_show_views && (
                      <td className="px-4 py-4 text-left text-[13px] tabular-nums text-[var(--color-text-muted)]">
                        {p.view_count}
                      </td>
                    )}
                    {cols.list_show_likes && (
                      <td className="px-4 py-4 text-left text-[13px] tabular-nums text-[var(--color-text-muted)]">
                        {p.like_count ?? 0}
                      </td>
                    )}
                    {cols.list_show_comments && (
                      <td className="px-4 py-4 text-left text-[13px] tabular-nums text-[var(--color-text-muted)]">
                        {p.comment_count}
                      </td>
                    )}
                    {showShares && (
                      <td className="px-4 py-4 text-left text-[13px] tabular-nums text-[var(--color-text-muted)]">
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

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <nav className="flex justify-center items-center gap-1.5 mt-6" aria-label="페이지">
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
