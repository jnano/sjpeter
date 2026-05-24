import Link from "next/link";
import { buildMassRows, type MassEntry } from "@/lib/mass";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Parish { name: string; mass_schedule?: { entries?: MassEntry[] } | null; }
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
interface NoticeBrief { id: number; title: string; is_pinned: boolean; created_at: string; }
interface Reflection { id: number; title: string; body: string; }
interface GalleryPhoto { id: number; title: string; thumbnail_url: string; source: "liturgy" | "events"; }

const STATUS_LABEL: Record<string, string> = { planned: "대기", in_progress: "진행 중", completed: "완료" };
const QUICK_LINKS = [
  { href: "/about", label: "성당 안내", en: "About", icon: <><path d="M3 19V8l8-5 8 5v11" /><rect x="9" y="13" width="4" height="6" /><line x1="11" y1="3" x2="11" y2="8" /></> },
  { href: "/bulletin", label: "주보 아카이브", en: "Bulletin", icon: <><rect x="3" y="4" width="16" height="14" /><line x1="3" y1="9" x2="19" y2="9" /><line x1="11" y1="9" x2="11" y2="18" /></> },
  { href: "/prayers", label: "기도문", en: "Prayers", icon: <><circle cx="11" cy="8" r="4" /><path d="M7 14l4 6 4-6" /></> },
  { href: "/saints", label: "성인 사전", en: "Saints", icon: <><line x1="11" y1="3" x2="11" y2="19" /><line x1="5" y1="9" x2="17" y2="9" /></> },
  { href: "/community", label: "예비신자 안내", en: "Catechumen", icon: <><circle cx="11" cy="11" r="8" /><path d="M5 11h12M11 3a14 14 0 0 1 0 16" /></> },
];

