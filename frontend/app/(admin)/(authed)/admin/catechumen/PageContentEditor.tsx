"use client";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm";
const labelCls = "block text-[11px] font-semibold text-gray-600 mb-1";

interface Stat { v: string; l: string; }
interface PathStep { n: string; when: string; title: string; body: string; done: boolean; }
interface Curriculum { term: string; title: string; period: string; items: string[]; }
interface ScheduleRow { label: string; value: string; sub: string; }
interface Faq { q: string; a: string; }
interface PageContent {
  hero: { eyebrow: string; title_normal: string; title_em: string; body: string; stats: Stat[] };
  path_steps: PathStep[];
  curriculum: Curriculum[];
  schedule: ScheduleRow[];
  faq: Faq[];
  cta: { eyebrow: string; title_normal: string; title_em: string };
}

function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
}

// 리스트 항목 이동·삭제 버튼
function RowControls({ onUp, onDown, onDel, disableUp, disableDown }: {
  onUp: () => void; onDown: () => void; onDel: () => void; disableUp: boolean; disableDown: boolean;
}) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <button type="button" onClick={onUp} disabled={disableUp} className="px-2 py-1 text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30">▲</button>
      <button type="button" onClick={onDown} disabled={disableDown} className="px-2 py-1 text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30">▼</button>
      <button type="button" onClick={onDel} className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded">삭제</button>
    </div>
  );
}

