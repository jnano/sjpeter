"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DataEvent, notify } from "@/components/dataEvents";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type LayoutKind = "body" | "body_with_hero" | "sections" | "html";

interface DynamicPage {
  id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  group_label: string | null;
  layout_kind: LayoutKind;
  payload: Record<string, unknown>;
  body_markdown: string | null;
  is_active: boolean;
}

interface SectionCard {
  title: string;
  body: string;
}

const GROUP_PRESETS = ["성당 소개", "본당 공동체", "말씀과 기도", "알림과 게시판", "사진 갤러리"];

const LAYOUT_OPTIONS: { value: LayoutKind; label: string; description: string }[] = [
  { value: "body", label: "본문형", description: "제목 + 본문 텍스트만" },
  { value: "body_with_hero", label: "사진 + 본문", description: "상단 슬라이드쇼 + 본문 (페이지 사진은 /admin/page-photos에서 같은 slug로 등록)" },
  { value: "sections", label: "섹션 카드형", description: "본문 + 하단 카드 리스트 (FAQ·단계 안내 등)" },
  { value: "html", label: "HTML 직접 입력", description: "PageHeader·SectionLayout wrapper 없이 raw HTML 그대로 출력. 자유 레이아웃." },
];

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
}

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

const EMPTY_PAGE: DynamicPage = {
  id: 0,
  slug: "",
  title: "",
  subtitle: "",
  group_label: "",
  layout_kind: "body",
  payload: {},
  body_markdown: "",
  is_active: true,
};

