"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import MarkdownContent from "@/components/MarkdownContent";

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
  share_enabled?: boolean;
}

interface Post {
  id: number;
  title: string;
  content: string;
  view_count: number;
  created_at: string;
  updated_at: string;
  member: Author | null;
  comments: Comment[];
  attachments: Attachment[];
  board: BoardInfo | null;
  like_count?: number;
  liked_by_me?: boolean;
  share_allowed?: boolean;
  share_count?: number;
}

interface NeighborItem {
  id: number;
  title: string;
}

interface NeighborsOut {
  prev: NeighborItem | null;
  next: NeighborItem | null;
}

function Avatar({ author, size = 24 }: { author: Author | null; size?: number }) {
  if (author?.avatar_url) {
    const src = author.avatar_url.startsWith("/")
      ? `${API}${author.avatar_url}`
      : author.avatar_url;
    return (
      <Image
        src={src}
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
      {author ? author.nickname[0] : "성"}
    </span>
  );
}

interface CommentItemProps {
  comment: Comment;
  myId: number | null;
  isOperator: boolean;  // admin/운영자 — 타인 댓글도 수정·삭제 가능
  editingId: number | null;
  editContent: string;
  replyingTo: number | null;
  replyContent: string;
  submitting: boolean;
  session: ReturnType<typeof useSession>["data"];
  onStartEdit: (c: Comment) => void;
  onSaveEdit: (id: number) => void;
  onCancelEdit: () => void;
  onDeleteComment: (id: number) => void;
  onSetEditContent: (v: string) => void;
  onReplyingTo: (id: number | null) => void;
  onSetReplyContent: (v: string) => void;
  onSubmitReply: (parentId: number) => void;
}

function CommentItem({
  comment, myId, isOperator, editingId, editContent, replyingTo, replyContent,
  submitting, session,
  onStartEdit, onSaveEdit, onCancelEdit, onDeleteComment, onSetEditContent,
  onReplyingTo, onSetReplyContent, onSubmitReply,
}: CommentItemProps) {
  const isAuthor = myId !== null && comment.member.id === myId;
  const canManage = isAuthor || isOperator;
  const isEditing = editingId === comment.id;
  const isReplying = replyingTo === comment.id;

  return (
    <div>
      <div className="p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <Avatar author={comment.member} size={20} />
            {comment.member.nickname}
          </span>
          <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
            <span>{new Date(comment.created_at).toLocaleDateString("ko-KR")}</span>
            {session && !isEditing && (
              <button
                onClick={() => { onReplyingTo(isReplying ? null : comment.id); onSetReplyContent(""); }}
                className="hover:text-[var(--color-primary)] transition-colors"
              >
                답글
              </button>
            )}
            {canManage && !isEditing && (
              <>
                <button onClick={() => onStartEdit(comment)} className="hover:text-[var(--color-primary)] transition-colors">수정</button>
                <button onClick={() => onDeleteComment(comment.id)} className="hover:text-red-500 transition-colors">삭제</button>
              </>
            )}
          </div>
        </div>
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editContent}
              onChange={(e) => onSetEditContent(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={onCancelEdit} className="px-3 py-1 text-xs border border-[var(--color-border)] rounded-lg hover:bg-gray-100">취소</button>
              <button onClick={() => onSaveEdit(comment.id)} disabled={!editContent.trim()} className="px-3 py-1 text-xs bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] disabled:opacity-40">저장</button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--color-text)] whitespace-pre-wrap">{comment.content}</p>
        )}
      </div>

      {/* 답글 입력창 */}
      {isReplying && (
        <div className="ml-6 mt-2 flex gap-2">
          <textarea
            value={replyContent}
            onChange={(e) => onSetReplyContent(e.target.value)}
            placeholder="답글을 입력하세요..."
            rows={2}
            className="flex-1 px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
          <div className="flex flex-col gap-1 shrink-0">
            <button
              onClick={() => onSubmitReply(comment.id)}
              disabled={submitting || !replyContent.trim()}
              className="px-3 py-1.5 bg-[var(--color-primary)] text-white text-xs font-medium rounded-lg hover:bg-[var(--color-primary-dark)] disabled:opacity-50"
            >등록</button>
            <button
              onClick={() => onReplyingTo(null)}
              className="px-3 py-1.5 border border-[var(--color-border)] text-xs rounded-lg hover:bg-gray-50"
            >취소</button>
          </div>
        </div>
      )}

      {/* 대댓글 목록 */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-6 mt-2 space-y-2">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="p-3 bg-blue-50/50 border-l-2 border-[var(--color-primary)]/30 rounded-r-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="flex items-center gap-1.5 text-xs font-medium">
                  <span className="text-[var(--color-primary)]/50 text-xs">└</span>
                  <Avatar author={reply.member} size={16} />
                  {reply.member.nickname}
                </span>
                <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                  <span>{new Date(reply.created_at).toLocaleDateString("ko-KR")}</span>
                  {(isOperator || (myId !== null && reply.member.id === myId)) && (
                    <button onClick={() => onDeleteComment(reply.id)} className="hover:text-red-500 transition-colors">삭제</button>
                  )}
                </div>
              </div>
              <p className="text-sm text-[var(--color-text)] whitespace-pre-wrap pl-4">{reply.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


export default function PostDetail({
  post,
  slug,
  neighbors,
}: {
  post: Post;
  slug: string;
  neighbors?: NeighborsOut;
}) {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  // 목록에서 from=encoded(qs) 를 받아 삭제·취소 시 그 페이지·필터로 복귀.
  // 갤러리 종류 게시판도 /boards/{slug} 라우트에서 photo 뷰로 표시되므로 경로는 단일 (v1.5.201).
  const backToListHref = (() => {
    const from = searchParams?.get("from");
    return from ? `/boards/${slug}?${from}` : `/boards/${slug}`;
  })();
  const [comments, setComments] = useState<Comment[]>(post.comments);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [likeCount, setLikeCount] = useState<number>(post.like_count ?? 0);
  const [likedByMe, setLikedByMe] = useState<boolean>(post.liked_by_me ?? false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [shareCount, setShareCount] = useState<number>(post.share_count ?? 0);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareToast, setShareToast] = useState<string>("");
  // admin 토큰이 있으면 admin 으로 인식 — 공개 페이지에서도 글 수정·삭제 허용
  const [adminToken, setAdminToken] = useState<string | null>(null);
  useEffect(() => {
    try {
      const t = localStorage.getItem("admin_token");
      const expStr = localStorage.getItem("admin_token_exp");
      const exp = expStr ? Number(expStr) : 0;
      if (t && exp && Date.now() < exp) setAdminToken(t);
    } catch {}
  }, []);

  // 슈퍼관리자(admin 토큰) OR 운영자(session.isAdmin) — 권한 동등
  const isDelegatedAdmin = !!(session as { isAdmin?: boolean } | null)?.isAdmin;
  const isAdmin = !!adminToken || isDelegatedAdmin;
  // 글 수정·삭제·첨부 — admin 토큰 우선
  const authHeader = { Authorization: `Bearer ${adminToken ?? session?.accessToken ?? ""}` };
  // 댓글·좋아요는 백엔드가 회원 인증만 허용 — admin 토큰 거부됨(403)
  const memberAuthHeader = { Authorization: `Bearer ${session?.accessToken ?? ""}` };
  const myId = session?.memberId ?? null;

  async function handleShare() {
    if (shareBusy) return;
    setShareBusy(true);
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/boards/${slug}/${post.id}`;
    const title = post.title;
    let ok = false;
    try {
      const nav = typeof window !== "undefined" ? (window.navigator as Navigator & { share?: (d: ShareData) => Promise<void> }) : null;
      if (nav?.share) {
        await nav.share({ title, url });
        ok = true;
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setShareToast("링크가 복사되었습니다");
        ok = true;
      }
    } catch (err) {
      // Web Share API에서 사용자가 취소(AbortError)하면 카운트 증가시키지 않음
      const isAbort = err instanceof Error && err.name === "AbortError";
      if (!isAbort) {
        setShareToast("공유에 실패했습니다");
      }
    }
    if (ok) {
      try {
        const res = await fetch(`${API}/api/boards/${slug}/posts/${post.id}/share`, { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          setShareCount(data.share_count ?? shareCount + 1);
        }
      } catch {}
    }
    setShareBusy(false);
  }

  // 공유 토스트 자동 사라짐
  useEffect(() => {
    if (!shareToast) return;
    const t = setTimeout(() => setShareToast(""), 2500);
    return () => clearTimeout(t);
  }, [shareToast]);

  async function toggleLike() {
    if (!session?.accessToken) {
      router.push(`/members/login?callbackUrl=/boards/${slug}/${post.id}`);
      return;
    }
    if (likeBusy) return;
    setLikeBusy(true);
    try {
      const res = await fetch(`${API}/api/boards/${slug}/posts/${post.id}/like`, {
        method: "POST",
        headers: memberAuthHeader,
      });
      if (res.ok) {
        const data = await res.json();
        setLikeCount(data.like_count ?? 0);
        setLikedByMe(!!data.liked_by_me);
      }
    } finally {
      setLikeBusy(false);
    }
  }

  const isBoardModerator = myId !== null && post.board?.moderator_id === myId;
  const isPostAuthor = myId !== null && post.member?.id === myId;
  const canEditPost = isPostAuthor || isBoardModerator || isAdmin;

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim() || !session) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/boards/${slug}/posts/${post.id}/comments`, {
        method: "POST",
        headers: { ...memberAuthHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment }),
      });
      if (res.ok) {
        const created: Comment = await res.json();
        setComments((prev) => [...prev, { ...created, replies: [] }]);
        setNewComment("");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function submitReply(parentId: number) {
    if (!replyContent.trim() || !session) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/boards/${slug}/posts/${post.id}/comments`, {
        method: "POST",
        headers: { ...memberAuthHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ content: replyContent, parent_id: parentId }),
      });
      if (res.ok) {
        const created: Comment = await res.json();
        setComments((prev) =>
          prev.map((c) =>
            c.id === parentId
              ? { ...c, replies: [...(c.replies ?? []), created] }
              : c
          )
        );
        setReplyContent("");
        setReplyingTo(null);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(comment: Comment) {
    setEditingId(comment.id);
    setEditContent(comment.content);
  }

  async function saveEdit(commentId: number) {
    if (!editContent.trim()) return;
    const res = await fetch(
      `${API}/api/boards/${slug}/posts/${post.id}/comments/${commentId}`,
      {
        method: "PUT",
        headers: { ...memberAuthHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent.trim() }),
      }
    );
    if (res.ok) {
      const updated: Comment = await res.json();
      setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
      setEditingId(null);
    }
  }

  async function deleteComment(commentId: number) {
    if (!confirm("댓글을 삭제하시겠습니까?")) return;
    const res = await fetch(
      `${API}/api/boards/${slug}/posts/${post.id}/comments/${commentId}`,
      { method: "DELETE", headers: memberAuthHeader }
    );
    if (res.ok) {
      setComments((prev) =>
        prev
          .filter((c) => c.id !== commentId)
          .map((c) => ({ ...c, replies: c.replies.filter((r) => r.id !== commentId) }))
      );
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
      router.push(backToListHref);
    }
  }

  // admin/운영자 전용: 다른 게시판으로 이동 — admin/boards 패널과 동일한 prompt 패턴
  async function movePost() {
    const r = await fetch(`${API}/api/boards`);
    const allBoards: { slug: string; name: string; is_active: boolean }[] = r.ok ? await r.json() : [];
    const candidates = allBoards.filter((b) => b.slug !== slug && b.is_active);
    if (candidates.length === 0) { alert("이동 가능한 다른 게시판이 없습니다."); return; }
    const lines = candidates.map((b, i) => `${i + 1}. ${b.name} (${b.slug})`).join("\n");
    const answer = window.prompt(`「${post.title}」을(를) 어느 게시판으로 이동할까요?\n번호 또는 slug 입력.\n\n${lines}`);
    if (!answer) return;
    const num = parseInt(answer);
    const target = Number.isFinite(num) && num >= 1 && num <= candidates.length
      ? candidates[num - 1]
      : candidates.find((b) => b.slug === answer.trim());
    if (!target) { alert("올바른 게시판을 선택하세요."); return; }
    const res = await fetch(`${API}/api/boards/${slug}/posts/${post.id}/move`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({ target_slug: target.slug }),
    });
    if (res.ok) {
      router.push(`/boards/${target.slug}/${post.id}`);
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.detail || "이동에 실패했습니다.");
    }
  }

  // admin/운영자 전용: 다중 게시판 복사
  async function copyPost() {
    const r = await fetch(`${API}/api/boards`);
    const allBoards: { slug: string; name: string; is_active: boolean }[] = r.ok ? await r.json() : [];
    const candidates = allBoards.filter((b) => b.slug !== slug && b.is_active);
    if (candidates.length === 0) { alert("복사 가능한 다른 게시판이 없습니다."); return; }
    const lines = candidates.map((b, i) => `${i + 1}. ${b.name} (${b.slug})`).join("\n");
    const answer = window.prompt(`「${post.title}」을(를) 어느 게시판들로 복사할까요?\n번호 또는 slug를 콤마로 구분.\n예: 1,3 또는 notice,free\n\n${lines}`);
    if (!answer) return;
    const tokens = answer.split(",").map((s) => s.trim()).filter(Boolean);
    const target_slugs: string[] = [];
    for (const tok of tokens) {
      const n = parseInt(tok);
      const t = Number.isFinite(n) && n >= 1 && n <= candidates.length
        ? candidates[n - 1]
        : candidates.find((b) => b.slug === tok);
      if (t) target_slugs.push(t.slug);
    }
    if (target_slugs.length === 0) { alert("올바른 게시판을 선택하세요."); return; }
    const res = await fetch(`${API}/api/boards/${slug}/posts/${post.id}/copy`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({ target_slugs }),
    });
    if (res.ok) {
      const data = await res.json();
      const created = data.created ?? [];
      const failed = data.failed ?? [];
      let msg = `${created.length}건 복사 완료`;
      if (failed.length > 0) msg += `\n실패 ${failed.length}건: ${failed.map((f: { slug: string; reason: string }) => `${f.slug}(${f.reason})`).join(", ")}`;
      alert(msg);
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.detail || "복사에 실패했습니다.");
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
            {post.member?.nickname ?? "성당"} ·{" "}
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
      <div className="mb-8">
        <MarkdownContent content={post.content} size="base" />
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

      {/* 액션 바 — 권한별 노출:
          이동·복사: admin/운영자만
          수정·삭제: admin/운영자/게시판관리자/작성자 */}
      <div className="flex justify-end gap-2 mb-8 pt-4 border-t border-[var(--color-border)]">
        {isAdmin && (
          <>
            <button
              onClick={movePost}
              className="px-4 py-1.5 border border-[var(--color-border)] text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors text-[var(--color-text-muted)]"
              title="다른 게시판으로 이동"
            >
              이동
            </button>
            <button
              onClick={copyPost}
              className="px-4 py-1.5 border border-blue-200 text-xs font-medium rounded-lg hover:bg-blue-50 transition-colors text-blue-600"
              title="다중 게시판으로 복사"
            >
              복사
            </button>
          </>
        )}
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
          href={backToListHref}
          className="px-4 py-1.5 bg-[var(--color-primary)] text-white text-xs font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          목록으로
        </Link>
      </div>

      {/* 추천·공유 버튼 — 공유 버튼은 게시판 share_enabled && 글 share_allowed 일 때만 노출 */}
      <div className="flex justify-center my-6 gap-3 relative">
        <button
          type="button"
          onClick={toggleLike}
          disabled={likeBusy}
          aria-pressed={likedByMe}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full border-2 transition-all ${
            likedByMe
              ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
              : "bg-white text-[var(--color-text)] border-[var(--color-border)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
          } ${likeBusy ? "opacity-60 cursor-wait" : ""}`}
        >
          <span aria-hidden>{likedByMe ? "❤️" : "🤍"}</span>
          <span className="text-sm font-medium">추천</span>
          <span className="text-sm font-bold tabular-nums">{likeCount}</span>
        </button>
        {post.board?.share_enabled && post.share_allowed && (
          <button
            type="button"
            onClick={handleShare}
            disabled={shareBusy}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full border-2 bg-white text-[var(--color-text)] border-[var(--color-border)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-all ${shareBusy ? "opacity-60 cursor-wait" : ""}`}
            aria-label="공유"
          >
            <span aria-hidden>🔗</span>
            <span className="text-sm font-medium">공유</span>
            <span className="text-sm font-bold tabular-nums">{shareCount}</span>
          </button>
        )}
        {shareToast && (
          <span
            role="status"
            className="absolute -bottom-9 left-1/2 -translate-x-1/2 text-xs bg-[var(--color-text)] text-white px-3 py-1.5 rounded-full whitespace-nowrap shadow"
          >
            {shareToast}
          </span>
        )}
      </div>

      {/* 이전·다음 글 네비 */}
      {(neighbors?.prev || neighbors?.next) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
          {neighbors?.prev ? (
            <Link
              href={`/boards/${slug}/${neighbors.prev.id}`}
              className="group block border border-[var(--color-border)] rounded-lg p-3 hover:border-[var(--color-primary)]/30 hover:bg-[var(--color-surface-warm)] transition-colors"
            >
              <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest mb-1">← 이전 글</p>
              <p className="text-sm text-[var(--color-text)] line-clamp-2 group-hover:text-[var(--color-primary)] transition-colors">
                {neighbors.prev.title}
              </p>
            </Link>
          ) : (
            <div aria-hidden className="hidden sm:block" />
          )}
          {neighbors?.next ? (
            <Link
              href={`/boards/${slug}/${neighbors.next.id}`}
              className="group block border border-[var(--color-border)] rounded-lg p-3 hover:border-[var(--color-primary)]/30 hover:bg-[var(--color-surface-warm)] transition-colors sm:text-right"
            >
              <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest mb-1">다음 글 →</p>
              <p className="text-sm text-[var(--color-text)] line-clamp-2 group-hover:text-[var(--color-primary)] transition-colors">
                {neighbors.next.title}
              </p>
            </Link>
          ) : (
            <div aria-hidden className="hidden sm:block" />
          )}
        </div>
      )}

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
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              myId={myId}
              isOperator={isAdmin}
              editingId={editingId}
              editContent={editContent}
              replyingTo={replyingTo}
              replyContent={replyContent}
              submitting={submitting}
              session={session}
              onStartEdit={startEdit}
              onSaveEdit={saveEdit}
              onCancelEdit={() => setEditingId(null)}
              onDeleteComment={deleteComment}
              onSetEditContent={setEditContent}
              onReplyingTo={setReplyingTo}
              onSetReplyContent={setReplyContent}
              onSubmitReply={submitReply}
            />
          ))}
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
