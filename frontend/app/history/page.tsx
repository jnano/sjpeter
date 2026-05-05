import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "우리의 역사",
  description: "세종성베드로성당 창립부터 현재까지의 연표",
};

const historyItems = [
  {
    year: 2011,
    event: "세종성베드로성당 설립",
    detail: "세종특별자치시 출범과 함께 세종시 최초 가톨릭 본당으로 설립. 초대 주임신부 부임.",
    highlight: true,
  },
  {
    year: 2012,
    event: "성당 건물 축성",
    detail: "현재 성당 건물이 완공되어 축성 미사를 봉헌.",
    highlight: false,
  },
  {
    year: 2015,
    event: "신자 수 200명 돌파",
    detail: "세종시 인구 증가와 함께 공동체가 빠르게 성장.",
    highlight: false,
  },
  {
    year: 2019,
    event: "창립 8주년 — 사목평의회 창설",
    detail: "본당 운영의 민주적 참여를 위한 사목평의회 공식 발족.",
    highlight: false,
  },
  {
    year: 2021,
    event: "창립 10주년 기념 행사",
    detail: "10주년 감사 미사 및 공동체 축제 개최. 주보 500호 달성.",
    highlight: true,
  },
  {
    year: 2023,
    event: "현 주임신부 박○○ 신부 부임",
    detail: "새로운 사목 시대의 시작.",
    highlight: false,
  },
  {
    year: 2026,
    event: "현재",
    detail: "신자 약 480명. 주보 제623호 발행 중.",
    highlight: false,
    isCurrent: true,
  },
];

export default function HistoryPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-[var(--color-primary)] mb-2">
          우리의 역사
        </h1>
        <p className="text-[var(--color-text-muted)]">
          2011년 창립부터 현재까지 — 세종성베드로성당의 걸어온 길
        </p>
      </div>

      {/* 연표 */}
      <div className="relative">
        {/* 세로선 */}
        <div className="absolute left-[5.5rem] top-0 bottom-0 w-0.5 bg-[var(--color-border)]" />

        <div className="space-y-0">
          {historyItems.map((item, i) => (
            <div key={i} className="relative flex gap-6 pb-8">
              {/* 연도 */}
              <div className="w-20 shrink-0 text-right pt-1">
                <span
                  className={`text-sm font-bold ${
                    item.isCurrent
                      ? "text-[var(--color-accent)]"
                      : "text-[var(--color-text-muted)]"
                  }`}
                >
                  {item.year}
                </span>
              </div>

              {/* 점 */}
              <div className="relative z-10 shrink-0 mt-2">
                <div
                  className={`w-4 h-4 rounded-full border-2 ${
                    item.highlight || item.isCurrent
                      ? "bg-[var(--color-primary)] border-[var(--color-primary)]"
                      : "bg-white border-[var(--color-border-dark)]"
                  }`}
                />
              </div>

              {/* 내용 */}
              <div
                className={`flex-1 pb-4 ${
                  item.highlight
                    ? "bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 -mt-1"
                    : ""
                }`}
              >
                <h3
                  className={`font-serif font-bold mb-1 ${
                    item.isCurrent
                      ? "text-[var(--color-accent)] text-lg"
                      : item.highlight
                      ? "text-[var(--color-primary)] text-lg"
                      : "text-[var(--color-text)]"
                  }`}
                >
                  {item.event}
                  {item.isCurrent && (
                    <span className="ml-2 text-xs bg-[var(--color-accent)] text-white px-2 py-0.5 rounded-full font-sans">
                      현재
                    </span>
                  )}
                </h3>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                  {item.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 bg-[var(--color-surface-warm)] border border-[var(--color-border)] rounded-xl p-5 text-center">
        <p className="text-sm text-[var(--color-text-muted)]">
          오늘을 기록하면 역사가 됩니다. 주보 아카이브에서 본당의 전체 역사를 확인하세요.
        </p>
      </div>
    </div>
  );
}
