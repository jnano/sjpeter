import Link from "next/link";
import { buildMassRows, type MassEntry } from "@/lib/mass";
import { formatKRWShort, fundPercent } from "@/lib/fund";
import PhotoSlider from "../PhotoSlider";

interface Parish {
  name: string;
  phone?: string | null;
  address?: string | null;
  mass_schedule?: { entries?: MassEntry[] } | null;
}

interface GospelToday {
  date: string;
  liturgical_season: string | null;
  gospel_reference: string | null;
  gospel_text: string | null;
}

interface SummaryPhase { id: number; name: string; status: string; progress_percent: number; }
interface ConstructionSummary {
  current_phase: SummaryPhase | null;
  overall_percent: number;
  total_phases: number;
  completed_phases: number;
}

interface Fund {
  goal_amount: number;
  raised_amount: number;
  donor_count: number;
  is_active: boolean;
}

interface NoticeBrief { id: number; title: string; is_pinned: boolean; created_at: string; }
interface EventBrief { id: number; title: string; event_date: string; event_kind: string | null; }

const QUICK_LINKS = [
  { href: "/about", label: "성당 안내", en: "About" },
  { href: "/community", label: "분과와 단체", en: "Community" },
  { href: "/bulletin", label: "주보 아카이브", en: "Bulletin" },
  { href: "/word", label: "오늘의 말씀", en: "Word" },
  { href: "/gallery", label: "사진 갤러리", en: "Gallery" },
  { href: "/info", label: "오시는 길", en: "Visit" },
];

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

/**
 * 시안 v1 — 에디토리얼 미니멀.
 * 와인+골드 + Pretendard. 큰 타이포 hero + 빠른 메뉴 + 본당 소식 + 성전건축 + 갤러리 + 푸터.
 */
