"use client";
import { useState, useEffect, useRef } from "react";
import ClassDetail from "./ClassDetail";
import ApplicationsSection from "./ApplicationsSection";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface ClassRow {
  id: number;
  round_no: number | null;
  start_date: string | null;
  baptism_at: string | null;
  apply_open: boolean;
  apply_start_date: string | null;
  apply_note: string | null;
  note: string | null;
  sort_order: number;
  member_count: number;
  photo_count: number;
}

const EMPTY = {
  round_no: "" as number | "",
  start_date: "",
  baptism_at: "",
  apply_open: false,
  apply_start_date: "",
  apply_note: "",
  note: "",
  sort_order: 0,
};

function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
}

// "교육중 | 접수중 | 예정 | 완료" 상태를 날짜로 추정 (공개 카드 로직의 admin 미리보기)
function classStatus(c: ClassRow): { label: string; tone: string } {
  const today = new Date();
  const start = c.start_date ? new Date(c.start_date) : null;
  const bap = c.baptism_at ? new Date(c.baptism_at) : null;
  if (start && bap && today >= start && today <= bap) return { label: "교육중", tone: "bg-emerald-100 text-emerald-700" };
  if (c.apply_open) return { label: "접수중", tone: "bg-amber-100 text-amber-700" };
  if (bap && today > bap) return { label: "완료", tone: "bg-gray-100 text-gray-500" };
  if (start && today < start) return { label: "예정", tone: "bg-blue-100 text-blue-700" };
  return { label: "대기", tone: "bg-gray-100 text-gray-500" };
}