function ymd(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

/** 시안 v1 — 에디토리얼 미니멀 (home-v1.html 정밀 재현). */
export default function SkinEditorial({
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
  const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일 ${["일", "월", "화", "수", "목", "금", "토"][today.getDay()]}요일`;
  const galleryCap = gallery[0]?.title ?? "";

  return (
    <div className="skin-editorial">
      {/* hero */}
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-main">
            <div className="eyebrow">오늘의 복음 · Today&apos;s Gospel</div>
            <div className="gospel-meta">
              <span>{today.getFullYear()}년 <strong>{today.getMonth() + 1}월 {today.getDate()}일</strong> {["일", "월", "화", "수", "목", "금", "토"][today.getDay()]}요일</span>
              {gospel?.liturgical_season && <span><strong>{gospel.liturgical_season}</strong></span>}
              {gospel?.gospel_reference && <span>{gospel.gospel_reference}</span>}
            </div>
            <p className="gospel-quote">
              <span className="q-mark">&ldquo;</span>
              {gospel?.gospel_text
                ? gospel.gospel_text.split("\n").filter(Boolean).slice(0, 3).join(" ").slice(0, 90)
                : "오늘의 복음 본문이 곧 게재됩니다."}
              <span className="q-mark">&rdquo;</span>
            </p>
            {gospel?.gospel_reference && (
              <div className="gospel-cite">
                <span className="gospel-cite-key">{gospel.gospel_reference}</span>
                <span>가톨릭인터넷 굿뉴스 매일미사 — 매일 자동 업데이트</span>
              </div>
            )}
            <div className="hero-actions">
              <Link href="/word" className="btn-link">
                전체 복음 보기
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6"><line x1="2" y1="7" x2="12" y2="7" /><polyline points="8 3 12 7 8 11" /></svg>
              </Link>
              <Link href="/meditation" className="btn-link muted">주일 말씀 묵상</Link>
              <Link href="/prayers" className="btn-link muted">기도문</Link>
            </div>
          </div>

          <aside className="mass-card">
            <h3>Mass Schedule</h3>
            <h2>미사 시간</h2>
            {massRows.length === 0 ? (
              <div className="mass-row"><span className="mass-day">—</span><span className="mass-time">등록된 미사 시간 없음</span><span /></div>
            ) : (
              massRows.map((r, i) => (
                <div key={i} className={`mass-row ${r.label.includes("주일") ? "sun" : ""}`}>
                  <span className="mass-day">{r.label}</span>
                  <span className="mass-time tnum">{r.value}</span>
                  <span className="mass-label" />
                </div>
              ))
            )}
            <div className="mass-foot">
              <span>※ 변경될 수 있습니다</span>
              <Link href="/info">찾아오시는 길 →</Link>
            </div>
          </aside>
        </div>
      </section>

      {/* 빠른 링크 */}
      <section className="quicks">
        <div className="quicks-inner">
          {QUICK_LINKS.map((q) => (
            <Link key={q.href} href={q.href} className="quick">
              <span className="quick-icon">
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.4">{q.icon}</svg>
              </span>
              <span className="quick-text"><strong>{q.label}</strong><span>{q.en}</span></span>
            </Link>
          ))}
        </div>
      </section>

      {/* 함께 짓는 성전 (다크) */}
      {construction && construction.total_phases > 0 && (
        <section className="construction">
          <div className="construction-inner">
            <div className="con-head">
              <div>
                <div className="con-eyebrow">성전 건축 · 진행 중</div>
                <h2 className="con-title">함께 짓는 성전,<br /><em>한 단계씩</em> 자라납니다.</h2>
              </div>
              <p className="con-sub">
                본당의 새 성전이 자라나는 과정을 매주 기록합니다.
                기도와 봉헌으로 함께해 주신 모든 분께 감사드립니다.
              </p>
            </div>

            <div className="progress-block">
              <div className="progress-top">
                <div className="progress-pct">{overallPct}<sup>%</sup></div>
                <div className="progress-stage-info">
                  <div className="progress-label">현재 단계 — Stage {stageNum} of {sortedPhases.length}</div>
                  <div className="progress-stage-name">{curPhase?.name ?? "준비 중"}</div>
                  {curPhase?.description && <div className="progress-stage-sub">{curPhase.description}</div>}
                </div>
                <div className="progress-meta">
                  {curPhase?.expected_completion_date && <strong>{curPhase.expected_completion_date}</strong>}
                  <span>예상 완료</span>
                </div>
              </div>
              <div className="progress-bar">
                <i style={{ width: `${overallPct}%` }} />
                <b style={{ left: `${overallPct}%` }} />
              </div>
            </div>

            <div className="stages">
              {sortedPhases.map((p, i) => {
                const cls = p.status === "completed" ? "done" : p.status === "in_progress" ? "current" : "";
                return (
                  <div key={p.id} className={`stage ${cls}`}>
                    <div className="stage-num">{String(i + 1).padStart(2, "0")}</div>
                    <div className="stage-name">{p.name}</div>
                    <span className="stage-tag">
                      {p.status === "in_progress" ? `진행 중 · ${p.progress_percent}%` : STATUS_LABEL[p.status] ?? "대기"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* 공지 + 묵상 */}
      <section className="split">
        <div className="split-inner">
          <div>
            <div className="section-h">
              <h2>공지사항</h2>
              <Link href="/boards/notice" className="section-h-link">
                전체 보기
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4"><polyline points="4 2 8 6 4 10" /></svg>
              </Link>
            </div>
            <div className="notice-tabs">
              <span className="notice-tab on">전체</span>
              <Link href="/boards/notice" className="notice-tab">공지</Link>
              <Link href="/calendar" className="notice-tab">행사·모임</Link>
            </div>
            <ul className="notice-list">
              {notices.length === 0 ? (
                <li className="notice-item"><span className="notice-no-pin" /><span className="notice-title">등록된 공지가 없습니다</span><span /></li>
              ) : (
                notices.slice(0, 6).map((n) => (
                  <li key={n.id} className="notice-item">
                    {n.is_pinned ? <span className="notice-pin">고정</span> : <span className="notice-no-pin" />}
                    <Link href={`/boards/notice/${n.id}`} className="notice-title">{n.title}</Link>
                    <span className="notice-date">{ymd(n.created_at)}</span>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div>
            <div className="section-h">
              <h2>주일 말씀 묵상</h2>
              <Link href="/meditation/archive" className="section-h-link">
                이전 묵상
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4"><polyline points="4 2 8 6 4 10" /></svg>
              </Link>
            </div>
            <article className="reflection-card">
              {reflection ? (
                <>
                  <div className="reflection-meta">
                    <span>{dateStr}</span>
                    <span>·</span>
                    <b>주일 말씀 묵상</b>
                  </div>
                  <h3>{reflection.title}</h3>
                  {reflection.body.split("\n").filter(Boolean).slice(0, 3).map((para, i) => (
                    <p key={i}>{para.slice(0, 160)}</p>
                  ))}
                </>
              ) : (
                <p>주일 말씀 묵상이 곧 게재됩니다.</p>
              )}
            </article>
          </div>
        </div>
      </section>

      {/* 사진 갤러리 */}
      <section className="gallery">
        <div className="gallery-inner">
          <div className="gallery-head">
            <h2>사진 갤러리</h2>
            <div className="gallery-tabs">
              <Link href="/gallery/liturgy" className="on">전례 사진</Link>
              <Link href="/gallery/events">행사 사진</Link>
              <Link href="/gallery">모든 순간 →</Link>
            </div>
          </div>
          <div className="gallery-grid">
            {Array.from({ length: 5 }).map((_, i) => {
              const p = gallery[i];
              const cls = i === 0 ? "gallery-item big" : "gallery-item";
              if (!p) return <div key={i} className={cls}><div className="ph">사진 준비 중</div></div>;
              const href = p.source === "events" ? `/gallery/events/${p.id}` : "/gallery/liturgy";
              return (
                <Link key={p.id} href={href} className={cls}>
                  <img src={`${API}${p.thumbnail_url}`} alt={p.title} />
                  {i === 0 && galleryCap && <div className="gallery-cap">{galleryCap}</div>}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* 성서 인용 */}
      <section className="scripture">
        <svg className="scripture-cross" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4">
          <line x1="16" y1="4" x2="16" y2="28" /><line x1="9" y1="11" x2="23" y2="11" />
        </svg>
        <p>&ldquo;너는 베드로이다.<br />나는 이 반석 위에 내 교회를 세우겠다.&rdquo;</p>
        <cite>— 마태오 16,18</cite>
      </section>
    </div>
  );
}
