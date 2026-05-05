import { notFound } from "next/navigation";
import Link from "next/link";
import PostDetail from "./PostDetail";

const API = process.env.NEXT_PUBLIC_API_URL;

interface Author {
  id: number;
  nickname: string;
}

interface Comment {
  id: number;
  content: string;
  created_at: string;
  member: Author;
}

interface Attachment {
  id: number;
  original_name: string;
  file_url: string;
  file_size: number;
  is_image: boolean;
}

interface BoardInfo {
  id: number;
  name: string;
  slug: string;
  moderator_id: number | null;
}

interface Post {
  id: number;
  title: string;
  content: string;
  view_count: number;
  created_at: string;
  updated_at: string;
  member: Author;
  comments: Comment[];
  attachments: Attachment[];
  board: BoardInfo | null;
}

async function getPost(slug: string, postId: string): Promise<Post | null> {
  try {
    const res = await fetch(`${API}/api/boards/${slug}/posts/${postId}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string; postId: string }>;
}) {
  const { slug, postId } = await params;
  const post = await getPost(slug, postId);

  if (!post) notFound();

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <Link
        href={`/boards/${slug}`}
        className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
      >
        ← 목록으로
      </Link>
      <PostDetail post={post} slug={slug} />
    </div>
  );
}
