"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DataEvent, notify } from "@/components/dataEvents";
import { useBulkSelect } from "@/components/useBulkSelect";
import BulkActionBar from "@/components/BulkActionBar";

const API = process.env.NEXT_PUBLIC_API_URL;

interface PagePhotoSlug {
  id: number;
  slug: string;
  label: string;
  public_href: string;
  description: string | null;
  fallback_url: string | null;
  sort_order: number;
}

interface SlugStat {
  count: number;
  transition_mode: string;
  interval_seconds: number;
}

const TRANSITION_KO: Record<string, string> = {
  none: "전환 없음",
  fade: "페이드",
  slide: "슬라이드",
  "slide-up": "슬라이드↑",
  "slide-down": "슬라이드↓",
  "zoom-in": "줌 인",
  "zoom-out": "줌 아웃",
  "ken-burns": "켄 번즈",
  blur: "블러",
};

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("admin_token");
}

const EMPTY_FORM = {
  slug: "",
  label: "",
  public_href: "",
  description: "",
  fallback_url: "",
  sort_order: 0,
};

export default function AdminPagePhotosIndex() {
  const [slugs, setSlugs] = useState<PagePhotoSlug[]>([]);
  const [stats, setStats] = useState<Record<string, SlugStat>>({});
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const select = useBulkSelect(slugs.map((s) => s.id));

  function scrollToForm() {
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  async function fetchSlugs() {
    const res = await fetch(`${API}/api/page-photos/slugs`);
    if (!res.ok) return;
    const data: PagePhotoSlug[] = await res.json();
    setSlugs(data);

    // 슬러그별 통계 fetch
    const entries = await Promise.all(
      data.map(async (s) => {
        const r = await fetch(`${API}/api/page-photos/${s.slug}`);
        if (!r.ok) return null;
        const d = await r.json();
        return [s.slug, {
          count: (d.photos ?? []).length,
          transition_mode: d.settings?.transition_mode ?? "fade",
          interval_seconds: d.settings?.interval_seconds ?? 5,
        }] as const;
      }),
    );
    const m: Record<string, SlugStat> = {};
    entries.forEach((e) => { if (e) m[e[0]] = e[1]; });
    setStats(m);
  }

  useEffect(() => { fetchSlugs(); }, []);

  function startCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setError("");
    setShowForm(true);
    scrollToForm();
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setError("");
  }

  function startEdit(s: PagePhotoSlug) {
    setEditingId(s.id);
    setForm({
      slug: s.slug,
      label: s.label,
      public_href: s.public_href,
      description: s.description ?? "",
      fallback_url: s.fallback_url ?? "",
      sort_order: s.sort_order,
    });
    setError("");
    setShowForm(false); // 새 폼은 닫고 인라인으로
    scrollToForm();
  }

  function toggleEdit(s: PagePhotoSlug) {
    if (editingId === s.id) {
      setEditingId(null);
      setError("");
    } else {
      startEdit(s);
    }
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const token = getToken();
    const body = {
      ...form,
      description: form.description.trim() || null,
      fallback_url: form.fallback_url.trim() || null,
    };
    try {
      const url = editingId
        ? `${API}/api/page-photos/slugs/${editingId}`
        : `${API}/api/page-photos/slugs`;
      const method = editingId ? "PATCH" : "POST";
      // 수정 시에는 slug 변경 불가 (보안·데이터 일관성)
      const payload = editingId
        ? { label: body.label, public_href: body.public_href, description: body.description, fallback_url: body.fallback_url, sort_order: body.sort_order }
        : body;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "저장에 실패했습니다.");
        return;
      }
      closeForm();
      await fetchSlugs();
      notify(DataEvent.PAGE_PHOTOS);
    } finally {
      setSaving(false);
    }
  }

  async function deleteSlug(s: PagePhotoSlug) {
    if (!confirm(`'${s.label}' 페이지를 삭제하시겠습니까?\n등록된 사진과 설정도 모두 삭제됩니다.`)) return;
    const token = getToken();
    const res = await fetch(`${API}/api/page-photos/slugs/${s.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) { select.remove(s.id); await fetchSlugs(); notify(DataEvent.PAGE_PHOTOS); }
    else {
      const d = await res.json().catch(() => ({}));
      alert(d.detail || "삭제에 실패했습니다.");
    }
  }

  async function handleBulkDelete() {
    const ids = Array.from(select.selected);
    if (ids.length === 0) return;
    const targets = slugs.filter((s) => ids.includes(s.id));
    const labels = targets.map((s) => s.label).join(", ");
    if (!confirm(`선택한 페이지 ${ids.length}개(${labels})를 삭제하시겠습니까?\n각 페이지의 등록된 사진과 설정도 모두 삭제됩니다.`)) return;
    setBulkDeleting(true);
    const token = getToken();
    try {
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            const res = await fetch(`${API}/api/page-photos/slugs/${id}`, {
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
        await fetchSlugs();
        notify(DataEvent.PAGE_PHOTOS);
      }
      if (failedCount > 0) alert(`${failedCount}건 삭제 실패`);
    } finally {
      setBulkDeleting(false);
    }
  }

  const renderForm = () => (
    <form
      ref={formRef}
      onSubmit={submitForm}
      className="p-5 bg-white border border-blue-200 rounded-xl space-y-3"
    >
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <h2 className="font-semibold text-gray-800">
          {editingId ? `페이지 수정 — ${form.label || "(이름 없음)"}` : "새 페이지 등록"}
        </h2>
        {editingId && (
          <button type="button" onClick={startCreate} className="text-xs text-gray-600 underline">
            닫고 새로 등록
          </button>
        )}
      </div>
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">슬러그 (URL용 식별자)</label>
              <input
                value={form.slug}
                onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value.toLowerCase() }))}
                disabled={!!editingId}
                placeholder="history"
                pattern="^[a-z0-9][a-z0-9-]*$"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
              <p className="text-xs text-gray-400 mt-0.5">소문자·숫자·하이픈만. 등록 후 변경 불가.</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">표시 이름</label>
              <input
                value={form.label}
                onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
                placeholder="본당 연혁"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">공개 페이지 경로</label>
              <input
                value={form.public_href}
                onChange={(e) => setForm((p) => ({ ...p, public_href: e.target.value }))}
                placeholder="/history"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-0.5">예: /history. 슬라이드쇼는 SectionLayout을 사용하는 페이지의 pathname으로 자동 매칭됩니다.</p>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">설명 (선택)</label>
              <input
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="/history 상단 히어로 이미지"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">기본 사진 URL (선택)</label>
              <input
                value={form.fallback_url}
                onChange={(e) => setForm((p) => ({ ...p, fallback_url: e.target.value }))}
                placeholder="/photos/sample.jpg"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-0.5">사진을 한 장도 등록하지 않았을 때 표시할 폴백 이미지(public/ 경로 또는 절대 URL).</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">정렬 순서</label>
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm((p) => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-0.5">목록 표시 순서. 작은 값이 위로.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeForm}
              className="px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "저장 중..." : editingId ? "수정" : "등록"}
            </button>
          </div>
        </form>
  );

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">페이지 사진 관리</h1>
          <p className="text-sm text-gray-500 mt-1">
            각 페이지의 히어로 영역에 표시될 사진을 등록·관리합니다. 여러 장 등록하면 자동 슬라이드쇼로 전환됩니다.
          </p>
        </div>
        <button
          type="button"
          onClick={showForm && !editingId ? closeForm : startCreate}
          className={`shrink-0 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            showForm && !editingId
              ? "bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {showForm && !editingId ? "닫기" : "+ 새 페이지 등록"}
        </button>
      </div>

      {editingId !== null && (
        <div className="mb-4 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
          <strong>{form.label || "(이름 없음)"}</strong> 수정 중 — 해당 항목 아래에서 폼이 펼쳐집니다
        </div>
      )}

      {/* 새 등록 폼 (버튼 토글 + 편집 중이 아닐 때) */}
      {showForm && !editingId && (
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

      <ul className="space-y-2">
        {slugs.map((s) => {
          const stat = stats[s.slug];
          const isEditing = editingId === s.id;
          const isChecked = select.isSelected(s.id);
          return (
            <li key={s.id}>
              <div className={`p-4 bg-white border transition-colors ${
                isEditing
                  ? "rounded-t-xl border-amber-300 border-b-0"
                  : isChecked
                  ? "rounded-xl border-red-300 bg-red-50/30"
                  : "rounded-xl border-gray-200 hover:border-blue-200"
              }`}>
                <div className="flex items-center justify-between gap-4">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => select.toggle(s.id)}
                    className="rounded shrink-0"
                    aria-label={`${s.label} 선택`}
                  />
                  <Link
                    href={`/admin/page-photos/${s.slug}`}
                    className="flex-1 min-w-0"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-gray-800">{s.label}</h2>
                      <code className="text-xs text-gray-400 px-1.5 py-0.5 bg-gray-100 rounded">{s.slug}</code>
                      <code className="text-xs text-blue-500 px-1.5 py-0.5 bg-blue-50 rounded">{s.public_href}</code>
                    </div>
                    {s.description && <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>}
                  </Link>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium text-gray-700">
                      {stat ? `${stat.count}장` : "..."}
                    </p>
                    {stat && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {TRANSITION_KO[stat.transition_mode] ?? stat.transition_mode} · {stat.interval_seconds}초
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleEdit(s)}
                      className={`px-2.5 py-1 text-xs border rounded ${
                        isEditing
                          ? "bg-amber-100 border-amber-400 text-amber-800"
                          : "border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {isEditing ? "수정 닫기" : "수정"}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteSlug(s)}
                      className="px-2.5 py-1 text-xs text-red-500 border border-red-200 rounded hover:bg-red-50"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </div>
              {isEditing && (
                <div className="border border-t-0 border-amber-300 rounded-b-xl overflow-hidden">
                  {renderForm()}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
