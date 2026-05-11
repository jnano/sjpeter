import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "행사 사진",
  description: "세종성베드로성당 공동체 행사 사진 모음",
};

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const BOARD_SLUG = "photo";

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

interface Board {
  id: number;
  name: string;
  slug: string;
  description: string;
  members_only_write: boolean;
  members_only_read: boolean;
  posts_per_page: number;
}

interface PostListOut {
  posts: Post[];
  total: number;
  posts_per_page: number;
}

async function getBoard(): Promise<Board | null> {
  try {
    const res = await fetch(`${API}/api/boards/${BOARD_SLUG}`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getPosts(page: number, token?: string): Promise<PostListOut> {
  try {
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`${API}/api/boards/${BOARD_SLUG}/posts?page=${page}`, {
      next: { revalidate: 300 },
      headers,
    });
    if (!res.ok) return { posts: [], total: 0, posts_per_page: 12 };
    return res.json();
  } catch {
    return { posts: [], total: 0, posts_per_page: 12 };
  }
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

export default async function EventsGalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageStr = "1" } = await searchParams;
  const page = Math.max(1, parseInt(pageStr) || 1);

  const [board, session] = await Promise.all([getBoard(), auth()]);

  const subtitle = board?.description || "공동체가 함께한 행사와 나눔의 기록입니다.";

  if (!board) {
    return (
      <>
        <PageHeader group="사진 갤러리" title="행사 사진" subtitle="공동체가 함께한 행사와 나눔의 기록입니다." />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-[var(--color-surface-warm)] border border-[var(--color-border)] rounded-xl p-16 text-center">
            <div className="text-6xl mb-5">🖼️</div>
            <p className="font-serif text-xl text-[var(--color-primary)] mb-3">준비 중입니다</p>
            <p className="text-sm text-[var(--color-text-muted)]">
              함께했던 행사 사진들을 정리하여 곧 공개하겠습니다.
            </p>
          </div>
        </div>
      </>
    );
  }

  if (board.members_only_read && !session) {
    return (
      <>
        <PageHeader group="사진 갤러리" title="행사 사진" subtitle={subtitle} />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center py-16 border border-[var(--color-border)] rounded-xl">
            <p className="text-4xl mb-4">🔒</p>
            <p className="font-semibold text-[var(--color-text)]">회원 전용 갤러리입니다.</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1 mb-6">로그인 후 이용하실 수 있습니다.</p>
            <Link
              href="/members/login?callbackUrl=/gallery/events"
              className="px-6 py-2.5 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              로그인
            </Link>
          </div>
        </div>
      </>
    );
  }

  const token = (session as { accessToken?: string } | null)?.accessToken;
  const postList = await getPosts(page, token);
  const totalPages = Math.max(1, Math.ceil(postList.total / board.posts_per_page));
  const canWrite = !!session;
  const paginationRange = getPaginationRange(page, totalPages);

  return (
    <>
      <PageHeader
        group="사진 갤러리"
        title="행사 사진"
        subtitle={subtitle}
        action={canWrite ? (
          <Link
            href="/gallery/events/write"
            className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white text-sm font-medium rounded-lg transition-colors"
          >
            사진 올리기
          </Link>
        ) : undefined}
      />
      <div className="max-w-4xl mx-auto px-4 py-8">

      {postList.posts.length === 0 ? (
        <div className="text-center py-20 text-[var(--color-text-muted)] border border-[var(--color-border)] rounded-xl">
          <div className="text-5xl mb-4">📷</div>
          <p className="font-serif text-lg text-[var(--color-primary)] mb-2">아직 사진이 없습니다</p>
          {canWrite && (
            <p className="text-sm">첫 번째 사진을 올려보세요.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {postList.posts.map((post) => (
            <Link
              key={post.id}
              href={`/gallery/events/${post.id}`}
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
                <div className="w-full aspect-square bg-[var(--color-surface-warm)] flex items-center justify-center">
                  <span className="text-4xl text-[var(--color-border-dark)]">📷</span>
                </div>
              )}
              <div className="px-3 py-2.5 bg-white">
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
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-10">
          <Link
            href={`/gallery/events?page=${Math.max(1, page - 1)}`}
            aria-disabled={page === 1}
            className={`px-3 py-1.5 text-sm rounded-lg border border-[var(--color-border)] transition-colors ${
              page === 1 ? "pointer-events-none opacity-30" : "hover:bg-gray-50"
            }`}
          >
            ‹
          </Link>
          {paginationRange.map((p, i) =>
            p === "…" ? (
              <span key={`e-${i}`} className="px-2 text-sm text-[var(--color-text-muted)]">…</span>
            ) : (
              <Link
                key={p}
                href={`/gallery/events?page=${p}`}
                className={`w-9 h-9 flex items-center justify-center text-sm rounded-lg border transition-colors ${
                  p === page
                    ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                    : "border-[var(--color-border)] hover:bg-gray-50"
                }`}
              >
                {p}
              </Link>
            )
          )}
          <Link
            href={`/gallery/events?page=${Math.min(totalPages, page + 1)}`}
            aria-disabled={page === totalPages}
            className={`px-3 py-1.5 text-sm rounded-lg border border-[var(--color-border)] transition-colors ${
              page === totalPages ? "pointer-events-none opacity-30" : "hover:bg-gray-50"
            }`}
          >
            ›
          </Link>
        </div>
      )}
    </div>
    </>
  );
}
