import Link from "next/link";
import { buildMassRows, type MassEntry } from "@/lib/mass";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Parish { name: string; mass_schedule?: { entries?: MassEntry[] } | null; }
interface GospelToday { date: string; liturgical_season: string | null; gospel_reference: string | null; gospel_text: string | null; }
interface SummaryPhase { id: number; name: string; status: string; progress_percent: number; description?: string | null; }
interface ConstructionSummary { current_phase: SummaryPhase | null; overall_percent: number; total_phases: number; completed_phases: number; }
interface Phase { id: number; name: string; status: string; progress_percent: number; sort_order: number; expected_completion_date: string | null; description?: string | null; }
interface NoticeBrief { id: number; title: string; is_pinned: boolean; created_at: string; }
interface EventBrief { id: number; title: string; event_date: string; event_kind: string | null; }
interface Reflection { id: number; title: string; body: string; }
interface GalleryPhoto { id: number; title: string; thumbnail_url: string; source: "liturgy" | "events"; }

function mmdd(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

/** 시안 v2 모바일 — 대시보드 카드 (home-v2-mobile.html 재현). */
export default function SkinDashboardMobile({
  parish, gospel, notices, events, construction, phases, offeringCount, reflection, gallery,
}: {
  parish: Parish | null;
  gospel: GospelToday | null;
  notices: NoticeBrief[];
  events: EventBrief[];
  construction: ConstructionSummary | null;
  phases: Phase[];
  latestIssue: number | null;
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
  const stageNum = curIdx >= 0 ? curIdx + 1 : sortedPhases.length;

  // 캘린더 현재월
  const now = new Date();
  const calY = now.getFullYear(); const calM = now.getMonth(); const todayDate = now.getDate();
  const firstDow = new Date(calY, calM, 1).getDay();
  const daysInMonth = new Date(calY, calM + 1, 0).getDate();
  const prevDays = new Date(calY, calM, 0).getDate();
  const eventDays = new Set(events.filter((e) => { const d = new Date(e.event_date); return d.getFullYear() === calY && d.getMonth() === calM; }).map((e) => new Date(e.event_date).getDate()));
  type Cell = { day: number; m: boolean; t: boolean; h: boolean; dow: number };
  const cells: Cell[] = [];
  for (let i = firstDow - 1; i >= 0; i--) cells.push({ day: prevDays - i, m: true, t: false, h: false, dow: 0 });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, m: false, t: d === todayDate, h: eventDays.has(d), dow: (firstDow + d - 1) % 7 });
  let nd = 1; while (cells.length < 42) cells.push({ day: nd++, m: true, t: false, h: false, dow: 0 });

  const quicks = [
    { href: "/about", label: "성당 안내", en: "About", icon: <><path d="M3 19V8l8-5 8 5v11" /><rect x="9" y="13" width="4" height="6" /></> },
    { href: "/bulletin", label: "주보", en: "Bulletin", icon: <><rect x="3" y="4" width="16" height="14" /><line x1="3" y1="9" x2="19" y2="9" /></> },
    { href: "/prayer", label: "기도문", en: "Prayers", icon: <><circle cx="11" cy="8" r="4" /><path d="M7 14l4 6 4-6" /></> },
    { href: "/saints", label: "성인 사전", en: "Saints", icon: <><line x1="11" y1="3" x2="11" y2="19" /><line x1="5" y1="9" x2="17" y2="9" /></> },
  ];

  return (
    <div className="skin-m-dashboard">
      <div className="page-head">
        <div className="greeting">오늘의 공동체 · Today{gospel?.liturgical_season && <span className="liturgy">{gospel.liturgical_season}</span>}</div>
        <h1>안녕하세요,<br />오늘 공동체의 하루입니다.</h1>
      </div>

      <div className="stack">
        {/* gospel */}
        <article className="card gospel-c">
          <div className="card-head">
            <div><span className="card-eyebrow">오늘의 복음</span><h3>Today&apos;s Gospel</h3></div>
            <Link href="/word" className="card-link">전체 →</Link>
          </div>
          <p className="gospel-q">
            <span className="q">&ldquo;</span>
            {gospel?.gospel_text ? gospel.gospel_text.split("\n").filter(Boolean).slice(0, 2).join(" ").slice(0, 70) : "오늘의 복음 본문이 곧 게재됩니다."}
            <span className="q">&rdquo;</span>
          </p>
          <div className="bible">
            {gospel?.gospel_reference && <strong>{gospel.gospel_reference}</strong>}
            {gospel?.gospel_text ? gospel.gospel_text.replace(/\n/g, " ").slice(0, 60) : ""}
          </div>
          <div className="btn-row">
            <Link href="/meditation" className="btn-acc">묵상 읽기 →</Link>
            <Link href="/word" className="btn-line">미사 말씀</Link>
          </div>
        </article>

        {/* mass */}
        <article className="card mass-c">
          <div className="card-head">
            <div><span className="card-eyebrow">Mass Schedule</span><h3>미사 시간</h3></div>
            <span className="tag dot">변경 가능</span>
          </div>
          <ul>
            {massRows.map((r, i) => (
              <li key={i} className={r.label.includes("주일") ? "sun" : ""}>
                <span className="day">{r.label}</span><span className="time">{r.value}</span><span className="lbl" />
              </li>
            ))}
          </ul>
        </article>

        {/* construction */}
        {construction && construction.total_phases > 0 && (
          <article className="card con-c">
            <svg className="vis" viewBox="0 0 200 200" fill="none" stroke="var(--primary)" strokeWidth="1.4">
              <rect x="60" y="100" width="80" height="80" /><polygon points="60,100 100,60 140,100" />
              <rect x="90" y="40" width="20" height="60" /><polygon points="90,40 100,20 110,40" />
              <circle cx="100" cy="130" r="5" />
            </svg>
            <div className="card-head">
              <div><span className="card-eyebrow">함께 짓는 성전</span><h3>건축 진행 현황</h3></div>
              <span className="tag acc dot">진행 중</span>
            </div>
            <div className="con-pct-row">
              <span className="con-pct">{overallPct}<sup>%</sup></span>
              <div className="con-stage-nm"><span>Stage {stageNum} of {sortedPhases.length}</span>{curPhase?.name ?? "준비 중"}</div>
            </div>
            <div className="con-bar"><i style={{ width: `${overallPct}%` }} /></div>
            <div className="con-foot">
              <span>{curPhase?.name ?? "건축"} 진행 중</span>
              {curPhase?.expected_completion_date && <span>완료 <strong>{curPhase.expected_completion_date}</strong></span>}
            </div>
          </article>
        )}
      </div>

      {/* quick 2x2 */}
      <div className="quick-grid">
        {quicks.map((q) => (
          <Link key={q.href} href={q.href} className="quick-pill">
            <span className="q-icon"><svg viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5">{q.icon}</svg></span>
            <span className="q-text"><strong>{q.label}</strong><span>{q.en}</span></span>
          </Link>
        ))}
      </div>

      <div className="stack">
        {/* 오늘의 전례 */}
        <article className="card patron">
          <div className="card-head">
            <div><span className="card-eyebrow">Today · 오늘의 전례</span><h3>{gospel?.liturgical_season ?? "오늘의 전례"}</h3></div>
            <Link href="/word" className="card-link">전례력 →</Link>
          </div>
          <h4>{gospel?.gospel_reference ?? "오늘의 말씀"}</h4>
          {gospel?.liturgical_season && <div className="feast">{gospel.liturgical_season}</div>}
          <p>{gospel?.gospel_text ? gospel.gospel_text.replace(/\n/g, " ").slice(0, 90) : "오늘의 복음과 전례 안내가 곧 게재됩니다."}</p>
        </article>

        {/* calendar mini */}
        <article className="card cal-c">
          <div className="card-head">
            <div><span className="card-eyebrow">Calendar</span><h3>{calM + 1}월 행사</h3></div>
            <Link href="/calendar" className="card-link">전체 →</Link>
          </div>
          <div className="cal-head">
            <span className="cal-month">{calY} · {calM + 1}월</span>
            <div className="nav-mini">
              <Link href="/calendar" aria-label="달력"><svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6"><polyline points="6 2 3 5 6 8" /></svg></Link>
              <Link href="/calendar" aria-label="달력"><svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6"><polyline points="4 2 7 5 4 8" /></svg></Link>
            </div>
          </div>
          <div className="grid">
            {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => <span key={d} className={`dow${i === 0 ? " sun" : ""}`}>{d}</span>)}
            {cells.map((c, i) => (
              <span key={i} className={`d${c.m ? " m" : ""}${!c.m && c.dow === 0 ? " s" : ""}${c.t ? " t" : ""}${c.h ? " h" : ""}`}>{c.day}</span>
            ))}
          </div>
        </article>

        {/* notice */}
        <article className="card notice-c">
          <div className="card-head">
            <div><span className="card-eyebrow">Notice · Events</span><h3>공지사항</h3></div>
            <Link href="/boards/notice" className="card-link">전체 →</Link>
          </div>
          <div className="nt-tabs"><span className="on">공지</span><Link href="/calendar"><span>행사·모임</span></Link></div>
          <ul>
            {notices.length === 0 ? (
              <li><span className="ttl" style={{ gridColumn: "1/3" }}>등록된 공지가 없습니다</span><span /></li>
            ) : notices.slice(0, 5).map((n) => (
              <li key={n.id}>
                {n.is_pinned ? <span className="pin">고정</span> : <span style={{ width: 0 }} />}
                <Link href={`/boards/notice/${n.id}`} className="ttl" style={!n.is_pinned ? { gridColumn: "1/3" } : undefined}>{n.title}</Link>
                <span className="dt">{mmdd(n.created_at)}</span>
              </li>
            ))}
          </ul>
        </article>

        {/* offering */}
        <article className="card offering-c">
          <div className="card-head">
            <div><span className="card-eyebrow">성전 건축</span><h3>한 줄 봉헌</h3></div>
          </div>
          <div className="amt">{offeringCount.toLocaleString("ko-KR")}<sub> 줄</sub></div>
          <div className="amt-sub">함께 모은 봉헌의 마음</div>
          <Link href="/offering" className="cta">한 줄 남기기 ✍︎</Link>
        </article>

        {/* reflection */}
        {reflection && (
          <article className="card reflection-c">
            <div className="card-head">
              <div><span className="card-eyebrow">주일 말씀 묵상</span><h3>{reflection.title}</h3></div>
            </div>
            <div className="meta"><b>주일 말씀 묵상</b> · {mmdd(gospel?.date ?? "")}</div>
            <p>{reflection.body.replace(/\n/g, " ").slice(0, 110)}…</p>
            <Link href="/meditation" className="more">묵상 전체 읽기 →</Link>
          </article>
        )}

        {/* gallery */}
        <article className="card gallery-c">
          <div className="card-head">
            <div><span className="card-eyebrow">Photo Gallery</span><h3>사진 갤러리</h3></div>
            <Link href="/gallery" className="card-link">모두 →</Link>
          </div>
          <div className="strip">
            {gallery.length === 0 ? (
              <div className="gi"><div className="ph">사진 준비 중</div></div>
            ) : gallery.map((p) => (
              <Link key={p.id} href={p.source === "events" ? `/gallery/events/${p.id}` : "/gallery/liturgy"} className="gi">
                <img src={`${API}${p.thumbnail_url}`} alt={p.title} />
              </Link>
            ))}
          </div>
        </article>
      </div>
    </div>
  );
}
