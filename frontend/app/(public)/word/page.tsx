import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";
import GospelText from "./GospelText";

export const metadata: Metadata = {
  title: "오늘의 복음",
  description: "가톨릭굿뉴스 매일미사 — 오늘의 복음",
};

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface GospelToday {
  date: string;
  liturgical_season: string | null;
  gospel_reference: string | null;
  gospel_text: string | null;
}

async function fetchGospel(): Promise<GospelToday | null> {
  try {
    const res = await fetch(`${API}/api/gospel/today`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const json = await res.json();
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric", weekday: "long",
  });
}

export default async function WordPage() {
  const gospel = await fetchGospel();

  const missaUrl = gospel
    ? `https://maria.catholic.or.kr/mi_pr/missa/missa.asp?goMonth=${gospel.date}`
    : "https://maria.catholic.or.kr/mi_pr/missa/missa.asp";

  return (
    <>
      <PageHeader group="말씀과 기도" title="오늘의 복음" subtitle="오늘 선포되는 하느님의 말씀" />
      <SectionLayout group="word">

        {!gospel ? (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-12 text-center">
            <p className="text-4xl mb-4">📖</p>
            <p className="font-sans font-semibold text-[var(--color-primary)] mb-2">말씀을 불러올 수 없습니다</p>
            <p className="text-sm text-[var(--color-text-muted)] mb-6">
              가톨릭굿뉴스 서버에 일시적인 문제가 있을 수 있습니다.
            </p>
            <a
              href="https://maria.catholic.or.kr/mi_pr/missa/missa.asp"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-5 py-2.5 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              굿뉴스에서 직접 보기 →
            </a>
          </div>
        ) : (
          <div className="space-y-5">

            {/* 복음 본문 */}
            <div className="bg-[var(--color-primary)] text-white rounded-xl p-8">
              <div className="flex items-start justify-between gap-3 pb-4 mb-5 border-b border-white/20">
                <div className="flex items-baseline gap-3 min-w-0">
                  <h2 className="font-sans font-bold text-xl text-white">복음</h2>
                  {gospel.gospel_reference && (
                    <span className="text-white/70 text-sm">{gospel.gospel_reference}</span>
                  )}
                </div>
                {/* 날짜 + 전례 시기 — 카드 상단 우측 작은 글씨 */}
                <div className="text-right text-white/60 text-[11px] leading-relaxed shrink-0">
                  <div>{formatDate(gospel.date)}</div>
                  {gospel.liturgical_season && <div>{gospel.liturgical_season}</div>}
                </div>
              </div>

              {gospel.gospel_text ? (
                // 60대 신자 가독성 고려: 18px + leading 1.8 + 약간의 자간 + 100% 흰색
                // 3줄 요약 + 클릭 시 전체 펼치기 (GospelText client component)
                <GospelText text={gospel.gospel_text} />
              ) : (
                <p className="text-white/50 italic text-sm">복음 본문을 가져오지 못했습니다.</p>
              )}
            </div>

            {/* 전체 미사 독서 링크 */}
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 flex items-center justify-between gap-4">
              <div>
                <p className="font-sans font-semibold text-[var(--color-primary)] mb-1">오늘의 전체 미사 말씀</p>
                <p className="text-sm text-[var(--color-text-muted)]">제1독서, 화답송, 복음환호송, 복음 전문을 굿뉴스에서 확인하세요.</p>
              </div>
              <a
                href={missaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 px-4 py-2.5 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity whitespace-nowrap"
              >
                굿뉴스 보기 →
              </a>
            </div>

            {/* 출처 */}
            <p className="text-center text-xs text-[var(--color-text-muted)]">
              출처: 가톨릭인터넷 굿뉴스 (catholic.or.kr) · 매일 자동 업데이트
            </p>
          </div>
        )}
      </SectionLayout>
    </>
  );
}
