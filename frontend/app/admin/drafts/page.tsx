"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface BoardInfo { id: number; name: string; slug: string; }
interface Draft { id: number; title: string; content: string; created_at: string; board: BoardInfo; }
interface Board { id: number; name: string; slug: string; is_active: boolean; }

export default function DraftsPage() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [movingId, setMovingId] = useState<number | null>(null);
  const [moveTarget, setMoveTarget] = useState<Record<number, string>>({});
  const [processing, setProcessing] = useState<Record<number, boolean>>({});
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // 복수 목적지 게시 상태
  const [publishingId, setPublishingId] = useState<number | null>(null);
  const [extraBoards, setExtraBoards] = useState<Record<number, Set<string>>>({});
  const [addCalendar, setAddCalendar] = useState<Record<number, boolean>>({});

  const authHeaders = () => {
    const token = localStorage.getItem("admin_token");
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  };

  const fetchDrafts = useCallback(async () => {
    const token = localStorage.getItem("admin_token");
    if (!token) { router.push("/admin"); return; }
    try {
      const [draftsRes, boardsRes] = await Promise.all([
        fetch(`${API}/api/boards/drafts`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/boards`),
      ]);
      if (!draftsRes.ok) { router.push("/admin"); return; }
      const data: Draft[] = await draftsRes.json();
      setDrafts(data);
      setSelected(new Set());
      if (boardsRes.ok) setBoards((await boardsRes.json()).filter((b: Board) => b.is_active));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchDrafts(); }, [fetchDrafts]);

  // ── 선택 헬퍼 ─────────────────────────────────────────
  const allSelected = drafts.length > 0 && selected.size === drafts.length;
  const someSelected = selected.size > 0 && selected.size < drafts.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(drafts.map((d) => d.id)));
  }

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── 복수 목적지 게시 ──────────────────────────────────
  function openPublishPicker(id: number) {
    setPublishingId(id);
    setMovingId(null);
    setExtraBoards((prev) => ({ ...prev, [id]: prev[id] ?? new Set() }));
    setAddCalendar((prev) => ({ ...prev, [id]: prev[id] ?? false }));
  }

  function toggleExtraBoard(draftId: number, slug: string) {
    setExtraBoards((prev) => {
      const next = new Set(prev[draftId] ?? []);
      next.has(slug) ? next.delete(slug) : next.add(slug);
      return { ...prev, [draftId]: next };
    });
  }

  async function handlePublishMulti(draft: Draft) {
    const additional = Array.from(extraBoards[draft.id] ?? []);
    const calendar = addCalendar[draft.id] ?? false;
    setProcessing((p) => ({ ...p, [draft.id]: true }));
    try {
      const res = await fetch(`${API}/api/boards/drafts/${draft.id}/publish-multi`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ additional_board_slugs: additional, add_calendar: calendar }),
      });
      if (res.ok) {
        setDrafts((d) => d.filter((x) => x.id !== draft.id));
        setSelected((s) => { const n = new Set(s); n.delete(draft.id); return n; });
        setPublishingId(null);
      } else {
        alert("게시 처리에 실패했습니다.");
      }
    } finally {
      setProcessing((p) => ({ ...p, [draft.id]: false }));
    }
  }

  // ── 이동 ──────────────────────────────────────────────
  async function handleMove(id: number) {
    const slug = moveTarget[id];
    if (!slug) return;
    setProcessing((p) => ({ ...p, [id]: true }));
    try {
      const res = await fetch(`${API}/api/boards/drafts/${id}/move`, {
        method: "PATCH", headers: authHeaders(),
        body: JSON.stringify({ board_slug: slug }),
      });
      if (res.ok) {
        const updated: Draft = await res.json();
        setDrafts((d) => d.map((x) => (x.id === id ? updated : x)));
        setMovingId(null);
        setMoveTarget((t) => { const n = { ...t }; delete n[id]; return n; });
      } else alert("이동에 실패했습니다.");
    } finally {
      setProcessing((p) => ({ ...p, [id]: false }));
    }
  }

  // ── 삭제 ──────────────────────────────────────────────
  async function handleDelete(id: number) {
    if (!confirm("이 임시저장 게시글을 삭제하시겠습니까?")) return;
    setProcessing((p) => ({ ...p, [id]: true }));
    try {
      const res = await fetch(`${API}/api/boards/drafts/${id}`, {
        method: "DELETE", headers: authHeaders(),
      });
      if (res.ok || res.status === 204) {
        setDrafts((d) => d.filter((x) => x.id !== id));
        setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
      } else alert("삭제에 실패했습니다.");
    } finally {
      setProcessing((p) => ({ ...p, [id]: false }));
    }
  }

  // ── 다중 선택 게시 (현재 게시판에만) ─────────────────
  async function handleBulkPublish(ids: number[]) {
    if (ids.length === 0) return;
    if (!confirm(`선택한 게시글 ${ids.length}개를 현재 게시판에 게시하시겠습니까?`)) return;
    setBulkProcessing(true);
    try {
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            const res = await fetch(`${API}/api/boards/drafts/${id}/publish`, {
              method: "POST", headers: authHeaders(),
            });
            return { id, ok: res.ok };
          } catch { return { id, ok: false }; }
        })
      );
      const succeeded = new Set(results.filter((r) => r.ok).map((r) => r.id));
      const failedCount = results.filter((r) => !r.ok).length;
      if (succeeded.size > 0) {
        setDrafts((d) => d.filter((x) => !succeeded.has(x.id)));
        setSelected((s) => { const n = new Set(s); succeeded.forEach((id) => n.delete(id)); return n; });
      }
      if (failedCount > 0) alert(`${failedCount}개 게시 처리에 실패했습니다.`);
    } finally {
      setBulkProcessing(false);
    }
  }

  // ── 다중 선택 삭제 ────────────────────────────────────
  async function handleBulkDelete(ids: number[]) {
    if (ids.length === 0) return;
    if (!confirm(`선택한 게시글 ${ids.length}개를 삭제하시겠습니까?`)) return;
    setBulkProcessing(true);
    try {
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            const res = await fetch(`${API}/api/boards/drafts/${id}`, {
              method: "DELETE", headers: authHeaders(),
            });
            return { id, ok: res.ok || res.status === 204 };
          } catch { return { id, ok: false }; }
        })
      );
      const succeeded = new Set(results.filter((r) => r.ok).map((r) => r.id));
      const failedCount = results.filter((r) => !r.ok).length;
      if (succeeded.size > 0) {
        setDrafts((d) => d.filter((x) => !succeeded.has(x.id)));
        setSelected((s) => { const n = new Set(s); succeeded.forEach((id) => n.delete(id)); return n; });
      }
      if (failedCount > 0) alert(`${failedCount}개 삭제 처리에 실패했습니다.`);
    } finally {
      setBulkProcessing(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="text-center py-16 text-[var(--color-text-muted)]">불러오는 중…</div>
      </div>
    );
  }

  const selectedIds = Array.from(selected);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-[var(--color-primary)]">임시저장 게시글</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            주보 AI 분석으로 자동 분류된 초안입니다. 검토 후 게시하거나 삭제하세요.
          </p>
        </div>
        <button
          onClick={fetchDrafts}
          disabled={loading}
          className="text-sm border border-[var(--color-border)] hover:bg-[var(--color-surface-warm)] disabled:opacity-40 px-3 py-1.5 rounded-lg transition-colors"
        >
          새로고침
        </button>
      </div>

      {drafts.length === 0 ? (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-16 text-center">
          <p className="text-4xl mb-4">✅</p>
          <p className="text-[var(--color-text-muted)]">처리할 임시저장 게시글이 없습니다.</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-2">
            방금 주보를 업로드하셨다면 AI 분석이 진행 중일 수 있습니다.
            <br />분석 완료까지 약 1~2분 소요됩니다. 잠시 후 새로고침하세요.
          </p>
        </div>
      ) : (
        <>
          {/* 선택 액션 바 */}
          <div className="flex items-center justify-between bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 mb-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => { if (el) el.indeterminate = someSelected; }}
                onChange={toggleAll}
                className="w-4 h-4 rounded accent-[var(--color-primary)] cursor-pointer"
              />
              <span className="text-sm text-[var(--color-text-muted)]">
                {selected.size > 0 ? `${selected.size}개 선택됨` : `전체 ${drafts.length}개`}
              </span>
            </label>

            <div className="flex items-center gap-2">
              {selected.size > 0 ? (
                <>
                  <button
                    onClick={() => handleBulkPublish(selectedIds)}
                    disabled={bulkProcessing}
                    className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    {bulkProcessing ? "처리 중…" : `선택 게시 (${selected.size})`}
                  </button>
                  <button
                    onClick={() => handleBulkDelete(selectedIds)}
                    disabled={bulkProcessing}
                    className="disabled:opacity-50 text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 text-sm px-4 py-2 rounded-lg transition-colors"
                  >
                    선택 삭제 ({selected.size})
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleBulkPublish(drafts.map((d) => d.id))}
                  disabled={bulkProcessing}
                  className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  전체 게시 ({drafts.length})
                </button>
              )}
            </div>
          </div>

          {/* 목록 */}
          <div className="space-y-2">
            {drafts.map((draft) => {
              const isPicking = publishingId === draft.id;
              const currentExtra = extraBoards[draft.id] ?? new Set<string>();
              const otherBoards = boards.filter((b) => b.slug !== draft.board.slug);

              return (
                <div
                  key={draft.id}
                  className={`bg-[var(--color-surface)] border rounded-xl overflow-hidden transition-colors ${
                    selected.has(draft.id)
                      ? "border-[var(--color-primary)] bg-blue-50/30"
                      : "border-[var(--color-border)]"
                  }`}
                >
                  <div className="flex items-start gap-3 p-4">
                    {/* 체크박스 */}
                    <input
                      type="checkbox"
                      checked={selected.has(draft.id)}
                      onChange={() => toggleOne(draft.id)}
                      className="mt-1 w-4 h-4 rounded accent-[var(--color-primary)] cursor-pointer shrink-0"
                    />

                    {/* 내용 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded">
                          임시저장
                        </span>
                        <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-warm)] border border-[var(--color-border)] px-2 py-0.5 rounded">
                          {draft.board.name}
                        </span>
                      </div>
                      <h3 className="font-medium text-[var(--color-text)] truncate">{draft.title}</h3>
                      <p className="text-sm text-[var(--color-text-muted)] mt-0.5 line-clamp-2">
                        {draft.content.slice(0, 120)}{draft.content.length > 120 ? "…" : ""}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
                        {new Date(draft.created_at).toLocaleString("ko-KR")}
                      </p>
                    </div>

                    {/* 단건 액션 버튼 */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => isPicking ? setPublishingId(null) : openPublishPicker(draft.id)}
                          disabled={processing[draft.id] || bulkProcessing}
                          className={`text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                            isPicking
                              ? "bg-gray-100 text-[var(--color-text-muted)] border border-[var(--color-border)]"
                              : "bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white"
                          }`}
                        >
                          {isPicking ? "접기" : "게시"}
                        </button>
                        <button
                          onClick={() => { setMovingId(movingId === draft.id ? null : draft.id); setPublishingId(null); }}
                          disabled={processing[draft.id] || bulkProcessing}
                          className="text-xs border border-[var(--color-border)] hover:bg-[var(--color-surface-warm)] disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          이동
                        </button>
                        <button
                          onClick={() => handleDelete(draft.id)}
                          disabled={processing[draft.id] || bulkProcessing}
                          className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          삭제
                        </button>
                      </div>

                      {/* 게시판 이동 */}
                      {movingId === draft.id && (
                        <div className="flex items-center gap-2">
                          <select
                            value={moveTarget[draft.id] ?? ""}
                            onChange={(e) => setMoveTarget((t) => ({ ...t, [draft.id]: e.target.value }))}
                            className="text-xs border border-[var(--color-border)] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[var(--color-primary)]"
                          >
                            <option value="">게시판 선택</option>
                            {boards.map((b) => (
                              <option key={b.slug} value={b.slug}>{b.name}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleMove(draft.id)}
                            disabled={!moveTarget[draft.id] || processing[draft.id]}
                            className="text-xs bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors"
                          >
                            확인
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 복수 목적지 선택 패널 */}
                  {isPicking && (
                    <div className="border-t border-[var(--color-border)] bg-[var(--color-surface-warm)] px-5 py-4">
                      <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">
                        게시 위치 선택
                      </p>
                      <div className="space-y-2">
                        {/* 현재 게시판 — 항상 포함, 비활성 */}
                        <label className="flex items-center gap-2.5 opacity-60 cursor-not-allowed">
                          <input type="checkbox" checked readOnly
                            className="w-4 h-4 rounded accent-[var(--color-primary)]" />
                          <span className="text-sm font-medium">{draft.board.name}</span>
                          <span className="text-xs text-[var(--color-text-muted)]">(현재 게시판)</span>
                        </label>

                        {/* 다른 게시판들 */}
                        {otherBoards.map((b) => (
                          <label key={b.slug} className="flex items-center gap-2.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={currentExtra.has(b.slug)}
                              onChange={() => toggleExtraBoard(draft.id, b.slug)}
                              className="w-4 h-4 rounded accent-[var(--color-primary)]"
                            />
                            <span className="text-sm">{b.name}</span>
                          </label>
                        ))}

                        {/* 행사일정 */}
                        <label className="flex items-center gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={addCalendar[draft.id] ?? false}
                            onChange={(e) => setAddCalendar((prev) => ({ ...prev, [draft.id]: e.target.checked }))}
                            className="w-4 h-4 rounded accent-[var(--color-primary)]"
                          />
                          <span className="text-sm">📅 행사일정</span>
                        </label>
                      </div>

                      <div className="flex justify-end gap-2 mt-4">
                        <button
                          onClick={() => setPublishingId(null)}
                          className="text-xs px-4 py-2 border border-[var(--color-border)] rounded-lg hover:bg-white transition-colors"
                        >
                          취소
                        </button>
                        <button
                          onClick={() => handlePublishMulti(draft)}
                          disabled={processing[draft.id]}
                          className="text-xs px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
                        >
                          {processing[draft.id] ? "처리 중…" : "선택 위치에 게시"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
