"use client";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL;

interface BoardInfo {
  id: number;
  name: string;
  slug: string;
}

interface MyPost {
  id: number;
  title: string;
  view_count: number;
  created_at: string;
  comment_count: number;
  board: BoardInfo;
}

interface MyComment {
  id: number;
  content: string;
  created_at: string;
  post_id: number;
  post_title: string;
  board_slug: string;
}

interface MemberInfo {
  id: number;
  email: string;
  nickname: string;
  avatar_url: string | null;
  created_at: string;
}

export default function MypagePage() {
  const { data: session, update } = useSession();
  const [member, setMember] = useState<MemberInfo | null>(null);
  const [posts, setPosts] = useState<MyPost[]>([]);
  const [comments, setComments] = useState<MyComment[]>([]);
  const [tab, setTab] = useState<"posts" | "comments">("posts");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!session?.accessToken) return;

    const headers = { Authorization: `Bearer ${session.accessToken}` };

    Promise.all([
      fetch(`${API}/api/members/me`, { headers }).then((r) => r.json()),
      fetch(`${API}/api/members/me/posts`, { headers }).then((r) => r.json()),
      fetch(`${API}/api/members/me/comments`, { headers }).then((r) => r.json()),
    ]).then(([memberData, postsData, commentsData]) => {
      setMember(memberData);
      setPosts(Array.isArray(postsData) ? postsData : []);
      setComments(Array.isArray(commentsData) ? commentsData : []);
      setLoading(false);
    });
  }, [session]);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !session?.accessToken) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API}/api/members/me/avatar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.accessToken}` },
        body: formData,
      });
      if (res.ok) {
        const updated: MemberInfo = await res.json();
        setMember(updated);
        const newImage = updated.avatar_url ? `${API}${updated.avatar_url}` : null;
        await update({ picture: newImage });
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleAvatarDelete() {
    if (!session?.accessToken) return;
    if (!confirm("프로필 사진을 삭제하시겠습니까?")) return;

    const res = await fetch(`${API}/api/members/me/avatar`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    if (res.ok) {
      const updated: MemberInfo = await res.json();
      setMember(updated);
      await update({ picture: null });
    }
  }

  const avatarSrc = member?.avatar_url
    ? member.avatar_url.startsWith("http")
      ? member.avatar_url
      : `${API}${member.avatar_url}`
    : null;

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <p className="text-[var(--color-text-muted)]">불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-[var(--color-primary)] mb-8">마이페이지</h1>

      {member && (
        <div className="bg-white border border-[var(--color-border)] rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between gap-4">
            {/* 아바타 영역 */}
            <div className="flex items-center gap-5">
              <div className="relative group">
                {avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt={member.nickname}
                    className="w-20 h-20 rounded-full object-cover border-2 border-[var(--color-border)]"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-[var(--color-primary)]/15 flex items-center justify-center text-3xl font-bold text-[var(--color-primary)]">
                    {member.nickname[0]}
                  </div>
                )}
                {/* 호버 오버레이 */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium"
                >
                  {uploading ? "..." : "변경"}
                </button>
              </div>

              <div>
                <p className="text-lg font-semibold">{member.nickname}</p>
                <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{member.email}</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  가입일: {new Date(member.created_at).toLocaleDateString("ko-KR")}
                </p>
                {/* 사진 버튼 */}
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="text-xs text-[var(--color-primary)] hover:underline disabled:opacity-50"
                  >
                    {uploading ? "업로드 중..." : "사진 변경"}
                  </button>
                  {member.avatar_url && member.avatar_url.startsWith("/uploads/avatars/") && (
                    <button
                      onClick={handleAvatarDelete}
                      className="text-xs text-red-400 hover:underline"
                    >
                      사진 삭제
                    </button>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="px-4 py-2 text-sm border border-[var(--color-border)] rounded-lg hover:bg-gray-50 transition-colors shrink-0"
            >
              로그아웃
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>
      )}

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab("posts")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "posts"
              ? "bg-[var(--color-primary)] text-white"
              : "border border-[var(--color-border)] hover:bg-gray-50"
          }`}
        >
          내 글 ({posts.length})
        </button>
        <button
          onClick={() => setTab("comments")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "comments"
              ? "bg-[var(--color-primary)] text-white"
              : "border border-[var(--color-border)] hover:bg-gray-50"
          }`}
        >
          내 댓글 ({comments.length})
        </button>
      </div>

      {tab === "posts" && (
        <div className="space-y-2">
          {posts.length === 0 ? (
            <p className="text-center py-12 text-[var(--color-text-muted)]">작성한 글이 없습니다.</p>
          ) : (
            posts.map((post) => (
              <Link
                key={post.id}
                href={`/boards/${post.board.slug}/${post.id}`}
                className="block p-4 bg-white border border-[var(--color-border)] rounded-lg hover:border-[var(--color-primary)] transition-colors"
              >
                <p className="font-medium">{post.title}</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  {post.board.name} · 조회 {post.view_count} · 댓글 {post.comment_count} ·{" "}
                  {new Date(post.created_at).toLocaleDateString("ko-KR")}
                </p>
              </Link>
            ))
          )}
        </div>
      )}

      {tab === "comments" && (
        <div className="space-y-2">
          {comments.length === 0 ? (
            <p className="text-center py-12 text-[var(--color-text-muted)]">작성한 댓글이 없습니다.</p>
          ) : (
            comments.map((comment) => (
              <Link
                key={comment.id}
                href={`/boards/${comment.board_slug}/${comment.post_id}`}
                className="block p-4 bg-white border border-[var(--color-border)] rounded-lg hover:border-[var(--color-primary)] transition-colors"
              >
                <p className="text-sm">{comment.content}</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  {comment.post_title} ·{" "}
                  {new Date(comment.created_at).toLocaleDateString("ko-KR")}
                </p>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
