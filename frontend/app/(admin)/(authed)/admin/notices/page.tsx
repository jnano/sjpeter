"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useFocusItem, FOCUS_RING_CLASS } from "@/components/useFocusItem";

const API = process.env.NEXT_PUBLIC_API_URL;

function AiBadge() {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 border border-violet-200 font-medium shrink-0">
      AI
    </span>
  );
}

interface NoticeAttachment {
  id: number;
  file_url: string;
  original_name: string | null;
  file_size: number;
  sort_order: number;
}

interface Notice {
  id: number;
  title: string;
  content: string | null;
  is_pinned: boolean;
  is_ai_generated: boolean;
  created_at: string;
  expires_at?: string | null;
  attachments?: NoticeAttachment[];
}

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("admin_token");
}

const EMPTY_FORM = { title: "", content: "", is_pinned: false, created_at: "" };

function NoticeForm({
  initial,
  initialAttachments = [],
  onSave,
  onCancel,
  onDeleteAttachment,
}: {
  initial: typeof EMPTY_FORM;
  initialAttachments?: NoticeAttachment[];
  onSave: (data: typeof EMPTY_FORM, newFiles: File[]) => Promise<void>;
  onCancel: () => void;
  onDeleteAttachment?: (attachmentId: number) => Promise<void>;
}) {
  const [form, setForm] = useState(initial);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [existingAtts, setExistingAtts] = useState<NoticeAttachment[]>(initialAttachments);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError("제목을 입력해 주세요."); return; }
    setError(""); setLoading(true);
    try { await onSave(form, newFiles); }
    catch { setError("저장에 실패했습니다."); }
    finally { setLoading(false); }
  }

  function pickFiles(files: FileList | null) {
    if (!files) return;
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (imgs.length === 0) {
      setError("이미지 파일만 선택할 수 있습니다.");
      return;
    }
    setError("");
    setNewFiles((prev) => [...prev, ...imgs]);
  }

  async function handleDeleteExisting(id: number) {
    if (!onDeleteAttachment) return;
    if (!confirm("사진을 삭제하시겠습니까?")) return;
    await onDeleteAttachment(id);
    setExistingAtts((prev) => prev.filter((a) => a.id !== id));
  }

  function removeNewFile(idx: number) {
    setNewFiles((prev) => prev.filter((_, i) => i !== idx));
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
        {/* 사진 */}
        <div>
          <label className="block text-sm font-medium mb-1">
            사진 <span className="text-xs text-gray-400 font-normal">(여러 장 가능, 10MB 이하)</span>
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={(e) => {
              pickFiles(e.target.files);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 text-sm border border-[var(--color-primary)] text-[var(--color-primary)] rounded-lg hover:bg-[var(--color-primary)]/5"
          >
            + 사진 추가
          </button>
          {(existingAtts.length > 0 || newFiles.length > 0) && (
            <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
              {/* 기존 첨부 */}
              {existingAtts.map((a) => (
                <div key={`exist-${a.id}`} className="relative group aspect-square rounded-lg overflow-hidden border border-[var(--color-border)] bg-white">
                  <img
                    src={a.file_url.startsWith("http") ? a.file_url : `${API}${a.file_url}`}
                    alt={a.original_name ?? ""}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleDeleteExisting(a.id)}
                    className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white text-xs rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    aria-label="삭제"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {/* 새로 추가한 파일 (미리보기) */}
              {newFiles.map((f, i) => (
                <div key={`new-${i}`} className="relative group aspect-square rounded-lg overflow-hidden border border-blue-300 bg-blue-50">
                  <img src={URL.createObjectURL(f)} alt={f.name} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeNewFile(i)}
                    className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white text-xs rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    aria-label="제거"
                  >
                    ✕
                  </button>
                  <span className="absolute bottom-0 left-0 right-0 bg-blue-500/80 text-white text-[10px] text-center py-0.5">새로 추가</span>
                </div>
              ))}
            </div>
          )}
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
  const focusId = useFocusItem();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [editId, setEditId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // 월별 필터
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  // 노출 상태 필터 — active(노출 중) / expired(만료됨) / all(전체)
  const [statusFilter, setStatusFilter] = useState<"active" | "expired" | "all">("active");

  // 다중 선택
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const allCheckRef = useRef<HTMLInputElement>(null);
  // 이동·복사 — 대상 게시판 목록, 모달 모드, 선택 게시판, 처리중
  const [boards, setBoards] = useState<{ slug: string; name: string }[]>([]);
  const [bulkAction, setBulkAction] = useState<"move" | "copy" | null>(null);
  const [targetSlugs, setTargetSlugs] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => { fetchBoards(); }, []);
  useEffect(() => { fetchNotices(); }, [statusFilter]);

  async function fetchNotices() {
    // admin 전용 — status(노출중/만료됨/전체)별 조회. 만료 공지 관리 가능.
    const res = await fetch(`${API}/api/notices/admin?status=${statusFilter}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.ok) setNotices(await res.json());
  }

  // 시스템/내부 전용 게시판 — 이동·복사 대상에서 제외 (AI 임시저장·임시자료실)
  const INTERNAL_BOARDS = ["ai-extract", "temporary_data_room"];

  async function fetchBoards() {
    const res = await fetch(`${API}/api/boards`);
    if (res.ok) {
      const data = await res.json();
      // notice(공지사항) 자신 + 내부 게시판(exclude_from_search 플래그 또는 명시 slug) 제외
      setBoards(
        data
          .filter((b: { slug: string; exclude_from_search?: boolean }) =>
            b.slug !== "notice" && !b.exclude_from_search && !INTERNAL_BOARDS.includes(b.slug))
          .map((b: { slug: string; name: string }) => ({ slug: b.slug, name: b.name }))
      );
    }
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

  // 선택 공지를 게시판 1개로 이동 (원본이 옮겨감 → 공지 목록에서 사라짐)
  async function handleBulkMove() {
    const slug = targetSlugs[0];
    if (!slug) return;
    setBulkBusy(true);
    try {
      const res = await fetch(`${API}/api/boards/posts/bulk-move`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ post_ids: selectedIds, board_slug: slug }),
      });
      if (!res.ok) { alert("이동에 실패했습니다."); return; }
      const r = await res.json();
      const movedSet = new Set<number>(r.moved ?? []);
      setNotices((prev) => prev.filter((n) => !movedSet.has(n.id)));  // 이동분 목록에서 제거
      setSelected(new Set());
      setBulkAction(null); setTargetSlugs([]);
      const bn = boards.find((b) => b.slug === slug)?.name ?? slug;
      alert(`${movedSet.size}건을 '${bn}' 게시판으로 이동했습니다.` + (r.failed?.length ? `\n(${r.failed.length}건 제외)` : ""));
    } finally { setBulkBusy(false); }
  }

  // 선택 공지를 여러 게시판으로 복사 (원본 유지)
  async function handleBulkCopy() {
    if (targetSlugs.length === 0) return;
    setBulkBusy(true);
    try {
      const res = await fetch(`${API}/api/boards/posts/bulk-copy`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ post_ids: selectedIds, target_slugs: targetSlugs }),
      });
      if (!res.ok) { alert("복사에 실패했습니다."); return; }
      const r = await res.json();
      setSelected(new Set());
      setBulkAction(null); setTargetSlugs([]);
      alert(`${r.created?.length ?? 0}건 복사했습니다 (원본 유지).` + (r.failed?.length ? `\n(${r.failed.length}건 제외)` : ""));
    } finally { setBulkBusy(false); }
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

  async function uploadAttachments(noticeId: number, files: File[]) {
    if (files.length === 0) return;
    const fd = new FormData();
    for (const f of files) fd.append("files", f);
    await fetch(`${API}/api/notices/${noticeId}/attachments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` },
      body: fd,
    });
  }

  async function deleteAttachment(noticeId: number, attachmentId: number) {
    await fetch(`${API}/api/notices/${noticeId}/attachments/${attachmentId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    // 목록 state 갱신
    setNotices((prev) =>
      prev.map((n) =>
        n.id === noticeId
          ? { ...n, attachments: (n.attachments ?? []).filter((a) => a.id !== attachmentId) }
          : n
      )
    );
  }

  async function refetchNotice(id: number): Promise<Notice | null> {
    const r = await fetch(`${API}/api/notices/${id}`);
    return r.ok ? r.json() : null;
  }

  async function handleCreate(form: typeof EMPTY_FORM, files: File[]) {
    const res = await fetch(`${API}/api/notices/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(buildPayload(form)),
    });
    if (!res.ok) throw new Error();
    const created = await res.json();
    if (files.length > 0) {
      await uploadAttachments(created.id, files);
    }
    const fresh = (await refetchNotice(created.id)) ?? created;
    setNotices((prev) => [fresh, ...prev].sort((a, b) => b.created_at.localeCompare(a.created_at)));
    setShowCreate(false);
  }

  async function handleEdit(id: number, form: typeof EMPTY_FORM, files: File[]) {
    const res = await fetch(`${API}/api/notices/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(buildPayload(form)),
    });
    if (!res.ok) throw new Error();
    if (files.length > 0) {
      await uploadAttachments(id, files);
    }
    const fresh = await refetchNotice(id);
    setNotices((prev) =>
      prev.map((n) => (n.id === id ? (fresh ?? n) : n)).sort((a, b) => b.created_at.localeCompare(a.created_at))
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

      {/* 노출 상태 필터 — 노출 중 / 만료됨(지난) / 전체 */}
      <div className="flex flex-wrap gap-2 mb-3">
        {(["active", "expired", "all"] as const).map((v) => (
          <button
            key={v}
            onClick={() => { setStatusFilter(v); setSelected(new Set()); setSelectedMonth("all"); }}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              statusFilter === v
                ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                : "border-[var(--color-border)] hover:bg-[var(--color-surface-warm)]"
            }`}
          >
            {v === "active" ? "노출 중" : v === "expired" ? "만료됨(지난)" : "전체"}
          </button>
        ))}
      </div>

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
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setBulkAction("move"); setTargetSlugs([]); }}
                  className="text-xs border border-[var(--color-border)] hover:bg-[var(--color-surface-warm)] px-3 py-1.5 rounded-lg transition-colors"
                >
                  이동 ({selected.size})
                </button>
                <button
                  onClick={() => { setBulkAction("copy"); setTargetSlugs([]); }}
                  className="text-xs border border-[var(--color-border)] hover:bg-[var(--color-surface-warm)] px-3 py-1.5 rounded-lg transition-colors"
                >
                  복사 ({selected.size})
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="text-xs border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
                >
                  {bulkDeleting ? "삭제 중…" : `선택 삭제 (${selected.size})`}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* 이동·복사 게시판 선택 모달 */}
      {bulkAction && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !bulkBusy && setBulkAction(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[var(--color-primary)] mb-1">
              {bulkAction === "move" ? "게시판으로 이동" : "게시판으로 복사"} ({selected.size}건)
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] mb-4">
              {bulkAction === "move"
                ? "선택한 공지를 아래 게시판으로 옮깁니다. 이동하면 공지사항 목록에서는 사라집니다."
                : "선택한 공지를 아래 게시판(들)에 복사합니다. 원본 공지는 그대로 유지됩니다."}
            </p>
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {boards.length === 0 && <p className="text-sm text-[var(--color-text-muted)]">이동·복사할 다른 게시판이 없습니다.</p>}
              {boards.map((b) => {
                const checked = targetSlugs.includes(b.slug);
                return (
                  <label key={b.slug} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-[var(--color-surface-warm)] cursor-pointer">
                    <input
                      type={bulkAction === "move" ? "radio" : "checkbox"}
                      name="bulk-target"
                      checked={checked}
                      onChange={() => {
                        if (bulkAction === "move") setTargetSlugs([b.slug]);
                        else setTargetSlugs((prev) => prev.includes(b.slug) ? prev.filter((s) => s !== b.slug) : [...prev, b.slug]);
                      }}
                      className="accent-[var(--color-primary)]"
                    />
                    <span className="text-sm">{b.name}</span>
                  </label>
                );
              })}
            </div>
            <div className="flex gap-2 pt-4">
              <button
                onClick={bulkAction === "move" ? handleBulkMove : handleBulkCopy}
                disabled={bulkBusy || targetSlugs.length === 0}
                className="flex-1 px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {bulkBusy ? "처리 중…" : bulkAction === "move" ? "이동" : "복사"}
              </button>
              <button
                onClick={() => { setBulkAction(null); setTargetSlugs([]); }}
                disabled={bulkBusy}
                className="px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm disabled:opacity-50"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 공지 목록 */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-center py-12 text-[var(--color-text-muted)]">
            {notices.length === 0 ? "등록된 공지가 없습니다." : "해당 월의 공지가 없습니다."}
          </p>
        )}
        {filtered.map((n) => (
          <div key={n.id} data-focus-id={n.id}>
            <div
              className={`p-4 bg-[var(--color-surface)] border rounded-xl transition-colors ${
                editId === n.id
                  ? "border-[var(--color-primary)] rounded-b-none border-b-0"
                  : selected.has(n.id)
                  ? "border-[var(--color-primary)] bg-blue-50/20"
                  : focusId === n.id
                  ? FOCUS_RING_CLASS
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
                  <p className="text-xs text-[var(--color-text-muted)] mt-1 flex items-center gap-2 flex-wrap">
                    <span>{new Date(n.created_at).toLocaleDateString("ko-KR")}</span>
                    {n.expires_at && (() => {
                      const expired = new Date(n.expires_at) <= new Date();
                      return (
                        <span className={expired ? "text-red-500" : "text-[var(--color-text-muted)]"}>
                          📆 만료 {new Date(n.expires_at).toLocaleDateString("ko-KR")}{expired ? " (지남)" : ""}
                        </span>
                      );
                    })()}
                    {!n.expires_at && <span className="text-[var(--color-text-muted)]/60">📆 만료 없음</span>}
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
                  initialAttachments={n.attachments ?? []}
                  onSave={(form, files) => handleEdit(n.id, form, files)}
                  onCancel={() => setEditId(null)}
                  onDeleteAttachment={(aid) => deleteAttachment(n.id, aid)}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