export default function PageContentEditor() {
  const [content, setContent] = useState<PageContent | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => { load(); }, []);
  async function load() {
    const res = await fetch(`${API}/api/catechumen/page-content`);
    if (res.ok) setContent(await res.json());
  }

  async function save() {
    if (!content) return;
    setSaving(true); setMsg(null);
    try {
      const res = await fetch(`${API}/api/catechumen/page-content`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        setMsg({ type: "ok", text: "저장되었습니다. 공개 페이지에 즉시 반영됩니다." });
        await fetch("/api/revalidate?tag=catechumen", { method: "POST" });
      } else {
        setMsg({ type: "err", text: "저장에 실패했습니다." });
      }
    } catch {
      setMsg({ type: "err", text: "저장 중 오류가 발생했습니다." });
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 4000);
    }
  }

  // ── 공통 변경 헬퍼 ──────────────────────────────────────
  function setHero<K extends keyof PageContent["hero"]>(k: K, v: PageContent["hero"][K]) {
    setContent((c) => c && { ...c, hero: { ...c.hero, [k]: v } });
  }
  function setCta<K extends keyof PageContent["cta"]>(k: K, v: PageContent["cta"][K]) {
    setContent((c) => c && { ...c, cta: { ...c.cta, [k]: v } });
  }
  // 리스트(path_steps/curriculum/schedule/faq) 제네릭 조작
  function listEdit<K extends "path_steps" | "curriculum" | "schedule" | "faq">(
    key: K, idx: number, patch: Partial<PageContent[K][number]>,
  ) {
    setContent((c) => {
      if (!c) return c;
      const arr = [...(c[key] as unknown[])] as PageContent[K];
      arr[idx] = { ...(arr[idx] as object), ...patch } as PageContent[K][number];
      return { ...c, [key]: arr };
    });
  }
  function listAdd<K extends "path_steps" | "curriculum" | "schedule" | "faq">(key: K, item: PageContent[K][number]) {
    setContent((c) => c && { ...c, [key]: [...(c[key] as unknown[]), item] as PageContent[K] });
  }
  function listDel(key: "path_steps" | "curriculum" | "schedule" | "faq", idx: number) {
    setContent((c) => c && { ...c, [key]: (c[key] as unknown[]).filter((_, i) => i !== idx) });
  }
  function listMove(key: "path_steps" | "curriculum" | "schedule" | "faq", idx: number, dir: -1 | 1) {
    setContent((c) => {
      if (!c) return c;
      const arr = [...(c[key] as unknown[])];
      const t = idx + dir;
      if (t < 0 || t >= arr.length) return c;
      [arr[idx], arr[t]] = [arr[t], arr[idx]];
      return { ...c, [key]: arr };
    });
  }
  // stats (hero 내부 배열)
  function statEdit(idx: number, k: keyof Stat, v: string) {
    setContent((c) => {
      if (!c) return c;
      const stats = [...c.hero.stats];
      stats[idx] = { ...stats[idx], [k]: v };
      return { ...c, hero: { ...c.hero, stats } };
    });
  }
  function statAdd() { setContent((c) => c && { ...c, hero: { ...c.hero, stats: [...c.hero.stats, { v: "", l: "" }] } }); }
  function statDel(idx: number) { setContent((c) => c && { ...c, hero: { ...c.hero, stats: c.hero.stats.filter((_, i) => i !== idx) } }); }
  // curriculum.items (중첩 string[])
  function itemEdit(ci: number, ii: number, v: string) {
    setContent((c) => {
      if (!c) return c;
      const cur = [...c.curriculum];
      const items = [...cur[ci].items]; items[ii] = v;
      cur[ci] = { ...cur[ci], items };
      return { ...c, curriculum: cur };
    });
  }
  function itemAdd(ci: number) {
    setContent((c) => {
      if (!c) return c;
      const cur = [...c.curriculum];
      cur[ci] = { ...cur[ci], items: [...cur[ci].items, ""] };
      return { ...c, curriculum: cur };
    });
  }
  function itemDel(ci: number, ii: number) {
    setContent((c) => {
      if (!c) return c;
      const cur = [...c.curriculum];
      cur[ci] = { ...cur[ci], items: cur[ci].items.filter((_, i) => i !== ii) };
      return { ...c, curriculum: cur };
    });
  }

  const sectionTitle = "text-sm font-bold text-gray-800 border-b border-gray-200 pb-1.5 mb-3 mt-6";
  const cardCls = "border border-gray-200 rounded-lg p-3 mb-2 bg-gray-50/50";
  const addBtn = "mt-1 px-3 py-1.5 text-xs border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50";

  return (
    <section className="bg-white border border-gray-200 rounded-xl mb-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 text-left"
      >
        <div>
          <h2 className="text-lg font-bold">안내 페이지 콘텐츠</h2>
          <p className="text-sm text-gray-500 mt-0.5">공개 /catechumen 페이지의 문구·4단계·커리큘럼·일정·FAQ·CTA 를 편집합니다.</p>
        </div>
        <span className="text-gray-400 text-sm">{open ? "접기 ▲" : "펼치기 ▼"}</span>
      </button>

      {open && content && (
        <div className="px-6 pb-6">
          {/* HERO */}
          <h3 className={sectionTitle}>상단 영역 (Hero)</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className={labelCls}>상단 라벨 (eyebrow)</label><input className={inputCls} value={content.hero.eyebrow} onChange={(e) => setHero("eyebrow", e.target.value)} /></div>
            <div><label className={labelCls}>본문</label><input className={inputCls} value={content.hero.body} onChange={(e) => setHero("body", e.target.value)} /></div>
            <div><label className={labelCls}>제목 1행</label><input className={inputCls} value={content.hero.title_normal} onChange={(e) => setHero("title_normal", e.target.value)} /></div>
            <div><label className={labelCls}>제목 2행 (강조)</label><input className={inputCls} value={content.hero.title_em} onChange={(e) => setHero("title_em", e.target.value)} /></div>
          </div>
          <label className={`${labelCls} mt-3`}>통계 (값 · 라벨)</label>
          {content.hero.stats.map((s, i) => (
            <div key={i} className="flex items-center gap-2 mb-2">
              <input className={inputCls} placeholder="값 (예: 9개월)" value={s.v} onChange={(e) => statEdit(i, "v", e.target.value)} />
              <input className={inputCls} placeholder="라벨 (예: 전체 과정)" value={s.l} onChange={(e) => statEdit(i, "l", e.target.value)} />
              <button type="button" onClick={() => statDel(i)} className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded shrink-0">삭제</button>
            </div>
          ))}
          <button type="button" className={addBtn} onClick={statAdd}>+ 통계 추가</button>

          {/* PATH STEPS */}
          <h3 className={sectionTitle}>4단계의 길 (Path)</h3>
          {content.path_steps.map((s, i) => (
            <div key={i} className={cardCls}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="grid grid-cols-3 gap-2 flex-1">
                  <div><label className={labelCls}>번호</label><input className={inputCls} value={s.n} onChange={(e) => listEdit("path_steps", i, { n: e.target.value })} /></div>
                  <div><label className={labelCls}>시기</label><input className={inputCls} value={s.when} onChange={(e) => listEdit("path_steps", i, { when: e.target.value })} /></div>
                  <div><label className={labelCls}>제목</label><input className={inputCls} value={s.title} onChange={(e) => listEdit("path_steps", i, { title: e.target.value })} /></div>
                </div>
                <RowControls onUp={() => listMove("path_steps", i, -1)} onDown={() => listMove("path_steps", i, 1)} onDel={() => listDel("path_steps", i)} disableUp={i === 0} disableDown={i === content.path_steps.length - 1} />
              </div>
              <input className={`${inputCls} mb-2`} placeholder="설명" value={s.body} onChange={(e) => listEdit("path_steps", i, { body: e.target.value })} />
              <label className="inline-flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" checked={s.done} onChange={(e) => listEdit("path_steps", i, { done: e.target.checked })} className="rounded" />
                현재 단계로 강조(테두리 강조)
              </label>
            </div>
          ))}
          <button type="button" className={addBtn} onClick={() => listAdd("path_steps", { n: "", when: "", title: "", body: "", done: false })}>+ 단계 추가</button>

          {/* CURRICULUM */}
          <h3 className={sectionTitle}>무엇을 배우나요? (Curriculum)</h3>
          {content.curriculum.map((c, i) => (
            <div key={i} className={cardCls}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="grid grid-cols-3 gap-2 flex-1">
                  <div><label className={labelCls}>학기</label><input className={inputCls} value={c.term} onChange={(e) => listEdit("curriculum", i, { term: e.target.value })} /></div>
                  <div><label className={labelCls}>제목</label><input className={inputCls} value={c.title} onChange={(e) => listEdit("curriculum", i, { title: e.target.value })} /></div>
                  <div><label className={labelCls}>기간/시간</label><input className={inputCls} value={c.period} onChange={(e) => listEdit("curriculum", i, { period: e.target.value })} /></div>
                </div>
                <RowControls onUp={() => listMove("curriculum", i, -1)} onDown={() => listMove("curriculum", i, 1)} onDel={() => listDel("curriculum", i)} disableUp={i === 0} disableDown={i === content.curriculum.length - 1} />
              </div>
              <label className={labelCls}>항목 (<code>**굵게**</code> 지원)</label>
              {c.items.map((it, j) => (
                <div key={j} className="flex items-center gap-2 mb-1.5">
                  <input className={inputCls} value={it} onChange={(e) => itemEdit(i, j, e.target.value)} />
                  <button type="button" onClick={() => itemDel(i, j)} className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded shrink-0">삭제</button>
                </div>
              ))}
              <button type="button" className={addBtn} onClick={() => itemAdd(i)}>+ 항목 추가</button>
            </div>
          ))}
          <button type="button" className={addBtn} onClick={() => listAdd("curriculum", { term: "", title: "", period: "", items: [] })}>+ 학기 추가</button>

          {/* SCHEDULE */}
          <h3 className={sectionTitle}>일정과 장소 (Schedule)</h3>
          {content.schedule.map((r, i) => (
            <div key={i} className="flex items-start gap-2 mb-2">
              <div className="grid grid-cols-[100px_1fr_1fr] gap-2 flex-1">
                <input className={inputCls} placeholder="구분" value={r.label} onChange={(e) => listEdit("schedule", i, { label: e.target.value })} />
                <input className={inputCls} placeholder="내용" value={r.value} onChange={(e) => listEdit("schedule", i, { value: e.target.value })} />
                <input className={inputCls} placeholder="부가설명" value={r.sub} onChange={(e) => listEdit("schedule", i, { sub: e.target.value })} />
              </div>
              <RowControls onUp={() => listMove("schedule", i, -1)} onDown={() => listMove("schedule", i, 1)} onDel={() => listDel("schedule", i)} disableUp={i === 0} disableDown={i === content.schedule.length - 1} />
            </div>
          ))}
          <button type="button" className={addBtn} onClick={() => listAdd("schedule", { label: "", value: "", sub: "" })}>+ 일정 추가</button>

          {/* FAQ */}
          <h3 className={sectionTitle}>궁금하실 것들 (FAQ)</h3>
          {content.faq.map((f, i) => (
            <div key={i} className={cardCls}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <input className={`${inputCls} flex-1`} placeholder="질문" value={f.q} onChange={(e) => listEdit("faq", i, { q: e.target.value })} />
                <RowControls onUp={() => listMove("faq", i, -1)} onDown={() => listMove("faq", i, 1)} onDel={() => listDel("faq", i)} disableUp={i === 0} disableDown={i === content.faq.length - 1} />
              </div>
              <textarea className={`${inputCls} resize-none`} rows={2} placeholder="답변" value={f.a} onChange={(e) => listEdit("faq", i, { a: e.target.value })} />
            </div>
          ))}
          <button type="button" className={addBtn} onClick={() => listAdd("faq", { q: "", a: "" })}>+ 질문 추가</button>

          {/* CTA */}
          <h3 className={sectionTitle}>하단 배너 (CTA)</h3>
          <div className="grid sm:grid-cols-3 gap-3">
            <div><label className={labelCls}>상단 라벨</label><input className={inputCls} value={content.cta.eyebrow} onChange={(e) => setCta("eyebrow", e.target.value)} /></div>
            <div><label className={labelCls}>문구 1행</label><input className={inputCls} value={content.cta.title_normal} onChange={(e) => setCta("title_normal", e.target.value)} /></div>
            <div><label className={labelCls}>문구 2행 (강조)</label><input className={inputCls} value={content.cta.title_em} onChange={(e) => setCta("title_em", e.target.value)} /></div>
          </div>

          {/* SAVE */}
          <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
            {msg && <span className={`text-sm ${msg.type === "ok" ? "text-green-600" : "text-red-600"}`}>{msg.text}</span>}
            <button type="button" onClick={save} disabled={saving} className="px-5 py-2.5 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40">
              {saving ? "저장 중…" : "콘텐츠 저장"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
