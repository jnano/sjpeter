"use client";
import { useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL;

const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "text/plain",
];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function WritePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const valid: File[] = [];
    for (const f of Array.from(incoming)) {
      if (f.size > 10 * 1024 * 1024) {
        setError(`"${f.name}" 파일이 10MB를 초과합니다.`);
        continue;
      }
      if (!ALLOWED_TYPES.includes(f.type) && !f.name.match(/\.(hwp|hwpx)$/i)) {
        setError(`"${f.name}" 은 허용되지 않는 파일 형식입니다.`);
        continue;
      }
      valid.push(f);
    }
    setFiles((prev) => [...prev, ...valid]);
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError("제목과 내용을 입력해 주세요.");
      return;
    }
    if (!session?.accessToken) {
      router.push("/members/login");
      return;
    }

    setError("");
    setLoading(true);
    try {
      // 1. 게시글 생성
      const postRes = await fetch(`${API}/api/boards/${slug}/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({ title, content }),
      });
      const postData = await postRes.json();
      if (!postRes.ok) {
        setError(postData.detail || "게시글 등록에 실패했습니다.");
        return;
      }

      // 2. 파일 업로드
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        await fetch(`${API}/api/boards/${slug}/posts/${postData.id}/attachments`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.accessToken}` },
          body: fd,
        });
      }

      router.refresh();
      router.push(`/boards/${slug}/${postData.id}`);
    } catch {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  const images = files.filter((f) => f.type.startsWith("image/"));
  const otherFiles = files.filter((f) => !f.type.startsWith("image/"));

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <Link
        href={`/boards/${slug}`}
        className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
      >
        ← 목록으로
      </Link>

      <h1 className="text-2xl font-bold text-[var(--color-primary)] mt-4 mb-8">글쓰기</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목을 입력하세요"
          maxLength={200}
          required
          className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent text-lg"
        />

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="내용을 입력하세요..."
          rows={14}
          required
          className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent resize-none"
        />

        {/* 파일 첨부 영역 */}
        <div className="border border-dashed border-[var(--color-border)] rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--color-text-muted)]">
              파일 첨부 <span className="text-xs font-normal">(이미지·PDF·문서 · 최대 10MB)</span>
            </span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 text-xs border border-[var(--color-border)] rounded-lg hover:bg-gray-50 transition-colors"
            >
              파일 선택
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.hwp,.hwpx,.zip,.txt"
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>

          {/* 이미지 미리보기 */}
          {images.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {images.map((f, i) => (
                <div key={i} className="relative group">
                  <img
                    src={URL.createObjectURL(f)}
                    alt={f.name}
                    className="w-20 h-20 object-cover rounded-lg border border-[var(--color-border)]"
                  />
                  <button
                    type="button"
                    onClick={() => removeFile(files.indexOf(f))}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5 w-20 truncate">{formatBytes(f.size)}</p>
                </div>
              ))}
            </div>
          )}

          {/* 일반 파일 목록 */}
          {otherFiles.length > 0 && (
            <ul className="space-y-1">
              {otherFiles.map((f, i) => (
                <li key={i} className="flex items-center justify-between text-sm py-1 px-2 bg-gray-50 rounded">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-gray-400">📎</span>
                    <span className="truncate">{f.name}</span>
                    <span className="text-xs text-[var(--color-text-muted)] shrink-0">{formatBytes(f.size)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(files.indexOf(f))}
                    className="ml-2 text-red-400 hover:text-red-600 shrink-0"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          {files.length === 0 && (
            <p className="text-xs text-[var(--color-text-muted)] text-center py-2">
              첨부할 파일을 선택하세요
            </p>
          )}
        </div>

        <div className="flex gap-3 justify-end">
          <Link
            href={`/boards/${slug}`}
            className="px-6 py-2.5 border border-[var(--color-border)] rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            취소
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50"
          >
            {loading ? "등록 중..." : "등록"}
          </button>
        </div>
      </form>
    </div>
  );
}
