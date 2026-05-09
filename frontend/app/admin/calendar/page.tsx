"use client";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL;

const CATEGORIES = [
  { value: "liturgy", label: "전례" },
  { value: "community", label: "공동체" },
  { value: "education", label: "교육" },
  { value: "special", label: "특별행사" },
  { value: "general", label: "일반" },
];

function AiBadge() {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 border border-violet-200 font-medium shrink-0">
      AI
    </span>
  );
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
}

const EMPTY: Omit<Event, "id"> = {
  title: "", description: null, event_date: "", end_date: null,
  start_time: null, location: null, category: "general", is_public: true, is_ai_generated: false,
};

export default function AdminCalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Omit<Event, "id"> & { id?: number }>(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
  const authHeader = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  async function loadEvents() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/events/?year=${year}&month=${month}`, {
        headers: authHeader,
      });
      if (res.ok) setEvents(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadEvents(); }, [year, month]);

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  function startEdit(e: Event) {
    setEditId(e.id);
    setForm({ ...e });
  }

  function resetForm() {
    setEditId(null);
    setForm({ ...EMPTY, event_date: `${year}-${String(month).padStart(2, "0")}-01` });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.event_date) return;
    setSaving(true);
    setMessage(null);
    try {
      const url = editId
        ? `${API}/api/events/${editId}`
        : `${API}/api/events/`;
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: authHeader,
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setMessage({ type: "ok", text: editId ? "수정되었습니다." : "등록되었습니다." });
        resetForm();
        loadEvents();
      } else {
        const data = await res.json();
        setMessage({ type: "err", text: data.detail || "오류가 발생했습니다." });
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("이 행사를 삭제하시겠습니까?")) return;
    const res = await fetch(`${API}/api/events/${id}`, {
      method: "DELETE",
      headers: authHeader,
    });
    if (res.ok) setEvents(prev => prev.filter(e => e.id !== id));
  }

  const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map(c => [c.value, c.label]));

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-primary)]">행사 캘린더 관리</h1>
        <a
          href="/calendar"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm border border-[var(--color-border)] hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors"
        >
          사용자 페이지 보기 →
        </a>
      </div>

      {/* 월 이동 */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={prevMonth} className="px-3 py-1.5 border border-[var(--color-border)] rounded-lg hover:bg-gray-50 text-sm">‹</button>
        <span className="font-semibold">{year}년 {month}월</span>
        <button onClick={nextMonth} className="px-3 py-1.5 border border-[var(--color-border)] rounded-lg hover:bg-gray-50 text-sm">›</button>
      </div>

      {/* 행사 등록/수정 폼 */}
      <form onSubmit={handleSave} className="bg-white border border-[var(--color-border)] rounded-xl p-5 mb-6 space-y-4">
        <h2 className="text-sm font-bold text-[var(--color-primary)]">
          {editId ? "행사 수정" : "새 행사 등록"}
        </h2>

        {message && (
          <p className={`text-xs px-3 py-2 rounded-lg border ${
            message.type === "ok"
              ? "bg-green-50 text-green-700 border-green-200"
              : "bg-red-50 text-red-700 border-red-200"
          }`}>
            {message.text}
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">행사명 *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              required
              placeholder="예: 부활절 미사"
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">시작일 *</label>
            <input
              type="date"
              value={form.event_date}
              onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))}
              required
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">종료일</label>
            <input
              type="date"
              value={form.end_date ?? ""}
              onChange={e => setForm(f => ({ ...f, end_date: e.target.value || null }))}
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">시간</label>
            <input
              type="text"
              value={form.start_time ?? ""}
              onChange={e => setForm(f => ({ ...f, start_time: e.target.value || null }))}
              placeholder="예: 10:00"
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">장소</label>
            <input
              type="text"
              value={form.location ?? ""}
              onChange={e => setForm(f => ({ ...f, location: e.target.value || null }))}
              placeholder="예: 성당 대성전"
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">분류</label>
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            >
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <input
              type="checkbox"
              id="is_public"
              checked={form.is_public}
              onChange={e => setForm(f => ({ ...f, is_public: e.target.checked }))}
              className="w-4 h-4 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
            />
            <label htmlFor="is_public" className="text-sm">공개 행사</label>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">상세 설명</label>
            <textarea
              value={form.description ?? ""}
              onChange={e => setForm(f => ({ ...f, description: e.target.value || null }))}
              rows={2}
              placeholder="행사 설명 (선택)"
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          {editId && (
            <button type="button" onClick={resetForm} className="px-4 py-2 text-sm border border-[var(--color-border)] rounded-lg hover:bg-gray-50">
              취소
            </button>
          )}
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] disabled:opacity-40"
          >
            {saving ? "저장 중…" : editId ? "수정 저장" : "등록"}
          </button>
        </div>
      </form>

      {/* 행사 목록 */}
      {loading ? (
        <p className="text-sm text-[var(--color-text-muted)]">불러오는 중...</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-8">이번 달 등록된 행사가 없습니다.</p>
      ) : (
        <div className="bg-white border border-[var(--color-border)] rounded-xl overflow-hidden">
          <div className="divide-y divide-[var(--color-border)]">
            {events.map(e => (
              <div key={e.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{e.title}</span>
                    <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded shrink-0">
                      {CATEGORY_LABEL[e.category]}
                    </span>
                    {e.is_ai_generated && <AiBadge />}
                    {!e.is_public && (
                      <span className="text-xs px-1.5 py-0.5 bg-red-50 text-red-600 rounded shrink-0">비공개</span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {new Date(e.event_date).toLocaleDateString("ko-KR")}
                    {e.start_time && ` ${e.start_time}`}
                    {e.location && ` · ${e.location}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <button onClick={() => startEdit(e)} className="text-xs text-[var(--color-primary)] hover:underline">수정</button>
                  <button onClick={() => handleDelete(e.id)} className="text-xs text-red-500 hover:text-red-700">삭제</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
