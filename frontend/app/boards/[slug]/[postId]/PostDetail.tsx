"use client";
import Image from "next/image";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Author {
  id: number;
  nickname: string;
  avatar_url?: string | null;
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

function Avatar({ author, size = 24 }: { author: Author; size?: number }) {
  if (author.avatar_url) {
    return (
      <Image
        src={author.avatar_url}
        alt={author.nickname}
        width={size}
        height={size}
        className="rounded-full object-cover shrink-0"
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size }}
      className="rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center text-[10px] font-bold text-[var(--color-primary)] shrink-0"
    >
      {author.nickname[0]}
    </span>
  );
}

export default function PostDetail({ post, slug }: { post: Post; slug: string }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [comments, setComments] = useState<Comment[]>(post.comments);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const authHeader = { Authorization: `Bearer ${session?.accessToken}` };
  const myId = session?.memberId ?? null;

  const isBoardModerator = myId !== null && post.board?.moderator_id === myId;
  const isPostAuthor = myId !== null && post.member?.id === myId;
  const canEditPost = isPostAuthor || isBoardModerator;

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim() || !session) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/boards/${slug}/posts/${post.id}/comments`, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment }),
      });
      if (res.ok) {
        const created: Comment = await res.json();
        setComments((prev) => [...prev, created]);
        setNewComment("");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteComment(commentId: number) {
    if (!confirm("댓글을 삭제하시겠습니까?")) return;
    const res = await fetch(
      `${API}/api/boards/${slug}/posts/${post.id}/comments/${commentId}`,
      { method: "DELETE", headers: authHeader }
    );
    if (res.ok) {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    }
  }

  async function deletePost() {
    if (!confirm("게시글을 삭제하시겠습니까?")) return;
    const res = await fetch(`${API}/api/boards/${slug}/posts/${post.id}`, {
      method: "DELETE",
      headers: authHeader,
    });
    if (res.ok) {
      router.refresh();
      router.push(`/boards/${slug}`);
    }
  }

  return (
    <>
      {/* 제목 + 메타 */}
      <div className="mt-4 border-b border-[var(--color-border)] pb-6 mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text)] mb-3">{post.title}</h1>
        <div className="flex items-center text-sm text-[var(--color-text-muted)]">
          <span className="flex items-center gap-1.5">
            <Avatar author={post.member} size={20} />
            {post.member.nickname} ·{" "}
            {new Date(post.created_at).toLocaleDateString("ko-KR", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}{" "}
            · 조회 {post.view_count}
          </span>
        </div>
      </div>

      {/* 본문 */}
      <div className="text-[var(--color-text)] leading-relaxed whitespace-pre-wrap mb-8">
        {post.content}
      </div>

      {/* 첨부파일 */}
      {post.attachments && post.attachments.length > 0 && (() => {
        const images = post.attachments.filter((a) => a.is_image);
        const others = post.attachments.filter((a) => !a.is_image);
        return (
          <div className="mb-12 space-y-4">
            {images.length > 0 && (
              <div className="flex flex-col items-center gap-5">
                {images.map((att) => (
                  <a
                    key={att.id}
                    href={`${API}${att.file_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="max-w-[90%]"
                  >
                    <img
                      src={`${API}${att.file_url}`}
                      alt={att.original_name}
                      className="max-w-full h-auto rounded-lg border border-[var(--color-border)] hover:opacity-90 transition-opacity"
                    />
                  </a>
                ))}
              </div>
            )}
            {others.length > 0 && (
              <div className="border border-[var(--color-border)] rounded-lg divide-y divide-[var(--color-border)]">
                {others.map((att) => (
                  <a
                    key={att.id}
                    href={`${API}${att.file_url}`}
                    download={att.original_name}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-gray-400 text-lg">📎</span>
                    <span className="flex-1 text-sm text-[var(--color-text)] truncate">{att.original_name}</span>
                    <span className="text-xs text-[var(--color-text-muted)] shrink-0">{formatBytes(att.file_size)}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* 액션 바 */}
      <div className="flex justify-end gap-2 mb-8 pt-4 border-t border-[var(--color-border)]">
        {canEditPost && (
          <>
            <Link
              href={`/boards/${slug}/${post.id}/edit`}
              className="px-4 py-1.5 border border-[var(--color-border)] text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors text-[var(--color-text-muted)]"
            >
              수정
            </Link>
            <button
              onClick={deletePost}
              className="px-4 py-1.5 border border-red-200 text-xs font-medium rounded-lg hover:bg-red-50 transition-colors text-red-500"
            >
              삭제
            </button>
          </>
        )}
        <Link
          href={`/boards/${slug}`}
          className="px-4 py-1.5 bg-[var(--color-primary)] text-white text-xs font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          목록으로
        </Link>
      </div>

      {/* 댓글 */}
      <div>
        <h2 className="text-lg font-semibold mb-4">
          댓글 <span className="text-[var(--color-primary)]">{comments.length}</span>
        </h2>

        <div className="space-y-4 mb-6">
          {comments.length === 0 && (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-4">
              첫 댓글을 남겨보세요.
            </p>
          )}
          {comments.map((comment) => {
            const isCommentAuthor = myId !== null && comment.member.id === myId;
            return (
              <div key={comment.id} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <Avatar author={comment.member} size={20} />
                    {comment.member.nickname}
                  </span>
                  <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                    <span>{new Date(comment.created_at).toLocaleDateString("ko-KR")}</span>
                    {isCommentAuthor && (
                      <button
                        onClick={() => deleteComment(comment.id)}
                        className="hover:text-red-500 transition-colors"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-[var(--color-text)] whitespace-pre-wrap">
                  {comment.content}
                </p>
              </div>
            );
          })}
        </div>

        {/* 댓글 입력 */}
        {session ? (
          <form onSubmit={submitComment} className="flex gap-2">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="댓글을 입력하세요..."
              rows={2}
              className="flex-1 px-4 py-2.5 border border-[var(--color-border)] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent text-sm"
            />
            <button
              type="submit"
              disabled={submitting || !newComment.trim()}
              className="px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50 self-end"
            >
              등록
            </button>
          </form>
        ) : (
          <p className="text-sm text-[var(--color-text-muted)] text-center py-4">
            <Link href="/members/login" className="text-[var(--color-primary)] hover:underline">
              로그인
            </Link>
            하면 댓글을 작성할 수 있습니다.
          </p>
        )}
      </div>
    </>
  );
}
