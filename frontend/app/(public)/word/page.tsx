import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";
import DateNav from "./DateNav";
import GospelToolbar from "./GospelToolbar";
import LiturgicalMiniCal from "./LiturgicalMiniCal";
import WeekReadings from "./WeekReadings";

export const metadata: Metadata = {
  title: "오늘의 복음",
  description: "가톨릭굿뉴스 매일미사 — 오늘의 복음",
};

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface GospelDay {
  date: string;
  liturgical_season: string | null;
  gospel_reference: string | null;
  gospel_text: string | null;
}

async function fetchGospel(dateIso: string | null): Promise<GospelDay | null> {
  try {
    const url = dateIso
      ? `${API}/api/gospel?date=${dateIso}`
      : `${API}/api/gospel/today`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.success) return null;
    // /api/gospel 응답은 date 필드가 없으니 보강
    return { date: json.data.date ?? dateIso ?? new Date().toISOString().slice(0, 10), ...json.data };
  } catch {
    return null;
  }
}

/** 전례 시기 텍스트에서 색 제의 추정 — 백엔드에 데이터 없으므로 키워드로 매핑. */
function inferVestment(season: string | null): { label: string; color: string } {
  const s = (season ?? "").toLowerCase();
  if (s.includes("사순") || s.includes("대림") || s.includes("재의")) return { label: "보라색 제의", color: "#6B4E8C" };
  if (s.includes("성령") || s.includes("성지") || s.includes("수난") || s.includes("순교") || s.includes("성목요일") || s.includes("성금요일")) return { label: "빨강색 제의", color: "#A93232" };
  if (s.includes("연중")) return { label: "초록색 제의", color: "#2E6B43" };
  // 부활·성탄·대축일·기념일 기본
  return { label: "흰색 제의", color: "#E8DFD6" };
}

function formatKoreanDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return {
    full: d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" }),
    weekday: d.toLocaleDateString("ko-KR", { weekday: "long" }),
  };
}