export default function SkinEditorial({
  parish,
  gospel,
  notices,
  events,
  construction,
  fund,
}: {
  parish: Parish | null;
  gospel: GospelToday | null;
  notices: NoticeBrief[];
  events: EventBrief[];
  construction: ConstructionSummary | null;
  fund: Fund | null;
}) {
  const today = new Date(gospel?.date ?? new Date().toISOString().slice(0, 10));
  const dayStr = today.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
  const massRows = buildMassRows(parish?.mass_schedule?.entries ?? []);
  const cPct = Math.max(0, Math.min(100, construction?.overall_percent ?? 0));
  const fundActive = !!fund?.is_active && (fund.goal_amount > 0 || fund.raised_amount > 0);

  return (
    <div className="skin-editorial">
      {/* ── Hero ── */}
      <section className="ed-hero">
        <div className="ed-hero-inner">
          <div className="ed-hero-main">
            <div className="ed-eyebrow">오늘의 복음 · Today&apos;s Gospel</div>
            <div className="ed-gospel-meta">
              <span>{dayStr}</span>
              {gospel?.liturgical_season && <span><strong>{gospel.liturgical_season}</strong></span>}
              {gospel?.gospel_reference && <span>{gospel.gospel_reference}</span>}
            </div>
            <p className="ed-gospel-quote">
              <span className="ed-q-mark">&ldquo;</span>
              {gospel?.gospel_text
                ? gospel.gospel_text.split("\n").slice(0, 3).join(" ").slice(0, 110)
                : "오늘의 복음 본문이 곧 게재됩니다."}
              <span className="ed-q-mark">&rdquo;</span>
            </p>
            {gospel?.gospel_reference && (
              <div className="ed-gospel-cite">
                <span className="ed-gospel-cite-key">{gospel.gospel_reference}</span>
                <span>가톨릭인터넷 굿뉴스 매일미사 — 매일 자동 업데이트</span>
              </div>
            )}
            <div className="ed-hero-actions">
              <Link href="/word" className="ed-btn-link">전체 복음 보기 →</Link>
              <Link href="/meditation" className="ed-btn-link muted">주일 말씀 묵상</Link>
              <Link href="/prayer" className="ed-btn-link muted">기도문</Link>
            </div>
          </div>
          <aside className="ed-mass-card">
            <h3>Mass Schedule</h3>
            <h2>미사 시간</h2>
            {massRows.length === 0 ? (
              <p className="ed-mass-empty">등록된 미사 시간이 없습니다.</p>
            ) : (
              massRows.map((r, i) => (
                <div key={i} className={`ed-mass-row ${r.label.includes("주일") ? "sun" : ""}`}>
                  <span className="ed-mass-day">{r.label}</span>
                  <span className="ed-mass-time tnum">{r.value}</span>
                </div>
              ))
            )}
            <div className="ed-mass-foot">
              <span>※ 변경될 수 있습니다</span>
              <Link href="/info">전체 안내</Link>
            </div>
          </aside>
        </div>
      </section>

      {/* ── 빠른 메뉴 ── */}
      <section className="ed-quick">
        <div className="ed-quick-inner">
          {QUICK_LINKS.map((q, i) => (
            <Link key={q.href} href={q.href} className="ed-quick-item">
              <span className="ed-quick-num">{String(i + 1).padStart(2, "0")}</span>
              <span className="ed-quick-label">{q.label}</span>
              <span className="ed-quick-en">{q.en}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── 본당 소식 (공지 + 일정) ── */}
      <section className="ed-news">
        <div className="ed-news-inner">
          <div className="ed-news-col">
            <div className="ed-col-head">
              <h2>본당 소식</h2>
              <Link href="/boards/notice">전체 →</Link>
            </div>
            {notices.length === 0 ? (
              <p className="ed-empty">등록된 공지가 없습니다.</p>
            ) : (
              <ul className="ed-news-list">
                {notices.slice(0, 5).map((n) => (
                  <li key={n.id}>
                    <Link href={`/boards/notice/${n.id}`}>
                      <span className="ed-news-title">
                        {n.is_pinned && <span className="ed-pin">고정</span>}
                        {n.title}
                      </span>
                      <time>{shortDate(n.created_at)}</time>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="ed-news-col">
            <div className="ed-col-head">
              <h2>다가오는 일정</h2>
              <Link href="/calendar">달력 →</Link>
            </div>
            {events.length === 0 ? (
              <p className="ed-empty">예정된 일정이 없습니다.</p>
            ) : (
              <ul className="ed-news-list">
                {events.slice(0, 5).map((e) => (
                  <li key={e.id}>
                    <Link href="/calendar">
                      <span className="ed-news-title">
                        {e.event_kind && <span className={`ed-kind ${e.event_kind === "행사" ? "ev" : "mt"}`}>{e.event_kind}</span>}
                        {e.title}
                      </span>
                      <time>{shortDate(e.event_date)}</time>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* ── 성전 건축 ── */}
      {construction && construction.total_phases > 0 && (
        <section className="ed-construction">
          <div className="ed-construction-inner">
            <div className="ed-construction-text">
              <div className="ed-eyebrow">성전 건축 · Building Together</div>
              <h2 className="ed-construction-head">
                함께 짓는 새 성전,<br />지금 {cPct}% 지어졌습니다
              </h2>
              {construction.current_phase && (
                <p className="ed-construction-stage">
                  현재 단계 — <strong>{construction.current_phase.name}</strong>
                </p>
              )}
              <p className="ed-construction-sub">
                전체 {construction.total_phases}단계 중 {construction.completed_phases}단계 완료
                {fundActive && fund && ` · 헌금 ${formatKRWShort(fund.raised_amount)}원 모금 (${fundPercent(fund.raised_amount, fund.goal_amount)}%)`}
              </p>
              <Link href="/construction" className="ed-btn-link">건축 현황 자세히 →</Link>
            </div>
            <div className="ed-construction-meter">
              <div className="ed-meter-pct">{cPct}<sup>%</sup></div>
              <div className="ed-meter-bar"><i style={{ width: `${cPct}%` }} /></div>
              {fundActive && fund && (
                <div className="ed-meter-fund">
                  <span>모금 {formatKRWShort(fund.raised_amount)}원</span>
                  <span className="muted">목표 {formatKRWShort(fund.goal_amount)}원</span>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── 사진 갤러리 ── */}
      <section className="ed-gallery">
        <div className="ed-gallery-inner">
          <div className="ed-col-head">
            <h2>사진 갤러리</h2>
            <Link href="/gallery">전체 →</Link>
          </div>
          <PhotoSlider />
        </div>
      </section>

      {/* ── 푸터 ── */}
      <footer className="ed-footer">
        <div className="ed-footer-inner">
          <div className="ed-footer-brand">{parish?.name ?? "본당 홈페이지"}</div>
          <div className="ed-footer-meta">
            {parish?.address && <span>{parish.address}</span>}
            {parish?.phone && <span>{parish.phone}</span>}
          </div>
          <div className="ed-footer-links">
            <Link href="/about">성당 안내</Link>
            <Link href="/bulletin">주보</Link>
            <Link href="/calendar">일정</Link>
            <Link href="/info">오시는 길</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
