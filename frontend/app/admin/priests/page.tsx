"use client";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { DataEvent, notify } from "@/components/dataEvents";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Priest {
  id: number;
  name: string;
  baptism_date: string | null;
  ordained_date: string;
  role: string | null;
  photo_url: string | null;
  bio: string | null;
  sort_order: number;
}

const EMPTY = {
  name: "", baptism_date: "", ordained_date: "", role: "", bio: "", sort_order: 0,
};

function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
}

export default function AdminPriestsPage() {
  const [priests, setPriests] = useState<Priest[]>([]);
  const [form, setForm] = useState({ ...EMPTY });
  const [editId, setEditId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  function scrollToForm() {
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  useEffect(() => { load(); }, []);

  async function load() {
    const res = await fetch(`${API}/api/archive/priests`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.ok) setPriests(await res.json());
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
  function openEdit(p: Priest) {
    setForm({
      name: p.name,
      baptism_date: p.baptism_date?.slice(0, 10) ?? "",
      ordained_date: p.ordained_date?.slice(0, 10) ?? "",
      role: p.role ?? "",
      bio: p.bio ?? "",
      sort_order: p.sort_order,
    });
    setEditId(p.id); setMsg(null); setShowForm(false);
    scrollToForm();
  }
  function toggleEdit(p: Priest) {
    if (editId === p.id) { setEditId(null); setMsg(null); }
    else openEdit(p);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const token = getToken();
    const body = {
      ...form,
      baptism_date: form.baptism_date || null,
      ordained_date: form.ordained_date,
      role: form.role || null,
    };
    const url = editId ? `${API}/api/archive/priests/${editId}` : `${API}/api/archive/priests`;
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
    await fetch(`${API}/api/archive/priests/${id}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${getToken()}` },
    });
    loadAfterMutation();
  }

  async function handlePhoto(id: number, file: File) {
    setUploading(id);
    const fd = new FormData();
    fd.append("file", file);
    await fetch(`${API}/api/archive/priests/${id}/photo`, {
      method: "POST", headers: { Authorization: `Bearer ${getToken()}` }, body: fd,
    });
    setUploading(null);
    load();
  }

  const renderForm = () => (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="p-5 bg-[var(--color-surface-warm)] border border-[var(--color-border)] rounded-xl space-y-3"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[var(--color-primary)]">
          {editId ? `수정 — ${form.name || "(이름 없음)"}` : "새 사제 등록"}
        </h2>
        {editId && (
          <button type="button" onClick={openCreate} className="text-xs text-gray-600 underline">
            닫고 새로 등록
          </button>
        )}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">이름 *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required
                className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">직책/현황</label>
              <input value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]"
                placeholder="예: 대전교구 ○○본당 주임" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">사제서품일 *</label>
              <input type="date" value={form.ordained_date} onChange={e => setForm(p => ({ ...p, ordained_date: e.target.value }))} required
                className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">세례일 (선택)</label>
              <input type="date" value={form.baptism_date ?? ""} onChange={e => setForm(p => ({ ...p, baptism_date: e.target.value }))}
                className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">소개</label>
            <textarea value={form.bio ?? ""} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} rows={3}
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)] resize-none" />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={closeForm} className="px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm">취소</button>
            <button type="submit" className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium">저장</button>
          </div>
        </form>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-primary)]">본당 출신 사제 관리</h1>
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

      {showForm && !editId && (
        <div className="mb-6">{renderForm()}</div>
      )}

      <div className="space-y-3">
        {priests.length === 0 && <p className="text-center py-12 text-[var(--color-text-muted)] text-sm">등록된 사제가 없습니다.</p>}
        {priests.map((p) => {
          const isEditing = editId === p.id;
          return (
            <div key={p.id}>
              <div className={`flex items-center gap-4 bg-white border p-4 ${
                isEditing ? "rounded-t-xl border-amber-300 border-b-0" : "rounded-xl border-[var(--color-border)]"
              }`}>
                <div className="w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-[var(--color-surface-warm)] border border-[var(--color-border)] flex items-center justify-center relative">
                  {p.photo_url ? (
                    <Image src={p.photo_url.startsWith("/") ? `${API}${p.photo_url}` : p.photo_url}
                      alt={p.name} fill className="object-cover" />
                  ) : (
                    <span className="text-2xl text-[var(--color-border)]">✝</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[var(--color-primary)]">{p.name}
                    {p.role && <span className="ml-2 text-xs font-normal text-[var(--color-text-muted)]">{p.role}</span>}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    서품: {p.ordained_date?.slice(0, 10) ?? "?"}
                  </p>
                </div>
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
