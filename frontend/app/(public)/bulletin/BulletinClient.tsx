"use client";

import { useMemo, useState } from "react";
import Script from "next/script";
import type { Bulletin } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function shareToKakao(b: Bulletin, kakaoKey: string, parishName: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kakao = (window as any).Kakao;
  if (!kakao?.isInitialized()) return;
  kakao.Share.sendDefault({
    objectType: "feed",
    content: {
      title: b.issue_number ? `${parishName} 주보 제${b.issue_number}호` : `${parishName} 주보`,
      description: [b.liturgical_season, b.gospel_reference].filter(Boolean).join(" · ") || "이번 주 주보를 확인하세요",
      imageUrl: "https://t1.kakaocdn.net/kakao_js_sdk/1.1/kakao_thumbnail.png",
      link: { mobileWebUrl: window.location.href, webUrl: window.location.href },
    },
    buttons: [
      { title: "주보 보기", link: { mobileWebUrl: window.location.href, webUrl: window.location.href } },
    ],
  });
}

function quarterOf(month: number): { id: number; label: string; range: string } {
  if (month <= 3) return { id: 1, label: "1분기 · 대림·연중", range: "01 — 03" };
  if (month <= 6) return { id: 2, label: "2분기 · 사순·부활·성령", range: "04 — 06" };
  if (month <= 9) return { id: 3, label: "3분기 · 연중", range: "07 — 09" };
  return { id: 4, label: "4분기 · 연중·대림", range: "10 — 12" };
}

interface QuarterGroup {
  year: number;
  quarter: number;
  label: string;
  range: string;
  items: Bulletin[];
}

