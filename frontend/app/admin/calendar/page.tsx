"use client";
import { useEffect, useState, useRef } from "react";

const API = process.env.NEXT_PUBLIC_API_URL;

const CATEGORIES = [
  { value: "liturgy", label: "전례" },
  { value: "community", label: "공동체" },
  { value: "education", label: "교육" },
  { value: "special", label: "특별행사" },
  { value: "general", label: "일반" },
];

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.label])
);

function AiBadge() {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 border border-violet-200 font-medium shrink-0">
      AI
    </span>
  );
}

function KindBadge({ kind }: { kind: string | null }) {
  if (kind === "행사")
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200 font-medium shrink-0">
        행사
      </span>
    );
  if (kind === "모임")
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-600 border border-green-200 font-medium shrink-0">
        모임
      </span>
    );
  return null;
}

interface Event {
  id: number;
  title: string;
  description: string | null;
  event_date: string;
  end_date: string | null;
  start_time: string | null;
  location: string | null;
  category: string;
  is_public: boolean;
  is_ai_generated: boolean;
  event_kind: string | null;
}

type EventFormData = Omit<Event, "id" | "is_ai_generated">;

const EMPTY_FORM: EventFormData = {
  title: "",
  description: null,
  event_date: "",
  end_date: null,
  start_time: null,
  location: null,
  category: "general",
  is_public: true,
  event_kind: null,
};

function EventForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: EventFormData;
  onSave: (data: EventFormData) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError("행사명을 입력해 주세요."); return; }
    if (!form.event_date) { setError("시작일을 선택해 주세요."); return; }
    setError(""); setBusy(true);
    try { await onSave(form); } catch { setError("저장에 실패했습니다."); }
    finally { setBusy(false); }
  }

  return (
    <div ref={ref}>
      <form
        onSubmit={handleSubmit}
        className="p-5 bg-[var(--color-surface-warm)] border border-[var(--color-border)] rounded-xl space-y-3"
      >
        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">행사·모임명 *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
              autoFocus
              placeholder="예: 부활절 미사 / 사목회의"
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">구분</label>
            <select
              value={form.event_kind ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, event_kind: e.target.value || null }))}
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-white"
            >
              <option value="">없음</option>
              <option value="행사">행사</option>
              <option value="모임">모임</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">분류</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-white"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">시작일 *</label>
            <input
              type="date"
              value={form.event_date}
              onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))}
              required
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">종료일</label>
            <input
              type="date"
              value={form.end_date ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value || null }))}
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">시간</label>
            <input
              type="text"
              value={form.start_time ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value || null }))}
              placeholder="예: 10:00"
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">장소</label>
            <input
              type="text"
              value={form.location ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value || null }))}
              placeholder="예: 성당 대성전"
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-white"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="is_public"
              checked={form.is_public}
              onChange={(e) => setForm((f) => ({ ...f, is_public: e.target.checked }))}
              className="w-4 h-4 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
            />
            <label htmlFor="is_public" className="text-sm cursor-pointer">공개</label>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">상세 설명</label>
            <textarea
              value={form.description ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value || null }))}
              rows={2}
              placeholder="설명 (선택)"
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-white"
            />
          </div>
        </div>

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
            disabled={busy}
            className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {busy ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </div>
  );
}

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("admin_token");
}

