"use client";
import { useEffect, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL;

const BOARDS = [
  { slug: "liturgy", label: "전례의 순간 (미사·전례 사진)" },
  { slug: "photo",   label: "함께한 시간 (행사·공동체 사진)" },
];

interface GalleryPost {
  id: number;
  title: string;
  created_at: string;
  thumbnail_url: string | null;
  view_count: number;
}

export default function GalleryAdminPage() {
  const [boardSlug, setBoardSlug] = useState("liturgy");
  const [posts, setPosts] = useState<GalleryPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
  const authHeader = { Authorization: `Bearer ${token}` };

  async function loadPosts(slug: string) {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/boards/${slug}/posts?page=1&size=50`, {
        headers: authHeader,
      });
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadPosts(boardSlug); }, [boardSlug]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !files?.length) return;
    setUploading(true);
    setMessage(null);
    try {
      // 1. 게시글 생성
      const postRes = await fetch(`${API}/api/boards/${boardSlug}/posts`, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), content: "" }),
      });
      if (!postRes.ok) { setMessage({ type: "err", text: "게시글 생성 실패" }); return; }
      const post = await postRes.json();

      // 2. 이미지 업로드
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        await fetch(`${API}/api/boards/${boardSlug}/posts/${post.id}/attachments`, {
          method: "POST",
          headers: authHeader,
          body: fd,
        });
      }

      setMessage({ type: "ok", text: "업로드 완료" });
      setTitle("");
      setFiles(null);
      if (fileRef.current) fileRef.current.value = "";
      loadPosts(boardSlug);
    } catch {
      setMessage({ type: "err", text: "업로드 중 오류가 발생했습니다." });
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(postId: number) {
    if (!confirm("이 갤러리 항목을 삭제하시겠습니까?")) return;
    const res = await fetch(`${API}/api/boards/${boardSlug}/posts/${postId}`, {
      method: "DELETE",
      headers: authHeader,
    });
    if (res.ok) setPosts((prev) => prev.filter((p) => p.id !== postId));
  }

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-2xl font-bold text-[var(--color-primary)] mb-6">갤러리 관리</h1>

      {/* 게시판 선택 */}
      <div className="flex gap-2 mb-6">
        {BOARDS.map((b) => (
          <button
            key={b.slug}
            onClick={() => setBoardSlug(b.slug)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              boardSlug === b.slug
                ? "bg-[var(--color-primary)] text-white"
                : "border border-[var(--color-border)] hover:bg-gray-50"
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      {/* 업로드 폼 */}
      <form onSubmit={handleUpload} className="bg-white border border-[var(--color-border)] rounded-xl p-5 mb-6 space-y-3">
        <h2 className="text-sm font-bold text-[var(--color-primary)]">사진 추가</h2>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="예: 2026년 부활 미사"
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
              사진 선택 (여러 장 가능)
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              required
              onChange={(e) => setFiles(e.target.files)}
              className="w-full text-sm text-[var(--color-text-muted)] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-[var(--color-primary)] file:text-white hover:file:bg-[var(--color-primary-dark)] cursor-pointer"
            />
          </div>
          <button
            type="submit"
            disabled={uploading || !title.trim() || !files?.length}
            className="px-5 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] disabled:opacity-40 transition-colors shrink-0"
          >
            {uploading ? "업로드 중…" : "업로드"}
          </button>
        </div>
        {message && (
          <p className={`text-xs px-3 py-2 rounded-lg ${
            message.type === "ok"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}>
            {message.text}
          </p>
        )}
      </form>

      {/* 갤러리 목록 */}
      {loading ? (
        <p className="text-sm text-[var(--color-text-muted)]">불러오는 중...</p>
      ) : posts.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-12">등록된 사진이 없습니다.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {posts.map((post) => (
            <div key={post.id} className="group relative border border-[var(--color-border)] rounded-xl overflow-hidden bg-white">
              {post.thumbnail_url ? (
                <img
                  src={`${API}${post.thumbnail_url}`}
                  alt={post.title}
                  className="w-full aspect-square object-cover"
                />
              ) : (
                <div className="w-full aspect-square bg-gray-100 flex items-center justify-center text-3xl text-gray-300">
                  🖼️
                </div>
              )}
              <div className="p-2">
                <p className="text-xs font-medium truncate">{post.title}</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {new Date(post.created_at).toLocaleDateString("ko-KR")}
                </p>
              </div>
              <button
                onClick={() => handleDelete(post.id)}
                className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
                title="삭제"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
