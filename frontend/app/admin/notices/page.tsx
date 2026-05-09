"use client";
import { useState, useEffect, useRef } from "react";

const API = process.env.NEXT_PUBLIC_API_URL;

function AiBadge() {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 border border-violet-200 font-medium shrink-0">
      AI
    </span>
  );
}

interface Notice {
  id: number;
  title: string;
  content: string | null;
  is_pinned: boolean;
  is_ai_generated: boolean;
  created_at: string;
}

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("admin_token");
}

const EMPTY_FORM = { title: "", content: "", is_pinned: false };

// 공지 작성 / 수정 폼 (재사용)
function NoticeForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: typeof EMPTY_FORM;
  onSave: (data: typeof EMPTY_FORM) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError("제목을 입력해 주세요."); return; }
    setError(""); setLoading(true);
    try { await onSave(form); } catch { setError("저장에 실패했습니다."); }
    finally { setLoading(false); }
  }

  return (
    <div ref={ref}>
      <form
        onSubmit={handleSubmit}
        className="p-5 bg-[var(--color-surface-warm)] border border-[var(--color-border)] rounded-xl space-y-3"
      >
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div>
          <label className="block text-sm font-medium mb-1">제목</label>
          <input
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            required
            autoFocus
            className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)] bg-white"
            placeholder="공지 제목"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">내용</label>
          <textarea
            value={form.content}
            onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
            rows={5}
            className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)] resize-none bg-white"
            placeholder="공지 내용 (선택)"
          />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_pinned}
            onChange={(e) => setForm((p) => ({ ...p, is_pinned: e.target.checked }))}
            className="rounded"
          />
          상단 고정
        </label>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm hover:bg-white transition-colors"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {loading ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AdminNoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [editId, setEditId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { fetchNotices(); }, []);

  async function fetchNotices() {
    const res = await fetch(`${API}/api/notices/`);
    if (res.ok) setNotices(await res.json());
  }

  async function handleCreate(form: typeof EMPTY_FORM) {
    const res = await fetch(`${API}/api/notices/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(form),
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    setNotices((prev) => [data, ...prev]);
    setShowCreate(false);
  }

  async function handleEdit(id: number, form: typeof EMPTY_FORM) {
    const res = await fetch(`${API}/api/notices/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(form),
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    setNotices((prev) => prev.map((n) => (n.id === id ? data : n)));
    setEditId(null);
  }

  async function handleDelete(id: number) {
    if (!confirm("공지를 삭제하시겠습니까?")) return;
    const res = await fetch(`${API}/api/notices/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.ok) setNotices((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-primary)]">공지 관리</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">공지사항을 작성하고 관리합니다.</p>
        </div>
        <button
          onClick={() => { setShowCreate((v) => !v); setEditId(null); }}
          className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white rounded-lg text-sm font-medium transition-colors"
        >
          {showCreate ? "취소" : "+ 공지 작성"}
        </button>
      </div>

      {/* 새 공지 작성 폼 (상단) */}
      {showCreate && (
        <div className="mb-4">
          <NoticeForm
            initial={EMPTY_FORM}
            onSave={handleCreate}
            onCancel={() => setShowCreate(false)}
          />
        </div>
      )}

      <div className="space-y-2">
        {notices.length === 0 && (
          <p className="text-center py-12 text-[var(--color-text-muted)]">등록된 공지가 없습니다.</p>
        )}
        {notices.map((n) => (
          <div key={n.id}>
            {/* 공지 카드 */}
            <div
              className={`p-4 bg-[var(--color-surface)] border rounded-xl transition-colors ${
                editId === n.id
                  ? "border-[var(--color-primary)] rounded-b-none border-b-0"
                  : "border-[var(--color-border)]"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {n.is_pinned && (
                      <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-full shrink-0">
                        고정
                      </span>
                    )}
                    {n.is_ai_generated && <AiBadge />}
                    <p className="font-medium truncate">{n.title}</p>
                  </div>
                  {n.content && (
                    <p className="text-sm text-[var(--color-text-muted)] mt-1 line-clamp-2">{n.content}</p>
                  )}
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    {new Date(n.created_at).toLocaleDateString("ko-KR")}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setEditId(editId === n.id ? null : n.id)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                      editId === n.id
                        ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                        : "border-[var(--color-border)] hover:bg-[var(--color-surface-warm)]"
                    }`}
                  >
                    {editId === n.id ? "접기" : "수정"}
                  </button>
                  <button
                    onClick={() => handleDelete(n.id)}
                    className="px-3 py-1.5 text-xs border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>

            {/* 인라인 수정 폼 — 카드 바로 아래 */}
            {editId === n.id && (
              <div className="border border-t-0 border-[var(--color-primary)] rounded-b-xl overflow-hidden">
                <NoticeForm
                  initial={{ title: n.title, content: n.content ?? "", is_pinned: n.is_pinned }}
                  onSave={(form) => handleEdit(n.id, form)}
                  onCancel={() => setEditId(null)}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
