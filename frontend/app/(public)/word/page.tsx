import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";
import DateNav from "./DateNav";
import GospelToolbar from "./GospelToolbar";
import LiturgicalMiniCal from "./LiturgicalMiniCal";
import ReadTabs from "./ReadTabs";
import WeekReadings, { type WeekDay } from "./WeekReadings";
import { toLocalIso, todayIso } from "./dateUtils";

export const metadata: Metadata = {
  title: "오늘의 복음",
  description: "가톨릭굿뉴스 매일미사 — 1독서·화답송·복음환호송·복음",
};

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── 응답 타입 ──────────────────────────────────────
interface Reading { reference: string; text: string }
interface Psalm { reference: string; refrain: string; verses: string[] }
interface Alleluia { reference: string; refrain: string; verse: string }

interface GospelDay {
  date: string;
  liturgical_season: string | null;
  vestment_color: "white" | "red" | "green" | "purple" | "gold" | null;
  gospel_reference: string | null;
  gospel_text: string | null;
  readings: {
    first: Reading | null;
    second: Reading | null;
    psalm: Psalm | null;
    alleluia: Alleluia | null;
    gospel: Reading | null;
  };
}

interface WeekItem {
  date: string;
  season: string | null;
  first_ref: string | null;
  gospel_ref: string | null;
}

// ── server fetch ──────────────────────────────────
async function fetchGospel(dateIso: string | null): Promise<GospelDay | null> {
  try {
    const url = dateIso ? `${API}/api/gospel?date=${dateIso}` : `${API}/api/gospel/today`;
    // dev: 매 요청 새로 받기. prod: 1시간 캐시.
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.success) return null;
    const d = json.data ?? {};
    // 백엔드 구버전(readings 필드 없음) 호환 — 복음만 readings 에 채움
    const readings = d.readings ?? {
      first: null, second: null, psalm: null, alleluia: null,
      gospel: (d.gospel_reference || d.gospel_text)
        ? { reference: d.gospel_reference ?? "", text: d.gospel_text ?? "" }
        : null,
    };
    return {
      date: d.date ?? dateIso ?? todayIso(),
      liturgical_season: d.liturgical_season ?? null,
      vestment_color: d.vestment_color ?? null,
      gospel_reference: d.gospel_reference ?? null,
      gospel_text: d.gospel_text ?? null,
      readings,
    };
  } catch {
    return null;
  }
}

async function fetchWeek(currentIso: string): Promise<WeekDay[]> {
  const labels = ["월", "화", "수", "목", "금", "토", "일"];
  // ISO week 월요일 시작
  const cur = new Date(currentIso + "T00:00:00");
  const dow = cur.getDay();
  const offsetToMon = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(cur);
  monday.setDate(cur.getDate() + offsetToMon);
  const monIso = toLocalIso(monday); // toISOString 은 UTC 라 KST 자정이 전날로 밀림(v1.5.404)

  try {
    const res = await fetch(`${API}/api/gospel/week?from=${monIso}`, { next: { revalidate: 21600 } });
    if (!res.ok) throw new Error("week fetch failed");
    const json = await res.json();
    if (!json.success) throw new Error(json.message ?? "no data");
    const items: WeekItem[] = json.data;
    return items.map((it, i) => ({
      date: it.date,
      dayLabel: labels[i],
      firstRef: it.first_ref,
      gospelRef: it.gospel_ref,
    }));
  } catch {
    // fallback — 날짜만 채워서 표시 (참조 미상)
    return labels.map((dayLabel, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return {
        date: toLocalIso(d),
        dayLabel,
        firstRef: null,
        gospelRef: null,
      };
    });
  }
}

