import Link from "next/link";

interface Parish {
  name: string;
}

interface GospelToday {
  date: string;
  liturgical_season: string | null;
  gospel_reference: string | null;
  gospel_text: string | null;
}

interface ConstructionSummary {
  current_phase_name?: string | null;
  overall_percent?: number;
  total_donated?: number;
  goal_amount?: number;
}

/**
 * 시안 v3 — 함께 짓는 성전.
 * 큰 헤드라인 + 성전건축 프로젝트 강조 hero.
 * v1.5.350: 1차 stub — hero 만. 나머지 후속.
 */
export default function SkinConstruction({
  parish,
  gospel,
  construction,
}: {
  parish: Parish | null;
  gospel: GospelToday | null;
  construction: ConstructionSummary | null;
}) {
  const pct = Math.max(0, Math.min(100, construction?.overall_percent ?? 0));

  return (
    <div className="skin-construction">
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
              {construction?.current_phase_name && (
                <div className="cn-progress-stage">{construction.current_phase_name}</div>
              )}
              <div className="cn-progress-bar"><i style={{ width: `${pct}%` }} /></div>
            </div>
          </div>
        </div>
      </section>

      <section className="ed-stub">
        <div className="ed-stub-inner">
          <p className="ed-eyebrow" style={{ marginBottom: 12 }}>STUB · 1차 commit</p>
          <p style={{ fontSize: 17, lineHeight: 1.7, maxWidth: 760, color: "var(--color-text-muted)" }}>
            이 스킨은 시안 v3 (함께 짓는 성전) 의 hero 만 적용된 상태입니다.
            나머지 섹션(공지 + 복음 + 미사 카드, 건축 단계 타임라인, 헌금 현황, 후원 CTA) 의 디테일 변환은
            다음 commit 에서 보강.
          </p>
        </div>
      </section>
    </div>
  );
}
