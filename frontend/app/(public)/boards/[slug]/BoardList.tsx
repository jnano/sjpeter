import Image from "next/image";
import Link from "next/link";

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

const API = process.env.NEXT_PUBLIC_API_URL;

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

function AuthorChip({ author, size = "sm" }: { author: Author | null; size?: "sm" | "md" }) {
  const dim = size === "md" ? "w-6 h-6" : "w-5 h-5";
  const src = avatarSrc(author?.avatar_url ?? null);
  const initial = (author?.nickname ?? "성").slice(0, 1);
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <span className={`${dim} rounded-full bg-[var(--color-surface-warm)] border border-[var(--color-border)] flex items-center justify-center overflow-hidden shrink-0`}>
        {src ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={src} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-[10px] font-bold text-[var(--color-text-muted)]">{initial}</span>
        )}
      </span>
      <span className="truncate">{author?.nickname ?? "성당"}</span>
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
  created_at: string;
  thumbnail_url: string | null;
  has_video?: boolean;
}

export interface BoardCols {
  list_show_number: boolean;
  list_show_author: boolean;
  list_show_date: boolean;
  list_show_views: boolean;
  list_show_likes: boolean;
  list_show_comments: boolean;
}

interface Props {
  posts: Post[];
  slug: string;
  currentPage: number;
  totalPages: number;
  currentView: "list" | "photo";
  cols: BoardCols;
  currentQ?: string;
  currentSort?: string;
  currentCategory?: string;
}

function pageUrl(slug: string, page: number, view: string, q?: string, sort?: string, category?: string) {
  const qp = new URLSearchParams({ page: String(page), view });
  if (q) qp.set("q", q);
  if (sort && sort !== "latest") qp.set("sort", sort);
  if (category) qp.set("category", category);
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

export default function BoardList({ posts, slug, currentPage, totalPages, currentView, cols, currentQ, currentSort, currentCategory }: Props) {
  return (
    <>
      {posts.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-text-muted)]">
          아직 작성된 글이 없습니다. 첫 번째 글을 남겨보세요.
        </div>
      ) : currentView === "list" ? (
        <ListView posts={posts} slug={slug} cols={cols} />
      ) : (
        <PhotoView posts={posts} slug={slug} cols={cols} />
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
        />
      )}
    </>
  );
}

