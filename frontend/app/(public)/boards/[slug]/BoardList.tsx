import Image from "next/image";
import Link from "next/link";

function AiBadge() {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 border border-violet-200 font-medium">
      AI
    </span>
  );
}

const API = process.env.NEXT_PUBLIC_API_URL;

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
}

interface Props {
  posts: Post[];
  slug: string;
  currentPage: number;
  totalPages: number;
  currentView: "list" | "photo";
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

export default function BoardList({ posts, slug, currentPage, totalPages, currentView, currentQ, currentSort, currentCategory }: Props) {
  return (
    <>
      {posts.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-text-muted)]">
          아직 작성된 글이 없습니다. 첫 번째 글을 남겨보세요.
        </div>
      ) : currentView === "list" ? (
        <ListView posts={posts} slug={slug} />
      ) : (
        <PhotoView posts={posts} slug={slug} />
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

function ListView({ posts, slug }: { posts: Post[]; slug: string }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {posts.map((post) => (
        <Link
          key={post.id}
          href={`/boards/${slug}/${post.id}`}
          className="group bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden hover:border-[var(--color-primary)] hover:shadow-sm transition-all"
        >
          {post.thumbnail_url && (
            <div className="relative w-full aspect-video">
              <Image
                src={`${API}${post.thumbnail_url}`}
                alt={post.title}
                fill
                className="object-cover group-hover:opacity-95 transition-opacity"
                sizes="(max-width: 640px) 100vw, 50vw"
              />
            </div>
          )}
          <div className="p-4">
            <p className="font-medium text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors line-clamp-2">
              {post.title}
              {post.comment_count > 0 && (
                <span className="ml-1.5 text-sm text-[var(--color-primary)]">
                  [{post.comment_count}]
                </span>
              )}
            </p>
            <div className="flex items-center justify-between mt-3 text-xs text-[var(--color-text-muted)]">
              <span className="flex items-center gap-1.5">
                {!post.member && <AiBadge />}
                {post.member?.nickname ?? "성당"}
              </span>
              <div className="flex items-center gap-2">
                <span>{new Date(post.created_at).toLocaleDateString("ko-KR")}</span>
                <span>조회 {post.view_count}</span>
              </div>
            </div>
          </div>
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
            <div className="relative w-full aspect-square">
              <Image
                src={`${API}${post.thumbnail_url}`}
                alt={post.title}
                fill
                className="object-cover group-hover:opacity-90 transition-opacity"
                sizes="(max-width: 640px) 50vw, 33vw"
              />
            </div>
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
              {post.member?.nickname ?? "성당"} · {new Date(post.created_at).toLocaleDateString("ko-KR")}
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