// ── 색 제의 표시 ──────────────────────────────────
// "제의(祭衣)"는 미사에서 사제가 입는 옷. 전례 시기·축일마다 색이 정해져 있어
// 그날의 분위기를 드러낸다. 신자가 아닌 방문자도 의미를 알 수 있도록 title 에
// 설명을 함께 제공.
const VESTMENT: Record<string, { label: string; hex: string; ink: string; tip: string }> = {
  red:    { label: "빨강색 제의", hex: "#A93232", ink: "#FFF",                 tip: "성령강림·수난주일·성지주일·순교자 기념일 — 성령의 불꽃과 순교자의 피를 뜻합니다" },
  green:  { label: "초록색 제의", hex: "#2E6B43", ink: "#FFF",                 tip: "연중 시기 — 희망과 일상의 신앙을 뜻합니다" },
  purple: { label: "보라색 제의", hex: "#6B4E8C", ink: "#FFF",                 tip: "사순·대림 — 참회와 준비의 시기를 뜻합니다" },
  gold:   { label: "금색 제의",   hex: "#C9A961", ink: "var(--color-text)",    tip: "특별한 대축일 — 가장 큰 영광을 표현합니다" },
  white:  { label: "흰색 제의",   hex: "#E8DFD6", ink: "var(--color-text)",    tip: "부활·성탄·대축일·기념일 — 기쁨과 순결을 뜻합니다" },
};

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
  const currentIso = gospel?.date ?? requestedDate ?? todayIso();
  const week = await fetchWeek(currentIso);

  const vestment = VESTMENT[gospel?.vestment_color ?? "white"] ?? VESTMENT.white;
  const dateFmt = formatKoreanDate(currentIso);
  const missaUrl = `https://maria.catholic.or.kr/mi_pr/missa/missa.asp?goMonth=${currentIso}`;

  // read-tabs 항목 구성 — 실제로 데이터가 있는 reading 만
  const tabs = gospel ? [
    gospel.readings.first ? { id: "first", label: "제1독서", reference: gospel.readings.first.reference } : null,
    gospel.readings.second ? { id: "second", label: "제2독서", reference: gospel.readings.second.reference } : null,
    gospel.readings.psalm ? { id: "psalm", label: "화답송", reference: gospel.readings.psalm.reference } : null,
    gospel.readings.alleluia ? { id: "alleluia", label: "복음환호송", reference: gospel.readings.alleluia.reference } : null,
    gospel.readings.gospel ? { id: "gospel", label: "복음", reference: gospel.readings.gospel.reference } : null,
  ].filter((t): t is { id: string; label: string; reference: string } => !!t) : [];

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
                <a href={missaUrl} target="_blank" rel="noopener noreferrer"
                   className="inline-block px-5 py-2.5 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium hover:opacity-90">
                  굿뉴스에서 직접 보기 →
                </a>
              </div>
            ) : (
              <>
                {/* today-head */}
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
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wider cursor-help"
                    style={{ background: vestment.hex, color: vestment.ink }}
                    title={vestment.tip}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: vestment.ink }} />
                    {vestment.label}
                  </span>
                </section>

                {/* read-tabs (탭이 2개 이상일 때만) */}
                {tabs.length >= 2 && <ReadTabs tabs={tabs} />}

                {/* 제1독서 */}
                {gospel.readings.first && (
                  <ReadingCard id="first" eyebrow="제1독서" reference={gospel.readings.first.reference}>
                    <Passage text={gospel.readings.first.text} />
                  </ReadingCard>
                )}

                {/* 제2독서 (주일·대축일에만) */}
                {gospel.readings.second && (
                  <ReadingCard id="second" eyebrow="제2독서" reference={gospel.readings.second.reference}>
                    <Passage text={gospel.readings.second.text} />
                  </ReadingCard>
                )}

                {/* 화답송 */}
                {gospel.readings.psalm && (
                  <ReadingCard id="psalm" eyebrow="화답송" reference={gospel.readings.psalm.reference}>
                    {gospel.readings.psalm.refrain && (
                      <p className="mb-3 px-5 py-3.5 italic font-semibold text-[15px] text-[var(--color-text)]"
                         style={{ background: "var(--color-surface-warm)", borderLeft: "3px solid var(--color-accent, #C9A961)", borderRadius: "6px" }}>
                        ◎ {gospel.readings.psalm.refrain}
                      </p>
                    )}
                    {gospel.readings.psalm.verses.map((v, i) => (
                      <p key={i} className="mb-2.5 text-[16px] leading-[1.9] text-[var(--color-text)]">
                        ○ {v} <span className="text-[var(--color-accent, #C9A961)] font-bold">◎</span>
                      </p>
                    ))}
                  </ReadingCard>
                )}

                {/* 복음환호송 */}
                {gospel.readings.alleluia && (
                  <ReadingCard id="alleluia" eyebrow="복음환호송" reference={gospel.readings.alleluia.reference}>
                    <p className="mb-2.5 text-[16px] leading-[1.9] font-semibold">◎ {gospel.readings.alleluia.refrain}.</p>
                    {gospel.readings.alleluia.verse && (
                      <p className="mb-2.5 text-[16px] leading-[1.9] text-[var(--color-text)]">○ {gospel.readings.alleluia.verse}</p>
                    )}
                    <p className="text-[16px] leading-[1.9] font-semibold">◎ {gospel.readings.alleluia.refrain}.</p>
                  </ReadingCard>
                )}

                {/* 다크 복음 카드 */}
                {gospel.readings.gospel && (
                  <article id="gospel" className="scroll-mt-28 md:scroll-mt-32 bg-[var(--color-text)] text-white rounded-2xl p-7 sm:p-10 mb-5">
                    <div className="flex justify-between items-baseline gap-3 pb-4 mb-6 border-b border-white/15">
                      <h3 className="text-[13px] tracking-[0.12em] uppercase font-bold" style={{ color: "var(--color-accent, #C9A961)" }}>
                        ✠ 오늘의 복음
                      </h3>
                      <span className="text-[12px] font-bold tracking-tight px-3 py-1 rounded"
                            style={{ background: "rgba(201,169,97,0.2)", color: "var(--color-accent, #C9A961)" }}>
                        {gospel.readings.gospel.reference}
                      </span>
                    </div>
                    {gospel.readings.gospel.text ? (
                      <p className="text-[17px] sm:text-[18px] leading-[1.95] tracking-tight whitespace-pre-line text-white reading-zoom">
                        {gospel.readings.gospel.text}
                      </p>
                    ) : (
                      <p className="text-white/50 italic text-sm">복음 본문을 가져오지 못했습니다.</p>
                    )}
                  </article>
                )}

                {/* 도구 바 */}
                {gospel.gospel_text && (
                  <GospelToolbar text={gospel.gospel_text} reference={gospel.gospel_reference} dateIso={currentIso} />
                )}

                {/* 묵상 링크 — refl-link */}
                <a href="/meditation" className="mt-7 block rounded-2xl p-6 sm:p-8 text-white"
                   style={{ background: "linear-gradient(135deg, var(--color-primary), var(--color-primary-dark, #5C1820))" }}>
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
                    <span className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                          style={{ background: "var(--color-accent, #C9A961)", color: "var(--color-text)" }}>
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <line x1="3" y1="9" x2="15" y2="9" />
                        <polyline points="9 4 15 9 9 14" />
                      </svg>
                    </span>
                  </div>
                </a>

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
              <WeekReadings currentIso={currentIso} week={week} />
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

