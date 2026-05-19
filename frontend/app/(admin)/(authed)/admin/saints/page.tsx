"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const PAGE_SIZE = 50;
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

interface Saint {
  id: number;
  korean_name: string;
  latin_name: string | null;
  feast_month: number;
  feast_day: number;
  title: string | null;
  bio_short: string | null;
  patronage: string | null;
  rank_within_name: number;
  is_active: boolean;
}

interface SaintListOut {
  items: Saint[];
  total: number;
  page: number;
  limit: number;
}

const emptyForm = {
  korean_name: "",
  latin_name: "",
  feast_month: 1,
  feast_day: 1,
  title: "",
  bio_short: "",
  patronage: "",
  rank_within_name: 0,
  is_active: true,
};

type FormState = typeof emptyForm;

function payloadOf(f: FormState) {
  return {
    korean_name: f.korean_name.trim(),
    latin_name: f.latin_name.trim() || null,
    feast_month: Number(f.feast_month) || 1,
    feast_day: Number(f.feast_day) || 1,
    title: f.title.trim() || null,
    bio_short: f.bio_short.trim() || null,
    patronage: f.patronage.trim() || null,
    rank_within_name: Number(f.rank_within_name) || 0,
    is_active: !!f.is_active,
  };
}

export default function AdminSaintsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Saint[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [month, setMonth] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<FormState>({ ...emptyForm });
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<FormState>({ ...emptyForm });
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const token = useCallback(() => {
    return typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
  }, []);

  function flash(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(""), 2500);
  }

  const load = useCallback(async () => {
    const t = token();
    if (!t) {
      router.push("/admin");
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (q) params.set("q", q);
    if (month) params.set("month", month);
    try {
      const res = await fetch(`${API}/api/saints/?${params}`);
      if (res.ok) {
        const data: SaintListOut = await res.json();
        setItems(data.items);
        setTotal(data.total);
      }
    } finally {
      setLoading(false);
    }
  }, [page, q, month, router, token]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const t = token();
    if (!t) return;
    const body = payloadOf(form);
    if (!body.korean_name) {
      flash("한글명을 입력하세요.");
      return;
    }
    const res = await fetch(`${API}/api/saints/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      flash("추가했습니다.");
      setForm({ ...emptyForm });
      setShowCreate(false);
      setPage(1);
      load();
    } else {
      const err = await res.json().catch(() => ({}));
      flash(err.detail ?? "추가 실패");
    }
  }

  function startEdit(s: Saint) {
    setEditId(s.id);
    setEditForm({
      korean_name: s.korean_name,
      latin_name: s.latin_name ?? "",
      feast_month: s.feast_month,
      feast_day: s.feast_day,
      title: s.title ?? "",
      bio_short: s.bio_short ?? "",
      patronage: s.patronage ?? "",
      rank_within_name: s.rank_within_name,
      is_active: s.is_active,
    });
  }

  async function handleUpdate(id: number) {
    const t = token();
    if (!t) return;
    const body = payloadOf(editForm);
    if (!body.korean_name) {
      flash("한글명을 입력하세요.");
      return;
    }
    const res = await fetch(`${API}/api/saints/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      flash("수정했습니다.");
      setEditId(null);
      load();
    } else {
      flash("수정 실패");
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("이 성인을 삭제할까요?")) return;
    const t = token();
    if (!t) return;
    const res = await fetch(`${API}/api/saints/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${t}` },
    });
    if (res.ok || res.status === 204) {
      flash("삭제했습니다.");
      const next = new Set(selected);
      next.delete(id);
      setSelected(next);
      load();
    } else {
      flash("삭제 실패");
    }
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`선택한 ${selected.size}명을 삭제할까요?`)) return;
    const t = token();
    if (!t) return;
    const ids = Array.from(selected);
    let ok = 0;
    for (const id of ids) {
      const res = await fetch(`${API}/api/saints/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.ok || res.status === 204) ok += 1;
    }
    flash(`${ok}/${ids.length}명 삭제`);
    setSelected(new Set());
    load();
  }

  function toggleAllOnPage(checked: boolean) {
    if (checked) setSelected(new Set(items.map((i) => i.id)));
    else setSelected(new Set());
  }

  function toggleOne(id: number, checked: boolean) {
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    setSelected(next);
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    setQ(qInput.trim());
    setPage(1);
  }

  return (
    <div className="max-w-6xl">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif text-[var(--color-primary)]">성인 사전 관리</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            세례명·축일·라틴명 등록·수정·삭제 — 총 {total}명
          </p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="text-sm bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
        >
          {showCreate ? "닫기" : "성인 추가"}
        </button>
      </header>

      {msg && (
        <div className="mb-3 px-3 py-2 text-sm bg-[var(--color-surface-warm)] text-[var(--color-primary)] rounded">
          {msg}
        </div>
      )}

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="mb-5 border border-[var(--color-border)] rounded-lg p-4 bg-white grid gap-2 sm:grid-cols-2"
        >
          <label className="text-xs grid gap-1">
            한글명 *
            <input
              type="text"
              value={form.korean_name}
              onChange={(e) => setForm({ ...form, korean_name: e.target.value })}
              className="border border-[var(--color-border)] rounded px-2 py-1 text-sm"
              required
            />
          </label>
          <label className="text-xs grid gap-1">
            라틴 원어명
            <input
              type="text"
              value={form.latin_name}
              onChange={(e) => setForm({ ...form, latin_name: e.target.value })}
              className="border border-[var(--color-border)] rounded px-2 py-1 text-sm"
            />
          </label>
          <label className="text-xs grid gap-1">
            축일 (월)
            <select
              value={form.feast_month}
              onChange={(e) => setForm({ ...form, feast_month: Number(e.target.value) })}
              className="border border-[var(--color-border)] rounded px-2 py-1 text-sm"
            >
              {MONTHS.map((m) => (
                <option key={m} value={m}>
                  {m}월
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs grid gap-1">
            축일 (일)
            <input
              type="number"
              min={1}
              max={31}
              value={form.feast_day}
              onChange={(e) => setForm({ ...form, feast_day: Number(e.target.value) })}
              className="border border-[var(--color-border)] rounded px-2 py-1 text-sm"
            />
          </label>
          <label className="text-xs grid gap-1 sm:col-span-2">
            신분 (예: 사도, 순교, 동정, 주교)
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="border border-[var(--color-border)] rounded px-2 py-1 text-sm"
            />
          </label>
          <label className="text-xs grid gap-1 sm:col-span-2">
            짧은 소개
            <textarea
              value={form.bio_short}
              onChange={(e) => setForm({ ...form, bio_short: e.target.value })}
              rows={2}
              className="border border-[var(--color-border)] rounded px-2 py-1 text-sm"
            />
          </label>
          <label className="text-xs grid gap-1 sm:col-span-2">
            수호 영역
            <input
              type="text"
              value={form.patronage}
              onChange={(e) => setForm({ ...form, patronage: e.target.value })}
              className="border border-[var(--color-border)] rounded px-2 py-1 text-sm"
            />
          </label>
          <div className="sm:col-span-2 flex items-center justify-end gap-2 mt-1">
            <button
              type="button"
              onClick={() => {
                setForm({ ...emptyForm });
                setShowCreate(false);
              }}
              className="text-xs px-3 py-1.5 border border-[var(--color-border)] rounded"
            >
              취소
            </button>
            <button
              type="submit"
              className="text-xs bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white px-3 py-1.5 rounded"
            >
              추가
            </button>
          </div>
        </form>
      )}

      {/* 검색·필터 */}
      <div className="mb-4 flex flex-wrap gap-2 items-center">
        <form onSubmit={submitSearch} className="flex items-center gap-2">
          <input
            type="search"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="한글명 / 라틴명"
            className="border border-[var(--color-border)] rounded px-2 py-1.5 text-sm w-44"
          />
          <button
            type="submit"
            className="text-xs bg-[var(--color-primary)] text-white px-3 py-1.5 rounded"
          >
            검색
          </button>
          {q && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                setQInput("");
                setPage(1);
              }}
              className="text-xs text-[var(--color-text-muted)]"
            >
              지우기
            </button>
          )}
        </form>

        <select
          value={month}
          onChange={(e) => {
            setMonth(e.target.value);
            setPage(1);
          }}
          className="border border-[var(--color-border)] rounded px-2 py-1.5 text-sm"
        >
          <option value="">전체 월</option>
          {MONTHS.map((m) => (
            <option key={m} value={m}>
              {m}월
            </option>
          ))}
        </select>

        {selected.size > 0 && (
          <button
            onClick={handleBulkDelete}
            className="ml-auto text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded"
          >
            선택 {selected.size}명 삭제
          </button>
        )}
      </div>

      {/* 목록 */}
      {loading ? (
        <p className="text-sm text-[var(--color-text-muted)] py-10 text-center">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] py-10 text-center">결과가 없습니다.</p>
      ) : (
        <div className="overflow-x-auto border border-[var(--color-border)] rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-warm)] text-xs">
              <tr>
                <th className="px-2 py-2 w-8">
                  <input
                    type="checkbox"
                    checked={items.length > 0 && items.every((i) => selected.has(i.id))}
                    onChange={(e) => toggleAllOnPage(e.target.checked)}
                  />
                </th>
                <th className="px-2 py-2 text-left">한글명</th>
                <th className="px-2 py-2 text-left">라틴 원어</th>
                <th className="px-2 py-2 text-left w-24">축일</th>
                <th className="px-2 py-2 text-left">신분</th>
                <th className="px-2 py-2 w-32"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) =>
                editId === s.id ? (
                  <tr key={s.id} className="border-t border-[var(--color-border)] bg-yellow-50">
                    <td className="px-2 py-2"></td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={editForm.korean_name}
                        onChange={(e) =>
                          setEditForm({ ...editForm, korean_name: e.target.value })
                        }
                        className="border border-[var(--color-border)] rounded px-1 py-0.5 text-sm w-full"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={editForm.latin_name}
                        onChange={(e) =>
                          setEditForm({ ...editForm, latin_name: e.target.value })
                        }
                        className="border border-[var(--color-border)] rounded px-1 py-0.5 text-sm w-full"
                      />
                    </td>
                    <td className="px-2 py-2 flex gap-1">
                      <select
                        value={editForm.feast_month}
                        onChange={(e) =>
                          setEditForm({ ...editForm, feast_month: Number(e.target.value) })
                        }
                        className="border border-[var(--color-border)] rounded px-1 py-0.5 text-xs"
                      >
                        {MONTHS.map((m) => (
                          <option key={m} value={m}>
                            {m}월
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={editForm.feast_day}
                        onChange={(e) =>
                          setEditForm({ ...editForm, feast_day: Number(e.target.value) })
                        }
                        className="border border-[var(--color-border)] rounded px-1 py-0.5 text-xs w-14"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={editForm.title}
                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                        className="border border-[var(--color-border)] rounded px-1 py-0.5 text-sm w-full"
                      />
                    </td>
                    <td className="px-2 py-2 flex gap-1 justify-end">
                      <button
                        onClick={() => handleUpdate(s.id)}
                        className="text-xs bg-[var(--color-primary)] text-white px-2 py-0.5 rounded"
                      >
                        저장
                      </button>
                      <button
                        onClick={() => setEditId(null)}
                        className="text-xs border border-[var(--color-border)] px-2 py-0.5 rounded"
                      >
                        취소
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={s.id} className="border-t border-[var(--color-border)] hover:bg-gray-50">
                    <td className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={selected.has(s.id)}
                        onChange={(e) => toggleOne(s.id, e.target.checked)}
                      />
                    </td>
                    <td className="px-2 py-2 font-medium">{s.korean_name}</td>
                    <td className="px-2 py-2 italic text-[var(--color-text-muted)]">
                      {s.latin_name ?? "—"}
                    </td>
                    <td className="px-2 py-2">
                      {s.feast_month}월 {s.feast_day}일
                    </td>
                    <td className="px-2 py-2 text-xs">{s.title ?? "—"}</td>
                    <td className="px-2 py-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => startEdit(s)}
                        className="text-xs text-[var(--color-primary)] hover:underline mr-2"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <nav className="flex justify-center items-center gap-1 mt-6" aria-label="페이지 이동">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 text-sm border border-[var(--color-border)] rounded disabled:opacity-30"
          >
            ←
          </button>
          <span className="px-3 text-sm">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 text-sm border border-[var(--color-border)] rounded disabled:opacity-30"
          >
            →
          </button>
        </nav>
      )}
    </div>
  );
}
