import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "오늘의 말씀",
  description: "가톨릭굿뉴스 오늘의 말씀 — 매일 전례 말씀",
};

interface Reading {
  title: string;
  reference: string;
  text: string;
}

async function fetchDailyWord(): Promise<{
  date: string;
  liturgicalSeason: string;
  readings: Reading[];
  gospel: Reading | null;
} | null> {
  try {
    // 가톨릭굿뉴스 RSS 연동 — Phase 3에서 완성
    // 현재는 오늘 날짜 기반 구조만 반환
    const today = new Date().toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });

    return {
      date: today,
      liturgicalSeason: "부활 제5주일",
      readings: [
        {
          title: "제1독서",
          reference: "사도 9,26-31",
          text: "사울이 예루살렘에 이르러 제자들과 어울리려고 하였으나, 그가 제자가 된 것을 믿지 않아 모두 그를 두려워하였다. 그때 바르나바가 그를 데리고 사도들에게 가서, 그가 다마스쿠스로 가는 길에서 주님을 보았으며 주님이 그에게 말씀하셨고, 또 그가 다마스쿠스에서 예수님의 이름으로 담대하게 말하였다는 것을 이야기하여 주었다.",
        },
      ],
      gospel: {
        title: "복음",
        reference: "요한 15,1-8",
        text: "그때에 예수님께서 제자들에게 말씀하셨다. '나는 참포도나무요 나의 아버지는 농부이시다. 나에게 붙어 있으면서 열매를 맺지 못하는 가지는 아버지께서 다 잘라 내시고, 열매를 맺는 가지는 더 많은 열매를 맺도록 깨끗이 손질하신다.'",
      },
    };
  } catch {
    return null;
  }
}

export default async function WordPage() {
  const word = await fetchDailyWord();

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-[var(--color-primary)] mb-2">
          오늘의 말씀
        </h1>
        {word && (
          <p className="text-[var(--color-text-muted)]">
            {word.date} · {word.liturgicalSeason}
          </p>
        )}
      </div>

      {!word ? (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-12 text-center">
          <p className="text-[var(--color-text-muted)]">말씀을 불러오는 중입니다…</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* 독서들 */}
          {word.readings.map((reading, i) => (
            <div
              key={i}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6"
            >
              <div className="flex items-baseline gap-3 mb-4">
                <h2 className="font-serif font-bold text-[var(--color-primary)]">
                  {reading.title}
                </h2>
                <span className="text-sm text-[var(--color-text-muted)]">
                  {reading.reference}
                </span>
              </div>
              <p className="leading-relaxed text-[var(--color-text)]">{reading.text}</p>
            </div>
          ))}

          {/* 복음 — 강조 */}
          {word.gospel && (
            <div className="bg-[var(--color-primary)] text-white rounded-xl p-6">
              <div className="flex items-baseline gap-3 mb-4">
                <h2 className="font-serif font-bold text-xl">복음</h2>
                <span className="text-white/70 text-sm">{word.gospel.reference}</span>
              </div>
              <p className="leading-relaxed">{word.gospel.text}</p>
            </div>
          )}

          {/* 출처 */}
          <div className="text-center">
            <p className="text-xs text-[var(--color-text-muted)]">
              출처: 가톨릭굿뉴스 (catholics.or.kr)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
