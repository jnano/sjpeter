"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PRAYER_CATEGORIES, PRAYER_CATEGORY_LABELS, type PrayerCategory } from "@/lib/prayer";

export interface PrayerItem {
  id: number;
  title: string;
  category: string;
  scripture: string | null;
  body: string;
  author: string | null;
  is_featured: boolean;
}

const SAVE_KEY = "prayer-saved";

function IconBookmark({ filled }: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 14 14" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
      <path d="M3.5 2h7v10l-3.5-2.5L3.5 12z" strokeLinejoin="round" />
    </svg>
  );
}
function IconShare() {
  return (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="3.5" cy="7" r="1.5" /><circle cx="10.5" cy="3.5" r="1.5" /><circle cx="10.5" cy="10.5" r="1.5" />
      <line x1="4.8" y1="6.3" x2="9.2" y2="4.2" /><line x1="4.8" y1="7.7" x2="9.2" y2="9.8" />
    </svg>
  );
}

export default function PrayerListView({ prayers }: { prayers: PrayerItem[] }) {
  const [cat, setCat] = useState<PrayerCategory | "">("");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState(""); // 제출된 검색어
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) setSaved(new Set(JSON.parse(raw) as number[]));
    } catch { /* 무시 */ }
  }, []);

  function showToast(m: string) { setToast(m); window.setTimeout(() => setToast(""), 1800); }

  function toggleSave(id: number) {
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem(SAVE_KEY, JSON.stringify([...next])); } catch { /* 무시 */ }
      showToast(next.has(id) ? "보관함에 저장했어요" : "저장을 해제했어요");
      return next;
    });
  }

  async function share(p: PrayerItem) {
    const url = `${window.location.origin}/prayer/${p.id}`;
    if (navigator.share) { try { await navigator.share({ title: p.title, url }); } catch { /* 취소 */ } }
    else { try { await navigator.clipboard.writeText(url); showToast("링크를 복사했어요"); } catch { showToast("복사 실패"); } }
  }

  // 카테고리별 카운트 (전체 기준)
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of prayers) m[p.category] = (m[p.category] ?? 0) + 1;
    return m;
  }, [prayers]);

  const featured = useMemo(() => prayers.find((p) => p.is_featured) ?? null, [prayers]);

  const filtered = useMemo(() => {
    let pool = prayers;
    if (cat) pool = pool.filter((p) => p.category === cat);
    if (query) {
      const k = query.toLowerCase();
      pool = pool.filter((p) =>
        p.title.toLowerCase().includes(k) ||
        (p.body ?? "").toLowerCase().includes(k) ||
        (p.scripture ?? "").toLowerCase().includes(k) ||
        (p.author ?? "").toLowerCase().includes(k));
    }
    return pool;
  }, [prayers, cat, query]);

  // 카테고리별 그룹 (필터 안 걸렸을 때만 그룹 표시; 그룹 순서는 PRAYER_CATEGORIES)
  const groups = useMemo(() => {
    const byCat: Record<string, PrayerItem[]> = {};
    for (const p of filtered) (byCat[p.category] ??= []).push(p);
    return PRAYER_CATEGORIES.filter((c) => byCat[c]?.length).map((c) => ({ cat: c, items: byCat[c] }));
  }, [filtered]);

  function Card({ p }: { p: PrayerItem }) {
    const isSaved = saved.has(p.id);
    return (
      <article className="pr-card" data-pcat={p.category}>
        <div className="min-w-0">
          <div className="cat-label">{PRAYER_CATEGORY_LABELS[p.category as PrayerCategory] ?? p.category}</div>
          <h3><Link href={`/prayer/${p.id}`}>{p.title}</Link></h3>
          {p.scripture && <span className="ref">{p.scripture}</span>}
          <p className="preview">{p.body}</p>
        </div>
        <div className="pc-side">
          {p.author && <div className="src"><b>{p.author}</b></div>}
          <div className="pc-actions">
            <button type="button" aria-label="저장" aria-pressed={isSaved} className={isSaved ? "on" : ""} onClick={() => toggleSave(p.id)}>
              <IconBookmark filled={isSaved} />
            </button>
            <button type="button" aria-label="공유" onClick={() => share(p)}><IconShare /></button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <div className="pr-root">
      {/* 오늘 추천 기도 */}
      {featured && (
        <div className="pr-today">
          <div>
            <div className="meta">오늘 추천 기도</div>
            <h3>{featured.title}</h3>
            <p className="verse">{featured.body}</p>
          </div>
          <Link href={`/prayer/${featured.id}`} className="go">
            기도문 전체 보기
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="2" y1="6.5" x2="11" y2="6.5" /><polyline points="7 3 11 6.5 7 10" /></svg>
          </Link>
        </div>
      )}

      {/* 카테고리 칩 */}
      <div className="pr-catbar">
        <button type="button" className={`pr-chip ${!cat ? "on" : ""}`} onClick={() => setCat("")}>
          <span>전체</span><span className="count">{prayers.length}</span>
        </button>
        {PRAYER_CATEGORIES.filter((c) => counts[c]).map((c) => (
          <button key={c} type="button" data-pcat={c} className={`pr-chip ${cat === c ? "on" : ""}`} onClick={() => setCat(c)}>
            <span className="dot" /><span>{PRAYER_CATEGORY_LABELS[c]}</span><span className="count">{counts[c]}</span>
          </button>
        ))}
      </div>

      {/* 검색 */}
      <form className="pr-search" onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()); }} role="search">
        <div className="inp">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="7" cy="7" r="5" /><line x1="11" y1="11" x2="14" y2="14" strokeLinecap="round" /></svg>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="제목·본문·성서 구절·필자로 검색"
            onKeyDown={(e) => { if (e.key === "Escape") { setQ(""); setQuery(""); } }} />
        </div>
        <button type="submit" className="go">검색</button>
      </form>

      {/* 리스트 헤드 */}
      <div className="pr-listhead">
        <div className="cnt">
          {(cat || query) && <span className="text-[var(--color-primary)] font-medium">{cat ? PRAYER_CATEGORY_LABELS[cat] : `"${query}"`} </span>}
          {cat || query ? "결과 " : "총 "}<b>{filtered.length}</b>편
        </div>
      </div>

      {/* 목록 */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-sm text-[var(--color-text-muted)]">조건에 맞는 기도문이 없습니다.</div>
      ) : cat || query ? (
        // 필터/검색 시 — 평면 목록
        <div className="pr-list">{filtered.map((p) => <Card key={p.id} p={p} />)}</div>
      ) : (
        // 기본 — 카테고리 그룹
        groups.map((g) => (
          <div key={g.cat}>
            <div className="pr-group">{PRAYER_CATEGORY_LABELS[g.cat]} <span className="c">{g.items.length}</span></div>
            <div className="pr-list">{g.items.map((p) => <Card key={p.id} p={p} />)}</div>
          </div>
        ))
      )}

      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[60] bg-[var(--color-text)] text-white text-sm px-4 py-2 rounded-full shadow-lg pointer-events-none">{toast}</div>
      )}
    </div>
  );
}
