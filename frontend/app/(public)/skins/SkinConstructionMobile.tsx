import Link from "next/link";
import { buildMassRows, type MassEntry } from "@/lib/mass";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Parish { name: string; mass_schedule?: { entries?: MassEntry[] } | null; }
interface GospelToday { date: string; liturgical_season: string | null; gospel_reference: string | null; gospel_text: string | null; }
interface SummaryPhase { id: number; name: string; status: string; progress_percent: number; description?: string | null; }
interface ConstructionSummary { current_phase: SummaryPhase | null; overall_percent: number; total_phases: number; completed_phases: number; latest_journal: { entry_date: string; note: string } | null; }
interface Phase { id: number; name: string; status: string; progress_percent: number; sort_order: number; started_at?: string | null; completed_at?: string | null; expected_completion_date: string | null; description?: string | null; }
interface NoticeBrief { id: number; title: string; is_pinned: boolean; created_at: string; }
interface EventBrief { id: number; title: string; event_date: string; event_kind: string | null; }
interface Reflection { id: number; title: string; body: string; }
interface GalleryPhoto { id: number; title: string; thumbnail_url: string; source: "liturgy" | "events"; }

function mmdd(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}
function yearMonth(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** 시안 v3 모바일 — 함께 짓는 성전 (home-v3-mobile.html 재현). */
export default function SkinConstructionMobile({
  parish, gospel, notices, events, construction, phases, offeringCount, reflection, gallery,
}: {
  parish: Parish | null;
  gospel: GospelToday | null;
  notices: NoticeBrief[];
  events: EventBrief[];
  construction: ConstructionSummary | null;
  phases: Phase[];
  offeringCount: number;
  reflection: Reflection | null;
  gallery: GalleryPhoto[];
}) {
  const massRows = buildMassRows(parish?.mass_schedule?.entries ?? []);
  const overallPct = Math.max(0, Math.min(100, construction?.overall_percent ?? 0));
  const sortedPhases = [...phases].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  let curIdx = sortedPhases.findIndex((p) => p.status === "in_progress");
  if (curIdx < 0) curIdx = sortedPhases.findIndex((p) => p.status !== "completed");
  const curPhase = curIdx >= 0 ? sortedPhases[curIdx] : null;
  const total = sortedPhases.length;
  const completed = construction?.completed_phases ?? 0;
  const lastPhase = sortedPhases[sortedPhases.length - 1];
  const journal = construction?.latest_journal ?? null;

  return (
    <div className="skin-m-construction">
      {/* hero */}
      <section className="hero">
        <div className="hero-eyebrow">
          <span>Cathedral Build</span>
          <span className="live">LIVE</span>
        </div>
        <h1 className="hero-headline">한 단계씩,<br /><em>함께 짓는</em><br />새 성전.</h1>
        <p className="hero-sub">
          {parish?.name ?? "본당"}의 새 성전이 한 단계씩 자라나고 있습니다.
          기도와 봉헌으로 함께해 주신 모든 분의 이름 위에 한 장의 벽돌이 더해집니다.
        </p>
      </section>

      {/* cathedral visualization */}
      <div className="vis-card">
        <svg viewBox="0 0 320 320" className="vis-svg" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" preserveAspectRatio="xMidYMid meet">
          <line x1="20" y1="280" x2="300" y2="280" strokeWidth="1" />
          <rect x="100" y="170" width="120" height="110" /><polygon points="100,170 160,110 220,170" />
          <rect x="70" y="200" width="30" height="80" /><rect x="220" y="200" width="30" height="80" />
          <line x1="70" y1="200" x2="100" y2="170" /><line x1="220" y1="170" x2="250" y2="200" />
          <rect x="150" y="60" width="20" height="110" /><polygon points="150,60 160,30 170,60" />
          <line x1="160" y1="30" x2="160" y2="14" strokeWidth="1.6" /><line x1="155" y1="22" x2="165" y2="22" strokeWidth="1.6" />
          <circle cx="160" cy="200" r="14" stroke="currentColor" />
          <line x1="160" y1="186" x2="160" y2="214" strokeWidth="0.8" opacity="0.5" />
          <line x1="146" y1="200" x2="174" y2="200" strokeWidth="0.8" opacity="0.5" />
          <path d="M148 280 Q148 240 160 240 Q172 240 172 280" />
          <rect x="80" y="220" width="10" height="20" /><rect x="230" y="220" width="10" height="20" />
          <g className="scaffold">
            <line x1="60" y1="80" x2="60" y2="280" /><line x1="60" y1="100" x2="100" y2="100" />
            <line x1="60" y1="140" x2="100" y2="140" /><line x1="60" y1="180" x2="80" y2="180" /><line x1="60" y1="220" x2="80" y2="220" />
          </g>
          <g className="crane">
            <line x1="250" y1="280" x2="250" y2="40" strokeWidth="1.2" />
            <line x1="250" y1="40" x2="200" y2="50" strokeWidth="1.2" /><line x1="250" y1="40" x2="290" y2="40" strokeWidth="1.2" />
            <line x1="220" y1="50" x2="220" y2="68" strokeWidth="1" /><rect x="214" y="68" width="12" height="10" strokeWidth="1" />
          </g>
        </svg>
        <div className="vis-pct"><b>{overallPct}<sup>%</sup></b><span>완료</span></div>
        <div className="vis-overlay">
          <span className="dot" />
          <div className="info">
            <b>{curPhase ? `${curPhase.name} 진행 중` : "건축 진행 중"}</b>
            <span>{journal?.note ?? curPhase?.description ?? "성전 건축 진행 중"}</span>
          </div>
          {journal && <div className="day">{new Date(journal.entry_date).getFullYear()}<br />{mmdd(journal.entry_date)}</div>}
        </div>
      </div>

      {/* CTA */}
      <div className="cta-row">
        <Link href="/construction" className="btn btn-ink">건축 현황
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="3 2 7 5.5 3 9" /></svg>
        </Link>
        <Link href="/boards/build_offering" className="btn btn-ghost">한 줄 봉헌 ✍︎</Link>
      </div>

      {/* KPI 2x2 */}
      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-icon"><svg viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 19V8l8-5 8 5v11" /><rect x="9" y="13" width="4" height="6" /></svg></div>
          <div className="kpi-text"><div className="kpi-num">{completed} / {total}</div><div className="kpi-label">완료 단계</div></div>
        </div>
        <div className="kpi">
          <div className="kpi-icon"><svg viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8" /><polyline points="11 6 11 11 14 13" /></svg></div>
          <div className="kpi-text"><div className="kpi-num">{yearMonth(lastPhase?.expected_completion_date ?? null)}</div><div className="kpi-label">입당 예정</div></div>
        </div>
        <div className="kpi">
          <div className="kpi-icon"><svg viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11 19s-7-4-7-10a4 4 0 0 1 7-3 4 4 0 0 1 7 3c0 6-7 10-7 10z" /></svg></div>
          <div className="kpi-text"><div className="kpi-num">{offeringCount.toLocaleString("ko-KR")}<sup> 줄</sup></div><div className="kpi-label">한 줄 봉헌</div></div>
        </div>
        <div className="kpi">
          <div className="kpi-icon"><svg viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="7" r="3" /><path d="M4 19c0-4 3-7 7-7s7 3 7 7" /></svg></div>
          <div className="kpi-text"><div className="kpi-num">{events.length} 건</div><div className="kpi-label">다가오는 일정</div></div>
        </div>
      </div>

      {/* timeline */}
      {total > 0 && (
        <>
          <div className="s-title">
            <div className="s-eyebrow">단계별 진행 — Build Timeline</div>
            <h2>다섯 단계,<br /><em>다섯 번의 봉헌.</em></h2>
            <p>기공식부터 입당까지. 본당의 새 성전이 완성되기까지의 단계를 매주 주보에 기록합니다.</p>
          </div>
          <div className="timeline">
            {sortedPhases.map((p) => {
              const node = p.status === "completed" ? "done" : p.status === "in_progress" ? "cur" : "";
              const statusCls = p.status === "completed" ? "done" : p.status === "in_progress" ? "cur" : "next";
              const statusLabel = p.status === "completed" ? "완료" : p.status === "in_progress" ? `진행 중 · ${p.progress_percent}%` : "대기 중";
              const dateText = p.status === "completed"
                ? (p.completed_at ? `~ ${mmdd(p.completed_at)} 완료` : "완료")
                : (p.expected_completion_date ? `예상 ${mmdd(p.expected_completion_date)} 완료` : "");
              return (
                <div key={p.id} className={`tl-item ${node}`}>
                  <div className="tl-row"><span className="tl-name">{p.name}</span><span className={`tl-status ${statusCls}`}>{statusLabel}</span></div>
                  {dateText && <div className="tl-date">{dateText}</div>}
                  {p.status === "in_progress" && p.description && <p className="tl-desc">{p.description}</p>}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* gospel dark block */}
      <article className="gospel-block">
        <div className="e">오늘의 복음 · Today&apos;s Gospel</div>
        <h3>{gospel?.gospel_text ? gospel.gospel_text.replace(/\n/g, " ").slice(0, 70) : "오늘의 복음 본문이 곧 게재됩니다."}</h3>
        <div className="meta">
          {gospel?.gospel_reference && <span><strong>{gospel.gospel_reference}</strong></span>}
          <span>{mmdd(gospel?.date ?? "")}{gospel?.liturgical_season ? ` · ${gospel.liturgical_season}` : ""}</span>
        </div>
        <div className="btns">
          <Link href="/word" className="gb-btn">전체 복음 →</Link>
          <Link href="/meditation" className="gb-btn2">주일 묵상</Link>
        </div>
      </article>

      {/* mass */}
      <article className="mass-block">
        <div className="head">
          <div><small>Mass Schedule</small><h3>미사 시간</h3></div>
          <span style={{ fontSize: 11, color: "var(--ink-3)" }}>매주</span>
        </div>
        <ul>
          {massRows.map((r, i) => (
            <li key={i} className={r.label.includes("주일") ? "sun" : ""}>
              <span className="day">{r.label}</span><span className="time">{r.value}</span><span className="lbl" />
            </li>
          ))}
        </ul>
      </article>

      {/* community */}
      <div className="s-title">
        <div className="s-eyebrow">본당 소식 · Community</div>
        <h2>한 주의 공동체 일.</h2>
      </div>
      <article className="notice" style={{ marginTop: 16 }}>
        <div className="head">
          <h3>공지사항</h3>
          <Link href="/boards/notice">전체 →</Link>
        </div>
        <div className="nt-tabs"><span className="on">전체</span><span>공지</span><span>행사·모임</span></div>
        <ul>
          {notices.length === 0 ? (
            <li><span className="nopin" /><span className="ttl">등록된 공지가 없습니다</span><span /></li>
          ) : notices.slice(0, 5).map((n) => (
            <li key={n.id}>
              {n.is_pinned ? <span className="pin">고정</span> : <span className="nopin" />}
              <Link href={`/boards/notice/${n.id}`} className="ttl">{n.title}</Link>
              <span className="dt">{mmdd(n.created_at)}</span>
            </li>
          ))}
        </ul>
      </article>

      {/* reflection */}
      {reflection && (
        <article className="reflection">
          <div className="e">주일 말씀 묵상</div>
          <h3>{reflection.title}</h3>
          <div className="meta"><b>주일 말씀 묵상</b> · {mmdd(gospel?.date ?? "")}</div>
          {reflection.body.split("\n").filter(Boolean).slice(0, 2).map((para, i) => <p key={i}>{para.slice(0, 110)}</p>)}
          <Link href="/meditation" className="more">묵상 전체 읽기 →</Link>
        </article>
      )}

      {/* gallery */}
      <section className="gallery-wide">
        <div className="head">
          <h2><small>Photo Gallery</small>모든 날 모든 순간</h2>
          <Link href="/gallery">모두 →</Link>
        </div>
        <div className="gw-strip">
          {gallery.length === 0 ? (
            <div className="gw-item tall"><div className="ph">사진 준비 중</div></div>
          ) : gallery.map((p, i) => (
            <Link key={p.id} href={p.source === "events" ? `/gallery/events/${p.id}` : "/gallery/liturgy"} className={`gw-item ${i % 3 === 0 ? "wide" : "tall"}`}>
              <img src={`${API}${p.thumbnail_url}`} alt={p.title} />
              <span className="gw-cap">{p.title}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* closing */}
      <section className="closing">
        <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4"><line x1="16" y1="4" x2="16" y2="28" /><line x1="9" y1="11" x2="23" y2="11" /></svg>
        <p>&ldquo;너는 베드로이다.<br />나는 이 반석 위에 내<br />교회를 세우겠다.&rdquo;</p>
        <cite>— 마태오 16,18</cite>
      </section>
    </div>
  );
}
