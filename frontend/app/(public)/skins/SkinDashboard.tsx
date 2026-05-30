import Link from "next/link";
import ThumbnailImage from "@/components/ThumbnailImage";
import { buildMassRows, type MassEntry } from "@/lib/mass";
import NoticeEventsTabs from "./NoticeEventsTabs";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Parish {
  name: string;
  mass_schedule?: { entries?: MassEntry[] } | null;
}
interface GospelToday {
  date: string;
  liturgical_season: string | null;
  gospel_reference: string | null;
  gospel_text: string | null;
}
interface SummaryPhase { id: number; name: string; status: string; progress_percent: number; description?: string | null; }
interface ConstructionSummary {
  current_phase: SummaryPhase | null;
  overall_percent: number;
  total_phases: number;
  completed_phases: number;
}
interface Phase {
  id: number; name: string; status: string; progress_percent: number;
  sort_order: number; expected_completion_date: string | null; description?: string | null;
}
interface Fund { goal_amount: number; raised_amount: number; donor_count: number; is_active: boolean; }
interface NoticeBrief { id: number; title: string; is_pinned: boolean; created_at: string; }
interface EventBrief { id: number; title: string; event_date: string; event_kind: string | null; }
interface Reflection { id: number; title: string; body: string; }
interface GalleryPhoto { id: number; title: string; thumbnail_url: string; source: "liturgy" | "events"; }

const STATUS_LABEL: Record<string, string> = { planned: "예정", in_progress: "진행 중", completed: "완료" };