export default function AdminCatechumenPage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [form, setForm] = useState({ ...EMPTY });
  const [editId, setEditId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const res = await fetch(`${API}/api/catechumen/classes`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.ok) setClasses(await res.json());
  }

  function scrollToForm() {
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }
  function openCreate() {
    setForm({ ...EMPTY }); setEditId(null); setMsg(null); setShowForm(true); scrollToForm();
  }
  function closeForm() { setShowForm(false); setEditId(null); setMsg(null); }
  function openEdit(c: ClassRow) {
    setForm({
      round_no: c.round_no ?? "",
      start_date: c.start_date?.slice(0, 10) ?? "",
      baptism_at: c.baptism_at?.slice(0, 16) ?? "",
      apply_open: c.apply_open,
      apply_start_date: c.apply_start_date?.slice(0, 10) ?? "",
      apply_note: c.apply_note ?? "",
      note: c.note ?? "",
      sort_order: c.sort_order,
    });
    setEditId(c.id); setMsg(null); setShowForm(false); scrollToForm();
  }
  function toggleEdit(c: ClassRow) {
    if (editId === c.id) { setEditId(null); setMsg(null); } else openEdit(c);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const token = getToken();
    const body = {
      round_no: form.round_no === "" ? null : Number(form.round_no),
      start_date: form.start_date || null,
      baptism_at: form.baptism_at || null,
      apply_open: form.apply_open,
      apply_start_date: form.apply_start_date || null,
      apply_note: form.apply_note || null,
      note: form.note || null,
      sort_order: form.sort_order,
    };
    const url = editId ? `${API}/api/catechumen/classes/${editId}` : `${API}/api/catechumen/classes`;
    const res = await fetch(url, {
      method: editId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) { setMsg({ type: "err", text: "저장에 실패했습니다." }); return; }
    setMsg({ type: "ok", text: "저장되었습니다." });
    setShowForm(false); setEditId(null);
    load();
  }

  async function handleDelete(id: number) {
    if (!confirm("이 차수를 삭제하시겠습니까?\n참여자·사진도 함께 삭제됩니다(회원 계정은 보존).")) return;
    await fetch(`${API}/api/catechumen/classes/${id}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (selectedId === id) setSelectedId(null);
    load();
  }

  const renderForm = () => (
    <form ref={formRef} onSubmit={handleSubmit}
      className="p-5 bg-[var(--color-surface-warm)] border border-[var(--color-border)] rounded-xl space-y-3">
      <h2 className="font-semibold text-[var(--color-primary)]">
        {editId ? `수정 — 제${form.round_no || "?"}차` : "새 차수 등록"}
      </h2>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">차수 (제N차) *</label>
          <input type="number" value={form.round_no}
            onChange={(e) => setForm((p) => ({ ...p, round_no: e.target.value === "" ? "" : parseInt(e.target.value) }))}
            required placeholder="예: 3"
            className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">정렬 순서</label>
          <input type="number" value={form.sort_order}
            onChange={(e) => setForm((p) => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))}
            className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">교육 시작일</label>
          <input type="date" value={form.start_date}
            onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
            className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">세례성사 일시</label>
          <input type="datetime-local" value={form.baptism_at}
            onChange={(e) => setForm((p) => ({ ...p, baptism_at: e.target.value }))}
            className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]" />
        </div>
      </div>

      <div className="border-t border-[var(--color-border)] pt-3 mt-1">
        <label className="flex items-center gap-2 text-sm font-medium mb-3">
          <input type="checkbox" checked={form.apply_open}
            onChange={(e) => setForm((p) => ({ ...p, apply_open: e.target.checked }))} className="rounded" />
          입교신청 접수중 (공개 카드에 "예비자교리 접수중" 노출)
        </label>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">다음 과정 시작 예정일</label>
            <input type="date" value={form.apply_start_date}
              onChange={(e) => setForm((p) => ({ ...p, apply_start_date: e.target.value }))}
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">안내 문구</label>
            <input value={form.apply_note}
              onChange={(e) => setForm((p) => ({ ...p, apply_note: e.target.value }))}
              placeholder="예: 입교신청 기간입니다."
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]" />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1">메모 (내부용)</label>
        <textarea value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} rows={2}
          className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)] resize-none" />
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={closeForm} className="px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm">취소</button>
        <button type="submit" className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--color-primary)] hover:opacity-90">저장</button>
      </div>
    </form>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-[var(--color-primary)]">예비자교리 관리</h1>
        <button onClick={showForm && !editId ? closeForm : openCreate}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            showForm && !editId ? "bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200"
              : "bg-[var(--color-primary)] text-white hover:opacity-90"}`}>
          {showForm && !editId ? "닫기" : "+ 차수 등록"}
        </button>
      </div>
      <p className="text-sm text-[var(--color-text-muted)] mb-6">
        예비자교리 차수를 등록하고 참여자·세례성사 사진을 관리합니다. 상태(교육중·접수중)는 날짜로 자동 판단됩니다.
      </p>

      {msg && (
        <p className={`mb-4 text-sm px-3 py-2 rounded-lg ${msg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{msg.text}</p>
      )}

      {showForm && !editId && <div className="mb-6">{renderForm()}</div>}

      <div className="space-y-3">
        {classes.length === 0 && (
          <p className="text-center py-12 text-[var(--color-text-muted)] text-sm">등록된 차수가 없습니다.</p>
        )}
        {classes.map((c) => {
          const isEditing = editId === c.id;
          const isOpen = selectedId === c.id;
          const st = classStatus(c);
          return (
            <div key={c.id}>
              <div className={`flex items-center gap-4 bg-white border p-4 ${
                isEditing ? "rounded-t-xl border-amber-300 border-b-0" : "rounded-xl border-[var(--color-border)]"}`}>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[var(--color-primary)] flex items-center gap-2 flex-wrap">
                    <span>제{c.round_no ?? "?"}차</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${st.tone}`}>{st.label}</span>
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    교육 {c.start_date?.slice(0, 10) ?? "—"}
                    {c.baptism_at && ` · 세례 ${c.baptism_at.slice(0, 10)} ${c.baptism_at.slice(11, 16)}`}
                    {` · 참여 ${c.member_count}명 · 사진 ${c.photo_count}장`}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setSelectedId(isOpen ? null : c.id)}
                    className={`px-3 py-1.5 text-xs border rounded-lg ${isOpen ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]" : "border-[var(--color-border)] hover:bg-gray-50"}`}>
                    {isOpen ? "관리 닫기" : "참여자·사진"}
                  </button>
                  <button onClick={() => toggleEdit(c)}
                    className={`px-3 py-1.5 text-xs border rounded-lg ${isEditing ? "bg-amber-100 border-amber-400 text-amber-800" : "border-[var(--color-border)] hover:bg-gray-50"}`}>
                    {isEditing ? "수정 닫기" : "수정"}
                  </button>
                  <button onClick={() => handleDelete(c.id)}
                    className="px-3 py-1.5 text-xs border border-red-200 text-red-500 rounded-lg hover:bg-red-50">삭제</button>
                </div>
              </div>
              {isEditing && (
                <div className="border border-t-0 border-amber-300 rounded-b-xl overflow-hidden">{renderForm()}</div>
              )}
              {isOpen && !isEditing && (
                <ClassDetail classId={c.id} roundNo={c.round_no} onChanged={load} />
              )}
            </div>
          );
        })}
      </div>

      <ApplicationsSection onChanged={load} />
    </div>
  );
}
