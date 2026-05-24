import Link from "next/link";
import { buildMassRows, type MassEntry } from "@/lib/mass";
import { formatKRWShort, fundPercent } from "@/lib/fund";
import PhotoSlider from "../PhotoSlider";

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

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

/**
 * 시안 v2 — 대시보드 카드.
 * 12-grid 카드 밀집형. gospel 어두운 카드 + 미사 + 공지·일정·성전건축·헌금 KPI + 갤러리.
 */
export default function SkinDashboard({
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
  const massRows = buildMassRows(parish?.mass_schedule?.entries ?? []);
  const cPct = Math.max(0, Math.min(100, construction?.overall_percent ?? 0));
  const hasConstruction = !!construction && construction.total_phases > 0;
  const fundActive = !!fund?.is_active && (fund.goal_amount > 0 || fund.raised_amount > 0);
  const fundPct = fund ? fundPercent(fund.raised_amount, fund.goal_amount) : 0;

  return (
    <div className="skin-dashboard">
      <div className="ds-page-head">
        <h1>
          <small>HOME · DASHBOARD</small>
          {parish?.name ?? "본당 홈페이지"}
        </h1>
      </div>
      <div className="ds-dash">
        <div className="ds-grid12">
          {/* gospel — 8col 어두운 카드 */}
          <div className="ds-card ds-gospel ds-col-8">
            <div className="ds-card-head">
              <span className="ds-card-eyebrow">오늘의 복음</span>
              <Link href="/word" className="ds-card-link">전체 보기 →</Link>
            </div>
            <p className="ds-gospel-quote">
              <span className="ds-q">&ldquo;</span>
              {gospel?.gospel_text
                ? gospel.gospel_text.split("\n").slice(0, 2).join(" ").slice(0, 80)
                : "오늘의 복음 본문이 곧 게재됩니다."}
              <span className="ds-q">&rdquo;</span>
            </p>
            <div className="ds-gospel-detail">
              <div className="ds-gospel-bible">
                {gospel?.gospel_reference && <strong>{gospel.gospel_reference}</strong>}
                {gospel?.liturgical_season ?? "전례 시기 안내"}
              </div>
              <Link href="/word" className="ds-gospel-action">전체 복음 →</Link>
            </div>
          </div>

          {/* mass — 4col */}
          <div className="ds-card ds-col-4">
            <div className="ds-card-head">
              <h3>미사 시간</h3>
              <Link href="/info" className="ds-card-link">전체</Link>
            </div>
            <ul className="ds-mass-list">
              {massRows.slice(0, 5).map((r, i) => (
                <li key={i} className={r.label.includes("주일") ? "sun" : ""}>
                  <span className="day">{r.label}</span>
                  <span className="time tnum">{r.value}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 공지 — 4col */}
          <div className="ds-card ds-col-4">
            <div className="ds-card-head">
              <h3>본당 소식</h3>
              <Link href="/boards/notice" className="ds-card-link">전체</Link>
            </div>
            {notices.length === 0 ? (
              <p className="ds-empty">공지가 없습니다.</p>
            ) : (
              <ul className="ds-link-list">
                {notices.slice(0, 5).map((n) => (
                  <li key={n.id}>
                    <Link href={`/boards/notice/${n.id}`}>
                      {n.is_pinned && <span className="ds-pin">고정</span>}
                      <span className="ds-ll-title">{n.title}</span>
                      <time>{shortDate(n.created_at)}</time>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 일정 — 4col */}
          <div className="ds-card ds-col-4">
            <div className="ds-card-head">
              <h3>다가오는 일정</h3>
              <Link href="/calendar" className="ds-card-link">달력</Link>
            </div>
            {events.length === 0 ? (
              <p className="ds-empty">예정된 일정이 없습니다.</p>
            ) : (
              <ul className="ds-link-list">
                {events.slice(0, 5).map((e) => (
                  <li key={e.id}>
                    <Link href="/calendar">
                      {e.event_kind && <span className={`ds-kind ${e.event_kind === "행사" ? "ev" : "mt"}`}>{e.event_kind}</span>}
                      <span className="ds-ll-title">{e.title}</span>
                      <time>{shortDate(e.event_date)}</time>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 성전건축 KPI — 4col */}
          {hasConstruction && (
            <Link href="/construction" className="ds-card ds-kpi ds-col-4">
              <div className="ds-card-head">
                <h3>성전 건축</h3>
                <span className="ds-card-link">현황 →</span>
              </div>
              <div className="ds-kpi-num">{cPct}<sup>%</sup></div>
              <div className="ds-kpi-label">전체 진행률</div>
              <div className="ds-kpi-bar"><i style={{ width: `${cPct}%` }} /></div>
              <div className="ds-kpi-sub">
                {construction!.completed_phases}/{construction!.total_phases} 단계 완료
                {construction!.current_phase && ` · ${construction!.current_phase.name}`}
              </div>
            </Link>
          )}

          {/* 헌금 KPI — 4col */}
          {fundActive && fund && (
            <Link href="/construction" className="ds-card ds-kpi ds-fund ds-col-4">
              <div className="ds-card-head">
                <h3>건축 헌금</h3>
                <span className="ds-card-link">후원 →</span>
              </div>
              <div className="ds-kpi-num">{formatKRWShort(fund.raised_amount)}<small>원</small></div>
              <div className="ds-kpi-label">목표 {formatKRWShort(fund.goal_amount)}원 · {fundPct}%</div>
              <div className="ds-kpi-bar"><i style={{ width: `${fundPct}%` }} /></div>
              {fund.donor_count > 0 && (
                <div className="ds-kpi-sub">{fund.donor_count.toLocaleString("ko-KR")}명이 함께하고 있습니다</div>
              )}
            </Link>
          )}

          {/* 갤러리 — 가로 전체 */}
          <div className="ds-card ds-col-12 ds-gallery-card">
            <div className="ds-card-head">
              <h3>사진 갤러리</h3>
              <Link href="/gallery" className="ds-card-link">전체 →</Link>
            </div>
            <PhotoSlider />
          </div>
        </div>
      </div>
    </div>
  );
}