function authHeaders() {
  return { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" };
}

const KIND_FILTERS = [
  { value: "all", label: "전체" },
  { value: "행사", label: "행사만" },
  { value: "모임", label: "모임만" },
];

export default function AdminCalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [filterKind, setFilterKind] = useState("all");

  // 다중 선택
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const allCheckRef = useRef<HTMLInputElement>(null);

  async function loadEvents() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/events/?year=${year}&month=${month}`, {
        headers: authHeaders(),
      });
      if (res.ok) setEvents(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setSelected(new Set());
    loadEvents();
  }, [year, month]);

  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  }

  // 필터링된 목록
  const filtered = filterKind === "all"
    ? events
    : filterKind === "행사"
    ? events.filter((e) => e.event_kind === "행사")
    : filterKind === "모임"
    ? events.filter((e) => e.event_kind === "모임")
    : events;

  // 전체 선택 indeterminate
  const allSelected = filtered.length > 0 && filtered.every((e) => selected.has(e.id));
  const someSelected = filtered.some((e) => selected.has(e.id)) && !allSelected;

  useEffect(() => {
    if (allCheckRef.current) allCheckRef.current.indeterminate = someSelected;
  }, [someSelected]);

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) filtered.forEach((e) => next.delete(e.id));
      else filtered.forEach((e) => next.add(e.id));
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

  async function handleBulkDelete() {
    const ids = Array.from(selected);
    if (!confirm(`선택한 항목 ${ids.length}건을 삭제하시겠습니까?`)) return;
    setBulkDeleting(true);
    try {
      await Promise.all(
        ids.map((id) =>
          fetch(`${API}/api/events/${id}`, {
            method: "DELETE",
            headers: authHeaders(),
          })
        )
      );
      setEvents((prev) => prev.filter((e) => !selected.has(e.id)));
      setSelected(new Set());
    } finally {
      setBulkDeleting(false);
    }
  }

  async function handleCreate(form: EventFormData) {
    const res = await fetch(`${API}/api/events/`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(form),
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    setEvents((prev) => [...prev, data].sort((a, b) => a.event_date.localeCompare(b.event_date)));
    setShowCreate(false);
  }

  async function handleEdit(id: number, form: EventFormData) {
    const res = await fetch(`${API}/api/events/${id}`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(form),
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    setEvents((prev) => prev.map((e) => (e.id === id ? data : e)));
    setEditId(null);
  }

  async function handleDelete(id: number) {
    if (!confirm("이 항목을 삭제하시겠습니까?")) return;
    const res = await fetch(`${API}/api/events/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (res.ok) {
      setEvents((prev) => prev.filter((e) => e.id !== id));
      setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  }

  // 구분별 카운트
  const countByKind = {
    행사: events.filter((e) => e.event_kind === "행사").length,
    모임: events.filter((e) => e.event_kind === "모임").length,
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-primary)]">본당 행사·모임 일정</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">행사와 모임을 등록하고 관리합니다.</p>
        </div>
        <button
          onClick={() => { setShowCreate((v) => !v); setEditId(null); }}
          className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white rounded-lg text-sm font-medium transition-colors"
        >
          {showCreate ? "취소" : "+ 등록"}
        </button>
      </div>

      {/* 새 항목 등록 폼 */}
      {showCreate && (
        <div className="mb-5">
          <EventForm
            initial={{ ...EMPTY_FORM, event_date: `${year}-${String(month).padStart(2, "0")}-01` }}
            onSave={handleCreate}
            onCancel={() => setShowCreate(false)}
          />
        </div>
      )}

      {/* 월 이동 */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={prevMonth} className="px-3 py-1.5 border border-[var(--color-border)] rounded-lg hover:bg-gray-50 text-sm">‹</button>
        <span className="font-semibold">{year}년 {month}월</span>
        <button onClick={nextMonth} className="px-3 py-1.5 border border-[var(--color-border)] rounded-lg hover:bg-gray-50 text-sm">›</button>
        <a
          href="/calendar"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-sm border border-[var(--color-border)] hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors"
        >
          사용자 페이지 →
        </a>
      </div>

      {/* 구분 필터 칩 */}
      {events.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {KIND_FILTERS.map((f) => {
            const count = f.value === "all" ? events.length
              : f.value === "행사" ? countByKind.행사
              : countByKind.모임;
            return (
              <button
                key={f.value}
                onClick={() => { setFilterKind(f.value); setSelected(new Set()); }}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  filterKind === f.value
                    ? f.value === "모임"
                      ? "bg-green-600 text-white border-green-600"
                      : f.value === "행사"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                    : "border-[var(--color-border)] hover:bg-[var(--color-surface-warm)]"
                }`}
              >
                {f.label} {count}건
              </button>
            );
          })}
        </div>
      )}

      {/* 선택 컨트롤 바 */}
      {filtered.length > 0 && (
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
      )}

      {/* 목록 */}
      {loading ? (
        <p className="text-sm text-[var(--color-text-muted)]">불러오는 중...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-12">
          {events.length === 0 ? "이번 달 등록된 항목이 없습니다." : "해당 구분의 항목이 없습니다."}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((ev) => (
            <div key={ev.id}>
              <div
                className={`p-4 bg-[var(--color-surface)] border rounded-xl transition-colors ${
                  editId === ev.id
                    ? "border-[var(--color-primary)] rounded-b-none border-b-0"
                    : selected.has(ev.id)
                    ? "border-[var(--color-primary)] bg-blue-50/20"
                    : "border-[var(--color-border)]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(ev.id)}
                    onChange={() => toggleOne(ev.id)}
                    className="mt-1 w-4 h-4 rounded accent-[var(--color-primary)] cursor-pointer shrink-0"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <KindBadge kind={ev.event_kind} />
                      <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded shrink-0">
                        {CATEGORY_LABEL[ev.category] ?? ev.category}
                      </span>
                      {ev.is_ai_generated && <AiBadge />}
                      {!ev.is_public && (
                        <span className="text-xs px-1.5 py-0.5 bg-red-50 text-red-600 rounded shrink-0">비공개</span>
                      )}
                      <p className="font-medium truncate">{ev.title}</p>
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                      {new Date(ev.event_date).toLocaleDateString("ko-KR")}
                      {ev.end_date && ` ~ ${new Date(ev.end_date).toLocaleDateString("ko-KR")}`}
                      {ev.start_time && ` · ${ev.start_time}`}
                      {ev.location && ` · ${ev.location}`}
                    </p>
                    {ev.description && (
                      <p className="text-sm text-[var(--color-text-muted)] mt-1 line-clamp-1">{ev.description}</p>
                    )}
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => { setEditId(editId === ev.id ? null : ev.id); setShowCreate(false); }}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                        editId === ev.id
                          ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                          : "border-[var(--color-border)] hover:bg-[var(--color-surface-warm)]"
                      }`}
                    >
                      {editId === ev.id ? "접기" : "수정"}
                    </button>
                    <button
                      onClick={() => handleDelete(ev.id)}
                      className="px-3 py-1.5 text-xs border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </div>

              {/* 인라인 수정 폼 */}
              {editId === ev.id && (
                <div className="border border-t-0 border-[var(--color-primary)] rounded-b-xl overflow-hidden">
                  <EventForm
                    initial={{
                      title: ev.title,
                      description: ev.description,
                      event_date: ev.event_date,
                      end_date: ev.end_date,
                      start_time: ev.start_time,
                      location: ev.location,
                      category: ev.category,
                      is_public: ev.is_public,
                      event_kind: ev.event_kind,
                    }}
                    onSave={(form) => handleEdit(ev.id, form)}
                    onCancel={() => setEditId(null)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
