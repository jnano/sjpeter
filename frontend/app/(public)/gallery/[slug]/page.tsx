import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";
import BannerSlider from "@/components/BannerSlider";
import { fetchParishMin } from "@/lib/parish";

export const dynamic = "force-dynamic";

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

interface Board {
  id: number;
  name: string;
  slug: string;
  description: string;
  members_only_write: boolean;
  members_only_read: boolean;
  posts_per_page: number;
  kind: string;
}

interface PostListOut {
  posts: Post[];
  total: number;
  posts_per_page: number;
}

async function getBoard(slug: string): Promise<Board | null> {
  try {
    // cache: no-store — kind 변경(예: default↔gallery) 즉시 반영
    const res = await fetch(`${API}/api/boards/${slug}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getPosts(slug: string, page: number, token?: string): Promise<PostListOut> {
  try {
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`${API}/api/boards/${slug}/posts?page=${page}`, {
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [p, board] = await Promise.all([fetchParishMin(), getBoard(slug)]);
  const title = board?.name ?? "갤러리";
  return { title, description: `${p.name} ${title}` };
}

export default async function GalleryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const { page: pageStr = "1" } = await searchParams;
  const page = Math.max(1, parseInt(pageStr) || 1);

  const [board, session] = await Promise.all([getBoard(slug), auth()]);

  // 존재하지 않거나 갤러리 종류가 아닌 게시판은 404
  if (!board || board.kind !== "gallery") {
    notFound();
  }

  const subtitle = board.description || "공동체와 함께한 사진 기록입니다.";

  if (board.members_only_read && !session) {
    return (
      <>
        <PageHeader group="사진 갤러리" title={board.name} subtitle={subtitle} />
        <SectionLayout autoHero={false}>
          <div className="text-center py-16 border border-[var(--color-border)] rounded-xl">
            <p className="text-4xl mb-4">🔒</p>
            <p className="font-semibold text-[var(--color-text)]">회원 전용 갤러리입니다.</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1 mb-6">로그인 후 이용하실 수 있습니다.</p>
            <Link
              href={`/members/login?callbackUrl=/gallery/${slug}`}
              className="px-6 py-2.5 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              로그인
            </Link>
          </div>
        </SectionLayout>
      </>
    );
  }

  const token = (session as { accessToken?: string } | null)?.accessToken;
  const postList = await getPosts(slug, page, token);
  const totalPages = Math.max(1, Math.ceil(postList.total / board.posts_per_page));
  const canWrite = !!session;
  const paginationRange = getPaginationRange(page, totalPages);

  return (
    <>
      <PageHeader
        group="사진 갤러리"
        title={board.name}
        subtitle={subtitle}
        action={canWrite ? (
          <Link
            href={`/gallery/${slug}/write`}
            className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white text-sm font-medium rounded-lg transition-colors"
          >
            사진 올리기
          </Link>
        ) : undefined}
      />
      <SectionLayout autoHero={false}>

      <BannerSlider placement="gallery_top" className="mb-6" />

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
              href={`/gallery/${slug}/${post.id}`}
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
                  {post.is_pinned && (
                    <span className="mr-1 text-amber-600" title="상단 고정">📌</span>
                  )}
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
            href={`/gallery/${slug}?page=${Math.max(1, page - 1)}`}
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
                href={`/gallery/${slug}?page=${p}`}
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
            href={`/gallery/${slug}?page=${Math.min(totalPages, page + 1)}`}
            aria-disabled={page === totalPages}
            className={`px-3 py-1.5 text-sm rounded-lg border border-[var(--color-border)] transition-colors ${
              page === totalPages ? "pointer-events-none opacity-30" : "hover:bg-gray-50"
            }`}
          >
            ›
          </Link>
        </div>
      )}
      </SectionLayout>
    </>
  );
}
