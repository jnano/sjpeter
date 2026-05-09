import { notFound } from "next/navigation";
import Link from "next/link";
import PostDetail from "@/app/boards/[slug]/[postId]/PostDetail";
import PageHeader from "@/components/PageHeader";
import { auth } from "@/auth";

const API = process.env.NEXT_PUBLIC_API_URL;
const SLUG = "photo";

interface Author {
  id: number;
  nickname: string;
}

interface Comment {
  id: number;
  content: string;
  created_at: string;
  member: Author;
  parent_id: number | null;
  replies: Comment[];
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

async function getPost(postId: string, token?: string): Promise<Post | null> {
  try {
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`${API}/api/boards/${SLUG}/posts/${postId}`, {
      cache: "no-store",
      headers,
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function EventPostPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  const session = await auth();
  const token = (session as { accessToken?: string } | null)?.accessToken;
  const post = await getPost(postId, token);

  if (!post) notFound();

  return (
    <>
      <PageHeader group="사진 갤러리" title="행사 사진" subtitle="공동체가 함께한 행사와 나눔의 기록입니다." />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link
          href="/gallery/events"
          className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] mb-4 inline-block"
        >
          ← 목록으로
        </Link>
        <PostDetail post={post} slug={SLUG} />
      </div>
    </>
  );
}