function ListView({ posts, slug, cols }: { posts: Post[]; slug: string; cols: BoardCols }) {
  // kind='default' 게시판의 표준 글 목록 — 한 줄 텍스트 리스트.
  // 사진 그리드가 필요하면 board.kind='gallery' 로 두고 /gallery/{slug} 사용.
  return (
    <div className="divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
      {posts.map((post, i) => (
        <Link
          key={post.id}
          href={`/boards/${slug}/${post.id}`}
          className="flex items-baseline justify-between gap-3 py-3.5 group hover:text-[var(--color-primary)] transition-colors"
        >
          <span className="flex items-baseline gap-1.5 flex-1 min-w-0">
            {cols.list_show_number && (
              <span className="text-xs text-[var(--color-text-muted)] tabular-nums shrink-0">
                {posts.length - i}
              </span>
            )}
            {!post.member && <AiBadge />}
            <span className="font-medium text-[var(--color-text)] truncate group-hover:underline">
              {post.title}
            </span>
            {cols.list_show_comments && post.comment_count > 0 && (
              <span className="text-xs text-[var(--color-primary)] shrink-0">
                [{post.comment_count}]
              </span>
            )}
            {post.thumbnail_url && (
              <span className="text-xs text-[var(--color-text-muted)] shrink-0" title="사진 첨부">📷</span>
            )}
            {post.has_video && <VideoBadge inline />}
          </span>
          <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)] shrink-0">
            {cols.list_show_author && (
              <span className="hidden sm:inline-flex">
                <AuthorChip author={post.member} />
              </span>
            )}
            {cols.list_show_date && (
              <span>{new Date(post.created_at).toLocaleDateString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit" })}</span>
            )}
            {cols.list_show_views && (
              <span className="hidden sm:inline">조회 {post.view_count}</span>
            )}
            {cols.list_show_likes && (
              <span className="hidden sm:inline" title="좋아요">♡ {post.like_count ?? 0}</span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

function PhotoView({ posts, slug, cols }: { posts: Post[]; slug: string; cols: BoardCols }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {posts.map((post) => (
        <Link
          key={post.id}
          href={`/boards/${slug}/${post.id}`}
          className="group rounded-xl overflow-hidden border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:shadow-md transition-all"
        >
          {post.thumbnail_url ? (
            <div className="relative w-full aspect-square">
              <Image
                src={`${API}${post.thumbnail_url}`}
                alt={post.title}
                fill
                className="object-cover group-hover:opacity-90 transition-opacity"
                sizes="(max-width: 640px) 50vw, 33vw"
              />
              {post.has_video && (
                <span
                  className="absolute top-2 right-2 inline-flex items-center gap-0.5 bg-rose-500/95 text-white text-xs px-2 py-0.5 rounded-full shadow-md animate-pulse"
                  title="동영상 포함"
                >
                  <span className="text-[10px]">✨</span>
                  <span>🎬</span>
                </span>
              )}
            </div>
          ) : (
            <div className="w-full aspect-square bg-gray-100 flex items-center justify-center relative">
              {post.has_video ? (
                <span className="text-3xl animate-pulse" title="동영상 포함">🎬</span>
              ) : (
                <span className="text-3xl text-gray-300">📄</span>
              )}
            </div>
          )}
          <div className="px-3 py-2.5">
            <p className="text-sm font-medium truncate group-hover:text-[var(--color-primary)]">
              {post.title}
              {cols.list_show_comments && post.comment_count > 0 && (
                <span className="ml-1 text-xs text-[var(--color-primary)]">
                  [{post.comment_count}]
                </span>
              )}
            </p>
            {(cols.list_show_author || cols.list_show_date) && (
              <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] mt-1">
                {cols.list_show_author && <AuthorChip author={post.member} />}
                {cols.list_show_author && cols.list_show_date && <span>·</span>}
                {cols.list_show_date && (
                  <span>{new Date(post.created_at).toLocaleDateString("ko-KR")}</span>
                )}
              </div>
            )}
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
}: {
  slug: string;
  currentPage: number;
  totalPages: number;
  view: string;
  q?: string;
  sort?: string;
  category?: string;
}) {
  const pages = getPaginationRange(currentPage, totalPages);

  return (
    <div className="flex items-center justify-center gap-1 mt-8">
      <Link
        href={pageUrl(slug, Math.max(1, currentPage - 1), view, q, sort, category)}
        aria-disabled={currentPage === 1}
        className={`px-3 py-1.5 text-sm rounded-lg border border-[var(--color-border)] transition-colors ${
          currentPage === 1 ? "pointer-events-none opacity-30" : "hover:bg-gray-50"
        }`}
      >
        ‹
      </Link>

      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`ellipsis-${i}`} className="px-2 text-sm text-[var(--color-text-muted)]">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={pageUrl(slug, p, view, q, sort, category)}
            className={`w-9 h-9 flex items-center justify-center text-sm rounded-lg border transition-colors ${
              p === currentPage
                ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                : "border-[var(--color-border)] hover:bg-gray-50"
            }`}
          >
            {p}
          </Link>
        )
      )}

      <Link
        href={pageUrl(slug, Math.min(totalPages, currentPage + 1), view, q, sort, category)}
        aria-disabled={currentPage === totalPages}
        className={`px-3 py-1.5 text-sm rounded-lg border border-[var(--color-border)] transition-colors ${
          currentPage === totalPages ? "pointer-events-none opacity-30" : "hover:bg-gray-50"
        }`}
      >
        ›
      </Link>
    </div>
  );
}
