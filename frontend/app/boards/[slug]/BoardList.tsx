import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL;

interface Author {
  id: number;
  nickname: string;
}

interface Post {
  id: number;
  title: string;
  member: Author;
  view_count: number;
  comment_count: number;
  created_at: string;
  thumbnail_url: string | null;
}

interface Props {
  posts: Post[];
  slug: string;
  currentPage: number;
  totalPages: number;
  currentView: "list" | "photo";
}

function pageUrl(slug: string, page: number, view: string) {
  return `/boards/${slug}?page=${page}&view=${view}`;
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

export default function BoardList({ posts, slug, currentPage, totalPages, currentView }: Props) {
  return (
    <>
      {/* 툴바 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1 border border-[var(--color-border)] rounded-lg p-1">
          <Link
            href={pageUrl(slug, 1, "list")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              currentView === "list"
                ? "bg-[var(--color-primary)] text-white"
                : "text-[var(--color-text-muted)] hover:bg-gray-100"
            }`}
          >
            목록
          </Link>
          <Link
            href={pageUrl(slug, 1, "photo")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              currentView === "photo"
                ? "bg-[var(--color-primary)] text-white"
                : "text-[var(--color-text-muted)] hover:bg-gray-100"
            }`}
          >
            사진
          </Link>
        </div>
        <Link
          href={`/boards/${slug}/write`}
          className="px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          글쓰기
        </Link>
      </div>

      {/* 게시글 목록 */}
      {posts.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-text-muted)]">
          아직 작성된 글이 없습니다. 첫 번째 글을 남겨보세요.
        </div>
      ) : currentView === "list" ? (
        <ListView posts={posts} slug={slug} />
      ) : (
        <PhotoView posts={posts} slug={slug} />
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <Pagination
          slug={slug}
          currentPage={currentPage}
          totalPages={totalPages}
          view={currentView}
        />
      )}
    </>
  );
}

function ListView({ posts, slug }: { posts: Post[]; slug: string }) {
  return (
    <div className="divide-y divide-[var(--color-border)]">
      {posts.map((post) => (
        <Link
          key={post.id}
          href={`/boards/${slug}/${post.id}`}
          className="flex items-center justify-between py-4 hover:text-[var(--color-primary)] transition-colors group"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {post.thumbnail_url && (
              <img
                src={`${API}${post.thumbnail_url}`}
                alt=""
                className="w-10 h-10 object-cover rounded shrink-0 border border-[var(--color-border)]"
              />
            )}
            <div className="min-w-0">
              <p className="font-medium truncate group-hover:text-[var(--color-primary)]">
                {post.title}
                {post.comment_count > 0 && (
                  <span className="ml-1.5 text-sm text-[var(--color-primary)]">
                    [{post.comment_count}]
                  </span>
                )}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                {post.member.nickname} · {new Date(post.created_at).toLocaleDateString("ko-KR")}
              </p>
            </div>
          </div>
          <span className="ml-4 text-xs text-[var(--color-text-muted)] shrink-0">
            조회 {post.view_count}
          </span>
        </Link>
      ))}
    </div>
  );
}

function PhotoView({ posts, slug }: { posts: Post[]; slug: string }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {posts.map((post) => (
        <Link
          key={post.id}
          href={`/boards/${slug}/${post.id}`}
          className="group rounded-xl overflow-hidden border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:shadow-md transition-all"
        >
          {post.thumbnail_url ? (
            <img
              src={`${API}${post.thumbnail_url}`}
              alt={post.title}
              className="w-full aspect-square object-cover group-hover:opacity-90 transition-opacity"
            />
          ) : (
            <div className="w-full aspect-square bg-gray-100 flex items-center justify-center">
              <span className="text-3xl text-gray-300">📄</span>
            </div>
          )}
          <div className="px-3 py-2.5">
            <p className="text-sm font-medium truncate group-hover:text-[var(--color-primary)]">
              {post.title}
              {post.comment_count > 0 && (
                <span className="ml-1 text-xs text-[var(--color-primary)]">
                  [{post.comment_count}]
                </span>
              )}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {post.member.nickname} · {new Date(post.created_at).toLocaleDateString("ko-KR")}
            </p>
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
}: {
  slug: string;
  currentPage: number;
  totalPages: number;
  view: string;
}) {
  const pages = getPaginationRange(currentPage, totalPages);

  return (
    <div className="flex items-center justify-center gap-1 mt-8">
      <Link
        href={pageUrl(slug, Math.max(1, currentPage - 1), view)}
        aria-disabled={currentPage === 1}
        className={`px-3 py-1.5 text-sm rounded-lg border border-[var(--color-border)] transition-colors ${
          currentPage === 1
            ? "pointer-events-none opacity-30"
            : "hover:bg-gray-50"
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
            href={pageUrl(slug, p, view)}
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
        href={pageUrl(slug, Math.min(totalPages, currentPage + 1), view)}
        aria-disabled={currentPage === totalPages}
        className={`px-3 py-1.5 text-sm rounded-lg border border-[var(--color-border)] transition-colors ${
          currentPage === totalPages
            ? "pointer-events-none opacity-30"
            : "hover:bg-gray-50"
        }`}
      >
        ›
      </Link>
    </div>
  );
}