function mmdd(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * 시안 v2 — 대시보드 카드 (home-v2.html 정밀 재현).
 * page-head + 12-grid: gospel·mass·construction·오늘의전례·quick5·notice·calendar·offering·reflection·gallery.
 */
export default function SkinDashboard({
  parish, gospel, notices, events, construction, phases, fund,
  latestIssue, offeringCount, reflection, gallery,
}: {
  parish: Parish | null;
  gospel: GospelToday | null;
  notices: NoticeBrief[];
  events: EventBrief[];
  construction: ConstructionSummary | null;
  phases: Phase[];
  fund: Fund | null;
  latestIssue: number | null;
  offeringCount: number;
  reflection: Reflection | null;
  gallery: GalleryPhoto[];
}) {
  const massRows = buildMassRows(parish?.mass_schedule?.entries ?? []);
  const overallPct = Math.max(0, Math.min(100, construction?.overall_percent ?? 0));

  // 건축 현재 단계 / Stage N of M
  const sortedPhases = [...phases].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  let curIdx = sortedPhases.findIndex((p) => p.status === "in_progress");
  if (curIdx < 0) curIdx = sortedPhases.findIndex((p) => p.status !== "completed");
  const curPhase = curIdx >= 0 ? sortedPhases[curIdx] : null;
  const stageNum = curIdx >= 0 ? curIdx + 1 : sortedPhases.length;
  const totalStages = sortedPhases.length;

  // 캘린더 — 현재 월 그리드 + 행사 있는 날 표시
  const now = new Date();
  const calY = now.getFullYear();
  const calM = now.getMonth();
  const todayDate = now.getDate();
  const firstDow = new Date(calY, calM, 1).getDay();
  const daysInMonth = new Date(calY, calM + 1, 0).getDate();
  const prevMonthDays = new Date(calY, calM, 0).getDate();
  const eventDays = new Set(
    events
      .filter((e) => { const d = new Date(e.event_date); return d.getFullYear() === calY && d.getMonth() === calM; })
      .map((e) => new Date(e.event_date).getDate()),
  );

  // 다가오는 일정 8건 — 오늘 이후, 날짜 오름차순. v1.5.408 caled 카드 우측 목록용.
  const todayStart = new Date(calY, calM, todayDate, 0, 0, 0).getTime();
  const upcomingEvents = events
    .filter((e) => new Date(e.event_date).getTime() >= todayStart)
    .sort((a, b) => a.event_date.localeCompare(b.event_date))
    .slice(0, 8);
  type Cell = { day: number; muted: boolean; today: boolean; has: boolean; dow: number };
  const cells: Cell[] = [];
  for (let i = firstDow - 1; i >= 0; i--) cells.push({ day: prevMonthDays - i, muted: true, today: false, has: false, dow: 0 });
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = (firstDow + d - 1) % 7;
    cells.push({ day: d, muted: false, today: d === todayDate, has: eventDays.has(d), dow });
  }
  let nextDay = 1;
  while (cells.length < 42) cells.push({ day: nextDay++, muted: true, today: false, has: false, dow: 0 });

  const quickLinks = [
    { href: "/about", label: "성당 안내", en: "About",
      icon: <path d="M3 19V8l8-5 8 5v11M9 13h4v6" /> },
    { href: "/bulletin", label: "주보 아카이브", en: "Bulletin",
      icon: <><rect x="3" y="4" width="16" height="14" /><line x1="3" y1="9" x2="19" y2="9" /></> },
    { href: "/prayer", label: "기도문", en: "Prayers",
      icon: <><circle cx="11" cy="8" r="4" /><path d="M7 14l4 6 4-6" /></> },
    { href: "/saints", label: "성인 사전", en: "Saints",
      icon: <><line x1="11" y1="3" x2="11" y2="19" /><line x1="5" y1="9" x2="17" y2="9" /></> },
    { href: "/catechumen", label: "예비신자 안내", en: "Catechumen",
      icon: <><circle cx="11" cy="11" r="8" /><path d="M5 11h12M11 3a14 14 0 0 1 0 16" /></> },
  ];

  return (
    <div className="skin-dashboard">
      {/* page head */}
      <div className="page-head">
        <h1>
          <small>{parish?.name ? `${parish.name} · Dashboard` : "St. Peter's · Dashboard"}</small>
          환영합니다, 오늘 공동체의 하루입니다.
        </h1>
        <div className="head-meta">
          {/* v1.5.410 — 각 KPI 를 클릭 가능 링크로 매핑.
                주보 → /bulletin, 진행률 → /construction, 일정 → /calendar/upcoming(신규). */}
          <Link href="/bulletin" className="kpi"><b>제 {latestIssue ?? "—"} 호</b><span>이번 주 주보</span></Link>
          <Link href="/construction" className="kpi"><b>{overallPct}%</b><span>성전 진행</span></Link>
          <Link href="/calendar/upcoming" className="kpi"><b>{events.length} 건</b><span>다가오는 일정</span></Link>
        </div>
      </div>

      {/* dashboard */}
      <main className="dash">
        <div className="grid12">

          {/* Gospel (col-8) */}
          <article className="card gospel col-8">
            <div className="card-head">
              <span className="card-eyebrow">오늘의 복음 · Today&apos;s Gospel</span>
              <Link href="/word" className="card-link">전체 미사 말씀 →</Link>
            </div>
            <p className="gospel-quote">
              <span className="q">&ldquo;</span>
              {gospel?.gospel_text
                ? gospel.gospel_text.split("\n").filter(Boolean).slice(0, 2).join(" ").slice(0, 90)
                : "오늘의 복음 본문이 곧 게재됩니다."}
              <span className="q">&rdquo;</span>
            </p>
            <div className="gospel-detail">
              <div className="gospel-bible">
                {gospel?.gospel_reference && <strong>{gospel.gospel_reference}</strong>}
                {gospel?.liturgical_season ?? "매일미사 — 매일 자동 업데이트"}
              </div>
              <Link href="/meditation" className="gospel-action">
                묵상 읽기
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 2 8 6 4 10" /></svg>
              </Link>
            </div>
          </article>

          {/* Mass (col-4) */}
          <article className="card col-4">
            <div className="card-head">
              <div>
                <span className="card-eyebrow" style={{ display: "block", marginBottom: 4 }}>Mass Schedule</span>
                <h3>미사 시간</h3>
              </div>
              <span className="tag dot pri">변경 가능</span>
            </div>
            <ul className="mass-list">
              {massRows.length === 0 ? (
                <li><span className="day">—</span><span className="time">등록된 미사 시간이 없습니다</span><span /></li>
              ) : (
                massRows.map((r, i) => (
                  <li key={i} className={r.label.includes("주일") ? "sun" : ""}>
                    <span className="day">{r.label}</span>
                    <span className="time">{r.value}</span>
                    <span className="label" />
                  </li>
                ))
              )}
            </ul>
          </article>

          {/* Construction (col-6) */}
          <article className="con-card col-6">
            <svg className="con-illustration" viewBox="0 0 200 200" fill="none" stroke="var(--primary)" strokeWidth="1.4">
              <rect x="60" y="100" width="80" height="80" />
              <polygon points="60,100 100,60 140,100" />
              <rect x="90" y="40" width="20" height="60" />
              <polygon points="90,40 100,20 110,40" />
              <line x1="100" y1="20" x2="100" y2="8" />
              <line x1="96" y1="14" x2="104" y2="14" />
              <circle cx="100" cy="120" r="5" />
              <line x1="74" y1="130" x2="74" y2="160" />
              <line x1="126" y1="130" x2="126" y2="160" />
              <path d="M92 180 Q92 140 100 140 Q108 140 108 180" />
            </svg>
            <div className="card-head">
              <div>
                <span className="card-eyebrow" style={{ display: "block", marginBottom: 4 }}>함께 짓는 성전</span>
                <h3>성전 건축 진행 현황</h3>
              </div>
              <span className="tag acc dot">{curPhase ? STATUS_LABEL[curPhase.status] ?? "진행 중" : "진행 중"}</span>
            </div>
            <div className="con-pct-row">
              <span className="con-pct">{overallPct}<sup>%</sup></span>
              <span className="con-stage-name">
                {totalStages > 0 && <span>Stage {stageNum} of {totalStages}</span>}
                {curPhase?.name ?? "준비 중"}
              </span>
            </div>
            <div className="con-bar"><i style={{ width: `${overallPct}%` }} /></div>
            <div className="con-foot">
              <span>{curPhase?.description ?? "건축 단계 진행 중"}</span>
              {curPhase?.expected_completion_date && <span>예상 완료 <strong>{curPhase.expected_completion_date}</strong></span>}
            </div>
          </article>

          {/* Today / 전례 (col-6) */}
          <article className="card col-6">
            <div className="card-head">
              <div>
                <span className="card-eyebrow" style={{ display: "block", marginBottom: 4 }}>Today · 오늘의 전례</span>
                <h3>{gospel?.liturgical_season ?? "오늘의 전례"}</h3>
              </div>
              <Link href="/word" className="card-link">전례력 →</Link>
            </div>
            <div className="patron-card">
              <div className="patron-img"><div className="ph">전례<br />이미지</div></div>
              <div className="patron-body">
                <h4>{gospel?.gospel_reference ?? "오늘의 말씀"}</h4>
                {gospel?.liturgical_season && <div className="feast">{gospel.liturgical_season}</div>}
                <p>{gospel?.gospel_text ? gospel.gospel_text.replace(/\n/g, " ").slice(0, 110) : "오늘의 복음과 전례 안내가 곧 게재됩니다."}</p>
              </div>
            </div>
          </article>

          {/* Quick actions (col-12) */}
          <div className="col-12 quick-row">
            {quickLinks.map((q) => (
              <Link key={q.href} href={q.href} className="quick-pill">
                <span className="q-icon">
                  <svg width="20" height="20" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.4">{q.icon}</svg>
                </span>
                <span className="q-text"><strong>{q.label}</strong><span>{q.en}</span></span>
              </Link>
            ))}
          </div>

          {/* Notice + Calendar + Offering 한 행 — 비율 4.5:3.5:2 (v1.5.416).
              .grid12 는 정수 col-N 만 지원하므로 col-12 wrapper 안에 자체 grid 적용 (.three-card-row).
              모바일에서는 globals.css 미디어쿼리로 1fr stack. */}
          <div className="col-12 three-card-row">
          {/* Notice + 행사·모임 탭 — 같은 카드 안 탭으로 전환 (v1.5.409) */}
          <article className="card">
            <div className="card-head">
              <div>
                <span className="card-eyebrow" style={{ display: "block", marginBottom: 4 }}>Notice · Events</span>
                <h3>공지사항 · 행사</h3>
              </div>
              <Link href="/boards/notice" className="card-link">전체 보기 →</Link>
            </div>
            <NoticeEventsTabs notices={notices} events={upcomingEvents} />
          </article>

          {/* Calendar — 미니 캘린더 */}
          <article className="card calendar-mini">
            <div className="card-head" style={{ marginBottom: 14 }}>
              <div>
                <span className="card-eyebrow" style={{ display: "block", marginBottom: 4 }}>Calendar</span>
                <h3>{calM + 1}월 행사</h3>
              </div>
            </div>
            <div className="cal-head">
              <span className="cal-month">{calY} · {calM + 1}월</span>
              <div className="cal-nav">
                <Link href="/calendar" aria-label="달력" style={{ width: 26, height: 26, borderRadius: "50%", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4"><polyline points="6 2 3 5 6 8" /></svg>
                </Link>
                <Link href="/calendar" aria-label="달력" style={{ width: 26, height: 26, borderRadius: "50%", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4"><polyline points="4 2 7 5 4 8" /></svg>
                </Link>
              </div>
            </div>
            <div className="cal-grid">
              {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
                <span key={d} className={`dow${i === 0 ? " sun" : ""}`}>{d}</span>
              ))}
              {cells.map((c, i) => (
                <span
                  key={i}
                  className={`day${c.muted ? " muted" : ""}${!c.muted && c.dow === 0 ? " sun" : ""}${c.today ? " today" : ""}${c.has ? " has" : ""}`}
                >
                  {c.day}
                </span>
              ))}
            </div>
          </article>

          {/* Offering — 한 줄 봉헌 */}
          <article className="card offering">
            <div className="card-head">
              <div>
                <span className="card-eyebrow" style={{ display: "block", marginBottom: 4 }}>성전 건축</span>
                <h3>한 줄 봉헌</h3>
              </div>
            </div>
            <div className="offering-amt">{offeringCount.toLocaleString("ko-KR")}<span style={{ fontSize: 18, fontWeight: 600, opacity: 0.7 }}> 줄</span></div>
            <div className="offering-sub">함께 모은 봉헌의 마음</div>
            <Link href="/offering" className="offering-cta">한 줄 남기기 ✍︎</Link>
          </article>
          </div>{/* /3-card row */}

          {/* Reflection (col-12) */}
          {reflection && (
            <div className="col-12">
              <div className="reflection">
                <div className="card-head">
                  <div>
                    <span className="card-eyebrow" style={{ display: "block", marginBottom: 4 }}>주일 말씀 묵상 · Sunday Reflection</span>
                    <h3>{reflection.title}</h3>
                  </div>
                  <span className="meta"><b>주일 말씀 묵상</b></span>
                </div>
                <p>{reflection.body.replace(/\n/g, " ").slice(0, 220)}…</p>
                <Link href="/meditation" className="more">묵상 전체 읽기 →</Link>
              </div>
            </div>
          )}

          {/* Gallery (col-12) */}
          <article className="card gallery-card">
            <div className="gallery-card-head">
              <h3><small>Photo Gallery</small>사진 갤러리</h3>
              <div className="gallery-tabs">
                <Link href="/gallery/liturgy">전례 사진</Link>
                <Link href="/gallery/events">행사 사진</Link>
                <Link href="/gallery">모든 순간 →</Link>
              </div>
            </div>
            <div className="gallery-strip">
              {Array.from({ length: 6 }).map((_, i) => {
                const p = gallery[i];
                if (!p) return <div key={i} className="gi"><div className="ph">사진 준비 중</div></div>;
                const href = p.source === "events" ? `/gallery/events/${p.id}` : "/gallery/liturgy";
                return (
                  <Link key={p.id} href={href} className="gi">
                    <ThumbnailImage src={p.thumbnail_url} alt={p.title} />
                  </Link>
                );
              })}
            </div>
          </article>

        </div>
      </main>
    </div>
  );
}
