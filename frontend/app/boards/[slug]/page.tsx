import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import BoardList from "./BoardList";

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

interface PostListOut {
  posts: Post[];
  total: number;
  posts_per_page: number;
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

async function getBoard(slug: string): Promise<Board | null> {
  try {
    const res = await fetch(`${API}/api/boards/${slug}`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getPosts(slug: string, page: number): Promise<PostListOut> {
  try {
    const res = await fetch(`${API}/api/boards/${slug}/posts?page=${page}`, { cache: "no-store" });
    if (!res.ok) return { posts: [], total: 0, posts_per_page: 20 };
    return res.json();
  } catch {
    return { posts: [], total: 0, posts_per_page: 20 };
  }
}

export default async function BoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; view?: string }>;
}) {
  const { slug } = await params;
  const { page: pageStr = "1", view = "list" } = await searchParams;
  const page = Math.max(1, parseInt(pageStr) || 1);

  const [board, session] = await Promise.all([getBoard(slug), auth()]);

  if (!board) notFound();

  if (board.members_only_read && !session) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/boards" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)]">
          ← 게시판 목록
        </Link>
        <h1 className="text-2xl font-bold text-[var(--color-primary)] mt-4">{board.name}</h1>
        <div className="mt-12 text-center py-16 border border-[var(--color-border)] rounded-xl">
          <p className="text-4xl mb-4">🔒</p>
          <p className="font-semibold text-[var(--color-text)]">회원 전용 게시판입니다.</p>
          <p className="text-sm text-[var(--color-text-muted)] mt-1 mb-6">로그인 후 이용하실 수 있습니다.</p>
          <Link href={`/members/login?callbackUrl=/boards/${slug}`}
            className="px-6 py-2.5 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--color-primary-dark)] transition-colors">
            로그인
          </Link>
        </div>
      </div>
    );
  }

  const postList = await getPosts(slug, page);
  const totalPages = Math.max(1, Math.ceil(postList.total / postList.posts_per_page));

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="mb-8">
        <Link href="/boards" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)]">
          ← 게시판 목록
        </Link>
        <h1 className="text-2xl font-bold text-[var(--color-primary)] mt-2">{board.name}</h1>
        {board.description && (
          <p className="text-sm text-[var(--color-text-muted)] mt-1">{board.description}</p>
        )}
      </div>

      <BoardList
        posts={postList.posts}
        slug={slug}
        currentPage={page}
        totalPages={totalPages}
        currentView={view === "photo" ? "photo" : "list"}
      />
    </div>
  );
}
