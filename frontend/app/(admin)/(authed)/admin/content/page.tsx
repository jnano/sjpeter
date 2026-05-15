"use client";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { DataEvent, notify } from "@/components/dataEvents";
import { useBulkSelect } from "@/components/useBulkSelect";
import BulkActionBar from "@/components/BulkActionBar";
import MarkdownEditor from "@/components/MarkdownEditor";
import { useFocusItem, FOCUS_RING_CLASS } from "@/components/useFocusItem";

const API = process.env.NEXT_PUBLIC_API_URL;

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("admin_token");
}

// ─── Types ────────────────────────────────────────────────

interface HistoryItem {
  id: number;
  year: number;
  event: string;
  detail: string | null;
  highlight: boolean;
  is_current: boolean;
  sort_order: number;
}

interface Vision {
  id: number;
  year: number;
  motto: string;
  body: string | null;
  is_current: boolean;
}

interface CommunityGroup {
  id: number;
  name: string;
  description: string | null;
  activity_time: string | null;
  link_url: string | null;
  board_slug: string | null;
  sort_order: number;
  parent_id: number | null;
  slug: string | null;
  activities: string | null;
  photo_urls: string[] | null;
  photo_display_mode: string | null;
  representative_photo_url: string | null;
}

interface BoardOption { slug: string; name: string; }

interface CouncilMember {
  id: number;
  name: string;
  role: string;
  category: string;
  photo_url: string | null;
  sort_order: number;
  is_active: boolean;
}

const inputCls = "px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full";
const btnPrimary = "px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50";
const btnDanger = "text-xs text-red-400 hover:text-red-600";
const btnEdit = "text-xs text-blue-500 hover:text-blue-700";

// ─── History Tab ──────────────────────────────────────────