interface PageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function WordPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const requestedDate = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : null;
  const gospel = await fetchGospel(requestedDate);
  const currentIso = gospel?.date ?? requestedDate ?? new Date().toISOString().slice(0, 10);
  const vestment = inferVestment(gospel?.liturgical_season ?? null);
  const dateFmt = formatKoreanDate(currentIso);
  const missaUrl = `https://maria.catholic.or.kr/mi_pr/missa/missa.asp?goMonth=${currentIso}`;

  return (
    <>
      <PageHeader
        group="말씀과 기도"
        title="오늘의 복음"
        subtitle="매일 미사의 말씀, 하루를 여는 자리"
        action={<DateNav currentIso={currentIso} />}
      />
      <SectionLayout group="word">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_260px] gap-6 lg:gap-8">
          {/* ── 본문 ─────────────────────────────────────── */}
          <div className="min-w-0">
            {!gospel ? (
              <div className="bg-white border border-[var(--color-border)] rounded-2xl p-12 text-center">
                <p className="text-4xl mb-4">📖</p>
                <p className="font-sans font-semibold text-[var(--color-primary)] mb-2">말씀을 불러올 수 없습니다</p>
                <p className="text-sm text-[var(--color-text-muted)] mb-6">
                  가톨릭굿뉴스 서버에 일시적인 문제가 있을 수 있습니다.
                </p>
                <a
                  href={missaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-5 py-2.5 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium hover:opacity-90"
                >
                  굿뉴스에서 직접 보기 →
                </a>
              </div>
            ) : (
              <>
                {/* today-head — 날짜·전례 시기·색 제의 */}
                <section className="bg-[var(--color-surface-warm)] rounded-2xl p-6 sm:p-7 mb-7 flex items-center justify-between gap-5 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[var(--color-text-muted)]">
                      <span><b className="text-[var(--color-text)] font-bold">{dateFmt.full}</b> {dateFmt.weekday}</span>
                      {gospel.liturgical_season && (
                        <>
                          <span className="text-[var(--color-border)]">·</span>
                          <span>{gospel.liturgical_season}</span>
                        </>
                      )}
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight mt-2.5">
                      {gospel.liturgical_season ?? "오늘의 미사"}
                    </h2>
                  </div>
                  <span
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wider"
                    style={{ background: vestment.color, color: vestment.color === "#E8DFD6" ? "var(--color-text)" : "#FFF" }}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: vestment.color === "#E8DFD6" ? "var(--color-text)" : "#FFF" }}
                    />
                    {vestment.label}
                  </span>
                </section>

                {/* 다크 복음 카드 (시안 .reading.gospel) */}
                <article className="bg-[var(--color-text)] text-white rounded-2xl p-7 sm:p-10 mb-5">
                  <div className="flex justify-between items-baseline gap-3 pb-4 mb-6 border-b border-white/15">
                    <h3 className="text-[13px] tracking-[0.12em] uppercase font-bold" style={{ color: "var(--color-accent, #C9A961)" }}>
                      ✠ 오늘의 복음
                    </h3>
                    {gospel.gospel_reference && (
                      <span
                        className="text-[12px] font-bold tracking-tight px-3 py-1 rounded"
                        style={{ background: "rgba(201,169,97,0.2)", color: "var(--color-accent, #C9A961)" }}
                      >
                        {gospel.gospel_reference}
                      </span>
                    )}
                  </div>
                  {gospel.gospel_text ? (
                    <p className="text-[17px] sm:text-[18px] leading-[1.95] tracking-tight whitespace-pre-line text-white reading-zoom">
                      {gospel.gospel_text}
                    </p>
                  ) : (
                    <p className="text-white/50 italic text-sm">복음 본문을 가져오지 못했습니다.</p>
                  )}
                </article>

                {/* 도구 바 — TTS·저장·인쇄·공유 */}
                {gospel.gospel_text && (
                  <GospelToolbar
                    text={gospel.gospel_text}
                    reference={gospel.gospel_reference}
                    dateIso={currentIso}
                  />
                )}

                {/* 전체 미사 말씀 — 굿뉴스 단축 카드 (1독서·화답송·복음환호송 자리는 2단계에서) */}
                <div className="mt-5 bg-white border border-[var(--color-border)] rounded-2xl p-6 flex items-center justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-sans font-semibold text-[var(--color-primary)] mb-1">오늘의 전체 미사 말씀</p>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      제1독서, 화답송, 복음환호송 전문은 굿뉴스에서 확인하세요.
                    </p>
                  </div>
                  <a
                    href={missaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 px-4 py-2.5 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium hover:opacity-90 whitespace-nowrap"
                  >
                    굿뉴스 보기 →
                  </a>
                </div>

                {/* 묵상 링크 카드 — 시안 .refl-link */}
                <a
                  href="/meditation"
                  className="mt-6 block rounded-2xl p-6 sm:p-8 text-white"
                  style={{ background: "linear-gradient(135deg, var(--color-primary), var(--color-primary-dark, #5C1820))" }}
                >
                  <div className="flex items-center justify-between gap-5 flex-wrap">
                    <div className="min-w-0">
                      <div className="text-[10px] tracking-[0.2em] uppercase font-bold mb-2" style={{ color: "var(--color-accent, #C9A961)" }}>
                        주일 말씀 묵상
                      </div>
                      <h3 className="text-lg sm:text-xl font-bold tracking-tight mb-1.5">
                        이번 주 묵상을 함께 읽어보세요
                      </h3>
                      <p className="text-[13px] text-white/70">주임신부님의 묵상과 이번 주 실천을 함께 만납니다.</p>
                    </div>
                    <span
                      className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: "var(--color-accent, #C9A961)", color: "var(--color-text)" }}
                    >
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <line x1="3" y1="9" x2="15" y2="9" />
                        <polyline points="9 4 15 9 9 14" />
                      </svg>
                    </span>
                  </div>
                </a>

                {/* 출처 */}
                <p className="text-center text-xs text-[var(--color-text-muted)] mt-6">
                  출처: 가톨릭인터넷 굿뉴스 (catholic.or.kr) · 매일 자동 업데이트
                </p>
              </>
            )}
          </div>

          {/* ── 우측 rail ─────────────────────────────────── */}
          <aside className="space-y-4 lg:sticky lg:top-44 lg:self-start">
            <div className="bg-white border border-[var(--color-border)] rounded-2xl p-5">
              <h4 className="text-[11px] tracking-[0.14em] uppercase font-bold text-[var(--color-text-muted)] pb-3 mb-1 border-b border-[var(--color-border)]">
                이번 주 미사 말씀
              </h4>
              <WeekReadings currentIso={currentIso} />
            </div>

            <div className="bg-white border border-[var(--color-border)] rounded-2xl p-5">
              <h4 className="text-[11px] tracking-[0.14em] uppercase font-bold text-[var(--color-text-muted)] pb-3 mb-3 border-b border-[var(--color-border)]">
                전례력
              </h4>
              <LiturgicalMiniCal currentIso={currentIso} />
            </div>
          </aside>
        </div>
      </SectionLayout>
    </>
  );
}
