"use client";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { DataEvent, notify } from "@/components/dataEvents";
import { useBulkSelect } from "@/components/useBulkSelect";
import BulkActionBar from "@/components/BulkActionBar";

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
}

interface BoardOption { slug: string; name: string; }

interface StaticPage {
  slug: string;
  title: string;
  subtitle: string | null;
  body: string | null;
}

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
  const [form, setForm] = useState({ year: new Date().getFullYear(), motto: "", is_current: false });
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ year: 0, motto: "", is_current: false });
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
    if (res.ok) { setMsg("추가되었습니다."); setForm({ year: new Date().getFullYear(), motto: "", is_current: false }); setShowCreate(false); load(); }
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
                <input value={editForm.motto} onChange={(e) => setEditForm((p) => ({ ...p, motto: e.target.value }))} className={inputCls} />
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
                  <button onClick={() => { setEditId(v.id); setEditForm({ year: v.year, motto: v.motto, is_current: v.is_current }); }} className={btnEdit}>수정</button>
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
};

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
  const select = useBulkSelect(items.map((i) => i.id));

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
  const children = (parentId: number) =>
    items.filter((i) => i.parent_id === parentId).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  const sortedItems: CommunityGroup[] = [];
  for (const top of topLevel) {
    sortedItems.push(top);
    sortedItems.push(...children(top.id));
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
          <p className="text-xs text-gray-400">사진은 등록 후 수정 모드에서 추가하세요.</p>
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
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">연결 게시판</label>
                  <BoardSelect value={editForm.board_slug} onChange={(v) => setEditForm((p) => ({ ...p, board_slug: v }))} />
                </div>
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
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">분과</span>
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
                  <button onClick={() => { setEditId(g.id); setEditForm({ name: g.name, description: g.description ?? "", activity_time: g.activity_time ?? "", board_slug: g.board_slug ?? "", sort_order: g.sort_order, parent_id: g.parent_id, slug: g.slug ?? "", activities: g.activities ?? "" }); }} className={btnEdit}>수정</button>
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

// ─── Pages Tab ───────────────────────────────────────────

const PAGE_LABELS: Record<string, string> = {
  saint: "성 베드로",
  council: "사목평의회",
  meditation: "묵상 글",
  prayer: "기도문",
};

function PagesTab() {
  const [pages, setPages] = useState<StaticPage[]>([]);
  const [editSlug, setEditSlug] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", subtitle: "", body: "" });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    const res = await fetch(`${API}/api/content/pages`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.ok) setPages(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function save(slug: string) {
    setLoading(true);
    const res = await fetch(`${API}/api/content/pages/${slug}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(editForm),
    });
    setLoading(false);
    if (res.ok) { setMsg("저장되었습니다."); setEditSlug(null); load(); }
  }

  return (
    <div className="space-y-4">
      {msg && <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{msg}</p>}
      <p className="text-xs text-gray-500">각 페이지의 제목·부제·본문을 수정합니다. 본문은 줄바꿈이 그대로 표시됩니다.</p>

      <div className="space-y-3">
        {pages.map((page) =>
          editSlug === page.slug ? (
            <div key={page.slug} className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-blue-400">/{page.slug}</span>
                <span className="font-semibold text-sm text-gray-700">{PAGE_LABELS[page.slug] ?? page.slug}</span>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">제목</label>
                <input value={editForm.title} onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">부제 (선택)</label>
                <input value={editForm.subtitle} onChange={(e) => setEditForm((p) => ({ ...p, subtitle: e.target.value }))} className={inputCls} placeholder="페이지 아래에 작은 글씨로 표시됩니다" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">본문</label>
                <textarea
                  value={editForm.body}
                  onChange={(e) => setEditForm((p) => ({ ...p, body: e.target.value }))}
                  rows={10}
                  className={`${inputCls} resize-y font-mono text-xs leading-relaxed`}
                  placeholder="내용을 입력하세요. 줄바꿈은 그대로 반영됩니다."
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => save(page.slug)} disabled={loading} className={btnPrimary}>저장</button>
                <button onClick={() => setEditSlug(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">취소</button>
              </div>
            </div>
          ) : (
            <div key={page.slug} className="bg-white border border-gray-200 rounded-xl p-5 flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-gray-400">/{page.slug}</span>
                  <span className="font-semibold text-sm">{PAGE_LABELS[page.slug] ?? page.slug}</span>
                </div>
                <p className="text-sm font-medium text-gray-700">{page.title}</p>
                {page.subtitle && <p className="text-xs text-gray-400 mt-0.5">{page.subtitle}</p>}
                {page.body ? (
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2 whitespace-pre-line">{page.body}</p>
                ) : (
                  <p className="text-xs text-orange-400 mt-1">본문 없음 — 수정 버튼으로 내용을 추가하세요.</p>
                )}
              </div>
              <button
                onClick={() => { setEditSlug(page.slug); setEditForm({ title: page.title, subtitle: page.subtitle ?? "", body: page.body ?? "" }); }}
                className={btnEdit}
              >
                수정
              </button>
            </div>
          )
        )}
      </div>
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
}

const emptyMedForm = {
  title: "",
  scripture: "",
  body: "",
  author: "",
  published_date: new Date().toISOString().slice(0, 10),
  is_published: true,
};

function MeditationTab() {
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
            <label className="block text-xs font-medium text-gray-600 mb-1">본문 <span className="text-red-400">*</span></label>
            <textarea
              value={form.body}
              onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
              rows={8}
              className={`${inputCls} resize-y`}
              placeholder="묵상 내용을 입력하세요. 줄바꿈이 그대로 표시됩니다."
              required
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
            <div key={item.id} className={`border rounded-lg overflow-hidden ${select.isSelected(item.id) ? "border-red-300 bg-red-50/30" : "border-gray-100"}`}>
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
                    <label className="block text-xs font-medium text-gray-600 mb-1">본문</label>
                    <textarea value={editForm.body} onChange={(e) => setEditForm((p) => ({ ...p, body: e.target.value }))} rows={8} className={`${inputCls} resize-y`} />
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
                <div className="p-4 flex items-start justify-between gap-4">
                  <input type="checkbox" checked={select.isSelected(item.id)} onChange={() => select.toggle(item.id)} className="rounded mt-1 shrink-0" aria-label={`${item.title} 선택`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {idx === 0 && (
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
                  <div className="flex gap-3 shrink-0">
                    <button onClick={() => startEdit(item)} className={btnEdit}>수정</button>
                    <button onClick={() => remove(item.id)} className={btnDanger}>삭제</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────

const TABS = [
  { key: "meditation", label: "묵상 글" },
  { key: "council", label: "사목평의회" },
  { key: "history", label: "연혁" },
  { key: "vision", label: "사목지표" },
  { key: "community", label: "단체/분과" },
  { key: "pages", label: "페이지 내용" },
] as const;

type TabKey = typeof TABS[number]["key"];

export default function AdminContentPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const rawTab = searchParams.get("tab");
  const tab: TabKey = (TABS.map((t) => t.key) as string[]).includes(rawTab ?? "")
    ? (rawTab as TabKey)
    : "meditation";

  function setTab(key: TabKey) {
    router.push(`/admin/content?tab=${key}`);
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">페이지 콘텐츠 관리</h1>
        <p className="text-sm text-gray-500 mt-1">묵상, 연혁, 사목지표, 단체/분과 내용을 관리합니다.</p>
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
      {tab === "pages" && <PagesTab />}
    </div>
  );
}
