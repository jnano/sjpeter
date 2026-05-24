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
 * 시안 v1 — 에디토리얼 미니멀.
 * tokens.css 의 와인+골드 + Pretendard. 큰 타이포 + 절제된 카드.
 * v1.5.350: 1차 stub — hero 만 시안 jsx, 나머지는 후속 commit 에서 디테일.
 */
export default function SkinEditorial({ parish, gospel }: { parish: Parish | null; gospel: GospelToday | null }) {
  const today = new Date(gospel?.date ?? new Date().toISOString().slice(0, 10));
  const dayStr = today.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
  const massEntries = parish?.mass_schedule?.entries ?? [];
  const massRows = buildMassRows(massEntries);

  return (
    <div className="skin-editorial">
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

      <section className="ed-stub">
        <div className="ed-stub-inner">
          <p className="ed-eyebrow" style={{ marginBottom: 12 }}>STUB · 1차 commit</p>
          <p style={{ fontSize: 17, lineHeight: 1.7, maxWidth: 760, color: "var(--color-text-muted)" }}>
            이 스킨은 시안 v1 (에디토리얼 미니멀) 의 hero 만 적용된 상태입니다.
            나머지 섹션(빠른 메뉴, 본당 공동체, 성전건축, 공지·묵상, 갤러리, 푸터) 의 디테일 변환은
            다음 commit 에서 보강합니다. 본 디자인의 핵심 시각 어휘 — 와인색 강조, 골드 포인트,
            큰 타이포, 절제된 사각 카드, Pretendard — 를 위에서 확인하실 수 있습니다.
          </p>
        </div>
      </section>
    </div>
  );
}
