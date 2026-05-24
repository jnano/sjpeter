import Link from "next/link";
import { buildMassRows, type MassEntry } from "@/lib/mass";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Parish { name: string; mass_schedule?: { entries?: MassEntry[] } | null; }
interface GospelToday { date: string; liturgical_season: string | null; gospel_reference: string | null; gospel_text: string | null; }
interface SummaryPhase { id: number; name: string; status: string; progress_percent: number; }
interface ConstructionSummary { current_phase: SummaryPhase | null; overall_percent: number; total_phases: number; completed_phases: number; }
interface Phase { id: number; name: string; status: string; progress_percent: number; sort_order: number; expected_completion_date: string | null; }
interface NoticeBrief { id: number; title: string; is_pinned: boolean; created_at: string; }
interface Reflection { id: number; title: string; body: string; }
interface GalleryPhoto { id: number; title: string; thumbnail_url: string; source: "liturgy" | "events"; }

const STATUS_LABEL: Record<string, string> = { planned: "대기", in_progress: "진행 중", completed: "완료" };

function mmdd(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

/** 시안 v1 모바일 — 에디토리얼 미니멀 (home-v1-mobile.html 재현). */
export default function SkinEditorialMobile({
  parish, gospel, notices, construction, phases, reflection, gallery,
}: {
  parish: Parish | null;
  gospel: GospelToday | null;
  notices: NoticeBrief[];
  construction: ConstructionSummary | null;
  phases: Phase[];
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
  const today = new Date(gospel?.date ?? new Date().toISOString().slice(0, 10));

  const chips = [
    { href: "/about", label: "성당 안내", en: "About", icon: <><path d="M3 19V8l8-5 8 5v11" /><rect x="9" y="13" width="4" height="6" /></> },
    { href: "/bulletin", label: "주보", en: "Bulletin", icon: <><rect x="3" y="4" width="16" height="14" /><line x1="3" y1="9" x2="19" y2="9" /></> },
    { href: "/prayers", label: "기도문", en: "Prayers", icon: <><circle cx="11" cy="8" r="4" /><path d="M7 14l4 6 4-6" /></> },
    { href: "/saints", label: "성인 사전", en: "Saints", icon: <><line x1="11" y1="3" x2="11" y2="19" /><line x1="5" y1="9" x2="17" y2="9" /></> },
    { href: "/community", label: "예비신자", en: "Catechumen", icon: <><circle cx="11" cy="11" r="8" /><path d="M5 11h12M11 3a14 14 0 0 1 0 16" /></> },
  ];

  return (
    <div className="skin-m-editorial">
      {/* hero */}
      <section className="hero">
        <div className="eyebrow">오늘의 복음 · Today&apos;s Gospel</div>
        <div className="hero-meta">
          <span>{today.getMonth() + 1}월 {today.getDate()}일 · {["일", "월", "화", "수", "목", "금", "토"][today.getDay()]}요일</span>
          {gospel?.liturgical_season && <span><strong>{gospel.liturgical_season}</strong></span>}
        </div>
        <p className="gospel-q">
          <span className="q">&ldquo;</span>
          {gospel?.gospel_text ? gospel.gospel_text.split("\n").filter(Boolean).slice(0, 3).join(" ").slice(0, 70) : "오늘의 복음 본문이 곧 게재됩니다."}
          <span className="q">&rdquo;</span>
        </p>
        {gospel?.gospel_reference && <span className="cite">{gospel.gospel_reference}</span>}
        {gospel?.gospel_text && <p className="gospel-pre">{gospel.gospel_text.replace(/\n/g, " ").slice(0, 70)}…</p>}
        <div className="hero-actions">
          <Link href="/word" className="btn btn-ink">전체 복음
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="3 2 7 5.5 3 9" /></svg>
          </Link>
          <Link href="/meditation" className="btn btn-ghost">주일 묵상</Link>
        </div>
      </section>

      {/* mass */}
      <article className="mass">
        <h3>Mass Schedule</h3>
        <h2>미사 시간</h2>
        <ul>
          {massRows.map((r, i) => (
            <li key={i} className={r.label.includes("주일") ? "sun" : ""}>
              <span className="day">{r.label}</span><span className="time">{r.value}</span><span className="lbl" />
            </li>
          ))}
        </ul>
        <div className="mass-foot">
          <span>※ 변경될 수 있습니다</span>
          <Link href="/info">찾아오시는 길 →</Link>
        </div>
      </article>

      {/* chips */}
      <div className="chips">
        {chips.map((c) => (
          <Link key={c.href} href={c.href} className="chip">
            <span className="ico"><svg viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5">{c.icon}</svg></span>
            <strong>{c.label}</strong>
            <span>{c.en}</span>
          </Link>
        ))}
      </div>

      {/* construction dark */}
      {construction && construction.total_phases > 0 && (
        <section className="con-section">
          <div className="eyebrow">성전 건축 · 진행 중</div>
          <h2>함께 짓는 성전,<br /><em>한 단계씩</em><br />자라납니다.</h2>
          <div className="con-pct-row">
            <div className="top">
              <span className="con-pct">{overallPct}<sup>%</sup></span>
              <div className="con-meta-r">
                {curPhase?.expected_completion_date && <strong>{curPhase.expected_completion_date}</strong>}
                <span>예상 완료</span>
              </div>
            </div>
            <div className="con-bar"><i style={{ width: `${overallPct}%` }} /></div>
            <div className="con-stage">
              <div className="nm"><span>Stage {stageNum} of {sortedPhases.length}</span>{curPhase?.name ?? "준비 중"}</div>
            </div>
          </div>
          <ul className="con-stages-list">
            {sortedPhases.map((p, i) => {
              const cls = p.status === "completed" ? "done" : p.status === "in_progress" ? "cur" : "";
              return (
                <li key={p.id} className={cls}>
                  <span className="cs-num">{String(i + 1).padStart(2, "0")}</span>
                  <span className="cs-name">{p.name}</span>
                  <span className="cs-tag">{p.status === "in_progress" ? `진행 중 · ${p.progress_percent}%` : STATUS_LABEL[p.status] ?? "대기"}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* notice */}
      <div className="s-title">
        <div className="eyebrow">Notice · 공지</div>
        <h2>한 주의 공지사항.</h2>
      </div>
      <section className="notice">
        <div className="notice-tabs">
          <span className="on">전체</span>
          <Link href="/boards/notice"><span>공지</span></Link>
          <Link href="/calendar"><span>행사·모임</span></Link>
        </div>
        <ul>
          {notices.length === 0 ? (
            <li><span className="nopin" /><span className="ttl">등록된 공지가 없습니다</span><span /></li>
          ) : notices.slice(0, 6).map((n) => (
            <li key={n.id}>
              {n.is_pinned ? <span className="pin">고정</span> : <span className="nopin" />}
              <Link href={`/boards/notice/${n.id}`} className="ttl">{n.title}</Link>
              <span className="dt">{mmdd(n.created_at)}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* reflection */}
      {reflection && (
        <article className="reflection">
          <div className="e">주일 말씀 묵상</div>
          <h3>{reflection.title}</h3>
          <div className="meta"><b>주일 말씀 묵상</b> · {mmdd(gospel?.date ?? "")}</div>
          {reflection.body.split("\n").filter(Boolean).slice(0, 2).map((para, i) => <p key={i}>{para.slice(0, 120)}</p>)}
          <Link href="/meditation" className="more">묵상 전체 읽기 →</Link>
        </article>
      )}

      {/* gallery */}
      <section className="gallery">
        <div className="mb-h-row" style={{ paddingTop: 0 }}>
          <h2><small>Photo Gallery</small>사진 갤러리</h2>
          <Link href="/gallery" className="link">모두 →</Link>
        </div>
        <div className="gallery-strip">
          {gallery.length === 0 ? (
            <div className="gi"><div className="ph">사진 준비 중</div></div>
          ) : gallery.map((p) => (
            <Link key={p.id} href={p.source === "events" ? `/gallery/events/${p.id}` : "/gallery/liturgy"} className="gi">
              <img src={`${API}${p.thumbnail_url}`} alt={p.title} />
              <span className="gi-cap">{p.title}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* scripture */}
      <section className="scripture">
        <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4"><line x1="16" y1="4" x2="16" y2="28" /><line x1="9" y1="11" x2="23" y2="11" /></svg>
        <p>&ldquo;너는 베드로이다.<br />나는 이 반석 위에 내<br />교회를 세우겠다.&rdquo;</p>
        <cite>— 마태오 16,18</cite>
      </section>
    </div>
  );
}