export default function BulletinClient({
  bulletins,
  kakaoKey = "",
  parishName = "본당 홈페이지",
}: {
  bulletins: Bulletin[];
  kakaoKey?: string;
  parishName?: string;
}) {
  const list = bulletins;
  const latest = list[0];
  const latestDate = latest ? new Date(latest.published_date) : null;

  // 연도 + 검색
  const years = useMemo(() => {
    const s = new Set<number>();
    list.forEach((b) => s.add(new Date(b.published_date).getFullYear()));
    return Array.from(s).sort((a, b) => b - a);
  }, [list]);
  const [year, setYear] = useState<number | "all">(years[0] ?? "all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");

  // 필터 + 분기 그룹화
  const groups: QuarterGroup[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = list.filter((b) => {
      if (year !== "all" && new Date(b.published_date).getFullYear() !== year) return false;
      if (!q) return true;
      const hay = [
        b.issue_number != null ? `제${b.issue_number}호` : "",
        b.liturgical_season ?? "",
        b.gospel_reference ?? "",
        b.published_date,
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });

    const map = new Map<string, QuarterGroup>();
    for (const b of filtered) {
      const d = new Date(b.published_date);
      const y = d.getFullYear();
      const qq = quarterOf(d.getMonth() + 1);
      const key = `${y}-${qq.id}`;
      if (!map.has(key)) {
        map.set(key, { year: y, quarter: qq.id, label: qq.label, range: qq.range, items: [] });
      }
      map.get(key)!.items.push(b);
    }
    return Array.from(map.values()).sort((a, b) => b.year - a.year || b.quarter - a.quarter);
  }, [list, year, query]);

  const filteredCount = groups.reduce((n, g) => n + g.items.length, 0);

  function formatPub(iso: string) {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  }
  function formatShort(iso: string) {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
  function viewPdf(b: Bulletin) {
    if (!b.pdf_url) return;
    window.open(`${API}${b.pdf_url}`, "_blank", "noopener");
  }

  return (
    <div>
      <Script
        src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js"
        strategy="lazyOnload"
        onLoad={() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const k = (window as any).Kakao;
          if (k && !k.isInitialized() && kakaoKey) k.init(kakaoKey);
        }}
      />

      {/* ── latest hero ─────────────────────────────────── */}
      {latest && latestDate && (
        <section className="grid lg:grid-cols-[260px_1fr] gap-7 lg:gap-10 bg-[var(--color-surface-warm)] rounded-3xl p-6 sm:p-8 mb-10">
          <div className="relative aspect-[210/297] bg-white border border-[var(--color-border)] rounded-xl overflow-hidden mx-auto w-full max-w-[260px] flex flex-col items-center justify-between p-6 sm:p-7 text-center"
               style={{ boxShadow: "0 12px 32px rgba(44,38,32,0.12)" }}>
            <span className="absolute top-4 -right-2 px-3 py-1 bg-[var(--color-primary)] text-white text-[11px] font-bold tracking-wider">
              최신호
            </span>
            <span className="text-3xl sm:text-4xl" style={{ color: "var(--color-accent, #C9A961)" }}>✠</span>
            <div className="text-[13px] sm:text-[14px] font-bold text-[var(--color-text)] tracking-tight leading-snug">
              {parishName}<br />주보
            </div>
            <div className="text-[10px] sm:text-[11px] font-bold text-[var(--color-text-muted)] tabular-nums">
              {latest.issue_number ? `제 ${latest.issue_number} 호 · ` : ""}{formatPub(latest.published_date)}
            </div>
          </div>

          <div className="py-2 min-w-0">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[var(--color-primary)] text-white rounded-full text-[11px] font-bold tracking-wider mb-4">
              최신호 · This Week
            </span>
            {latest.issue_number && (
              <div className="text-[12px] text-[var(--color-text-muted)] font-bold tracking-wider uppercase mb-2">
                제 {latest.issue_number} 호
              </div>
            )}
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight leading-snug text-balance mb-3.5">
              {latestDate.getFullYear()}년 {latestDate.getMonth() + 1}월 {latestDate.getDate()}일
              {latest.liturgical_season && <><br />{latest.liturgical_season}</>}
            </h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[var(--color-text-muted)] mb-5">
              <span><b className="text-[var(--color-text)] font-bold">발행</b> {formatPub(latest.published_date)}</span>
              {latest.gospel_reference && (
                <>
                  <span className="text-[var(--color-border)]">·</span>
                  <span>{latest.gospel_reference}</span>
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => viewPdf(latest)}
                disabled={!latest.pdf_url}
                className="inline-flex items-center gap-2 px-5 py-3 bg-[var(--color-text)] text-white rounded-full text-[13px] font-semibold hover:opacity-90 disabled:opacity-40"
              >
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <rect x="2" y="2" width="10" height="10" rx="1" />
                  <line x1="2" y1="5" x2="12" y2="5" />
                </svg>
                지금 읽기
              </button>
              <a
                href={latest.pdf_url ? `${API}${latest.pdf_url}` : "#"}
                download={!!latest.pdf_url}
                aria-disabled={!latest.pdf_url}
                className={`inline-flex items-center gap-2 px-5 py-3 bg-white border border-[var(--color-border)] text-[var(--color-text-muted)] rounded-full text-[13px] font-semibold hover:text-[var(--color-text)] ${!latest.pdf_url ? "opacity-40 pointer-events-none" : ""}`}
              >
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <line x1="7" y1="2" x2="7" y2="10" />
                  <polyline points="4 7 7 10 10 7" />
                  <line x1="2" y1="12" x2="12" y2="12" />
                </svg>
                PDF 다운로드
              </a>
              {kakaoKey && (
                <button
                  type="button"
                  onClick={() => shareToKakao(latest, kakaoKey, parishName)}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-[13px] font-semibold"
                  style={{ background: "#FEE500", color: "#3C1E1E" }}
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M12 3C6.48 3 2 6.48 2 10.8c0 2.74 1.57 5.16 3.96 6.64l-.99 3.69 4.28-2.82c.88.17 1.8.26 2.75.26 5.52 0 10-3.48 10-7.77C22 6.48 17.52 3 12 3z" /></svg>
                  카카오 공유
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── toolbar ────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 items-center pb-6 mb-6 border-b border-[var(--color-border)]">
        <div className="flex-1 min-w-[200px] flex items-center gap-3 px-4 py-2.5 bg-white border border-[var(--color-border)] rounded-full">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-[var(--color-text-muted)] shrink-0">
            <circle cx="7" cy="7" r="5" />
            <line x1="11" y1="11" x2="14" y2="14" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="주보 내용·호수·날짜 검색"
            className="flex-1 outline-none bg-transparent text-[14px] placeholder:text-[var(--color-text-muted)]"
          />
        </div>

        {years.length > 1 && (
          <div className="flex p-1 bg-white border border-[var(--color-border)] rounded-full">
            {years.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setYear(y)}
                className={`px-3 sm:px-3.5 py-1.5 rounded-full text-[12px] font-bold tabular-nums transition-colors ${
                  year === y ? "bg-[var(--color-text)] text-white" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                }`}
              >
                {y}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setYear("all")}
              className={`px-3 sm:px-3.5 py-1.5 rounded-full text-[12px] font-bold transition-colors ${
                year === "all" ? "bg-[var(--color-text)] text-white" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              전체
            </button>
          </div>
        )}

        <div className="hidden sm:flex p-1 bg-white border border-[var(--color-border)] rounded-full">
          {(["grid", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-label={v === "grid" ? "표지 보기" : "목록 보기"}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${
                view === v ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              {v === "grid" ? (
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <rect x="1.5" y="1.5" width="3.5" height="3.5" />
                  <rect x="6" y="1.5" width="3.5" height="3.5" />
                  <rect x="1.5" y="6" width="3.5" height="3.5" />
                  <rect x="6" y="6" width="3.5" height="3.5" />
                </svg>
              ) : (
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <line x1="1.5" y1="3" x2="9.5" y2="3" />
                  <line x1="1.5" y1="5.5" x2="9.5" y2="5.5" />
                  <line x1="1.5" y1="8" x2="9.5" y2="8" />
                </svg>
              )}
              {v === "grid" ? "표지" : "목록"}
            </button>
          ))}
        </div>
      </div>

      {/* counts-row */}
      <div className="flex justify-between items-baseline mb-5">
        <div className="text-[13px] text-[var(--color-text-muted)]">
          {year === "all" ? "전체" : `${year}년`} · <b className="text-[var(--color-text)] tabular-nums font-bold">{filteredCount}</b>호
        </div>
      </div>

      {/* ── groups ──────────────────────────────────────── */}
      {groups.length === 0 ? (
        <div className="bg-white border border-[var(--color-border)] rounded-2xl p-12 text-center text-[var(--color-text-muted)]">
          조건에 맞는 주보가 없습니다.
        </div>
      ) : (
        groups.map((g) => (
          <section key={`${g.year}-${g.quarter}`} className="mb-9">
            <div className="flex items-center gap-3 pb-2.5 border-b border-[var(--color-text)] mb-5">
              <h3 className="text-lg font-bold tracking-tight">
                {g.year} · {g.label}
              </h3>
              <span className="text-[11px] px-2.5 py-1 bg-[var(--color-surface-warm)] text-[var(--color-text-muted)] rounded-full font-bold tabular-nums">
                {g.items.length}호
              </span>
              <span className="ml-auto text-[12px] text-[var(--color-text-muted)]">{g.year}.{g.range}</span>
            </div>

            {view === "grid" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {g.items.map((b) => (
                  <BulletinCard key={b.id} b={b} formatPub={formatPub} formatShort={formatShort} parishName={parishName} onView={viewPdf} />
                ))}
              </div>
            ) : (
              <ul className="border border-[var(--color-border)] rounded-xl overflow-hidden bg-white divide-y divide-[var(--color-border)]">
                {g.items.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => viewPdf(b)}
                      disabled={!b.pdf_url}
                      className="w-full flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-[var(--color-surface-warm)] disabled:opacity-50 text-left"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <span className="shrink-0 text-[12px] tabular-nums font-bold text-[var(--color-text-muted)] w-12">
                          {b.issue_number ? `제${b.issue_number}호` : "—"}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold truncate">{b.liturgical_season ?? "주보"}</p>
                          <p className="text-[11px] text-[var(--color-text-muted)] tabular-nums mt-0.5">{formatPub(b.published_date)}</p>
                        </div>
                      </div>
                      <span className="text-[12px] text-[var(--color-primary)] font-semibold shrink-0">{b.pdf_url ? "보기 →" : "준비 중"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))
      )}
    </div>
  );
}

function BulletinCard({
  b, formatPub, formatShort, parishName, onView,
}: {
  b: Bulletin;
  formatPub: (iso: string) => string;
  formatShort: (iso: string) => string;
  parishName: string;
  onView: (b: Bulletin) => void;
}) {
  const isEaster = (b.liturgical_season ?? "").includes("부활 대축일");
  return (
    <button
      type="button"
      onClick={() => onView(b)}
      disabled={!b.pdf_url}
      className="text-left flex flex-col gap-3 p-4 bg-white border border-[var(--color-border)] rounded-2xl hover:-translate-y-0.5 hover:border-[var(--color-text-muted)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div
        className="relative aspect-[210/297] rounded-lg overflow-hidden flex flex-col items-center justify-between text-center p-4"
        style={{
          background: isEaster ? "rgba(122,31,43,0.06)" : "var(--color-surface-warm)",
          border: "1px solid var(--color-border)",
        }}
      >
        <span className="text-xl sm:text-2xl" style={{ color: isEaster ? "var(--color-primary)" : "var(--color-accent, #C9A961)" }}>✠</span>
        <div className="text-[10px] sm:text-[11px] font-bold leading-snug text-[var(--color-text)]">
          {parishName}<br />{isEaster ? "부활 특집호" : "주보"}
        </div>
        <div className="mt-auto text-[9px] sm:text-[10px] font-bold text-[var(--color-text-muted)] tabular-nums">
          {b.issue_number ? `${b.issue_number}호 · ${formatShort(b.published_date)}` : formatShort(b.published_date)}
        </div>
      </div>

      <div className="flex flex-col gap-0.5">
        {b.issue_number != null && (
          <span className={`text-[10px] tracking-wider font-bold ${isEaster ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"}`}>
            제 {b.issue_number} 호{isEaster ? " · 특집" : ""}
          </span>
        )}
        <h4 className="text-[14px] font-bold tracking-tight leading-snug line-clamp-2 min-h-[2.6em]">
          {b.liturgical_season ?? "주보"}
        </h4>
        <span className="text-[11px] text-[var(--color-text-muted)] tabular-nums">{formatPub(b.published_date)}</span>
      </div>

      <div className="mt-auto pt-2 border-t border-dashed border-[var(--color-border)] flex items-center justify-between">
        <span className="text-[10px] text-[var(--color-text-muted)] tabular-nums">
          {b.pdf_url ? "PDF 보기" : "준비 중"}
        </span>
        {b.pdf_url && (
          <span className="text-[var(--color-primary)] text-[11px] font-semibold inline-flex items-center gap-1">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6">
              <line x1="3" y1="7" x2="11" y2="7" />
              <polyline points="7 3 11 7 7 11" />
            </svg>
          </span>
        )}
      </div>
    </button>
  );
}
