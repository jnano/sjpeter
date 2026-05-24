import Link from "next/link";
import { buildMassRows, type MassEntry } from "@/lib/mass";
import { formatKRWShort, formatKRWFull, fundPercent } from "@/lib/fund";

interface Parish {
  name: string;
  mass_schedule?: { entries?: MassEntry[]; note?: string } | null;
}

interface GospelToday {
  date: string;
  liturgical_season: string | null;
  gospel_reference: string | null;
  gospel_text: string | null;
}

interface SummaryPhase {
  id: number;
  name: string;
  status: string;
  progress_percent: number;
  description?: string | null;
}
interface ConstructionSummary {
  current_phase: SummaryPhase | null;
  overall_percent: number;
  total_phases: number;
  completed_phases: number;
  latest_journal: { entry_date: string; note: string } | null;
}

interface Phase {
  id: number;
  name: string;
  status: string;
  progress_percent: number;
  sort_order: number;
  expected_completion_date: string | null;
}

interface Fund {
  goal_amount: number;
  raised_amount: number;
  donor_count: number;
  account_info: string | null;
  note: string | null;
  is_active: boolean;
}

interface NoticeBrief { id: number; title: string; is_pinned: boolean; created_at: string; }
interface EventBrief { id: number; title: string; event_date: string; event_kind: string | null; }

const STATUS_LABEL: Record<string, string> = {
  planned: "예정",
  in_progress: "진행 중",
  completed: "완료",
};

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

/**
 * 시안 v3 — 함께 짓는 성전.
 * 큰 헤드라인 hero + 공지·복음·미사 카드 + 건축 단계 타임라인 + 헌금 현황·후원 CTA.
 */
