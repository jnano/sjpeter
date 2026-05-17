"use client";
import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import MarkdownEditor from "@/components/MarkdownEditor";

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

interface Attachment {
  id: number;
  original_name: string;
  file_url: string;
  file_size: number;
  is_image: boolean;
}

export default function EditPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams<{ slug: string; postId: string }>();
  const { slug, postId } = params;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [existingAttachments, setExistingAttachments] = useState<Attachment[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [boardShareEnabled, setBoardShareEnabled] = useState(false);
  const [shareAllowed, setShareAllowed] = useState(false);
  // 기존 글 데이터에서 PUT 시 손실 방지를 위해 보존할 필드
  const [category, setCategory] = useState<string | null>(null);
  const [intentionKind, setIntentionKind] = useState<string | null>(null);
  const [intentionFor, setIntentionFor] = useState<string | null>(null);
  // admin 토큰 인식 — admin 이면 모든 글 수정 허용
  const [adminToken, setAdminToken] = useState<string | null>(null);
  useEffect(() => {
    try {
      const t = localStorage.getItem("admin_token");
      const expStr = localStorage.getItem("admin_token_exp");
      const exp = expStr ? Number(expStr) : 0;
      if (t && exp && Date.now() < exp) setAdminToken(t);
    } catch {}
  }, []);
  const isDelegatedAdmin = !!(session as { isAdmin?: boolean } | null)?.isAdmin;
  const isAdmin = !!adminToken || isDelegatedAdmin;
  const bearerToken = adminToken ?? session?.accessToken ?? "";

  useEffect(() => {
    fetch(`${API}/api/boards/${slug}/posts/${postId}`)
      .then((r) => r.json())
      .then((data) => {
        const isModerator = !!(session && data.board?.moderator_id === session.memberId);
        const isAuthor = !!(session && data.member?.id === session.memberId);
        const allowed = isAdmin || isAuthor || isModerator;
        // 매 fetch 마다 forbidden 명시 갱신 — isAdmin 이 늦게 true 가 돼도 재실행 시 false 로 복귀
        setForbidden(!allowed);
        if (allowed) {
          setTitle(data.title ?? "");
          setContent(data.content ?? "");
          setExistingAttachments(data.attachments ?? []);
          setBoardShareEnabled(!!data.board?.share_enabled);
          setShareAllowed(!!data.share_allowed);
          setCategory(data.category ?? null);
          setIntentionKind(data.intention_kind ?? null);
          setIntentionFor(data.intention_for ?? null);
        }
        setFetching(false);
      });
  }, [slug, postId, session, isAdmin]);

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
    setNewFiles((prev) => [...prev, ...valid]);
  }

  async function deleteExistingAttachment(attId: number) {
    if (!bearerToken) return;
    const res = await fetch(
      `${API}/api/boards/${slug}/posts/${postId}/attachments/${attId}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${bearerToken}` } }
    );
    if (res.ok) {
      setExistingAttachments((prev) => prev.filter((a) => a.id !== attId));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError("제목과 내용을 입력해 주세요.");
      return;
    }
    if (!bearerToken) {
      router.push("/members/login");
      return;
    }

    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/boards/${slug}/posts/${postId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${bearerToken}`,
        },
        body: JSON.stringify({
          title,
          content,
          category,
          intention_kind: intentionKind,
          intention_for: intentionFor,
          share_allowed: boardShareEnabled && shareAllowed,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "수정에 실패했습니다.");
        return;
      }

      for (const file of newFiles) {
        const fd = new FormData();
        fd.append("file", file);
        await fetch(`${API}/api/boards/${slug}/posts/${postId}/attachments`, {
          method: "POST",
          headers: { Authorization: `Bearer ${bearerToken}` },
          body: fd,
        });
      }

      router.refresh();
      router.push(`/boards/${slug}/${postId}`);
    } catch {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  if (fetching) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <p className="text-[var(--color-text-muted)]">불러오는 중...</p>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4">
        <p className="text-[var(--color-text-muted)]">본인이 작성한 글만 수정할 수 있습니다.</p>
        <Link
          href={`/boards/${slug}/${postId}`}
          className="text-sm text-[var(--color-primary)] hover:underline"
        >
          게시글로 돌아가기
        </Link>
      </div>
    );
  }

  const existingImages = existingAttachments.filter((a) => a.is_image);
  const existingOthers = existingAttachments.filter((a) => !a.is_image);
  const newImages = newFiles.filter((f) => f.type.startsWith("image/"));
  const newOthers = newFiles.filter((f) => !f.type.startsWith("image/"));

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <Link
        href={`/boards/${slug}/${postId}`}
        className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
      >
        ← 게시글로 돌아가기
      </Link>

      <h1 className="text-2xl font-bold text-[var(--color-primary)] mt-4 mb-8">게시글 수정</h1>

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

        <MarkdownEditor value={content} onChange={setContent} height={350} />

        {/* 첨부파일 영역 */}
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
              파일 추가
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

          {/* 기존 이미지 */}
          {existingImages.length > 0 && (
            <div>
              <p className="text-xs text-[var(--color-text-muted)] mb-2">등록된 이미지</p>
              <div className="flex flex-wrap gap-2">
                {existingImages.map((att) => (
                  <div key={att.id} className="relative group">
                    <img
                      src={`${API}${att.file_url}`}
                      alt={att.original_name}
                      className="w-20 h-20 object-cover rounded-lg border border-[var(--color-border)]"
                    />
                    <button
                      type="button"
                      onClick={() => deleteExistingAttachment(att.id)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5 w-20 truncate">{formatBytes(att.file_size)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 기존 일반 파일 */}
          {existingOthers.length > 0 && (
            <div>
              <p className="text-xs text-[var(--color-text-muted)] mb-1">등록된 파일</p>
              <ul className="space-y-1">
                {existingOthers.map((att) => (
                  <li key={att.id} className="flex items-center justify-between text-sm py-1 px-2 bg-gray-50 rounded">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="text-gray-400">📎</span>
                      <span className="truncate">{att.original_name}</span>
                      <span className="text-xs text-[var(--color-text-muted)] shrink-0">{formatBytes(att.file_size)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteExistingAttachment(att.id)}
                      className="ml-2 text-red-400 hover:text-red-600 shrink-0"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 새로 추가할 이미지 미리보기 */}
          {newImages.length > 0 && (
            <div>
              <p className="text-xs text-[var(--color-text-muted)] mb-2">추가할 이미지</p>
              <div className="flex flex-wrap gap-2">
                {newImages.map((f, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={URL.createObjectURL(f)}
                      alt={f.name}
                      className="w-20 h-20 object-cover rounded-lg border border-[var(--color-border)]"
                    />
                    <button
                      type="button"
                      onClick={() => setNewFiles((prev) => prev.filter((_, j) => prev.indexOf(f) !== j))}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5 w-20 truncate">{formatBytes(f.size)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 새로 추가할 일반 파일 */}
          {newOthers.length > 0 && (
            <div>
              <p className="text-xs text-[var(--color-text-muted)] mb-1">추가할 파일</p>
              <ul className="space-y-1">
                {newOthers.map((f, i) => (
                  <li key={i} className="flex items-center justify-between text-sm py-1 px-2 bg-blue-50 rounded">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="text-gray-400">📎</span>
                      <span className="truncate">{f.name}</span>
                      <span className="text-xs text-[var(--color-text-muted)] shrink-0">{formatBytes(f.size)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setNewFiles((prev) => prev.filter((x) => x !== f))}
                      className="ml-2 text-red-400 hover:text-red-600 shrink-0"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {existingAttachments.length === 0 && newFiles.length === 0 && (
            <p className="text-xs text-[var(--color-text-muted)] text-center py-2">
              첨부된 파일이 없습니다
            </p>
          )}
        </div>

        {boardShareEnabled && (
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={shareAllowed}
              onChange={(e) => setShareAllowed(e.target.checked)}
              className="rounded"
            />
            <span>이 글의 공유를 허용합니다 <span className="text-xs text-[var(--color-text-muted)]">(다른 사람이 공유 버튼으로 외부에 링크 전달 가능)</span></span>
          </label>
        )}

        <div className="flex gap-3 justify-end">
          <Link
            href={`/boards/${slug}/${postId}`}
            className="px-6 py-2.5 border border-[var(--color-border)] rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            취소
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50"
          >
            {loading ? "저장 중..." : "저장"}
          </button>
        </div>
      </form>
    </div>
  );
}