function HistoryTab() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [form, setForm] = useState({ year: new Date().getFullYear(), event: "", detail: "", highlight: false, is_current: false, sort_order: 0 });
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ year: 0, event: "", detail: "", highlight: false, is_current: false, sort_order: 0 });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const select = useBulkSelect(items.map((i) => i.id));

  async function load() {
    const res = await fetch(`${API}/api/content/history`);
    if (res.ok) setItems(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.event.trim()) return;
    setLoading(true);
    const res = await fetch(`${API}/api/content/history`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (res.ok) { setMsg("추가되었습니다."); setForm({ year: new Date().getFullYear(), event: "", detail: "", highlight: false, is_current: false, sort_order: 0 }); setShowCreate(false); load(); }
  }

  async function update(id: number) {
    setLoading(true);
    const res = await fetch(`${API}/api/content/history/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(editForm),
    });
    setLoading(false);
    if (res.ok) { setMsg("수정되었습니다."); setEditId(null); load(); }
  }

  async function remove(id: number) {
    if (!confirm("삭제하시겠습니까?")) return;
    await fetch(`${API}/api/content/history/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    select.remove(id);
    load();
  }

  async function handleBulkDelete() {
    const ids = Array.from(select.selected);
    if (ids.length === 0) return;
    if (!confirm(`선택한 연혁 ${ids.length}개를 삭제하시겠습니까?`)) return;
    setBulkDeleting(true);
    try {
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            const r = await fetch(`${API}/api/content/history/${id}`, {
              method: "DELETE", headers: { Authorization: `Bearer ${getToken()}` },
            });
            return { id, ok: r.ok };
          } catch { return { id, ok: false }; }
        }),
      );
      const succeeded = new Set(results.filter((r) => r.ok).map((r) => r.id));
      if (succeeded.size > 0) { select.removeMany(succeeded); load(); }
      const failedCount = results.filter((r) => !r.ok).length;
      if (failedCount > 0) alert(`${failedCount}건 삭제 실패`);
    } finally {
      setBulkDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {msg && <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{msg}</p>}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            showCreate
              ? "bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200"
              : "bg-[var(--color-primary)] text-white hover:opacity-90"
          }`}
        >
          {showCreate ? "닫기" : "+ 새 연혁 추가"}
        </button>
      </div>

      {showCreate && (
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-800 mb-4 border-b pb-2">새 연혁 추가</h3>
        <form onSubmit={create} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">연도</label>
              <input type="number" value={form.year} onChange={(e) => setForm((p) => ({ ...p, year: +e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">순서</label>
              <input type="number" value={form.sort_order} onChange={(e) => setForm((p) => ({ ...p, sort_order: +e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">사건명</label>
            <input value={form.event} onChange={(e) => setForm((p) => ({ ...p, event: e.target.value }))} className={inputCls} placeholder="예: 성당 창립" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">상세 설명</label>
            <textarea value={form.detail} onChange={(e) => setForm((p) => ({ ...p, detail: e.target.value }))} rows={2} className={`${inputCls} resize-none`} placeholder="상세 내용 (선택)" />
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.highlight} onChange={(e) => setForm((p) => ({ ...p, highlight: e.target.checked }))} className="rounded" />
              강조 표시
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.is_current} onChange={(e) => setForm((p) => ({ ...p, is_current: e.target.checked }))} className="rounded" />
              현재 표시
            </label>
          </div>
          <button type="submit" disabled={loading} className={btnPrimary}>추가</button>
        </form>
      </section>
      )}

      <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">연혁 목록 ({items.length}건)</h3>
        </div>
        <div className="px-6 pt-3">
          <BulkActionBar
            selectedCount={select.selectedCount}
            total={select.total}
            allSelected={select.allSelected}
            someSelected={select.someSelected}
            onToggleAll={select.toggleAll}
            onDelete={handleBulkDelete}
            deleting={bulkDeleting}
            className="mb-0"
          />
        </div>
        <div className="divide-y divide-gray-100">
          {items.map((item) =>
            editId === item.id ? (
              <div key={item.id} className="p-4 bg-blue-50 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input type="number" value={editForm.year} onChange={(e) => setEditForm((p) => ({ ...p, year: +e.target.value }))} className={inputCls} />
                  <input type="number" value={editForm.sort_order} onChange={(e) => setEditForm((p) => ({ ...p, sort_order: +e.target.value }))} className={inputCls} placeholder="순서" />
                </div>
                <input value={editForm.event} onChange={(e) => setEditForm((p) => ({ ...p, event: e.target.value }))} className={inputCls} />
                <textarea value={editForm.detail ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, detail: e.target.value }))} rows={2} className={`${inputCls} resize-none`} />
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={editForm.highlight} onChange={(e) => setEditForm((p) => ({ ...p, highlight: e.target.checked }))} className="rounded" />
                    강조
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={editForm.is_current} onChange={(e) => setEditForm((p) => ({ ...p, is_current: e.target.checked }))} className="rounded" />
                    현재
                  </label>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => update(item.id)} disabled={loading} className={btnPrimary}>저장</button>
                  <button onClick={() => setEditId(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">취소</button>
                </div>
              </div>
            ) : (
              <div key={item.id} className={`flex items-start justify-between px-6 py-4 ${select.isSelected(item.id) ? "bg-red-50/30" : "hover:bg-gray-50"}`}>
                <input
                  type="checkbox"
                  checked={select.isSelected(item.id)}
                  onChange={() => select.toggle(item.id)}
                  className="rounded mr-3 mt-0.5"
                  aria-label={`${item.year} ${item.event} 선택`}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-500 w-12">{item.year}</span>
                    <span className="font-medium text-sm">{item.event}</span>
                    {item.highlight && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">강조</span>}
                    {item.is_current && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">현재</span>}
                  </div>
                  {item.detail && <p className="text-xs text-gray-400 mt-1 ml-14">{item.detail}</p>}
                </div>
                <div className="flex gap-3 shrink-0">
                  <button onClick={() => { setEditId(item.id); setEditForm({ year: item.year, event: item.event, detail: item.detail ?? "", highlight: item.highlight, is_current: item.is_current, sort_order: item.sort_order }); }} className={btnEdit}>수정</button>
                  <button onClick={() => remove(item.id)} className={btnDanger}>삭제</button>
                </div>
              </div>
            )
          )}
        </div>
      </section>
    </div>
  );
}

// ─── Vision Tab ───────────────────────────────────────────

function VisionTab() {
  const [items, setItems] = useState<Vision[]>([]);
  const [form, setForm] = useState({ year: new Date().getFullYear(), motto: "", body: "", is_current: false });
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ year: 0, motto: "", body: "", is_current: false });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const select = useBulkSelect(items.map((i) => i.id));

  async function load() {
    const res = await fetch(`${API}/api/content/visions`);
    if (res.ok) setItems(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.motto.trim()) return;
    setLoading(true);
    const res = await fetch(`${API}/api/content/visions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (res.ok) { setMsg("추가되었습니다."); setForm({ year: new Date().getFullYear(), motto: "", body: "", is_current: false }); setShowCreate(false); load(); }
  }

  async function update(id: number) {
    setLoading(true);
    const res = await fetch(`${API}/api/content/visions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(editForm),
    });
    setLoading(false);
    if (res.ok) { setMsg("수정되었습니다."); setEditId(null); load(); }
  }

  async function remove(id: number) {
    if (!confirm("삭제하시겠습니까?")) return;
    await fetch(`${API}/api/content/visions/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    select.remove(id);
    load();
  }

  async function handleBulkDelete() {
    const ids = Array.from(select.selected);
    if (ids.length === 0) return;
    if (!confirm(`선택한 사목지표 ${ids.length}개를 삭제하시겠습니까?`)) return;
    setBulkDeleting(true);
    try {
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            const r = await fetch(`${API}/api/content/visions/${id}`, {
              method: "DELETE", headers: { Authorization: `Bearer ${getToken()}` },
            });
            return { id, ok: r.ok };
          } catch { return { id, ok: false }; }
        }),
      );
      const succeeded = new Set(results.filter((r) => r.ok).map((r) => r.id));
      if (succeeded.size > 0) { select.removeMany(succeeded); load(); }
      const failedCount = results.filter((r) => !r.ok).length;
      if (failedCount > 0) alert(`${failedCount}건 삭제 실패`);
    } finally {
      setBulkDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {msg && <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{msg}</p>}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            showCreate
              ? "bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200"
              : "bg-[var(--color-primary)] text-white hover:opacity-90"
          }`}
        >
          {showCreate ? "닫기" : "+ 새 사목지표 추가"}
        </button>
      </div>

      {showCreate && (
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-800 mb-4 border-b pb-2">새 사목지표 추가</h3>
        <form onSubmit={create} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">연도</label>
            <input type="number" value={form.year} onChange={(e) => setForm((p) => ({ ...p, year: +e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">지표 (슬로건)</label>
            <input value={form.motto} onChange={(e) => setForm((p) => ({ ...p, motto: e.target.value }))} className={inputCls} placeholder="예: 거룩한 향기의 해" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">본문 <span className="text-gray-400">(선택, 마크다운)</span></label>
            <MarkdownEditor value={form.body} onChange={(v) => setForm((p) => ({ ...p, body: v }))} height={320} />
            <p className="mt-1.5 text-[11px] text-gray-500 leading-relaxed">
              · 제목: <code className="bg-gray-100 px-1 rounded">## 1. 성전 봉헌</code>
              {" / "}작은 제목: <code className="bg-gray-100 px-1 rounded">### </code>
              {" / "}카드 섹션: <code className="bg-gray-100 px-1 rounded">{`> 본문`}</code>
              {" / "}구분선: <code className="bg-gray-100 px-1 rounded">---</code>
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.is_current} onChange={(e) => setForm((p) => ({ ...p, is_current: e.target.checked }))} className="rounded" />
            올해 지표로 표시
          </label>
          <button type="submit" disabled={loading} className={btnPrimary}>추가</button>
        </form>
      </section>
      )}

      <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">사목지표 목록 ({items.length}건)</h3>
        </div>
        <div className="px-6 pt-3">
          <BulkActionBar
            selectedCount={select.selectedCount}
            total={select.total}
            allSelected={select.allSelected}
            someSelected={select.someSelected}
            onToggleAll={select.toggleAll}
            onDelete={handleBulkDelete}
            deleting={bulkDeleting}
            className="mb-0"
          />
        </div>
        <div className="divide-y divide-gray-100">
          {items.map((v) =>
            editId === v.id ? (
              <div key={v.id} className="p-4 bg-blue-50 space-y-3">
                <input type="number" value={editForm.year} onChange={(e) => setEditForm((p) => ({ ...p, year: +e.target.value }))} className={inputCls} />
                <input value={editForm.motto} onChange={(e) => setEditForm((p) => ({ ...p, motto: e.target.value }))} className={inputCls} placeholder="지표 (슬로건)" />
                <MarkdownEditor value={editForm.body} onChange={(v) => setEditForm((p) => ({ ...p, body: v }))} height={320} />
                <p className="text-[11px] text-gray-500">
                  · <code className="bg-white border border-gray-200 px-1 rounded">## 제목</code>
                  {" / "}<code className="bg-white border border-gray-200 px-1 rounded">{`> 카드`}</code>
                  {" / "}<code className="bg-white border border-gray-200 px-1 rounded">---</code> 구분선
                </p>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={editForm.is_current} onChange={(e) => setEditForm((p) => ({ ...p, is_current: e.target.checked }))} className="rounded" />
                  올해 지표
                </label>
                <div className="flex gap-2">
                  <button onClick={() => update(v.id)} disabled={loading} className={btnPrimary}>저장</button>
                  <button onClick={() => setEditId(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">취소</button>
                </div>
              </div>
            ) : (
              <div key={v.id} className={`flex items-center justify-between px-6 py-4 ${select.isSelected(v.id) ? "bg-red-50/30" : "hover:bg-gray-50"}`}>
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={select.isSelected(v.id)} onChange={() => select.toggle(v.id)} className="rounded" aria-label={`${v.year} 선택`} />
                  <span className="text-sm font-bold text-gray-500 w-12">{v.year}</span>
                  <span className="text-sm">&ldquo;{v.motto}&rdquo;</span>
                  {v.is_current && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">올해</span>}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { setEditId(v.id); setEditForm({ year: v.year, motto: v.motto, body: v.body ?? "", is_current: v.is_current }); }} className={btnEdit}>수정</button>
                  <button onClick={() => remove(v.id)} className={btnDanger}>삭제</button>
                </div>
              </div>
            )
          )}
        </div>
      </section>
    </div>
  );
}

// ─── Community Tab ────────────────────────────────────────

const emptyComForm = {
  name: "",
  description: "",
  activity_time: "",
  board_slug: "",
  sort_order: 0,
  parent_id: null as number | null,
  slug: "",
  activities: "",
  photo_display_mode: "slideshow",
};

const COMMUNITY_COLLAPSED_KEY = "admin_community_collapsed_divisions";

function CommunityTab() {
  const [items, setItems] = useState<CommunityGroup[]>([]);
  const [boards, setBoards] = useState<BoardOption[]>([]);
  const [form, setForm] = useState({ ...emptyComForm });
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ ...emptyComForm });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [collapsedDivisions, setCollapsedDivisions] = useState<Set<number>>(new Set());
  const select = useBulkSelect(items.map((i) => i.id));

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(COMMUNITY_COLLAPSED_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setCollapsedDivisions(new Set(arr.filter((v) => typeof v === "number")));
      }
    } catch {}
  }, []);

  function toggleDivision(id: number) {
    setCollapsedDivisions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(COMMUNITY_COLLAPSED_KEY, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }

  async function load() {
    const [communityRes, boardsRes] = await Promise.all([
      fetch(`${API}/api/content/community`),
      fetch(`${API}/api/boards`),
    ]);
    if (communityRes.ok) setItems(await communityRes.json());
    if (boardsRes.ok) {
      const bs: { slug: string; name: string }[] = await boardsRes.json();
      setBoards(bs.map((b) => ({ slug: b.slug, name: b.name })));
    }
  }

  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    const res = await fetch(`${API}/api/content/community`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ ...form, board_slug: form.board_slug || null }),
    });
    setLoading(false);
    if (res.ok) { setMsg("추가되었습니다."); setForm({ ...emptyComForm }); setShowCreate(false); load(); }
  }

  async function update(id: number) {
    setLoading(true);
    const res = await fetch(`${API}/api/content/community/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ ...editForm, board_slug: editForm.board_slug || null }),
    });
    setLoading(false);
    if (res.ok) { setMsg("수정되었습니다."); setEditId(null); load(); }
  }

  async function remove(id: number) {
    if (!confirm("삭제하시겠습니까?")) return;
    await fetch(`${API}/api/content/community/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    select.remove(id);
    load();
  }

  async function handleBulkDelete() {
    const ids = Array.from(select.selected);
    if (ids.length === 0) return;
    if (!confirm(`선택한 단체/분과 ${ids.length}개를 삭제하시겠습니까?`)) return;
    setBulkDeleting(true);
    try {
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            const r = await fetch(`${API}/api/content/community/${id}`, {
              method: "DELETE", headers: { Authorization: `Bearer ${getToken()}` },
            });
            return { id, ok: r.ok };
          } catch { return { id, ok: false }; }
        }),
      );
      const succeeded = new Set(results.filter((r) => r.ok).map((r) => r.id));
      if (succeeded.size > 0) { select.removeMany(succeeded); load(); }
      const failedCount = results.filter((r) => !r.ok).length;
      if (failedCount > 0) alert(`${failedCount}건 삭제 실패`);
    } finally {
      setBulkDeleting(false);
    }
  }

  function BoardSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
        <option value="">— 연결 안 함 —</option>
        {boards.map((b) => (
          <option key={b.slug} value={b.slug}>{b.name} ({b.slug})</option>
        ))}
      </select>
    );
  }

  // 분과(parent_id=null) 먼저, 그 뒤에 같은 부모의 소속단체들 트리 정렬
  const topLevel = items.filter((i) => !i.parent_id).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  const childrenOf = (parentId: number) =>
    items.filter((i) => i.parent_id === parentId).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  const childCount = (parentId: number) => items.filter((i) => i.parent_id === parentId).length;
  const sortedItems: CommunityGroup[] = [];
  for (const top of topLevel) {
    sortedItems.push(top);
    if (!collapsedDivisions.has(top.id)) {
      sortedItems.push(...childrenOf(top.id));
    }
  }
  // parent가 사라진 고아도 끝에 표시
  const orphans = items.filter((i) => i.parent_id && !topLevel.find((t) => t.id === i.parent_id));
  sortedItems.push(...orphans);

  return (
    <div className="space-y-6">
      {msg && <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{msg}</p>}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            showCreate
              ? "bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200"
              : "bg-[var(--color-primary)] text-white hover:opacity-90"
          }`}
        >
          {showCreate ? "닫기" : "+ 새 분과/소속단체 추가"}
        </button>
      </div>

      {showCreate && (
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-800 mb-4 border-b pb-2">새 분과/소속단체 추가</h3>
        <form onSubmit={create} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">이름 *</label>
              <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className={inputCls} placeholder="예: 전례분과" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">정렬 순서</label>
              <input type="number" value={form.sort_order} onChange={(e) => setForm((p) => ({ ...p, sort_order: +e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">분류</label>
              <select
                value={form.parent_id ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, parent_id: e.target.value ? +e.target.value : null }))}
                className={inputCls}
              >
                <option value="">최상위 분과 (사이드바에 노출)</option>
                {items.filter((i) => !i.parent_id).map((i) => (
                  <option key={i.id} value={i.id}>┗ {i.name}의 소속단체</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">URL 슬러그 (분과만 필요)</label>
              <input value={form.slug} onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))} className={inputCls} placeholder="liturgy, education" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">설명</label>
            <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={2} className={`${inputCls} resize-none`} placeholder="분과/단체 소개 한두 문단" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">주요 활동 (한 줄에 하나씩)</label>
            <textarea value={form.activities} onChange={(e) => setForm((p) => ({ ...p, activities: e.target.value }))} rows={4} className={`${inputCls} resize-y font-mono text-xs`} placeholder="전례 행사 관련 봉사&#10;전례 실무자 회의 등 분과 운영" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">활동 시간</label>
              <input value={form.activity_time} onChange={(e) => setForm((p) => ({ ...p, activity_time: e.target.value }))} className={inputCls} placeholder="예: 매주 화요일 저녁 7시" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">연결 게시판</label>
              <BoardSelect value={form.board_slug} onChange={(v) => setForm((p) => ({ ...p, board_slug: v }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">사진 표시 방식</label>
            <select
              value={form.photo_display_mode}
              onChange={(e) => setForm((p) => ({ ...p, photo_display_mode: e.target.value }))}
              className={inputCls}
            >
              <option value="slideshow">슬라이드쇼 (자동 전환)</option>
              <option value="grid">사진 격자 (정적, 2열)</option>
            </select>
          </div>
          <p className="text-xs text-gray-400">대표 이미지와 본문 사진은 추가 후 수정 모드에서 등록하세요.</p>
          <button type="submit" disabled={loading} className={btnPrimary}>추가</button>
        </form>
      </section>
      )}

      <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">단체/분과 목록 ({items.length}건)</h3>
        </div>
        <div className="px-6 pt-3">
          <BulkActionBar
            selectedCount={select.selectedCount}
            total={select.total}
            allSelected={select.allSelected}
            someSelected={select.someSelected}
            onToggleAll={select.toggleAll}
            onDelete={handleBulkDelete}
            deleting={bulkDeleting}
            className="mb-0"
          />
        </div>
        <div className="divide-y divide-gray-100">
          {sortedItems.map((g) =>
            editId === g.id ? (
              <div key={g.id} className="p-4 bg-blue-50 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} className={inputCls} placeholder="이름" />
                  <input type="number" value={editForm.sort_order} onChange={(e) => setEditForm((p) => ({ ...p, sort_order: +e.target.value }))} className={inputCls} placeholder="순서" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">분류</label>
                    <select
                      value={editForm.parent_id ?? ""}
                      onChange={(e) => setEditForm((p) => ({ ...p, parent_id: e.target.value ? +e.target.value : null }))}
                      className={inputCls}
                    >
                      <option value="">최상위 분과 (사이드바에 노출)</option>
                      {items.filter((i) => !i.parent_id && i.id !== g.id).map((i) => (
                        <option key={i.id} value={i.id}>┗ {i.name}의 소속단체</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">URL 슬러그</label>
                    <input value={editForm.slug} onChange={(e) => setEditForm((p) => ({ ...p, slug: e.target.value }))} className={inputCls} placeholder="liturgy" />
                  </div>
                </div>
                <textarea value={editForm.description} onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))} rows={2} className={`${inputCls} resize-none`} placeholder="설명" />
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">주요 활동 (한 줄에 하나)</label>
                  <textarea value={editForm.activities} onChange={(e) => setEditForm((p) => ({ ...p, activities: e.target.value }))} rows={4} className={`${inputCls} resize-y font-mono text-xs`} />
                </div>
                <input value={editForm.activity_time} onChange={(e) => setEditForm((p) => ({ ...p, activity_time: e.target.value }))} className={inputCls} placeholder="활동 시간" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">연결 게시판</label>
                    <BoardSelect value={editForm.board_slug} onChange={(v) => setEditForm((p) => ({ ...p, board_slug: v }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">사진 표시 방식</label>
                    <select
                      value={editForm.photo_display_mode}
                      onChange={(e) => setEditForm((p) => ({ ...p, photo_display_mode: e.target.value }))}
                      className={inputCls}
                    >
                      <option value="slideshow">슬라이드쇼 (자동 전환)</option>
                      <option value="grid">사진 격자 (정적, 2열)</option>
                    </select>
                  </div>
                </div>
                <CommunityRepPhotoManager group={g} onChange={load} />
                <CommunityPhotoManager group={g} onChange={load} />
                <div className="flex gap-2">
                  <button onClick={() => update(g.id)} disabled={loading} className={btnPrimary}>저장</button>
                  <button onClick={() => setEditId(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">취소</button>
                </div>
              </div>
            ) : (
              <div key={g.id} className={`flex items-start justify-between px-6 py-4 ${select.isSelected(g.id) ? "bg-red-50/30" : "hover:bg-gray-50"} ${g.parent_id ? "pl-12" : ""}`}>
                <input type="checkbox" checked={select.isSelected(g.id)} onChange={() => select.toggle(g.id)} className="rounded mr-3 mt-0.5" aria-label={`${g.name} 선택`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {g.parent_id ? (
                      <span className="text-xs text-gray-400">└</span>
                    ) : (
                      <>
                        {childCount(g.id) > 0 ? (
                          <button
                            type="button"
                            onClick={() => toggleDivision(g.id)}
                            aria-expanded={!collapsedDivisions.has(g.id)}
                            aria-label={`${g.name} 분과 ${collapsedDivisions.has(g.id) ? "펼치기" : "접기"}`}
                            className="text-gray-400 hover:text-gray-700 -ml-1 mr-0.5"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                              className={`transition-transform ${collapsedDivisions.has(g.id) ? "-rotate-90" : ""}`}
                            >
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </button>
                        ) : null}
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">분과</span>
                        {childCount(g.id) > 0 && (
                          <span className="text-[10px] text-gray-400">소속 {childCount(g.id)}개</span>
                        )}
                      </>
                    )}
                    <p className="font-medium text-sm">{g.name}</p>
                    {g.slug && !g.parent_id && (
                      <code className="text-[10px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">/groups/{g.slug}</code>
                    )}
                    {g.photo_urls && g.photo_urls.length > 0 && (
                      <span className="text-[10px] text-gray-500">사진 {g.photo_urls.length}장</span>
                    )}
                  </div>
                  {g.description && <p className="text-xs text-gray-500 mt-0.5">{g.description}</p>}
                  {g.activities && (
                    <p className="text-xs text-gray-400 mt-0.5">활동: {g.activities.split("\n").filter(Boolean).length}개 항목</p>
                  )}
                  {g.activity_time && <p className="text-xs text-gray-400 mt-0.5">{g.activity_time}</p>}
                  <div className="mt-1.5">
                    {g.board_slug ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                        <span>🔗</span> {boards.find((b) => b.slug === g.board_slug)?.name ?? g.board_slug}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex gap-3 shrink-0 ml-4">
                  <button onClick={() => { setEditId(g.id); setEditForm({ name: g.name, description: g.description ?? "", activity_time: g.activity_time ?? "", board_slug: g.board_slug ?? "", sort_order: g.sort_order, parent_id: g.parent_id, slug: g.slug ?? "", activities: g.activities ?? "", photo_display_mode: g.photo_display_mode ?? "slideshow" }); }} className={btnEdit}>수정</button>
                  <button onClick={() => remove(g.id)} className={btnDanger}>삭제</button>
                </div>
              </div>
            )
          )}
        </div>
      </section>
    </div>
  );
}

function CommunityRepPhotoManager({ group, onChange }: { group: CommunityGroup; onChange: () => void }) {
  const [uploading, setUploading] = useState(false);
  const rep = group.representative_photo_url;

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API}/api/content/community/${group.id}/representative-photo`, {
        method: "POST", headers: { Authorization: `Bearer ${getToken()}` }, body: fd,
      });
      if (res.ok) onChange();
      else alert("대표사진 업로드 실패");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function remove() {
    if (!confirm("대표사진을 삭제하시겠습니까?")) return;
    const res = await fetch(`${API}/api/content/community/${group.id}/representative-photo`, {
      method: "DELETE", headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.ok) onChange();
  }

  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-white">
      <label className="block text-xs font-medium text-gray-600 mb-2">
        대표 이미지 <span className="text-gray-400 font-normal">(/groups 목록의 원형 썸네일)</span>
      </label>
      <div className="flex items-start gap-3">
        <div className="w-20 h-20 rounded-full border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center shrink-0">
          {rep ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`${API}${rep}`} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl text-gray-300">📷</span>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <label className="inline-block px-3 py-1.5 text-xs border border-blue-300 text-blue-600 rounded-lg cursor-pointer hover:bg-blue-50">
            {uploading ? "처리 중..." : rep ? "대표사진 변경" : "대표사진 등록"}
            <input type="file" accept="image/*" onChange={upload} className="hidden" disabled={uploading} />
          </label>
          {rep && (
            <button
              type="button"
              onClick={remove}
              className="ml-2 px-3 py-1.5 text-xs border border-red-300 text-red-500 rounded-lg hover:bg-red-50"
            >
              삭제
            </button>
          )}
          <p className="text-[11px] text-gray-400">
            정사각형 사진 권장. 자동으로 원형 마스킹됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}


function CommunityPhotoManager({ group, onChange }: { group: CommunityGroup; onChange: () => void }) {
  const [uploading, setUploading] = useState(false);
  const photos = group.photo_urls ?? [];

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API}/api/content/community/${group.id}/photos`, {
        method: "POST", headers: { Authorization: `Bearer ${getToken()}` }, body: fd,
      });
      if (res.ok) onChange();
      else alert("업로드 실패");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function remove(url: string) {
    if (!confirm("이 사진을 삭제하시겠습니까?")) return;
    const res = await fetch(`${API}/api/content/community/${group.id}/photos?url=${encodeURIComponent(url)}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.ok) onChange();
  }

  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-white">
      <label className="block text-xs font-medium text-gray-600 mb-2">사진 ({photos.length}장)</label>
      {photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
          {photos.map((u) => (
            <div key={u} className="relative group aspect-square rounded overflow-hidden border border-gray-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${API}${u}`} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => remove(u)}
                className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                title="삭제"
              >×</button>
            </div>
          ))}
        </div>
      )}
      <input type="file" accept="image/*" onChange={upload} disabled={uploading} className="text-xs" />
      {uploading && <p className="text-xs text-gray-400 mt-1">업로드 중…</p>}
    </div>
  );
}

// ─── Council Tab ──────────────────────────────────────────

const COUNCIL_CATEGORIES = ["회장단", "분과대표", "구역장대표"];
const emptyCouncilForm = { name: "", role: "", category: "회장단", sort_order: 0, is_active: true };

function CouncilTab() {
  const [items, setItems] = useState<CouncilMember[]>([]);
  const [form, setForm] = useState({ ...emptyCouncilForm });
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ ...emptyCouncilForm });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [photoUploading, setPhotoUploading] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const select = useBulkSelect(items.map((i) => i.id));

  async function load() {
    const res = await fetch(`${API}/api/content/council/admin`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.ok) setItems(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.role.trim()) return;
    setLoading(true);
    const res = await fetch(`${API}/api/content/council`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (res.ok) { setMsg("추가되었습니다."); setForm({ ...emptyCouncilForm }); setShowCreate(false); load(); }
  }

  async function update(id: number) {
    setLoading(true);
    const res = await fetch(`${API}/api/content/council/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(editForm),
    });
    setLoading(false);
    if (res.ok) { setMsg("수정되었습니다."); setEditId(null); load(); }
  }

  async function remove(id: number) {
    if (!confirm("삭제하시겠습니까?")) return;
    await fetch(`${API}/api/content/council/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    select.remove(id);
    load();
  }

  async function handleBulkDelete() {
    const ids = Array.from(select.selected);
    if (ids.length === 0) return;
    if (!confirm(`선택한 구성원 ${ids.length}명을 삭제하시겠습니까?`)) return;
    setBulkDeleting(true);
    try {
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            const r = await fetch(`${API}/api/content/council/${id}`, {
              method: "DELETE", headers: { Authorization: `Bearer ${getToken()}` },
            });
            return { id, ok: r.ok };
          } catch { return { id, ok: false }; }
        }),
      );
      const succeeded = new Set(results.filter((r) => r.ok).map((r) => r.id));
      if (succeeded.size > 0) { select.removeMany(succeeded); load(); }
      const failedCount = results.filter((r) => !r.ok).length;
      if (failedCount > 0) alert(`${failedCount}건 삭제 실패`);
    } finally {
      setBulkDeleting(false);
    }
  }

  async function uploadPhoto(id: number, file: File) {
    setPhotoUploading(id);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API}/api/content/council/${id}/photo`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` },
      body: fd,
    });
    setPhotoUploading(null);
    if (res.ok) { setMsg("사진이 업로드되었습니다."); load(); }
    else { setMsg("사진 업로드에 실패했습니다."); }
  }

  const grouped = COUNCIL_CATEGORIES.map((cat) => ({
    category: cat,
    members: items.filter((m) => m.category === cat),
  }));

  return (
    <div className="space-y-6">
      {msg && <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{msg}</p>}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            showCreate
              ? "bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200"
              : "bg-[var(--color-primary)] text-white hover:opacity-90"
          }`}
        >
          {showCreate ? "닫기" : "+ 구성원 추가"}
        </button>
      </div>

      {/* 추가 폼 */}
      {showCreate && (
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-800 mb-4 border-b pb-2">구성원 추가</h3>
        <form onSubmit={create} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">이름</label>
              <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className={inputCls} placeholder="홍길동" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">직책</label>
              <input value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))} className={inputCls} placeholder="사목회장" required />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">카테고리</label>
              <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} className={inputCls}>
                {COUNCIL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">순서</label>
              <input type="number" value={form.sort_order} onChange={(e) => setForm((p) => ({ ...p, sort_order: +e.target.value }))} className={inputCls} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))} className="rounded" />
            현직 표시
          </label>
          <button type="submit" disabled={loading} className={btnPrimary}>추가</button>
        </form>
      </section>
      )}

      {/* 다중 선택 일괄 작업 바 (전체 카테고리 범위) */}
      <BulkActionBar
        selectedCount={select.selectedCount}
        total={select.total}
        allSelected={select.allSelected}
        someSelected={select.someSelected}
        onToggleAll={select.toggleAll}
        onDelete={handleBulkDelete}
        deleting={bulkDeleting}
      />

      {/* 카테고리별 목록 */}
      {grouped.map(({ category, members }) => (
        <section key={category} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-700 text-sm">{category}</h3>
            <span className="text-xs text-gray-400">{members.length}명</span>
          </div>
          {members.length === 0 ? (
            <p className="text-sm text-gray-400 px-6 py-4">등록된 구성원이 없습니다.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {members.map((m) => (
                <div key={m.id} className={`px-6 py-3 ${select.isSelected(m.id) ? "bg-red-50/30" : ""}`}>
                  {editId === m.id ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} className={inputCls} placeholder="이름" />
                        <input value={editForm.role} onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))} className={inputCls} placeholder="직책" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <select value={editForm.category} onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value }))} className={inputCls}>
                          {COUNCIL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                        </select>
                        <input type="number" value={editForm.sort_order} onChange={(e) => setEditForm((p) => ({ ...p, sort_order: +e.target.value }))} className={inputCls} placeholder="순서" />
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={editForm.is_active} onChange={(e) => setEditForm((p) => ({ ...p, is_active: e.target.checked }))} className="rounded" />
                        현직
                      </label>
                      <div className="flex gap-2">
                        <button onClick={() => update(m.id)} disabled={loading} className={btnPrimary}>저장</button>
                        <button onClick={() => setEditId(null)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">취소</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <input type="checkbox" checked={select.isSelected(m.id)} onChange={() => select.toggle(m.id)} className="rounded shrink-0" aria-label={`${m.name} 선택`} />
                      {/* 사진 */}
                      <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gray-100 border border-gray-200 shrink-0">
                        {m.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.photo_url.startsWith("http") ? m.photo_url : `${API}${m.photo_url}`} alt={m.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm font-bold">{m.name.slice(-1)}</div>
                        )}
                      </div>
                      {/* 정보 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-gray-800">{m.name}</span>
                          <span className="text-xs text-gray-500">{m.role}</span>
                          {!m.is_active && <span className="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">비활성</span>}
                        </div>
                        <p className="text-xs text-gray-400">순서: {m.sort_order}</p>
                      </div>
                      {/* 액션 */}
                      <div className="flex items-center gap-3 shrink-0">
                        <label className="text-xs text-purple-500 hover:text-purple-700 cursor-pointer">
                          {photoUploading === m.id ? "업로드 중…" : "사진 변경"}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(m.id, f); e.target.value = ""; }}
                          />
                        </label>
                        <button onClick={() => { setEditId(m.id); setEditForm({ name: m.name, role: m.role, category: m.category, sort_order: m.sort_order, is_active: m.is_active }); }} className={btnEdit}>수정</button>
                        <button onClick={() => remove(m.id)} className={btnDanger}>삭제</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

// ─── Meditation Tab ───────────────────────────────────────

interface Meditation {
  id: number;
  title: string;
  scripture: string | null;
  body: string;
  author: string | null;
  published_date: string;
  is_published: boolean;
  is_current?: boolean;
  background_image_url?: string | null;
  background_repeat?: boolean;
  background_position?: string;
  background_blur?: number;
  background_opacity?: number;
  background_gradient?: string;
  background_gradient_size?: number;
  body_font_size_px?: number;
}

type BackgroundPosition =
  | "top-left" | "top-center" | "top-right"
  | "bottom-left" | "bottom-center" | "bottom-right";
const BG_POSITIONS: { value: BackgroundPosition; label: string }[] = [
  { value: "top-left",      label: "↖ 좌상" },
  { value: "top-center",    label: "↑ 상중" },
  { value: "top-right",     label: "↗ 우상" },
  { value: "bottom-left",   label: "↙ 좌하" },
  { value: "bottom-center", label: "↓ 하중" },
  { value: "bottom-right",  label: "↘ 우하" },
];

type BackgroundGradient = "none" | "top" | "bottom" | "left" | "right";
const BG_GRADIENTS: { value: BackgroundGradient; label: string }[] = [
  { value: "none",   label: "✕ 없음" },
  { value: "top",    label: "↓ 위→아래" },
  { value: "bottom", label: "↑ 아래→위" },
  { value: "left",   label: "→ 좌→우" },
  { value: "right",  label: "← 우→좌" },
];

const emptyMedForm = {
  title: "",
  scripture: "",
  body: "",
  author: "",
  published_date: new Date().toISOString().slice(0, 10),
  is_published: true,
};

function MeditationTab() {
  const focusId = useFocusItem();
  const [items, setItems] = useState<Meditation[]>([]);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState({ ...emptyMedForm });
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ ...emptyMedForm });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const select = useBulkSelect(items.map((i) => i.id));

  async function load() {
    const res = await fetch(`${API}/api/content/meditations/admin`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.ok) {
      const data = await res.json();
      setItems(data.items);
      setTotal(data.total);
    }
  }

  useEffect(() => { load(); }, []);

  function flash(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(""), 3000);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) return;
    setLoading(true);
    const body = {
      title: form.title.trim(),
      scripture: form.scripture.trim() || null,
      body: form.body.trim(),
      author: form.author.trim() || null,
      published_date: form.published_date,
      is_published: form.is_published,
    };
    const res = await fetch(`${API}/api/content/meditations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (res.ok) { flash("등록되었습니다."); setForm({ ...emptyMedForm }); setShowCreate(false); load(); notify(DataEvent.MEDITATION_CURRENT); }
  }

  async function update(id: number) {
    setLoading(true);
    const body = {
      title: editForm.title.trim(),
      scripture: editForm.scripture.trim() || null,
      body: editForm.body.trim(),
      author: editForm.author.trim() || null,
      published_date: editForm.published_date,
      is_published: editForm.is_published,
    };
    const res = await fetch(`${API}/api/content/meditations/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (res.ok) { flash("수정되었습니다."); setEditId(null); load(); notify(DataEvent.MEDITATION_CURRENT); }
  }

  async function remove(id: number) {
    if (!confirm("삭제하시겠습니까? 복구할 수 없습니다.")) return;
    await fetch(`${API}/api/content/meditations/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    select.remove(id);
    load();
    notify(DataEvent.MEDITATION_CURRENT);
  }

  async function handleBulkDelete() {
    const ids = Array.from(select.selected);
    if (ids.length === 0) return;
    if (!confirm(`선택한 묵상 ${ids.length}편을 삭제하시겠습니까? 복구할 수 없습니다.`)) return;
    setBulkDeleting(true);
    try {
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            const r = await fetch(`${API}/api/content/meditations/${id}`, {
              method: "DELETE", headers: { Authorization: `Bearer ${getToken()}` },
            });
            return { id, ok: r.ok };
          } catch { return { id, ok: false }; }
        }),
      );
      const succeeded = new Set(results.filter((r) => r.ok).map((r) => r.id));
      if (succeeded.size > 0) { select.removeMany(succeeded); load(); notify(DataEvent.MEDITATION_CURRENT); }
      const failedCount = results.filter((r) => !r.ok).length;
      if (failedCount > 0) alert(`${failedCount}건 삭제 실패`);
    } finally {
      setBulkDeleting(false);
    }
  }

  function startEdit(item: Meditation) {
    setEditId(item.id);
    setEditForm({
      title: item.title,
      scripture: item.scripture ?? "",
      body: item.body,
      author: item.author ?? "",
      published_date: item.published_date,
      is_published: item.is_published,
    });
  }

  // ── 대표 지정 ──────────────────────────────────────────
  async function setCurrent(id: number) {
    const res = await fetch(`${API}/api/content/meditations/${id}/set-current`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.ok) { flash("대표 묵상으로 지정되었습니다."); load(); notify(DataEvent.MEDITATION_CURRENT); }
  }

  async function clearCurrent() {
    const res = await fetch(`${API}/api/content/meditations/clear-current`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.ok) { flash("대표 지정이 해제되었습니다. 최신 글이 자동으로 표시됩니다."); load(); notify(DataEvent.MEDITATION_CURRENT); }
  }

  // ── 배경 옵션 (반복/위치/흐림/투명도/그라데이션/폰트크기) ─
  async function saveBackgroundOptions(item: Meditation, patch: Partial<Meditation>) {
    const merged = {
      background_repeat: item.background_repeat ?? false,
      background_position: item.background_position ?? "top-left",
      background_blur: item.background_blur ?? 0,
      background_opacity: item.background_opacity ?? 100,
      background_gradient: item.background_gradient ?? "none",
      background_gradient_size: item.background_gradient_size ?? 100,
      body_font_size_px: item.body_font_size_px ?? 15,
      ...patch,
    };
    const res = await fetch(`${API}/api/content/meditations/${item.id}/background`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(merged),
    });
    if (res.ok) { load(); notify(DataEvent.MEDITATION_CURRENT); }
  }

  // ── 배경 이미지 업로드/삭제 ──────────────────────────
  async function uploadBackground(id: number, file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API}/api/content/meditations/${id}/background-image`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` },
      body: fd,
    });
    if (res.ok) { flash("배경 이미지가 업로드되었습니다."); load(); notify(DataEvent.MEDITATION_CURRENT); }
    else { flash("업로드에 실패했습니다."); }
  }

  async function removeBackground(id: number) {
    if (!confirm("배경 이미지를 제거하시겠습니까?")) return;
    const res = await fetch(`${API}/api/content/meditations/${id}/background-image`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.ok) { flash("배경 이미지가 제거되었습니다."); load(); notify(DataEvent.MEDITATION_CURRENT); }
  }

  return (
    <div className="space-y-6">
      {msg && <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{msg}</p>}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            showCreate
              ? "bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200"
              : "bg-[var(--color-primary)] text-white hover:opacity-90"
          }`}
        >
          {showCreate ? "닫기" : "+ 새 묵상 작성"}
        </button>
      </div>

      {/* 새 묵상 작성 폼 */}
      {showCreate && (
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-800 mb-4 border-b pb-2">새 묵상 작성</h3>
        <form onSubmit={create} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">발행일 <span className="text-red-400">*</span></label>
              <input
                type="date"
                value={form.published_date}
                onChange={(e) => setForm((p) => ({ ...p, published_date: e.target.value }))}
                className={inputCls}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">성경 구절</label>
              <input
                value={form.scripture}
                onChange={(e) => setForm((p) => ({ ...p, scripture: e.target.value }))}
                className={inputCls}
                placeholder="예: 요한 3,16  /  마태 5,1-12"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">제목 <span className="text-red-400">*</span></label>
            <input
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              className={inputCls}
              placeholder="묵상 제목"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              본문 <span className="text-red-400">*</span>
              <span className="ml-2 font-normal text-gray-400">마크다운 지원 — **굵게**, *기울임*, 표·목록 등</span>
            </label>
            <MarkdownEditor
              value={form.body}
              onChange={(v) => setForm((p) => ({ ...p, body: v }))}
              height={320}
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">작성자 (선택)</label>
              <input
                value={form.author}
                onChange={(e) => setForm((p) => ({ ...p, author: e.target.value }))}
                className={inputCls}
                placeholder="예: 주임 신부 홍길동"
              />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer shrink-0 mt-4">
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={(e) => setForm((p) => ({ ...p, is_published: e.target.checked }))}
                className="rounded"
              />
              바로 게시
            </label>
          </div>
          <button type="submit" disabled={loading} className={btnPrimary}>등록</button>
        </form>
      </section>
      )}

      {/* 대표 묵상 안내 */}
      <section className="bg-violet-50/60 border border-violet-200 rounded-xl px-5 py-3 flex items-start gap-3 text-sm">
        <span className="text-violet-700 mt-0.5">📌</span>
        <div className="flex-1 text-violet-900 leading-relaxed">
          <p className="font-medium">대표 묵상</p>
          <p className="text-xs text-violet-700 mt-0.5">
            아래 목록의 <strong>대표로 지정</strong> 버튼을 누르면 그 묵상이 홈·묵상 페이지에 우선 표시됩니다.
            지정하지 않으면 <strong>가장 최신 묵상</strong>이 자동으로 노출됩니다.
          </p>
          {items.some((i) => i.is_current) && (
            <button
              type="button"
              onClick={clearCurrent}
              className="mt-1 text-xs text-violet-700 underline hover:text-violet-900"
            >
              대표 지정 해제 (최신으로 자동 노출)
            </button>
          )}
        </div>
      </section>

      {/* 목록 */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-800 mb-4 border-b pb-2">
          묵상 목록 <span className="text-gray-400 font-normal text-sm">({total}편)</span>
        </h3>
        <BulkActionBar
          selectedCount={select.selectedCount}
          total={select.total}
          allSelected={select.allSelected}
          someSelected={select.someSelected}
          onToggleAll={select.toggleAll}
          onDelete={handleBulkDelete}
          deleting={bulkDeleting}
        />
        <div className="space-y-3">
          {items.length === 0 && <p className="text-sm text-gray-400 text-center py-8">등록된 묵상이 없습니다.</p>}
          {items.map((item, idx) => (
            <div
              key={item.id}
              data-focus-id={item.id}
              className={`border rounded-lg overflow-hidden ${
                select.isSelected(item.id)
                  ? "border-red-300 bg-red-50/30"
                  : focusId === item.id
                  ? FOCUS_RING_CLASS
                  : "border-gray-100"
              }`}
            >
              {editId === item.id ? (
                <div className="p-4 bg-blue-50 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">발행일</label>
                      <input type="date" value={editForm.published_date} onChange={(e) => setEditForm((p) => ({ ...p, published_date: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">성경 구절</label>
                      <input value={editForm.scripture} onChange={(e) => setEditForm((p) => ({ ...p, scripture: e.target.value }))} className={inputCls} placeholder="요한 3,16" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">제목</label>
                    <input value={editForm.title} onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      본문
                      <span className="ml-2 font-normal text-gray-400">마크다운 지원</span>
                    </label>
                    <MarkdownEditor
                      value={editForm.body}
                      onChange={(v) => setEditForm((p) => ({ ...p, body: v }))}
                      height={320}
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">작성자</label>
                      <input value={editForm.author} onChange={(e) => setEditForm((p) => ({ ...p, author: e.target.value }))} className={inputCls} />
                    </div>
                    <label className="flex items-center gap-2 text-sm cursor-pointer shrink-0 mt-4">
                      <input type="checkbox" checked={editForm.is_published} onChange={(e) => setEditForm((p) => ({ ...p, is_published: e.target.checked }))} className="rounded" />
                      게시됨
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => update(item.id)} disabled={loading} className={btnPrimary}>저장</button>
                    <button onClick={() => setEditId(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100">취소</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="p-4 flex items-start justify-between gap-4">
                    <input type="checkbox" checked={select.isSelected(item.id)} onChange={() => select.toggle(item.id)} className="rounded mt-1 shrink-0" aria-label={`${item.title} 선택`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {item.is_current && (
                          <span className="text-[10px] font-bold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">📌 대표</span>
                        )}
                        {idx === 0 && !item.is_current && (
                          <span className="text-[10px] font-medium bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">최신</span>
                        )}
                        {!item.is_published && (
                          <span className="text-[10px] font-medium bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">비공개</span>
                        )}
                        <span className="text-xs text-gray-400">{item.published_date}</span>
                        {item.scripture && (
                          <span className="text-xs text-[var(--color-accent)]">{item.scripture}</span>
                        )}
                      </div>
                      <p className="font-medium text-sm text-gray-800">{item.title}</p>
                      {item.author && <p className="text-xs text-gray-400 mt-0.5">{item.author}</p>}
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{item.body.slice(0, 100)}</p>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0 items-end">
                      <div className="flex gap-3">
                        <button onClick={() => startEdit(item)} className={btnEdit}>수정</button>
                        <button onClick={() => remove(item.id)} className={btnDanger}>삭제</button>
                      </div>
                      {!item.is_current && (
                        <button
                          onClick={() => setCurrent(item.id)}
                          className="text-xs px-2.5 py-1 rounded-md border border-violet-300 text-violet-700 hover:bg-violet-50 font-medium"
                        >
                          📌 대표로 지정
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 배경 이미지·옵션 패널 (대표일 때 강조) */}
                  <BackgroundPanel
                    item={item}
                    onUpload={(file) => uploadBackground(item.id, file)}
                    onRemove={() => removeBackground(item.id)}
                    onOptionsChange={(patch) => saveBackgroundOptions(item, patch)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── Meditation Background Panel ──────────────────────────

function BackgroundPanel({
  item,
  onUpload,
  onRemove,
  onOptionsChange,
}: {
  item: Meditation;
  onUpload: (file: File) => void | Promise<void>;
  onRemove: () => void | Promise<void>;
  onOptionsChange: (patch: Partial<Meditation>) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const repeat = !!item.background_repeat;
  const position = (item.background_position as BackgroundPosition) || "top-left";
  const blur = item.background_blur ?? 0;
  const opacity = item.background_opacity ?? 100;
  const gradient = (item.background_gradient as BackgroundGradient) || "none";
  const gradientSize = item.background_gradient_size ?? 100;
  const fontSize = item.body_font_size_px ?? 15;
  const bgUrl = item.background_image_url
    ? (item.background_image_url.startsWith("http")
        ? item.background_image_url
        : `${API}${item.background_image_url}`)
    : null;

  const summaryParts: string[] = [];
  if (bgUrl) summaryParts.push("이미지 ✓");
  summaryParts.push(repeat ? "반복" : (BG_POSITIONS.find((p) => p.value === position)?.label ?? position));
  if (blur > 0) summaryParts.push(`흐림 ${blur}px`);
  if (opacity < 100) summaryParts.push(`투명도 ${opacity}%`);
  if (gradient !== "none") {
    const gLabel = BG_GRADIENTS.find((g) => g.value === gradient)?.label ?? gradient;
    summaryParts.push(`그라데이션 ${gLabel}${gradientSize !== 100 ? ` (${gradientSize}%)` : ""}`);
  }
  if (fontSize !== 15) summaryParts.push(`글자 ${fontSize}px`);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try { await onUpload(file); }
    finally { setUploading(false); e.target.value = ""; }
  }

  return (
    <div className={`border-t border-gray-100 ${item.is_current ? "bg-violet-50/30" : "bg-gray-50/50"}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-2 flex items-center justify-between text-xs text-gray-600 hover:text-gray-900 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span>🎨 배경 설정</span>
          {!open && (
            <span className="text-gray-400">— {summaryParts.join(" · ")}</span>
          )}
        </span>
        <span className="text-gray-400">{open ? "닫기 ▲" : "펼치기 ▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* 이미지 영역 */}
          <div className="flex items-start gap-3">
            <div
              className="w-24 h-16 rounded-md border border-gray-200 bg-white flex items-center justify-center text-[10px] text-gray-400 overflow-hidden shrink-0"
              style={bgUrl ? { backgroundImage: `url("${bgUrl}")`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
            >
              {!bgUrl && "이미지 없음"}
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="inline-flex items-center gap-2 text-xs">
                <span className="px-2.5 py-1 bg-white border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50">
                  {uploading ? "업로드 중…" : bgUrl ? "이미지 교체" : "이미지 업로드"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFile}
                  className="sr-only"
                  disabled={uploading}
                />
              </label>
              {bgUrl && (
                <button
                  type="button"
                  onClick={() => onRemove()}
                  className="self-start text-[11px] text-red-600 hover:underline"
                >
                  이미지 제거
                </button>
              )}
              <p className="text-[10px] text-gray-400">권장: 가로 1600px 이상 PNG/JPG</p>
            </div>
          </div>

          {/* 옵션 영역 */}
          <div className="space-y-2.5 text-xs">
            {/* 반복 */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={repeat}
                onChange={(e) => onOptionsChange({ background_repeat: e.target.checked })}
                className="rounded"
              />
              <span className="font-medium text-gray-700">배경 반복</span>
              <span className="text-gray-400">(체크 해제 시 한 번만 표시)</span>
            </label>

            {/* 시작점 (반복 아닐 때만) — 3열 × 2행 */}
            <div className={repeat ? "opacity-40 pointer-events-none" : ""}>
              <p className="text-gray-700 font-medium mb-1">시작 위치</p>
              <div className="grid grid-cols-3 gap-1.5">
                {BG_POSITIONS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => onOptionsChange({ background_position: p.value })}
                    className={`px-2 py-1.5 rounded-md border text-xs transition-colors ${
                      position === p.value
                        ? "bg-violet-600 text-white border-violet-600"
                        : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 흐림 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-700 font-medium">흐림 정도</span>
                <span className="text-gray-500 tabular-nums">{blur}px</span>
              </div>
              <input
                type="range"
                min={0}
                max={40}
                step={1}
                value={blur}
                onChange={(e) => onOptionsChange({ background_blur: Number(e.target.value) })}
                className="w-full accent-violet-600"
              />
            </div>

            {/* 투명도 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-700 font-medium">투명도</span>
                <span className="text-gray-500 tabular-nums">{opacity}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={opacity}
                onChange={(e) => onOptionsChange({ background_opacity: Number(e.target.value) })}
                className="w-full accent-violet-600"
              />
              <p className="text-[10px] text-gray-400 mt-0.5">100% = 선명, 0% = 보이지 않음</p>
            </div>

            {/* 그라데이션 */}
            <div>
              <p className="text-gray-700 font-medium mb-1">
                그라데이션 페이드
                <span className="ml-2 font-normal text-gray-400 text-[10px]">선택한 방향으로 점차 사라짐</span>
              </p>
              <div className="grid grid-cols-5 gap-1.5">
                {BG_GRADIENTS.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => onOptionsChange({ background_gradient: g.value })}
                    className={`px-1.5 py-1.5 rounded-md border text-[11px] transition-colors ${
                      gradient === g.value
                        ? "bg-violet-600 text-white border-violet-600"
                        : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>

              {/* 그라데이션 크기 — 'none' 일 땐 비활성 */}
              <div className={`mt-2 ${gradient === "none" ? "opacity-40 pointer-events-none" : ""}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-600 text-[11px]">그라데이션 크기</span>
                  <span className="text-gray-500 tabular-nums text-[11px]">{gradientSize}%</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={gradientSize}
                  onChange={(e) => onOptionsChange({ background_gradient_size: Number(e.target.value) })}
                  className="w-full accent-violet-600"
                />
                <p className="text-[10px] text-gray-400 mt-0.5">
                  100% = 박스 전체에 걸쳐 부드럽게 · 작을수록 한쪽 끝에만 좁게 페이드
                </p>
              </div>
            </div>
          </div>

          {/* 본문 글자 크기 (배경과 별개지만 같은 패널 안에서 함께 조정) */}
          <div className="pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between mb-1">
              <span className="text-gray-700 font-medium text-xs">본문 글자 크기</span>
              <span className="text-gray-500 tabular-nums text-xs">{fontSize}px</span>
            </div>
            <input
              type="range"
              min={12}
              max={32}
              step={1}
              value={fontSize}
              onChange={(e) => onOptionsChange({ body_font_size_px: Number(e.target.value) })}
              className="w-full accent-violet-600"
            />
            <p className="text-[10px] text-gray-400 mt-0.5">기본 15px · 권장 14~22px</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────

const TABS = [
  { key: "vision", label: "사목지표", subtitle: "본당의 사목 방향을 관리합니다." },
  { key: "meditation", label: "주일 말씀", subtitle: "주일 말씀과 묵상 글을 관리합니다." },
  { key: "history", label: "연혁", subtitle: "성당의 역사·연혁 기록을 관리합니다." },
  { key: "council", label: "사목평의회", subtitle: "회장단·분과대표·구역장대표를 관리합니다." },
  { key: "community", label: "단체·분과", subtitle: "단체와 분과 정보를 관리합니다." },
] as const;

type TabKey = typeof TABS[number]["key"];

export default function AdminContentPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const rawTab = searchParams.get("tab");
  const tab: TabKey = (TABS.map((t) => t.key) as string[]).includes(rawTab ?? "")
    ? (rawTab as TabKey)
    : "vision";

  const currentTab = TABS.find((t) => t.key === tab) ?? TABS[0];

  function setTab(key: TabKey) {
    router.push(`/admin/content?tab=${key}`);
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{currentTab.label}</h1>
        <p className="text-sm text-gray-500 mt-1">{currentTab.subtitle}</p>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === t.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "meditation" && <MeditationTab />}
      {tab === "council" && <CouncilTab />}
      {tab === "history" && <HistoryTab />}
      {tab === "vision" && <VisionTab />}
      {tab === "community" && <CommunityTab />}
    </div>
  );
}