export default function AdminPagesPage() {
  const router = useRouter();
  const [pages, setPages] = useState<DynamicPage[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<DynamicPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const headers = (): HeadersInit => {
    const t = getToken();
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  const load = useCallback(async () => {
    const t = getToken();
    if (!t) { router.push("/admin"); return; }
    const res = await fetch(`${API}/api/pages/admin/all`, { headers: headers(), cache: "no-store" });
    if (res.status === 401) { router.push("/admin"); return; }
    if (res.ok) {
      const data: DynamicPage[] = await res.json();
      setPages(data);
      setSelectedId((prev) => (prev !== null && data.some((p) => p.id === prev)) ? prev : (data[0]?.id ?? null));
    }
    setLoading(false);
  }, [router]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // 선택 변경 시 draft 초기화
  useEffect(() => {
    if (selectedId === null) {
      setDraft(null);
      return;
    }
    if (selectedId === 0) {
      setDraft({ ...EMPTY_PAGE });
      return;
    }
    const p = pages.find((x) => x.id === selectedId);
    if (p) setDraft({ ...p });
  }, [selectedId, pages]);

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(""), 2500); }

  function formatErr(err: { detail?: unknown }, status: number): string {
    const d = err.detail;
    if (Array.isArray(d)) {
      return d.map((x) => (x && typeof x === "object" ? (x as { msg?: string }).msg ?? JSON.stringify(x) : String(x))).join(", ");
    }
    if (typeof d === "string") return d;
    return `HTTP ${status}`;
  }

  async function save() {
    if (!draft) return;
    if (!SLUG_RE.test(draft.slug)) {
      alert("slug은 영문 소문자·숫자·하이픈만 사용할 수 있습니다 (예: parish-pilgrimage).");
      return;
    }
    if (!draft.title.trim()) {
      alert("제목을 입력하세요.");
      return;
    }
    setSaving(true);
    const body = {
      slug: draft.slug.trim(),
      title: draft.title.trim(),
      subtitle: draft.subtitle?.trim() || null,
      group_label: draft.group_label?.trim() || null,
      layout_kind: draft.layout_kind,
      payload: draft.payload,
      body_markdown: draft.body_markdown,
      is_active: draft.is_active,
    };
    const isNew = draft.id === 0;
    const url = isNew ? `${API}/api/pages` : `${API}/api/pages/${draft.id}`;
    const res = await fetch(url, {
      method: isNew ? "POST" : "PUT",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) {
      const saved: DynamicPage = await res.json();
      await load();
      setSelectedId(saved.id);
      notify(DataEvent.MENUS); // 메뉴 모달의 page 선택지에도 영향
      flash(isNew ? "페이지가 추가되었습니다." : "저장되었습니다.");
    } else {
      const err = await res.json().catch(() => ({}));
      alert(`저장 실패: ${formatErr(err, res.status)}`);
    }
  }

  async function deletePage() {
    if (!draft || draft.id === 0) return;
    if (!confirm(`'${draft.title}' 페이지를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return;
    const res = await fetch(`${API}/api/pages/${draft.id}`, { method: "DELETE", headers: headers() });
    if (res.ok) {
      setSelectedId(null);
      await load();
      notify(DataEvent.MENUS);
      flash("삭제되었습니다.");
    } else {
      const err = await res.json().catch(() => ({}));
      alert(`삭제 실패: ${formatErr(err, res.status)}`);
    }
  }

  function updateDraft<K extends keyof DynamicPage>(key: K, value: DynamicPage[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  // sections payload 편집
  const sections: SectionCard[] = Array.isArray(draft?.payload?.sections)
    ? (draft!.payload.sections as SectionCard[])
    : [];
  function setSections(next: SectionCard[]) {
    if (!draft) return;
    setDraft({ ...draft, payload: { ...draft.payload, sections: next } });
  }
  function addSection() { setSections([...sections, { title: "", body: "" }]); }
  function updateSection(i: number, patch: Partial<SectionCard>) {
    setSections(sections.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  }
  function removeSection(i: number) {
    if (!confirm(`섹션 ${i + 1}을 삭제하시겠습니까?`)) return;
    setSections(sections.filter((_, idx) => idx !== i));
  }
  function moveSection(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= sections.length) return;
    const next = [...sections];
    [next[i], next[j]] = [next[j], next[i]];
    setSections(next);
  }

  if (loading) return <div className="p-8 text-sm text-gray-500">불러오는 중…</div>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-primary)]">동적 페이지</h1>
        <p className="text-sm text-gray-500 mt-1">
          코드 없이 페이지를 만들고 메뉴에 연결할 수 있습니다. URL은 <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">/p/{`{slug}`}</code> 형식.
        </p>
      </header>

      {msg && (
        <p className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{msg}</p>
      )}

      <div className="grid md:grid-cols-[280px_1fr] gap-6">
        {/* 좌: 페이지 목록 */}
        <aside className="bg-white border border-gray-200 rounded-xl p-4 self-start">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">페이지 ({pages.length})</h2>
            <button
              onClick={() => setSelectedId(0)}
              className="text-xs px-2 py-1 bg-[var(--color-primary)] text-white rounded"
            >+ 새 페이지</button>
          </div>
          {pages.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">아직 페이지가 없습니다.</p>
          ) : (
            <ul className="space-y-1">
              {pages.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => setSelectedId(p.id)}
                    className={`w-full text-left px-3 py-2 text-sm rounded transition-colors ${
                      selectedId === p.id ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-semibold" : "hover:bg-gray-50"
                    } ${!p.is_active ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate">{p.title || "(제목 없음)"}</span>
                      {!p.is_active && <span className="text-[10px] text-gray-500">숨김</span>}
                    </div>
                    <code className="text-[10px] text-gray-400 font-mono">/p/{p.slug}</code>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* 우: 편집 폼 */}
        {!draft ? (
          <main className="text-sm text-gray-400 text-center py-20">왼쪽에서 페이지를 선택하거나 + 새 페이지 클릭.</main>
        ) : (
          <main className="space-y-5">
            <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">{draft.id === 0 ? "새 페이지" : "페이지 편집"}</h2>
                <div className="flex gap-2">
                  {draft.id !== 0 && (
                    <a
                      href={`/p/${draft.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50"
                    >미리보기 ↗</a>
                  )}
                  <button
                    onClick={save}
                    disabled={saving}
                    className="text-xs px-3 py-1.5 bg-[var(--color-primary)] text-white rounded hover:opacity-90 disabled:opacity-50"
                  >{saving ? "저장 중..." : "저장"}</button>
                  {draft.id !== 0 && (
                    <button
                      onClick={deletePage}
                      className="text-xs px-3 py-1.5 border border-red-300 text-red-600 rounded hover:bg-red-50"
                    >삭제</button>
                  )}
                </div>
              </div>

              {/* 레이아웃 선택 */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">레이아웃</label>
                <div className="grid sm:grid-cols-3 gap-2">
                  {LAYOUT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => updateDraft("layout_kind", opt.value)}
                      className={`text-left px-3 py-3 text-xs rounded border transition-colors ${
                        draft.layout_kind === opt.value
                          ? "bg-blue-50 border-blue-400 text-blue-900"
                          : "bg-white border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <div className="font-semibold mb-1">{opt.label}</div>
                      <div className="text-[11px] text-gray-500 leading-snug">{opt.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 기본 필드 */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">URL slug</label>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <span>/p/</span>
                    <input
                      value={draft.slug}
                      onChange={(e) => updateDraft("slug", e.target.value.toLowerCase())}
                      placeholder="parish-pilgrimage"
                      className={inputCls + " font-mono text-xs"}
                    />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">영문 소문자·숫자·하이픈만. 한 번 정한 slug 변경 시 외부 링크가 깨질 수 있음.</p>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">제목</label>
                  <input
                    value={draft.title}
                    onChange={(e) => updateDraft("title", e.target.value)}
                    className={inputCls}
                    placeholder="페이지 제목"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-gray-600 mb-1">부제 (선택)</label>
                  <input
                    value={draft.subtitle ?? ""}
                    onChange={(e) => updateDraft("subtitle", e.target.value)}
                    className={inputCls}
                    placeholder="페이지 상단에 작은 글씨로 표시"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-gray-600 mb-1">소속 그룹 (헤더 브레드크럼·사이드바)</label>
                  <input
                    value={draft.group_label ?? ""}
                    onChange={(e) => updateDraft("group_label", e.target.value)}
                    className={inputCls}
                    placeholder="예: 성당 소개"
                  />
                  <div className="flex flex-wrap gap-1 mt-2">
                    {GROUP_PRESETS.map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => updateDraft("group_label", g)}
                        className={`text-xs px-2 py-1 rounded border ${
                          draft.group_label === g
                            ? "bg-blue-50 border-blue-300 text-blue-700"
                            : "bg-white border-gray-200 hover:bg-gray-50"
                        }`}
                      >{g}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 활성 토글 */}
              <div>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.is_active}
                    onChange={(e) => updateDraft("is_active", e.target.checked)}
                  />
                  활성 (체크 해제 시 사이트에서 404)
                </label>
              </div>
            </section>

            {/* 본문 — html 레이아웃이면 HTML, 그 외 markdown */}
            <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">
                  {draft.layout_kind === "html" ? "HTML 코드" : "본문 (마크다운)"}
                </h2>
                <a
                  href={draft.layout_kind === "html"
                    ? "https://developer.mozilla.org/ko/docs/Web/HTML/Element"
                    : "https://commonmark.org/help/"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline"
                >{draft.layout_kind === "html" ? "HTML 태그 참고 ↗" : "마크다운 문법 ↗"}</a>
              </div>
              {draft.layout_kind === "html" && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                  ⚠ HTML 은 wrapper 없이 그대로 렌더링됩니다. 외부에서 받은 코드를 붙여넣을 때는
                  &lt;script&gt; 등 동적 코드가 포함되지 않았는지 확인하세요.
                  글로벌 Header/Footer 는 자동 적용됩니다.
                </p>
              )}

              {/* 변수 안내 — 모든 레이아웃 공통 */}
              <details className="text-xs bg-blue-50 border border-blue-200 rounded">
                <summary className="cursor-pointer px-3 py-2 font-medium text-blue-900 select-none">
                  사용 가능한 변수 — 본문·제목·부제에 <code className="font-mono">{`{{ VAR_NAME }}`}</code> 형태로 쓰면 현재 본당 값으로 자동 치환됩니다 ▼
                </summary>
                <ul className="px-3 pb-3 pt-1 space-y-1 text-blue-900/90">
                  {[
                    { k: "PARISH_NAME", d: "본당 이름 (예: 세종성베드로성당)" },
                    { k: "PARISH_NAME_EN", d: "본당 영문명 (예: St. Peter's Cathedral)" },
                    { k: "PARISH_ADDRESS", d: "본당 주소" },
                    { k: "PARISH_PHONE", d: "본당 전화번호" },
                    { k: "PARISH_FAX", d: "본당 팩스번호" },
                    { k: "DIOCESE", d: "소속 교구" },
                    { k: "SITE_URL", d: "사이트 URL" },
                    { k: "CURRENT_YEAR", d: "현재 연도 (예: 2026)" },
                    { k: "TODAY", d: "오늘 날짜 (YYYY-MM-DD)" },
                  ].map((v) => (
                    <li key={v.k} className="flex items-baseline gap-2">
                      <code className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-white border border-blue-200 text-blue-700 whitespace-nowrap">
                        {`{{ ${v.k} }}`}
                      </code>
                      <span className="text-[11px]">{v.d}</span>
                    </li>
                  ))}
                </ul>
                <p className="px-3 pb-3 text-[11px] text-blue-700/80">
                  공백 유무·대소문자 무관. 모르는 변수는 그대로 출력됩니다 (오타 시 사이트 깨지지 않음).
                </p>
              </details>
              <textarea
                value={draft.body_markdown ?? ""}
                onChange={(e) => updateDraft("body_markdown", e.target.value)}
                rows={15}
                className={inputCls + " font-mono text-xs"}
                placeholder={draft.layout_kind === "html"
                  ? `<section class="max-w-3xl mx-auto px-6 py-12">\n  <h1 class="text-3xl font-bold">제목</h1>\n  <p class="mt-4 text-gray-600">자유로운 HTML 레이아웃을 작성하세요.</p>\n</section>`
                  : `# 제목\n\n여기에 본문을 작성합니다.\n\n- 항목 1\n- 항목 2\n\n> 인용문도 가능합니다.`}
              />
            </section>

            {/* sections 레이아웃 전용 카드 편집기 */}
            {draft.layout_kind === "sections" && (
              <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">하단 카드 ({sections.length})</h2>
                  <button
                    onClick={addSection}
                    className="text-xs px-3 py-1.5 bg-[var(--color-primary)] text-white rounded"
                  >+ 카드 추가</button>
                </div>
                {sections.length === 0 ? (
                  <p className="text-xs text-gray-400 py-4 text-center">카드가 없습니다. 본문 아래에 표시될 카드를 추가하세요.</p>
                ) : (
                  <ul className="space-y-3">
                    {sections.map((s, i) => (
                      <li key={i} className="border border-gray-200 rounded-lg p-3 bg-gray-50/50">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-gray-500">카드 {i + 1}</span>
                          <div className="flex gap-1">
                            <button onClick={() => moveSection(i, -1)} className="text-xs px-2 py-1 border border-gray-300 rounded bg-white hover:bg-gray-50">↑</button>
                            <button onClick={() => moveSection(i, 1)} className="text-xs px-2 py-1 border border-gray-300 rounded bg-white hover:bg-gray-50">↓</button>
                            <button onClick={() => removeSection(i)} className="text-xs px-2 py-1 border border-red-200 text-red-500 rounded bg-white hover:bg-red-50">삭제</button>
                          </div>
                        </div>
                        <input
                          value={s.title}
                          onChange={(e) => updateSection(i, { title: e.target.value })}
                          className={inputCls + " mb-2"}
                          placeholder="카드 제목"
                        />
                        <textarea
                          value={s.body}
                          onChange={(e) => updateSection(i, { body: e.target.value })}
                          rows={4}
                          className={inputCls + " font-mono text-xs"}
                          placeholder="카드 내용 (마크다운 가능)"
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {/* 슬라이드쇼 안내 */}
            {draft.layout_kind === "body_with_hero" && (
              <section className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
                <p className="font-semibold mb-1">슬라이드쇼 사진 등록</p>
                <p className="text-xs leading-relaxed">
                  이 레이아웃은 상단에 슬라이드쇼를 표시합니다. <a href="/admin/page-photos" className="underline">페이지 사진</a> 메뉴에서{" "}
                  <code className="bg-amber-100 px-1 rounded">slug: {draft.slug || "(slug)"}</code>로 사진을 등록하세요.
                  사진이 없으면 슬라이드 영역이 비어 보입니다.
                </p>
              </section>
            )}
          </main>
        )}
      </div>
    </div>
  );
}
