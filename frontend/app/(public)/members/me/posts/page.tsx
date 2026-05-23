"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";

const API = process.env.NEXT_PUBLIC_API_URL;

interface BoardInfo { id: number; name: string; slug: string; }
interface MyPost {
  id: number; title: string; view_count: number;
  created_at: string; comment_count: number; board: BoardInfo;
}
interface MyComment {
  id: number; content: string; created_at: string;
  post_id: number; post_title: string; board_slug: string;
}

export default function MyPostsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [posts, setPosts] = useState<MyPost[]>([]);
  const [comments, setComments] = useState<MyComment[]>([]);
  const [tab, setTab] = useState<"posts" | "comments">("posts");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/members/login?callbackUrl=/members/me/posts");
    }
  }, [status, router]);

  useEffect(() => {
    const token = session?.accessToken;
    if (!token) { if (status !== "loading") setLoading(false); return; }
    const headers = { Authorization: `Bearer ${token}` };
    const safeJson = async (r: Response) => (r.ok ? r.json() : null);
    Promise.all([
      fetch(`${API}/api/members/me/posts`, { headers }).then(safeJson).catch(() => null),
      fetch(`${API}/api/members/me/comments`, { headers }).then(safeJson).catch(() => null),
    ]).then(([postsData, commentsData]) => {
      setPosts(Array.isArray(postsData) ? postsData : []);
      setComments(Array.isArray(commentsData) ? commentsData : []);
      setLoading(false);
    });
  }, [session?.accessToken, status]);

  if (loading) {
    return <div className="min-h-[70vh] flex items-center justify-center"><p className="text-[var(--color-text-muted)]">불러오는 중...</p></div>;
  }

  return (
    <>
      <PageHeader group="회원" title="내가 쓴 글" subtitle={`작성한 글 ${posts.length}건 · 작성한 댓글 ${comments.length}건`} />
      <SectionLayout>
        <div className="max-w-3xl mx-auto">
          <div className="mb-4">
            <Link href="/members/me" className="text-sm text-[var(--color-primary)] hover:underline">← 마이페이지</Link>
          </div>

          <div className="flex gap-2 mb-6">
            {(["posts", "comments"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === t ? "bg-[var(--color-primary)] text-white" : "border border-[var(--color-border)] hover:bg-gray-50"
                }`}>
                {t === "posts" ? `내 글 (${posts.length})` : `내 댓글 (${comments.length})`}
              </button>
            ))}
          </div>

          {tab === "posts" && (
            <div className="space-y-2">
              {posts.length === 0 ? (
                <p className="text-center py-12 text-[var(--color-text-muted)]">작성한 글이 없습니다.</p>
              ) : posts.map((post) => (
                <Link key={post.id} href={`/boards/${post.board.slug}/${post.id}`}
                  className="block p-4 bg-white border border-[var(--color-border)] rounded-lg hover:border-[var(--color-primary)] transition-colors">
                  <p className="font-medium">{post.title}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    {post.board.name} · 조회 {post.view_count} · 댓글 {post.comment_count} ·{" "}
                    {new Date(post.created_at).toLocaleDateString("ko-KR")}
                  </p>
                </Link>
              ))}
            </div>
          )}

          {tab === "comments" && (
            <div className="space-y-2">
              {comments.length === 0 ? (
                <p className="text-center py-12 text-[var(--color-text-muted)]">작성한 댓글이 없습니다.</p>
              ) : comments.map((comment) => (
                <Link key={comment.id} href={`/boards/${comment.board_slug}/${comment.post_id}`}
                  className="block p-4 bg-white border border-[var(--color-border)] rounded-lg hover:border-[var(--color-primary)] transition-colors">
                  <p className="text-sm">{comment.content}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    {comment.post_title} · {new Date(comment.created_at).toLocaleDateString("ko-KR")}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </SectionLayout>
    </>
  );
}
