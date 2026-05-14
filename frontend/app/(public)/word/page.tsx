import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";

export const metadata: Metadata = {
  title: "오늘의 복음",
  description: "가톨릭굿뉴스 매일미사 — 오늘의 복음",
};

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

  const subtitle = gospel
    ? `${formatDate(gospel.date)}${gospel.liturgical_season ? " · " + gospel.liturgical_season : ""}`
    : "오늘 선포되는 하느님의 말씀";

  const missaUrl = gospel
    ? `https://maria.catholic.or.kr/mi_pr/missa/missa.asp?goMonth=${gospel.date}`
    : "https://maria.catholic.or.kr/mi_pr/missa/missa.asp";

  return (
    <>
      <PageHeader group="말씀과 기도" title="오늘의 복음" subtitle={subtitle} />
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
              <div className="flex items-baseline gap-3 mb-5">
                <h2 className="font-sans font-bold text-xl text-white">복음</h2>
                {gospel.gospel_reference && (
                  <span className="text-white/70 text-sm">{gospel.gospel_reference}</span>
                )}
              </div>

              {gospel.gospel_text ? (
                <p className="leading-relaxed text-white/90 text-base whitespace-pre-line">
                  {gospel.gospel_text}
                </p>
              ) : (
                <p className="text-white/50 italic text-sm">복음 본문을 가져오지 못했습니다.</p>
              )}
            </div>

            {/* 전례 정보 */}
            {gospel.liturgical_season && (
              <div className="bg-[var(--color-surface-warm)] border border-[var(--color-border)] rounded-xl px-6 py-4 flex items-center gap-3">
                <span className="text-[var(--color-accent)] text-lg">✝</span>
                <div>
                  <p className="text-xs text-[var(--color-text-muted)] mb-0.5">오늘의 전례</p>
                  <p className="text-sm font-medium text-[var(--color-primary)]">{gospel.liturgical_season}</p>
                </div>
              </div>
            )}

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
