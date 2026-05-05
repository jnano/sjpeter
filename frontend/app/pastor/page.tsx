import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "신부님",
  description: "세종성베드로성당 주임신부님 소개",
};

export default function PastorPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-[var(--color-primary)] mb-2">
          신부님
        </h1>
        <p className="text-[var(--color-text-muted)]">주임신부님을 소개합니다.</p>
      </div>

      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden">
        <div className="bg-[var(--color-primary)] text-white px-8 py-6">
          <div className="flex items-center gap-6">
            {/* 신부님 사진 플레이스홀더 */}
            <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center text-4xl shrink-0">
              ✝
            </div>
            <div>
              <p className="text-white/70 text-sm mb-1">주임신부</p>
              <h2 className="font-serif text-2xl font-bold">박○○ 신부</h2>
              <p className="text-white/70 text-sm mt-1">2023년 3월 부임</p>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <section>
            <h3 className="font-serif text-lg font-bold text-[var(--color-primary)] mb-3">
              2026년 사목지표
            </h3>
            <blockquote className="border-l-4 border-[var(--color-accent)] pl-5 italic font-serif text-xl text-[var(--color-primary)]">
              "거룩한 향기의 해"
            </blockquote>
          </section>

          <div className="border-t border-[var(--color-border)]" />

          <section>
            <h3 className="font-serif text-lg font-bold text-[var(--color-primary)] mb-3">
              한 말씀
            </h3>
            <div className="bg-[var(--color-surface-warm)] rounded-lg p-6">
              <p className="leading-relaxed text-[var(--color-text)]">
                사랑하는 세종성베드로성당 교우 여러분,<br /><br />
                2026년 한 해를 "거룩한 향기의 해"로 선포합니다.
                우리 각자가 주님의 향기가 되어 이웃에게, 이 도시에 퍼져나가는 한 해가 되기를 바랍니다.
                주보 한 장 한 장이 우리 공동체의 기도이자 역사입니다.
                함께 걸어가겠습니다.
              </p>
              <p className="mt-4 text-right text-[var(--color-text-muted)] text-sm">
                — 박○○ 신부
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
