"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import MarkdownEditor from "@/components/MarkdownEditor";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// 공지 첨부는 이미지만 허용 (backend 제약과 일치)
const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Attachment {
  id: number;
  original_name: string | null;
  file_url: string;
  file_size: number;
}

interface Notice {
  id: number;
  title: string;
  content: string | null;
  is_pinned: boolean;
  created_at: string;
  attachments?: Attachment[];
}

function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const t = localStorage.getItem("admin_token");
    const expStr = localStorage.getItem("admin_token_exp");
    const exp = expStr ? Number(expStr) : 0;
    if (t && exp && Date.now() < exp) return t;
  } catch {}
  return null;
}

export default function NoticeEditPage() {
  const router = useRouter();
  const params = useParams<{ postId: string }>();
  const postId = params.postId;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [existingAttachments, setExistingAttachments] = useState<Attachment[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  // admin 토큰 검증 — 없으면 forbidden
  useEffect(() => {
    if (!getAdminToken()) {
      setForbidden(true);
      setFetching(false);
      return;
    }
    async function load() {
      try {
        const res = await fetch(`${API}/api/notices/${postId}`, { cache: "no-store" });
        if (!res.ok) throw new Error("공지를 불러올 수 없습니다.");
        const n: Notice = await res.json();
        setTitle(n.title);
        setContent(n.content ?? "");
        setIsPinned(n.is_pinned);
        setExistingAttachments(n.attachments ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
      } finally {
        setFetching(false);
      }
    }
    load();
  }, [postId]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const valid = files.filter((f) => {
      if (!ALLOWED_TYPES.includes(f.type)) {
        setError(`지원하지 않는 형식: ${f.name}`);
        return false;
      }
      if (f.size > 20 * 1024 * 1024) {
        setError(`파일이 너무 큽니다 (최대 20MB): ${f.name}`);
        return false;
      }
      return true;
    });
    setNewFiles((prev) => [...prev, ...valid]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeNewFile(idx: number) {
    setNewFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function removeExistingAttachment(attId: number) {
    if (!confirm("이 첨부파일을 삭제하시겠습니까?")) return;
    const token = getAdminToken();
    if (!token) return;
    const res = await fetch(`${API}/api/notices/${postId}/attachments/${attId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok || res.status === 204) {
      setExistingAttachments((prev) => prev.filter((a) => a.id !== attId));
    } else {
      alert("첨부 삭제 실패");
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!title.trim()) { setError("제목을 입력해 주세요."); return; }
    const token = getAdminToken();
    if (!token) { setError("관리자 인증 정보가 없습니다."); return; }
    setLoading(true);
    try {
      // 1. 본문 업데이트
      const putRes = await fetch(`${API}/api/notices/${postId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), content, is_pinned: isPinned }),
      });
      if (!putRes.ok) {
        const detail = await putRes.json().catch(() => ({}));
        throw new Error(detail.detail ?? "수정 실패");
      }
      // 2. 새 첨부 업로드 (있을 때만)
      if (newFiles.length > 0) {
        const fd = new FormData();
        for (const file of newFiles) fd.append("files", file);
        const upRes = await fetch(`${API}/api/notices/${postId}/attachments`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (!upRes.ok) {
          const detail = await upRes.json().catch(() => ({}));
          throw new Error(detail.detail ?? "첨부 업로드 실패");
        }
      }
      router.push(`/boards/notice/${postId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("이 공지를 삭제하시겠습니까? 되돌릴 수 없습니다.")) return;
    const token = getAdminToken();
    if (!token) return;
    setLoading(true);
    const res = await fetch(`${API}/api/notices/${postId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok || res.status === 204) {
      router.push("/boards/notice");
      router.refresh();
    } else {
      alert("삭제 실패");
      setLoading(false);
    }
  }

  if (fetching) {
    return <div className="max-w-3xl mx-auto px-4 py-16 text-center text-[var(--color-text-muted)]">불러오는 중…</div>;
  }
  if (forbidden) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-red-600 mb-4">관리자 권한이 필요합니다.</p>
        <Link href={`/boards/notice/${postId}`} className="text-[var(--color-primary)] hover:underline">
          공지로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <Link
          href={`/boards/notice/${postId}`}
          className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
        >
          ← 공지로 돌아가기
        </Link>
        <button
          type="button"
          onClick={handleDelete}
          disabled={loading}
          className="text-xs px-3 py-1.5 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          공지 삭제
        </button>
      </div>

      <h1 className="text-xl font-bold text-[var(--color-primary)] mb-4">공지 수정</h1>

      {error && (
        <div className="mb-4 px-4 py-2.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1.5">제목</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)] bg-white"
            placeholder="공지 제목"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">본문 <span className="text-xs text-gray-400">(마크다운 지원)</span></label>
          <MarkdownEditor value={content} onChange={setContent} height={400} />
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={isPinned}
            onChange={(e) => setIsPinned(e.target.checked)}
            className="rounded accent-[var(--color-primary)]"
          />
          상단 고정
        </label>

        {/* 기존 첨부 */}
        {existingAttachments.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">기존 첨부 ({existingAttachments.length})</p>
            <ul className="space-y-1.5">
              {existingAttachments.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between text-sm bg-[var(--color-surface-warm)] border border-[var(--color-border)] rounded px-3 py-2"
                >
                  <a
                    href={`${API}${a.file_url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--color-primary)] hover:underline truncate"
                  >
                    {a.original_name ?? a.file_url.split("/").pop()}
                  </a>
                  <button
                    type="button"
                    onClick={() => removeExistingAttachment(a.id)}
                    className="text-xs text-red-500 hover:text-red-700 shrink-0 ml-3"
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 새 첨부 */}
        <div>
          <p className="text-sm font-medium mb-2">새 첨부 추가 <span className="text-xs text-gray-400">(이미지만)</span></p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="text-sm"
          />
          {newFiles.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {newFiles.map((f, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between text-sm bg-blue-50 border border-blue-200 rounded px-3 py-2"
                >
                  <span className="truncate">
                    {f.name} <span className="text-xs text-gray-500">({formatBytes(f.size)})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeNewFile(i)}
                    className="text-xs text-red-500 hover:text-red-700 shrink-0 ml-3"
                  >
                    제거
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] disabled:opacity-50"
          >
            {loading ? "저장 중…" : "저장"}
          </button>
          <Link
            href={`/boards/notice/${postId}`}
            className="px-6 py-2.5 border border-[var(--color-border)] text-[var(--color-text-muted)] text-sm font-medium rounded-lg hover:bg-gray-50"
          >
            취소
          </Link>
        </div>
      </form>
    </div>
  );
}