/* ── 보조 컴포넌트들 (server) ─────────────────────────── */

function ReadingCard({
  id, eyebrow, reference, children,
}: {
  id: string;
  eyebrow: string;
  reference: string;
  children: React.ReactNode;
}) {
  return (
    <article
      id={id}
      className="scroll-mt-28 md:scroll-mt-32 bg-white border border-[var(--color-border)] rounded-2xl p-7 sm:p-10 mb-5"
    >
      <div className="flex justify-between items-baseline gap-3 pb-4 mb-6 border-b border-[var(--color-text)]">
        <h3 className="text-[13px] tracking-[0.12em] uppercase font-bold text-[var(--color-primary)]">
          {eyebrow}
        </h3>
        <span
          className="text-[12px] font-bold tracking-tight px-3 py-1 rounded text-[var(--color-primary)]"
          style={{ background: "rgba(122,31,43,0.06)" }}
        >
          {reference}
        </span>
      </div>
      <div className="reading-zoom">{children}</div>
    </article>
  );
}

function Passage({ text }: { text: string }) {
  // 본문의 각 줄을 그대로 표시. 줄 첫머리에 절 번호(1자리 이상)가 있으면 <sup> 처리.
  const paragraphs = text.split("\n").map((line, i) => {
    const m = line.match(/^(\d+)\s*(.*)$/);
    return m ? (
      <p key={i} className="mb-3 text-[16px] sm:text-[17px] leading-[1.85] text-[var(--color-text)] tracking-tight">
        <span className="text-[11px] text-[var(--color-text-muted)] tabular-nums align-super mr-1 font-bold">{m[1]}</span>
        {m[2]}
      </p>
    ) : (
      <p key={i} className="mb-3 text-[16px] sm:text-[17px] leading-[1.85] text-[var(--color-text)] tracking-tight">
        {line}
      </p>
    );
  });
  return <>{paragraphs}</>;
}
