import Link from "next/link";
import { buildMassRows, type MassEntry } from "@/lib/mass";

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

/**
 * 시안 v2 — 대시보드 카드.
 * 12-grid 카드 밀집형 정보 레이아웃. 어두운 hero 카드 + 미사·공지·일정 등 카드.
 * v1.5.350: 1차 stub — hero(gospel dark card) + mass card. 나머지 후속.
 */
export default function SkinDashboard({ parish, gospel }: { parish: Parish | null; gospel: GospelToday | null }) {
  const massRows = buildMassRows(parish?.mass_schedule?.entries ?? []);

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
        </div>
      </div>

      <section className="ed-stub">
        <div className="ed-stub-inner">
          <p className="ed-eyebrow" style={{ marginBottom: 12 }}>STUB · 1차 commit</p>
          <p style={{ fontSize: 17, lineHeight: 1.7, maxWidth: 760, color: "var(--color-text-muted)" }}>
            이 스킨은 시안 v2 (대시보드 카드) 의 hero(gospel dark card + mass card) 만 적용된 상태입니다.
            나머지 카드(공지·일정·성전건축·갤러리 등 12-grid) 와 KPI·tag 시스템은 다음 commit 에서 보강.
          </p>
        </div>
      </section>
    </div>
  );
}
