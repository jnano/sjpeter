import Image from "next/image";
import Link from "next/link";
import AvatarImg from "@/components/AvatarImg";

function AiBadge() {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 border border-violet-200 font-medium">
      AI
    </span>
  );
}

/** 동영상 포함 표시 — 밝은 색·반짝임. inline 은 목록 텍스트 옆, 큰 형식은 PhotoView. */
function VideoBadge({ inline = false }: { inline?: boolean }) {
  if (inline) {
    return (
      <span
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 shrink-0 animate-pulse"
        title="동영상 포함"
      >
        <span className="text-[10px]">✨</span>
        <span className="text-[11px]">🎬</span>
      </span>
    );
  }
  return (
    <span className="text-3xl animate-pulse" title="동영상 포함">🎬</span>
  );
}

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL;

interface Author {
  id: number;
  nickname: string;
  avatar_url?: string | null;
}

function avatarSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API}${url}`;
}

function AuthorChip({ author, size = "sm", nameFirst = false }: { author: Author | null; size?: "sm" | "md"; nameFirst?: boolean }) {
  const dim = size === "md" ? "w-6 h-6" : "w-5 h-5";
  const src = avatarSrc(author?.avatar_url ?? null);
  const initial = (author?.nickname ?? "성").slice(0, 1);
  const avatar = (
    <span className={`${dim} rounded-full bg-[var(--color-surface-warm)] border border-[var(--color-border)] flex items-center justify-center overflow-hidden shrink-0`}>
      {src ? (
        <AvatarImg src={src} className="w-full h-full object-cover" />
      ) : (
        <span className="text-[10px] font-bold text-[var(--color-text-muted)]">{initial}</span>
      )}
    </span>
  );
  const name = <span className="truncate">{author?.nickname ?? "성당"}</span>;
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      {nameFirst ? <>{name}{avatar}</> : <>{avatar}{name}</>}
    </span>
  );
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
  has_video?: boolean;
  is_pinned?: boolean;
}

export interface BoardCols {
  list_show_number: boolean;
  list_show_author: boolean;
  list_show_date: boolean;
  list_show_views: boolean;
  list_show_likes: boolean;
  list_show_comments: boolean;
  list_show_shares: boolean;
  share_enabled: boolean;
}

interface Props {
  posts: Post[];
  slug: string;
  currentPage: number;
  totalPages: number;
  currentView: "list" | "photo" | "card";
  /** 게시판 종류별 default 뷰 — kindDefault 와 동일한 view 라면 URL 에 view 파라미터 생략 (v1.5.334) */
  kindDefault: "list" | "photo";
  cols: BoardCols;
  currentQ?: string;
  currentSort?: string;
  currentCategory?: string;
  /** 페이지네이션 링크에 항상 유지할 추가 쿼리 (예: 공지 '지난 공지' 탭 {tab:'archived'}) */
  extraParams?: Record<string, string>;
}

function pageUrl(slug: string, page: number, view: string, q?: string, sort?: string, category?: string, extra?: Record<string, string>) {
  const qp = new URLSearchParams({ page: String(page), view });
  if (q) qp.set("q", q);
  if (sort && sort !== "latest") qp.set("sort", sort);
  if (category) qp.set("category", category);
  if (extra) for (const [k, v] of Object.entries(extra)) qp.set(k, v);
  return `/boards/${slug}?${qp}`;
}

function getPaginationRange(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "…")[] = [1];
  if (current > 3) pages.push("…");
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push("…");
  pages.push(total);
  return pages;
}

export default function BoardList({ posts, slug, currentPage, totalPages, currentView, kindDefault, cols, currentQ, currentSort, currentCategory, extraParams }: Props) {
  // 글 상세 → 삭제·뒤로 돌아갈 때 현재 페이지·필터를 복원하기 위해 링크에 from= 첨부
  function detailHref(postId: number) {
    const qp = new URLSearchParams();
    if (currentPage > 1) qp.set("page", String(currentPage));
    if (currentView && currentView !== kindDefault) qp.set("view", currentView);
    if (currentQ) qp.set("q", currentQ);
    if (currentSort && currentSort !== "latest") qp.set("sort", currentSort);
    if (currentCategory) qp.set("category", currentCategory);
    const qs = qp.toString();
    return `/boards/${slug}/${postId}${qs ? `?from=${encodeURIComponent(qs)}` : ""}`;
  }
  return (
    <>
      {posts.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-text-muted)]">
          아직 작성된 글이 없습니다. 첫 번째 글을 남겨보세요.
        </div>
      ) : currentView === "list" ? (
        <ListView posts={posts} slug={slug} cols={cols} hrefFor={detailHref} />
      ) : currentView === "card" ? (
        <CardView posts={posts} slug={slug} cols={cols} hrefFor={detailHref} />
      ) : (
        <PhotoView posts={posts} slug={slug} cols={cols} hrefFor={detailHref} />
      )}

      {totalPages > 1 && (
        <Pagination
          slug={slug}
          currentPage={currentPage}
          totalPages={totalPages}
          view={currentView}
          q={currentQ}
          sort={currentSort}
          category={currentCategory}
          extraParams={extraParams}
        />
      )}
    </>
  );
}

function ListView({ posts, slug, cols, hrefFor }: { posts: Post[]; slug: string; cols: BoardCols; hrefFor: (id: number) => string }) {
  // v1.5.437 — 전통적 게시판 표 (시안 열린마당 톤). <table> + <colgroup> 으로
  // 헤더-행 컬럼 폭을 픽셀 단위로 정렬. cols 토글로 컬럼 동적 가감.
  const showShares = cols.list_show_shares && cols.share_enabled;
  const empty = posts.length === 0;

  function fmtDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] border-collapse" style={{ tableLayout: "fixed" }}>
        <colgroup>
          {cols.list_show_number && <col style={{ width: "80px" }} />}
          <col />{/* 제목 — 가변 */}
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
              <td
                colSpan={1 + (cols.list_show_number ? 1 : 0) + (cols.list_show_author ? 1 : 0) + (cols.list_show_date ? 1 : 0) + (cols.list_show_views ? 1 : 0) + (cols.list_show_likes ? 1 : 0) + (cols.list_show_comments ? 1 : 0) + (showShares ? 1 : 0)}
                className="px-4 py-16 text-center text-sm text-[var(--color-text-muted)]"
              >
                아직 작성된 글이 없습니다. 첫 번째 글을 남겨보세요.
              </td>
            </tr>
          ) : (
            posts.map((post, i) => {
              const rowNumber = posts.length - i;
              const href = hrefFor(post.id);
              const rowBg = post.is_pinned ? "bg-[var(--color-surface-warm)]/60" : "";
              return (
                <tr key={post.id} className={`text-[14px] border-b border-[var(--color-border)] ${rowBg} hover:bg-[var(--color-surface-warm)]/40 transition-colors`}>
                  {cols.list_show_number && (
                    <td className="px-4 py-4 text-left text-[var(--color-text-muted)] text-[13px] tabular-nums">
                      {post.is_pinned ? (
                        <span className="font-medium">공지사항</span>
                      ) : (
                        rowNumber
                      )}
                    </td>
                  )}
                  <td className="px-4 py-4 text-left">
                    <Link href={href} className="inline-flex items-center gap-2 min-w-0 max-w-full text-[var(--color-text)] hover:text-[var(--color-primary)]">
                      {!cols.list_show_number && post.is_pinned && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-[var(--color-primary)] text-white shrink-0">고정</span>
                      )}
                      {!post.member && <AiBadge />}
                      <span className="truncate">{post.title}</span>
                      {cols.list_show_comments && post.comment_count > 0 && (
                        <span className="text-[12px] text-[var(--color-primary)] tabular-nums shrink-0">[{post.comment_count}]</span>
                      )}
                      {post.thumbnail_url && (
                        <span className="text-[10px] text-[var(--color-text-muted)] shrink-0" title="사진 첨부">📷</span>
                      )}
                      {post.has_video && <VideoBadge inline />}
                    </Link>
                  </td>
                  {cols.list_show_author && (
                    <td className="px-4 py-4 text-left text-[13px] text-[var(--color-text-muted)] truncate">
                      {post.member?.nickname ?? "성당"}
                    </td>
                  )}
                  {cols.list_show_date && (
                    <td className="px-4 py-4 text-left text-[13px] tabular-nums text-[var(--color-text-muted)]">
                      {fmtDate(post.created_at)}
                    </td>
                  )}
                  {cols.list_show_views && (
                    <td className="px-4 py-4 text-left text-[13px] tabular-nums text-[var(--color-text-muted)]">
                      {post.view_count}
                    </td>
                  )}
                  {cols.list_show_likes && (
                    <td className="px-4 py-4 text-left text-[13px] tabular-nums text-[var(--color-text-muted)]">
                      {post.like_count ?? 0}
                    </td>
                  )}
                  {cols.list_show_comments && (
                    <td className="px-4 py-4 text-left text-[13px] tabular-nums text-[var(--color-text-muted)]">
                      {post.comment_count}
                    </td>
                  )}
                  {showShares && (
                    <td className="px-4 py-4 text-left text-[13px] tabular-nums text-[var(--color-text-muted)]">
                      {post.share_count ?? 0}
                    </td>
                  )}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

// 카드 뷰 — admin 글 관리 패널의 행 디자인 차용. 체크박스·관리 액션 제거.
// 좌측 썸네일, 가운데 제목+메타(날짜·댓글·조회·좋아요), 우측 작성자(아바타+닉네임).
function CardView({ posts, slug: _slug, cols, hrefFor }: { posts: Post[]; slug: string; cols: BoardCols; hrefFor: (id: number) => string }) {
  // 시안 board.html card-row — 썸네일 + 제목/메타 + 우측 통계.
  return (
    <div className="bd-cards">
      {posts.map((post) => {
        const metaParts: string[] = [];
        if (cols.list_show_date) metaParts.push(new Date(post.created_at).toLocaleDateString("ko-KR"));
        if (cols.list_show_comments && post.comment_count > 0) metaParts.push(`댓글 ${post.comment_count}`);
        if (cols.list_show_views) metaParts.push(`조회 ${post.view_count}`);
        return (
          <Link key={post.id} href={hrefFor(post.id)} className="bd-card">
            <span className="thumb">
              {post.thumbnail_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={`${API}${post.thumbnail_url}`} alt="" />
              ) : (post.has_video ? "🎬" : "📄")}
            </span>
            <div className="body">
              <h3>
                {post.is_pinned && <span className="bg-[var(--color-primary)] text-white text-[10px] px-1.5 py-0.5 rounded shrink-0 font-bold">고정</span>}
                {!post.member && <AiBadge />}
                <span className="ttl">{post.title}</span>
                {cols.list_show_comments && post.comment_count > 0 && <span className="cmt">{post.comment_count}</span>}
                {post.has_video && <VideoBadge inline />}
              </h3>
              <div className="meta">
                {cols.list_show_author && <AuthorChip author={post.member} nameFirst />}
                {cols.list_show_author && metaParts.length > 0 && <span className="text-[var(--color-border-dark)]">·</span>}
                {metaParts.join(" · ")}
              </div>
            </div>
            <div className="right-side">
              {cols.list_show_likes && <span title="좋아요">♡ {post.like_count ?? 0}</span>}
              {cols.list_show_shares && cols.share_enabled && <span title="공유">🔗 {post.share_count ?? 0}</span>}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function PhotoView({ posts, slug, cols, hrefFor }: { posts: Post[]; slug: string; cols: BoardCols; hrefFor: (id: number) => string }) {
  // 시안 board.html photo grid — 4열(모바일 2열) 사진 카드.
  return (
    <div className="bd-photo">
      {posts.map((post) => (
        <Link key={post.id} href={hrefFor(post.id)} className="bd-pcard">
          <div className="thumb">
            {post.thumbnail_url ? (
              <Image src={`${API}${post.thumbnail_url}`} alt={post.title} fill className="object-cover" sizes="(max-width: 768px) 50vw, 25vw" />
            ) : (post.has_video ? "🎬" : "📄")}
            {post.has_video && post.thumbnail_url && (
              <span className="absolute top-2 right-2 inline-flex items-center gap-0.5 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full" title="동영상 포함">🎬</span>
            )}
          </div>
          <div className="info">
            <h3>
              {post.is_pinned && <span className="mr-1 text-[var(--color-primary)]" title="상단 고정">📌</span>}
              {post.title}
              {cols.list_show_comments && post.comment_count > 0 && <span className="cmt ml-1 text-[var(--color-primary)] text-xs">[{post.comment_count}]</span>}
            </h3>
            <div className="pmeta">
              {cols.list_show_author ? <span><AuthorChip author={post.member} /></span> : <span />}
              {cols.list_show_date && <span>{new Date(post.created_at).toLocaleDateString("ko-KR")}</span>}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function Pagination({
  slug,
  currentPage,
  totalPages,
  view,
  q,
  sort,
  category,
  extraParams,
}: {
  slug: string;
  currentPage: number;
  totalPages: number;
  view: string;
  q?: string;
  sort?: string;
  category?: string;
  extraParams?: Record<string, string>;
}) {
  const pages = getPaginationRange(currentPage, totalPages);

  return (
    <div className="bd-page">
      {currentPage > 1 && (
        <Link href={pageUrl(slug, currentPage - 1, view, q, sort, category, extraParams)} aria-label="이전">‹</Link>
      )}
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`ellipsis-${i}`} className="gap text-[var(--color-text-muted)]">…</span>
        ) : p === currentPage ? (
          <span key={p} className="cur" aria-current="page">{p}</span>
        ) : (
          <Link key={p} href={pageUrl(slug, p, view, q, sort, category, extraParams)}>{p}</Link>
        )
      )}
      {currentPage < totalPages && (
        <Link href={pageUrl(slug, currentPage + 1, view, q, sort, category, extraParams)} aria-label="다음">›</Link>
      )}
    </div>
  );
}