export default function SkinConstruction({
  parish,
  gospel,
  notices,
  events,
  construction,
  phases,
  fund,
}: {
  parish: Parish | null;
  gospel: GospelToday | null;
  notices: NoticeBrief[];
  events: EventBrief[];
  construction: ConstructionSummary | null;
  phases: Phase[];
  fund: Fund | null;
}) {
  const pct = Math.max(0, Math.min(100, construction?.overall_percent ?? 0));
  const currentName = construction?.current_phase?.name ?? null;
  const massRows = buildMassRows(parish?.mass_schedule?.entries ?? []);
  const sortedPhases = [...phases].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  const fundActive = !!fund?.is_active && (fund.goal_amount > 0 || fund.raised_amount > 0);
  const fundPct = fund ? fundPercent(fund.raised_amount, fund.goal_amount) : 0;

  return (
    <div className="skin-construction">
      {/* ── Hero ── */}
      <section className="cn-hero">
        <div className="cn-hero-inner">
          <div className="cn-hero-eyebrow">
            <span>성전 건축 프로젝트</span>
            <span className="cn-tag-live">LIVE</span>
          </div>
          <div className="cn-hero-grid">
            <div>
              <h1 className="cn-hero-headline">
                함께 짓는 <em>{parish?.name ?? "본당"}</em>의 새 성전
              </h1>
              <p className="cn-hero-sub">
                {gospel?.gospel_text
                  ? gospel.gospel_text.split("\n")[0].slice(0, 70)
                  : "본당 공동체가 한마음으로 일구는 새 성전 건축의 여정을 함께해 주세요."}
              </p>
              <div className="cn-hero-cta-row">
                <Link href="/construction" className="cn-btn-pri">건축 진행 상황 →</Link>
                <Link href="/word" className="cn-btn-sec">오늘의 복음</Link>
              </div>
            </div>
            <div className="cn-progress-wrap">
              <div className="cn-progress-label">현재 진행률</div>
              <div className="cn-progress-pct">
                {pct}<sup>%</sup>
              </div>
              {currentName && <div className="cn-progress-stage">{currentName}</div>}
              <div className="cn-progress-bar"><i style={{ width: `${pct}%` }} /></div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 공지 + 복음 + 미사 카드 ── */}
      <section className="cn-info">
        <div className="cn-info-inner">
          <div className="cn-info-grid">
            {/* 공지 */}
            <div className="cn-card">
              <div className="cn-card-head">
                <h3>본당 소식</h3>
                <Link href="/boards/notice">전체 →</Link>
              </div>
              {notices.length === 0 ? (
                <p className="cn-empty">등록된 공지가 없습니다.</p>
              ) : (
                <ul className="cn-list">
                  {notices.slice(0, 5).map((n) => (
                    <li key={n.id}>
                      <Link href={`/boards/notice/${n.id}`}>
                        {n.is_pinned && <span className="cn-pin">고정</span>}
                        <span className="cn-list-title">{n.title}</span>
                        <time>{shortDate(n.created_at)}</time>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* 복음 — 어두운 카드 */}
            <Link href="/word" className="cn-card cn-gospel">
              <div className="cn-card-head">
                <h3>오늘의 복음</h3>
                {gospel?.liturgical_season && <span className="cn-gospel-season">{gospel.liturgical_season}</span>}
              </div>
              <p className="cn-gospel-quote">
                <span className="cn-q">&ldquo;</span>
                {gospel?.gospel_text
                  ? gospel.gospel_text.split("\n").slice(0, 3).join(" ").slice(0, 120)
                  : "오늘의 복음 본문이 곧 게재됩니다."}
                <span className="cn-q">&rdquo;</span>
              </p>
              {gospel?.gospel_reference && <cite className="cn-gospel-cite">— {gospel.gospel_reference}</cite>}
            </Link>

            {/* 미사 */}
            <div className="cn-card">
              <div className="cn-card-head">
                <h3>미사 시간</h3>
                <Link href="/info">안내 →</Link>
              </div>
              {massRows.length === 0 ? (
                <p className="cn-empty">미사 시간 정보가 없습니다.</p>
              ) : (
                <ul className="cn-mass">
                  {massRows.map((r, i) => (
                    <li key={i} className={r.label.includes("주일") ? "sun" : ""}>
                      <span className="day">{r.label}</span>
                      <span className="time tnum">{r.value}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── 건축 단계 타임라인 ── */}
      {sortedPhases.length > 0 && (
        <section className="cn-timeline-sec">
          <div className="cn-timeline-inner">
            <div className="cn-sec-head">
              <p className="cn-sec-eyebrow">건축 여정</p>
              <h2>한 단계씩, 함께 지어 갑니다</h2>
              {construction && (
                <p className="cn-sec-sub">
                  전체 {construction.total_phases}단계 중 {construction.completed_phases}단계 완료 · 전체 진행률 {pct}%
                </p>
              )}
            </div>
            <ol className="cn-timeline">
              {sortedPhases.map((p) => (
                <li key={p.id} className={`cn-tl-item is-${p.status}`}>
                  <span className="cn-tl-dot" />
                  <div className="cn-tl-body">
                    <div className="cn-tl-top">
                      <span className="cn-tl-name">{p.name}</span>
                      <span className="cn-tl-status">{STATUS_LABEL[p.status] ?? p.status}</span>
                    </div>
                    <div className="cn-tl-bar"><i style={{ width: `${p.progress_percent}%` }} /></div>
                    <div className="cn-tl-meta">
                      <span>{p.progress_percent}%</span>
                      {p.expected_completion_date && p.status !== "completed" && (
                        <span>예상 완료 {p.expected_completion_date}</span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* ── 헌금 현황 + 후원 CTA ── */}
      {fundActive && fund && (
        <section className="cn-fund-sec">
          <div className="cn-fund-inner">
            <div className="cn-fund-grid">
              <div className="cn-fund-main">
                <p className="cn-sec-eyebrow">건축 헌금 현황</p>
                <div className="cn-fund-amounts">
                  <span className="cn-fund-raised">{formatKRWShort(fund.raised_amount)}<small>원</small></span>
                  <span className="cn-fund-goal">목표 {formatKRWShort(fund.goal_amount)}원</span>
                </div>
                <div className="cn-fund-bar"><i style={{ width: `${fundPct}%` }} /></div>
                <div className="cn-fund-stats">
                  <span><strong>{fundPct}%</strong> 달성</span>
                  {fund.donor_count > 0 && <span><strong>{fund.donor_count.toLocaleString("ko-KR")}</strong>명 후원</span>}
                  <span className="cn-fund-full">{formatKRWFull(fund.raised_amount)}</span>
                </div>
              </div>
              <div className="cn-fund-cta">
                <h3>함께 지어 주세요</h3>
                <p>{fund.note || "작은 정성이 모여 새 성전이 됩니다. 본당 가족 여러분의 참여를 기다립니다."}</p>
                {fund.account_info && <div className="cn-fund-account">{fund.account_info}</div>}
                <Link href="/construction" className="cn-btn-pri">건축 후원 안내 →</Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── 다가오는 행사·모임 ── */}
      {events.length > 0 && (
        <section className="cn-events-sec">
          <div className="cn-events-inner">
            <div className="cn-sec-head row">
              <h2>다가오는 행사·모임</h2>
              <Link href="/calendar" className="cn-more">전체 일정 →</Link>
            </div>
            <ul className="cn-events">
              {events.slice(0, 4).map((e) => (
                <li key={e.id}>
                  <Link href="/calendar">
                    <span className="cn-ev-date">{shortDate(e.event_date)}</span>
                    {e.event_kind && <span className={`cn-ev-kind ${e.event_kind === "행사" ? "ev" : "mt"}`}>{e.event_kind}</span>}
                    <span className="cn-ev-title">{e.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
