import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "성당 소개",
  description: "세종성베드로성당 소개 — 세종시 최초 본당",
};

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-[var(--color-primary)] mb-2">
          성당 소개
        </h1>
        <p className="text-[var(--color-text-muted)]">세종성베드로성당에 오신 것을 환영합니다.</p>
      </div>

      {/* 성당 대표 이미지 플레이스홀더 */}
      <div className="bg-[var(--color-surface-warm)] border border-[var(--color-border)] rounded-xl h-64 flex items-center justify-center mb-8">
        <div className="text-center text-[var(--color-text-muted)]">
          <div className="text-5xl mb-2">⛪</div>
          <p className="text-sm">성당 사진</p>
        </div>
      </div>

      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-8 space-y-6">
        <section>
          <h2 className="font-serif text-xl font-bold text-[var(--color-primary)] mb-3">
            본당 소개
          </h2>
          <p className="leading-relaxed text-[var(--color-text)]">
            세종성베드로성당은 2011년 세종특별자치시 출범과 함께 설립된 세종시 최초의 가톨릭 본당입니다.
            대전교구 소속으로, 빠르게 성장하는 세종시에서 신앙 공동체의 중심으로 자리매김하고 있습니다.
          </p>
        </section>

        <div className="border-t border-[var(--color-border)]" />

        <section>
          <h2 className="font-serif text-xl font-bold text-[var(--color-primary)] mb-4">
            기본 정보
          </h2>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-[var(--color-border)]">
              {[
                { label: "설립일", value: "2011년" },
                { label: "소속 교구", value: "천주교 대전교구" },
                { label: "주소", value: "세종특별자치시 도움5로 00" },
                { label: "전화", value: "044-000-0000" },
                { label: "신자 수", value: "약 480명" },
              ].map((row) => (
                <tr key={row.label}>
                  <td className="py-3 pr-6 text-[var(--color-text-muted)] w-32">{row.label}</td>
                  <td className="py-3 font-medium">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="border-t border-[var(--color-border)]" />

        <section>
          <h2 className="font-serif text-xl font-bold text-[var(--color-primary)] mb-3">
            미사 시간
          </h2>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-[var(--color-border)]">
              {[
                { label: "주일", value: "오전 7:00 / 오전 10:00 / 오후 6:00" },
                { label: "평일 (월–금)", value: "오전 6:30" },
                { label: "토요일", value: "오전 9:00 / 오후 6:00" },
                { label: "첫째 주 금요일", value: "오전 6:30 / 오후 7:30 (성시간 포함)" },
              ].map((row) => (
                <tr key={row.label}>
                  <td className="py-3 pr-6 text-[var(--color-text-muted)] w-32">{row.label}</td>
                  <td className="py-3">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
