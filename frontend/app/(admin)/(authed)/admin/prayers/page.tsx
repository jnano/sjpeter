"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PRAYER_CATEGORIES,
  PRAYER_CATEGORY_LABELS,
  PRAYER_CATEGORY_HINTS,
  type PrayerCategory,
} from "@/lib/prayer";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Prayer {
  id: number;
  title: string;
  category: PrayerCategory;
  scripture: string | null;
  body: string;
  author: string | null;
  is_published: boolean;
  display_order: number;
  is_featured: boolean;
}

interface PrayerListOut {
  items: Prayer[];
  total: number;
}

const emptyForm = {
  title: "",
  category: "daily" as PrayerCategory,
  scripture: "",
  body: "",
  author: "",
  is_published: true,
  display_order: 0,
  is_featured: false,
};

export default function AdminPrayersPage() {
  const router = useRouter();
  const [items, setItems] = useState<Prayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<PrayerCategory | "">("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ ...emptyForm });

  function token() {
    return typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
  }

  function flash(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(""), 2500);
  }

  async function load() {
    const t = token();
    if (!t) {
      router.push("/admin");
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({ limit: "200" });
    if (filterCategory) params.set("category", filterCategory);
    try {
      const res = await fetch(`${API}/api/content/prayers/admin?${params}`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.status === 401) {
        router.push("/admin");
        return;
      }
      if (res.ok) {
        const data: PrayerListOut = await res.json();
        setItems(data.items);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCategory]);

  function payloadOf(f: typeof emptyForm) {
    return {
      title: f.title.trim(),
      category: f.category,
      scripture: f.scripture.trim() || null,
      body: f.body.trim(),
      author: f.author.trim() || null,
      is_published: f.is_published,
      display_order: Number(f.display_order) || 0,
      is_featured: f.is_featured,
    };
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      alert("제목과 본문은 필수입니다.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/content/prayers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify(payloadOf(form)),
      });
      if (res.ok) {
        setForm({ ...emptyForm, category: form.category });
        setShowCreate(false);
        flash("등록되었습니다.");
        load();
      } else {
        alert("등록에 실패했습니다.");
      }
    } finally {
      setSaving(false);
    }
  }

  function startEdit(p: Prayer) {
    setEditId(p.id);
    setEditForm({
      title: p.title,
      category: p.category,
      scripture: p.scripture ?? "",
      body: p.body,
      author: p.author ?? "",
      is_published: p.is_published,
      display_order: p.display_order,
      is_featured: p.is_featured,
    });
  }

  async function saveEdit() {
    if (editId == null) return;
    if (!editForm.title.trim() || !editForm.body.trim()) {
      alert("제목과 본문은 필수입니다.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/content/prayers/${editId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify(payloadOf(editForm)),
      });
      if (res.ok) {
        setEditId(null);
        flash("수정되었습니다.");
        load();
      } else {
        alert("수정에 실패했습니다.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function removePrayer(id: number) {
    if (!confirm("이 기도문을 삭제하시겠습니까? 복구할 수 없습니다.")) return;
    const res = await fetch(`${API}/api/content/prayers/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token()}` },
    });
    if (res.ok || res.status === 204) {
      flash("삭제되었습니다.");
      load();
    } else {
      alert("삭제에 실패했습니다.");
    }
  }

  async function toggle(id: number, field: "is_published" | "is_featured") {
    const p = items.find((i) => i.id === id);
    if (!p) return;
    const updated = { ...p, [field]: !p[field] };
    const res = await fetch(`${API}/api/content/prayers/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token()}`,
      },
      body: JSON.stringify(payloadOf({
        title: updated.title,
        category: updated.category,
        scripture: updated.scripture ?? "",
        body: updated.body,
        author: updated.author ?? "",
        is_published: updated.is_published,
        display_order: updated.display_order,
        is_featured: updated.is_featured,
      })),
    });
    if (res.ok) load();
  }

  const grouped: Record<string, Prayer[]> = {};
  for (const p of items) {
    (grouped[p.category] ??= []).push(p);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold text-[var(--color-primary)]">기도문 관리</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            카테고리별로 정리되어 /prayer 공개 페이지에 그대로 노출됩니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="px-4 py-2 bg-[var(--color-primary)] text-white text-sm rounded-lg hover:bg-[var(--color-primary-light)] transition-colors"
        >
          {showCreate ? "닫기" : "+ 새 기도문"}
        </button>
      </div>

      {msg && (
        <div className="mb-4 px-3 py-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
          {msg}
        </div>
      )}

      {/* 새 기도문 폼 */}
      {showCreate && (
        <form
          onSubmit={create}
          className="mb-6 bg-white border border-[var(--color-border)] rounded-xl p-5 space-y-3"
        >
          <PrayerFormFields form={form} setForm={setForm} />
          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-[var(--color-primary)] text-white text-sm rounded-lg disabled:opacity-50"
            >
              {saving ? "저장 중…" : "등록"}
            </button>
            <button
              type="button"
              onClick={() => {
                setForm({ ...emptyForm });
                setShowCreate(false);
              }}
              className="px-4 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              취소
            </button>
          </div>
        </form>
      )}

      {/* 카테고리 필터 */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setFilterCategory("")}
          className={`text-xs px-3 py-1.5 rounded-full border ${
            !filterCategory
              ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
              : "border-[var(--color-border)] hover:bg-gray-50"
          }`}
        >
          전체 ({items.length})
        </button>
        {PRAYER_CATEGORIES.map((c) => {
          const count = (grouped[c] ?? []).length;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setFilterCategory(c)}
              className={`text-xs px-3 py-1.5 rounded-full border ${
                filterCategory === c
                  ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                  : "border-[var(--color-border)] hover:bg-gray-50"
              }`}
            >
              {PRAYER_CATEGORY_LABELS[c]}
              {!filterCategory && count > 0 && (
                <span className="ml-1 opacity-70">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="text-center text-sm text-[var(--color-text-muted)] py-12">
          불러오는 중…
        </div>
      ) : items.length === 0 ? (
        <div className="text-center text-sm text-[var(--color-text-muted)] py-12 bg-white border border-[var(--color-border)] rounded-xl">
          {filterCategory
            ? `'${PRAYER_CATEGORY_LABELS[filterCategory as PrayerCategory]}' 카테고리에 등록된 기도문이 없습니다.`
            : "등록된 기도문이 없습니다. 우상단 '+ 새 기도문' 버튼으로 시작하세요."}
        </div>
      ) : (
        <div className="space-y-6">
          {(filterCategory ? [filterCategory] : PRAYER_CATEGORIES)
            .filter((c) => (grouped[c] ?? []).length > 0)
            .map((c) => (
              <section key={c}>
                <h2 className="font-serif text-base font-bold text-[var(--color-primary)] mb-1">
                  {PRAYER_CATEGORY_LABELS[c as PrayerCategory]}
                  <span className="ml-2 text-xs font-normal text-[var(--color-text-muted)]">
                    {(grouped[c] ?? []).length}편
                  </span>
                </h2>
                <p className="text-xs text-[var(--color-text-muted)] mb-2">
                  {PRAYER_CATEGORY_HINTS[c as PrayerCategory]}
                </p>
                <div className="bg-white border border-[var(--color-border)] rounded-xl overflow-hidden">
                  {(grouped[c] ?? []).map((p) => (
                    <div
                      key={p.id}
                      className="border-b border-[var(--color-border)] last:border-b-0"
                    >
                      {editId === p.id ? (
                        <div className="p-4 bg-[var(--color-surface-warm)] space-y-3">
                          <PrayerFormFields form={editForm} setForm={setEditForm} />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={saveEdit}
                              disabled={saving}
                              className="px-3 py-1.5 bg-[var(--color-primary)] text-white text-xs rounded disabled:opacity-50"
                            >
                              {saving ? "저장 중…" : "저장"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditId(null)}
                              className="px-3 py-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                            >
                              취소
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                              {p.is_featured && (
                                <span className="text-[10px] bg-[var(--color-primary)] text-white px-1.5 py-0.5 rounded">
                                  본당
                                </span>
                              )}
                              {!p.is_published && (
                                <span className="text-[10px] bg-gray-300 text-gray-700 px-1.5 py-0.5 rounded">
                                  비공개
                                </span>
                              )}
                              <span className="text-[10px] text-[var(--color-text-muted)]">
                                #{p.display_order}
                              </span>
                            </div>
                            <p className="font-serif font-semibold text-sm text-[var(--color-text)]">
                              {p.title}
                            </p>
                            {p.scripture && (
                              <p className="text-[10px] text-[var(--color-accent)] mt-0.5">
                                {p.scripture}
                              </p>
                            )}
                            <p className="text-xs text-[var(--color-text-muted)] mt-1 line-clamp-2">
                              {p.body}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => toggle(p.id, "is_featured")}
                              className="text-xs px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                              title="본당 자체 기도 핀 토글"
                            >
                              {p.is_featured ? "★" : "☆"}
                            </button>
                            <button
                              type="button"
                              onClick={() => toggle(p.id, "is_published")}
                              className="text-xs px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                              title="공개/비공개 토글"
                            >
                              {p.is_published ? "👁" : "🚫"}
                            </button>
                            <button
                              type="button"
                              onClick={() => startEdit(p)}
                              className="text-xs px-2 py-1 text-[var(--color-primary)] hover:bg-gray-100 rounded"
                            >
                              편집
                            </button>
                            <button
                              type="button"
                              onClick={() => removePrayer(p.id)}
                              className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded"
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}
        </div>
      )}
    </div>
  );
}

function PrayerFormFields({
  form,
  setForm,
}: {
  form: typeof emptyForm;
  setForm: (updater: (prev: typeof emptyForm) => typeof emptyForm) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold mb-1">카테고리</label>
          <select
            value={form.category}
            onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as PrayerCategory }))}
            className="w-full border border-[var(--color-border)] rounded px-2 py-1.5 text-sm"
          >
            {PRAYER_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {PRAYER_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">제목 *</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            placeholder="예: 주님의 기도"
            className="w-full border border-[var(--color-border)] rounded px-2 py-1.5 text-sm"
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold mb-1">성경 구절 (선택)</label>
          <input
            type="text"
            value={form.scripture}
            onChange={(e) => setForm((p) => ({ ...p, scripture: e.target.value }))}
            placeholder="예: 마태 6,9-13"
            className="w-full border border-[var(--color-border)] rounded px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">필자 (선택)</label>
          <input
            type="text"
            value={form.author}
            onChange={(e) => setForm((p) => ({ ...p, author: e.target.value }))}
            placeholder="예: 김준명 안드레아 신부"
            className="w-full border border-[var(--color-border)] rounded px-2 py-1.5 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold mb-1">본문 * (마크다운·줄바꿈 지원)</label>
        <textarea
          value={form.body}
          onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
          placeholder="기도문 본문 입력"
          rows={8}
          className="w-full border border-[var(--color-border)] rounded px-2 py-2 text-sm font-serif leading-relaxed"
          required
        />
      </div>
      <div className="grid grid-cols-3 gap-3 items-end">
        <div>
          <label className="block text-xs font-semibold mb-1">정렬 순서</label>
          <input
            type="number"
            value={form.display_order}
            onChange={(e) =>
              setForm((p) => ({ ...p, display_order: Number(e.target.value) || 0 }))
            }
            className="w-full border border-[var(--color-border)] rounded px-2 py-1.5 text-sm"
          />
          <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">낮을수록 위</p>
        </div>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_featured}
            onChange={(e) => setForm((p) => ({ ...p, is_featured: e.target.checked }))}
          />
          본당 자체 기도 (메인 상단 핀)
        </label>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_published}
            onChange={(e) => setForm((p) => ({ ...p, is_published: e.target.checked }))}
          />
          공개
        </label>
      </div>
    </>
  );
}
