"use client";
import { useState, useEffect, useRef, useCallback } from "react";

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

const EMPTY_FORM = { title: "", content: "", is_pinned: false, created_at: "" };

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
            required autoFocus
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
        <div>
          <label className="block text-sm font-medium mb-1">
            등록 날짜 <span className="text-xs text-gray-400 font-normal">(비워두면 오늘 날짜로 저장)</span>
          </label>
          <input
            type="date"
            value={form.created_at}
            onChange={(e) => setForm((p) => ({ ...p, created_at: e.target.value }))}
            className="px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)] bg-white"
          />
          <p className="text-xs text-gray-400 mt-1">과거 공지를 등록할 때 그 날짜로 지정하세요.</p>
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
          <button type="button" onClick={onCancel}
            className="px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm hover:bg-white transition-colors">
            취소
          </button>
          <button type="submit" disabled={loading}
            className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
            {loading ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </div>
  );
}

function monthKey(created_at: string) {
  return created_at.slice(0, 7); // "2026-05"
}

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return `${y}년 ${parseInt(m)}월`;
}

export default function AdminNoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [editId, setEditId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // 월별 필터
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  // 다중 선택
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const allCheckRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchNotices(); }, []);

  async function fetchNotices() {
    const res = await fetch(`${API}/api/notices/`);
    if (res.ok) setNotices(await res.json());
  }

  // 월 목록 (내림차순)
  const months = Array.from(new Set(notices.map((n) => monthKey(n.created_at))))
    .sort()
    .reverse();

  // 현재 월 필터 적용
  const filtered = selectedMonth === "all"
    ? notices
    : notices.filter((n) => monthKey(n.created_at) === selectedMonth);

  // 전체 선택 체크박스 indeterminate 처리
  const allSelected = filtered.length > 0 && filtered.every((n) => selected.has(n.id));
  const someSelected = filtered.some((n) => selected.has(n.id)) && !allSelected;

  useEffect(() => {
    if (allCheckRef.current) allCheckRef.current.indeterminate = someSelected;
  }, [someSelected]);

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) filtered.forEach((n) => next.delete(n.id));
      else filtered.forEach((n) => next.add(n.id));
      return next;
    });
  }

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const selectedIds = Array.from(selected);

  async function handleBulkDelete() {
    if (!confirm(`선택한 공지 ${selectedIds.length}건을 삭제하시겠습니까?`)) return;
    setBulkDeleting(true);
    try {
      await Promise.all(
        selectedIds.map((id) =>
          fetch(`${API}/api/notices/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${getToken()}` },
          })
        )
      );
      setNotices((prev) => prev.filter((n) => !selected.has(n.id)));
      setSelected(new Set());
    } finally {
      setBulkDeleting(false);
    }
  }

  function buildPayload(form: typeof EMPTY_FORM) {
    // created_at이 빈 문자열이면 백엔드에 보내지 않음 (자동/유지)
    // 날짜만 받으면 본당 정오(12:00) 시각으로 저장 — 정렬 시 자정 경계 모호함 회피
    const payload: {
      title: string;
      content: string;
      is_pinned: boolean;
      created_at?: string;
    } = {
      title: form.title,
      content: form.content,
      is_pinned: form.is_pinned,
    };
    if (form.created_at) {
      payload.created_at = `${form.created_at}T12:00:00`;
    }
    return payload;
  }

  async function handleCreate(form: typeof EMPTY_FORM) {
    const res = await fetch(`${API}/api/notices/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(buildPayload(form)),
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    setNotices((prev) => [data, ...prev].sort((a, b) => b.created_at.localeCompare(a.created_at)));
    setShowCreate(false);
  }

  async function handleEdit(id: number, form: typeof EMPTY_FORM) {
    const res = await fetch(`${API}/api/notices/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(buildPayload(form)),
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    setNotices((prev) =>
      prev.map((n) => (n.id === id ? data : n)).sort((a, b) => b.created_at.localeCompare(a.created_at))
    );
    setEditId(null);
  }

  async function handleDelete(id: number) {
    if (!confirm("공지를 삭제하시겠습니까?")) return;
    const res = await fetch(`${API}/api/notices/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.ok) {
      setNotices((prev) => prev.filter((n) => n.id !== id));
      setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5">
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

      {/* 새 공지 작성 폼 */}
      {showCreate && (
        <div className="mb-5">
          <NoticeForm initial={EMPTY_FORM} onSave={handleCreate} onCancel={() => setShowCreate(false)} />
        </div>
      )}

      {notices.length > 0 && (
        <>
          {/* 월별 필터 칩 */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setSelectedMonth("all")}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                selectedMonth === "all"
                  ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                  : "border-[var(--color-border)] hover:bg-[var(--color-surface-warm)]"
              }`}
            >
              전체 {notices.length}건
            </button>
            {months.map((m) => {
              const count = notices.filter((n) => monthKey(n.created_at) === m).length;
              return (
                <button
                  key={m}
                  onClick={() => { setSelectedMonth(m); setSelected(new Set()); }}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    selectedMonth === m
                      ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                      : "border-[var(--color-border)] hover:bg-[var(--color-surface-warm)]"
                  }`}
                >
                  {monthLabel(m)} ({count})
                </button>
              );
            })}
          </div>

          {/* 선택 컨트롤 바 */}
          <div className="flex items-center justify-between bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 mb-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                ref={allCheckRef}
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="w-4 h-4 rounded accent-[var(--color-primary)] cursor-pointer"
              />
              <span className="text-sm text-[var(--color-text-muted)]">
                {selected.size > 0 ? `${selected.size}건 선택됨` : `${filtered.length}건`}
              </span>
            </label>
            {selected.size > 0 && (
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="text-xs border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
              >
                {bulkDeleting ? "삭제 중…" : `선택 삭제 (${selected.size})`}
              </button>
            )}
          </div>
        </>
      )}

      {/* 공지 목록 */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-center py-12 text-[var(--color-text-muted)]">
            {notices.length === 0 ? "등록된 공지가 없습니다." : "해당 월의 공지가 없습니다."}
          </p>
        )}
        {filtered.map((n) => (
          <div key={n.id}>
            <div
              className={`p-4 bg-[var(--color-surface)] border rounded-xl transition-colors ${
                editId === n.id
                  ? "border-[var(--color-primary)] rounded-b-none border-b-0"
                  : selected.has(n.id)
                  ? "border-[var(--color-primary)] bg-blue-50/20"
                  : "border-[var(--color-border)]"
              }`}
            >
              <div className="flex items-start gap-3">
                {/* 체크박스 */}
                <input
                  type="checkbox"
                  checked={selected.has(n.id)}
                  onChange={() => toggleOne(n.id)}
                  className="mt-1 w-4 h-4 rounded accent-[var(--color-primary)] cursor-pointer shrink-0"
                />

                {/* 내용 */}
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

                {/* 버튼 */}
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

            {/* 인라인 수정 폼 */}
            {editId === n.id && (
              <div className="border border-t-0 border-[var(--color-primary)] rounded-b-xl overflow-hidden">
                <NoticeForm
                  initial={{
                    title: n.title,
                    content: n.content ?? "",
                    is_pinned: n.is_pinned,
                    created_at: n.created_at ? n.created_at.slice(0, 10) : "",
                  }}
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
