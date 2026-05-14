import { notFound } from "next/navigation";
import PostDetail from "./PostDetail";
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
  like_count?: number;
  liked_by_me?: boolean;
}

interface NeighborItem {
  id: number;
  title: string;
}

interface NeighborsOut {
  prev: NeighborItem | null;
  next: NeighborItem | null;
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

async function getNeighbors(slug: string, postId: string, token?: string): Promise<NeighborsOut> {
  try {
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`${API}/api/boards/${slug}/posts/${postId}/neighbors`, {
      cache: "no-store",
      headers,
    });
    if (!res.ok) return { prev: null, next: null };
    return res.json();
  } catch {
    return { prev: null, next: null };
  }
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string; postId: string }>;
}) {
  const { slug, postId } = await params;
  const session = await auth();
  const token = (session as { accessToken?: string } | null)?.accessToken;
  const [post, neighbors] = await Promise.all([
    getPost(slug, postId, token),
    getNeighbors(slug, postId, token),
  ]);

  if (!post) notFound();

  return (
    <SectionLayout autoHero={false}>
      <PostDetail post={post} slug={slug} neighbors={neighbors} />
    </SectionLayout>
  );
}
