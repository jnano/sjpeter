import { notFound } from "next/navigation";
import Link from "next/link";
import PostDetail from "@/app/(public)/boards/[slug]/[postId]/PostDetail";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";
import { auth } from "@/auth";

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
  kind?: string;
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

async function getPost(slug: string, postId: string, token?: string): Promise<Post | null> {
  try {
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`${API}/api/boards/${slug}/posts/${postId}`, {
      cache: "no-store",
      headers,
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function GalleryPostPage({
  params,
}: {
  params: Promise<{ slug: string; postId: string }>;
}) {
  const { slug, postId } = await params;
  const session = await auth();
  const token = (session as { accessToken?: string } | null)?.accessToken;
  const post = await getPost(slug, postId, token);

  if (!post) notFound();
  // 갤러리 종류가 아닌 게시판의 글이 /gallery/{slug}/{id} 로 들어오면 404
  if (post.board?.kind && post.board.kind !== "gallery") notFound();

  const boardName = post.board?.name ?? "갤러리";

  return (
    <>
      <PageHeader group="사진 갤러리" title={boardName} subtitle="공동체와 함께한 사진 기록입니다." />
      <SectionLayout autoHero={false}>
        <Link
          href={`/gallery/${slug}`}
          className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] mb-4 inline-block"
        >
          ← 목록으로
        </Link>
        <PostDetail post={post} slug={slug} />
      </SectionLayout>
    </>
  );
}
