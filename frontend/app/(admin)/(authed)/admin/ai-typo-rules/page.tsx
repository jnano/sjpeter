"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface TypoRule {
  id: number;
  wrong: string;
  replacement: string;
  note: string | null;
  exclude_prefixes: string[] | null;
  created_at: string;
  updated_at: string;
}

/** "장소:, 위치:" 같은 콤마 구분 입력을 배열로. 양옆 공백 제거 후 빈 항목 skip. */
function parsePrefixes(input: string): string[] {
  return input.split(",").map((s) => s.trim()).filter(Boolean);
}
function joinPrefixes(arr: string[] | null | undefined): string {
  return (arr ?? []).join(", ");
}

function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
}
function authHeaders(): HeadersInit {
  const t = getToken();
  return t ? { "Content-Type": "application/json", Authorization: `Bearer ${t}` } : { "Content-Type": "application/json" };
}

export default function AiTypoRulesPage() {
  const router = useRouter();
  const [rules, setRules] = useState<TypoRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  // 추가 폼
  const [newWrong, setNewWrong] = useState("");
  const [newReplacement, setNewReplacement] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newExcludes, setNewExcludes] = useState("");
  // 인라인 편집
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{ wrong: string; replacement: string; note: string; excludes: string }>({
    wrong: "", replacement: "", note: "", excludes: "",
  });

  const load = useCallback(async () => {
    if (!getToken()) { router.push("/admin"); return; }
    try {
      const r = await fetch(`${API}/api/admin/ai-typo-rules`, { headers: authHeaders(), cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setRules(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오기 실패");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  function flash(text: string) { setInfo(text); setTimeout(() => setInfo(""), 3000); }

  async function addRule() {
    setError("");
    const w = newWrong.trim();
    const r = newReplacement.trim();
    if (!w || !r) { setError("오타·교정 두 값 모두 입력하세요."); return; }
    if (w === r) { setError("오타와 교정이 같으면 의미가 없습니다."); return; }
    try {
      const res = await fetch(`${API}/api/admin/ai-typo-rules`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          wrong: w,
          replacement: r,
          note: newNote.trim() || null,
          exclude_prefixes: parsePrefixes(newExcludes),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail ?? "추가 실패");
      }
      const created = await res.json() as TypoRule;
      setRules((prev) => [created, ...prev]);
      setNewWrong(""); setNewReplacement(""); setNewNote(""); setNewExcludes("");
      flash(`'${created.wrong} → ${created.replacement}' 추가됨`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "추가 실패");
    }
  }

  function startEdit(rule: TypoRule) {
    setEditingId(rule.id);
    setEditForm({
      wrong: rule.wrong,
      replacement: rule.replacement,
      note: rule.note ?? "",
      excludes: joinPrefixes(rule.exclude_prefixes),
    });
  }
  function cancelEdit() { setEditingId(null); }

  async function saveEdit() {
    if (editingId == null) return;
    setError("");
    try {
      const res = await fetch(`${API}/api/admin/ai-typo-rules/${editingId}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({
          wrong: editForm.wrong.trim(),
          replacement: editForm.replacement.trim(),
          note: editForm.note.trim() || null,
          exclude_prefixes: parsePrefixes(editForm.excludes),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail ?? "저장 실패");
      }
      const updated = await res.json() as TypoRule;
      setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setEditingId(null);
      flash("저장됨");
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    }
  }

  async function deleteRule(id: number, label: string) {
    if (!confirm(`'${label}' 규칙을 삭제하시겠습니까?`)) return;
    setError("");
    try {
      const res = await fetch(`${API}/api/admin/ai-typo-rules/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok && res.status !== 204) throw new Error("삭제 실패");
      setRules((prev) => prev.filter((r) => r.id !== id));
      flash("삭제됨");
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제 실패");
    }
  }

  if (loading) return <div className="p-8 text-sm text-gray-500">불러오는 중…</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-primary)]">AI 오타 사전</h1>
        <p className="text-sm text-gray-500 mt-1">
          주보 AI 추출 결과의 알려진 오타를 1:1 치환으로 자동 교정합니다.
          새 추출부터 즉시 적용 — 이미 저장된 항목은 영향 없음(검토 화면의 편집 사용).
        </p>
      </header>

      {info && <p className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{info}</p>}
      {error && <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      {/* 추가 폼 */}
      <section className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">새 규칙 추가</h2>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1.5fr_1.5fr_auto] gap-2">
          <input
            type="text"
            value={newWrong}
            onChange={(e) => setNewWrong(e.target.value)}
            placeholder="AI 가 잘못 추출한 단어"
            className="border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={newReplacement}
            onChange={(e) => setNewReplacement(e.target.value)}
            placeholder="정확한 단어"
            className="border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={newExcludes}
            onChange={(e) => setNewExcludes(e.target.value)}
            placeholder='제외 prefix (예: "장소:, 위치:" 콤마 구분)'
            className="border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="메모 (옵션)"
            className="border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <button
            onClick={addRule}
            className="px-4 py-2 bg-[var(--color-primary)] text-white rounded text-sm font-medium hover:opacity-90"
          >
            추가
          </button>
        </div>
        <p className="text-[11px] text-gray-500 mt-2">
          <b>제외 prefix</b>: 같은 줄에 이 단어가 오타보다 앞에 있으면 그 occurrence 는 치환하지 않음.
          예) wrong=&quot;전입가경&quot;, 제외 prefix=&quot;장소:&quot; → &quot;장소: 전입가경&quot; 은 장소명일 수 있어 그대로.
        </p>
      </section>

      {/* 목록 */}
      <section className="bg-white border border-gray-200 rounded-xl">
        {rules.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">등록된 규칙이 없습니다.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium w-1/6">오타</th>
                <th className="text-left px-4 py-2 font-medium w-1/6">교정</th>
                <th className="text-left px-4 py-2 font-medium w-1/4">제외 prefix</th>
                <th className="text-left px-4 py-2 font-medium">메모</th>
                <th className="text-right px-4 py-2 font-medium w-32">동작</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rules.map((r) => (
                <tr key={r.id}>
                  {editingId === r.id ? (
                    <>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={editForm.wrong}
                          onChange={(e) => setEditForm({ ...editForm, wrong: e.target.value })}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={editForm.replacement}
                          onChange={(e) => setEditForm({ ...editForm, replacement: e.target.value })}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={editForm.excludes}
                          onChange={(e) => setEditForm({ ...editForm, excludes: e.target.value })}
                          placeholder="콤마 구분"
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={editForm.note}
                          onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button onClick={saveEdit} className="text-xs px-2 py-1 bg-[var(--color-primary)] text-white rounded mr-1">저장</button>
                        <button onClick={cancelEdit} className="text-xs px-2 py-1 border border-gray-300 rounded">취소</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-2 font-mono text-red-700">{r.wrong}</td>
                      <td className="px-4 py-2 font-mono text-green-700">→ {r.replacement}</td>
                      <td className="px-4 py-2 text-xs text-gray-600">
                        {(r.exclude_prefixes ?? []).length > 0 ? (
                          <span className="font-mono">{joinPrefixes(r.exclude_prefixes)}</span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-2 text-gray-500 text-xs">{r.note ?? ""}</td>
                      <td className="px-4 py-2 text-right">
                        <button onClick={() => startEdit(r)} className="text-xs text-[var(--color-primary)] hover:underline mr-3">편집</button>
                        <button onClick={() => deleteRule(r.id, `${r.wrong} → ${r.replacement}`)} className="text-xs text-red-600 hover:underline">삭제</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
