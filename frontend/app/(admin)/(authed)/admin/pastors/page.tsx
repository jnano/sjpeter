"use client";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { DataEvent, notify } from "@/components/dataEvents";
import { useBulkSelect } from "@/components/useBulkSelect";
import BulkActionBar from "@/components/BulkActionBar";
import CrossIcon from "@/components/icons/CrossIcon";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Pastor {
  id: number;
  name: string;
  title: string;
  appointed_at: string | null;
  resigned_at: string | null;
  photo_url: string | null;
  bio: string | null;
  sort_order: number;
  category: "priest" | "sister";
}

const EMPTY: Omit<Pastor, "id" | "photo_url"> = {
  name: "", title: "주임신부", appointed_at: "", resigned_at: "", bio: "", sort_order: 0,
  category: "priest",
};

const CATEGORY_LABEL: Record<string, string> = { priest: "신부님", sister: "수녀님" };

function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
}

export default function AdminPastorsPage() {
  const [pastors, setPastors] = useState<Pastor[]>([]);
  const [form, setForm] = useState({ ...EMPTY });
  const [editId, setEditId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const select = useBulkSelect(pastors.map((p) => p.id));

  function scrollToForm() {
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  useEffect(() => { load(); }, []);

  async function load() {
    const res = await fetch(`${API}/api/archive/pastors`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.ok) setPastors(await res.json());
  }

  function loadAfterMutation() {
    load();
    notify(DataEvent.ARCHIVE_COUNTS);
  }

  function openCreate() {
    setForm({ ...EMPTY }); setEditId(null); setMsg(null); setShowForm(true);
    scrollToForm();
  }
  function closeForm() {
    setShowForm(false); setEditId(null); setMsg(null);
  }
  function openEdit(p: Pastor) {
    setForm({ name: p.name, title: p.title,
      appointed_at: p.appointed_at?.slice(0, 10) ?? "",
      resigned_at: p.resigned_at?.slice(0, 10) ?? "",
      bio: p.bio ?? "", sort_order: p.sort_order, category: p.category });
    setEditId(p.id); setMsg(null); setShowForm(false); // 새 폼은 닫고 인라인으로
    scrollToForm();
  }
  function toggleEdit(p: Pastor) {
    if (editId === p.id) {
      setEditId(null); setMsg(null);
    } else {
      openEdit(p);
    }
  }

  // editId가 있고 이임일이 비어 있으면 "현재 사목자로 복원" 모드
  const isRestoreMode = editId !== null && !form.resigned_at;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const token = getToken();

    if (isRestoreMode) {
      if (!confirm(`${form.name} 님을 현재 사목자로 복원하시겠습니까?\n역대 사목자 목록에서는 사라지고 현재 사목자 목록에 다시 등장합니다.`)) {
        return;
      }
      const res = await fetch(`${API}/api/archive/pastors/${editId}/restore-to-staff`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setMsg({ type: "err", text: d.detail || "복원에 실패했습니다." });
        return;
      }
      setMsg({ type: "ok", text: "현재 사목자로 복원되었습니다." });
      setShowForm(false);
      loadAfterMutation();
      return;
    }

    const body = {
      ...form,
      appointed_at: form.appointed_at || null,
      resigned_at: form.resigned_at || null,
    };
    const url = editId ? `${API}/api/archive/pastors/${editId}` : `${API}/api/archive/pastors`;
    const res = await fetch(url, {
      method: editId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) { setMsg({ type: "err", text: "저장에 실패했습니다." }); return; }
    setMsg({ type: "ok", text: "저장되었습니다." });
    setShowForm(false);
    loadAfterMutation();
  }

  async function handleDelete(id: number) {
    if (!confirm("삭제하시겠습니까?")) return;
    await fetch(`${API}/api/archive/pastors/${id}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${getToken()}` },
    });
    select.remove(id);
    loadAfterMutation();
  }

  async function handleBulkDelete() {
    const ids = Array.from(select.selected);
    if (ids.length === 0) return;
    const targets = pastors.filter((p) => ids.includes(p.id));
    const names = targets.map((p) => p.name).join(", ");
    if (!confirm(`선택한 ${ids.length}명(${names})을 삭제하시겠습니까?`)) return;
    setBulkDeleting(true);
    const token = getToken();
    try {
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            const res = await fetch(`${API}/api/archive/pastors/${id}`, {
              method: "DELETE", headers: { Authorization: `Bearer ${token}` },
            });
            return { id, ok: res.ok };
          } catch { return { id, ok: false }; }
        }),
      );
      const succeeded = new Set(results.filter((r) => r.ok).map((r) => r.id));
      const failedCount = results.filter((r) => !r.ok).length;
      if (succeeded.size > 0) {
        select.removeMany(succeeded);
        loadAfterMutation();
      }
      if (failedCount > 0) alert(`${failedCount}건 삭제 실패`);
    } finally {
      setBulkDeleting(false);
    }
  }

  async function handlePhoto(id: number, file: File) {
    setUploading(id);
    const fd = new FormData();
    fd.append("file", file);
    await fetch(`${API}/api/archive/pastors/${id}/photo`, {
      method: "POST", headers: { Authorization: `Bearer ${getToken()}` }, body: fd,
    });
    setUploading(null);
    load();  // 사진 업로드는 archive counts에 영향 없음
  }

  const renderForm = () => (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="p-5 bg-[var(--color-surface-warm)] border border-[var(--color-border)] rounded-xl space-y-3"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[var(--color-primary)]">
          {editId ? `수정 — ${form.name || "(이름 없음)"}` : "새 사목자 등록"}
        </h2>
        {editId && (
          <button
            type="button"
            onClick={openCreate}
            className="text-xs text-gray-600 underline"
          >
            닫고 새로 등록
          </button>
        )}
      </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">구분 *</label>
              <select
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as "priest" | "sister" }))}
                className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]"
              >
                <option value="priest">역대 신부님 (/pastors)</option>
                <option value="sister">역대 수녀님 (/sisters)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">정렬 순서</label>
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm((p) => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))}
                className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">이름 *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required
                className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">직함</label>
              <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]"
                placeholder="주임신부, 보좌신부, 수녀…" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">부임일</label>
              <input type="date" value={form.appointed_at ?? ""} onChange={e => setForm(p => ({ ...p, appointed_at: e.target.value }))}
                className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">이임일</label>
              <input type="date" value={form.resigned_at ?? ""} onChange={e => setForm(p => ({ ...p, resigned_at: e.target.value }))}
                className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]" />
              {editId && !form.resigned_at && (
                <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                  ⚠ 비워서 저장하면 <strong>현재 사목자로 복원</strong>됩니다.
                </p>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">소개</label>
            <textarea value={form.bio ?? ""} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} rows={3}
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)] resize-none" />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={closeForm} className="px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm">취소</button>
            <button
              type="submit"
              className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${
                isRestoreMode
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-[var(--color-primary)] hover:opacity-90"
              }`}
            >
              {isRestoreMode ? "현재 사목자로 복원" : "저장"}
            </button>
          </div>
        </form>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-primary)]">역대 신부님·수녀님 관리</h1>
        <button
          onClick={showForm && !editId ? closeForm : openCreate}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            showForm && !editId
              ? "bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200"
              : "bg-[var(--color-primary)] text-white hover:opacity-90"
          }`}
        >
          {showForm && !editId ? "닫기" : "+ 등록"}
        </button>
      </div>

      {msg && (
        <p className={`mb-4 text-sm px-3 py-2 rounded-lg ${msg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {msg.text}
        </p>
      )}

      {editId !== null && (
        <div className="mb-4 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
          <strong>{form.name || "(이름 없음)"}</strong> 수정 중 — 해당 항목 아래에서 폼이 펼쳐집니다
        </div>
      )}

      {/* 새 등록 폼 (버튼 토글 + 편집 중이 아닐 때) */}
      {showForm && !editId && (
        <div className="mb-6">{renderForm()}</div>
      )}

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
        {pastors.length === 0 && <p className="text-center py-12 text-[var(--color-text-muted)] text-sm">등록된 사목자가 없습니다.</p>}
        {pastors.map((p) => {
          const isEditing = editId === p.id;
          const isChecked = select.isSelected(p.id);
          return (
            <div key={p.id}>
              <div className={`flex items-center gap-4 bg-white border p-4 ${
                isEditing ? "rounded-t-xl border-amber-300 border-b-0" : isChecked ? "rounded-xl border-red-300 bg-red-50/30" : "rounded-xl border-[var(--color-border)]"
              }`}>
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => select.toggle(p.id)}
                  className="rounded shrink-0"
                  aria-label={`${p.name} 선택`}
                />
                {/* 사진 */}
                <div className="w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-[var(--color-surface-warm)] border border-[var(--color-border)] flex items-center justify-center relative">
                  {p.photo_url ? (
                    <Image src={p.photo_url.startsWith("/") ? `${API}${p.photo_url}` : p.photo_url}
                      alt={p.name} fill className="object-cover" />
                  ) : (
                    <CrossIcon className="text-2xl text-[var(--color-border)]" />
                  )}
                </div>
                {/* 정보 */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[var(--color-primary)] flex items-center gap-2 flex-wrap">
                    <span>{p.name}</span>
                    <span className="text-xs font-normal text-[var(--color-text-muted)]">{p.title}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      p.category === "sister"
                        ? "bg-pink-100 text-pink-700"
                        : "bg-blue-100 text-blue-700"
                    }`}>
                      {CATEGORY_LABEL[p.category] ?? p.category}
                    </span>
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {p.appointed_at?.slice(0, 7) ?? "??"} ~ {p.resigned_at?.slice(0, 7) ?? "현재"}
                  </p>
                </div>
                {/* 액션 */}
                <div className="flex gap-2 shrink-0">
                  <label className="px-3 py-1.5 text-xs border border-[var(--color-border)] rounded-lg cursor-pointer hover:bg-gray-50">
                    {uploading === p.id ? "업로드 중…" : "사진"}
                    <input ref={fileRef} type="file" accept="image/*" className="hidden"
                      onChange={e => e.target.files?.[0] && handlePhoto(p.id, e.target.files[0])} />
                  </label>
                  <button
                    onClick={() => toggleEdit(p)}
                    className={`px-3 py-1.5 text-xs border rounded-lg ${
                      isEditing
                        ? "bg-amber-100 border-amber-400 text-amber-800"
                        : "border-[var(--color-border)] hover:bg-gray-50"
                    }`}
                  >
                    {isEditing ? "수정 닫기" : "수정"}
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="px-3 py-1.5 text-xs border border-red-200 text-red-500 rounded-lg hover:bg-red-50">삭제</button>
                </div>
              </div>
              {isEditing && (
                <div className="border border-t-0 border-amber-300 rounded-b-xl overflow-hidden">
                  {renderForm()}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
