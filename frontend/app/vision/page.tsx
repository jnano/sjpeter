import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "사목지표",
  description: "세종성베드로성당 역대 사목지표",
};

const visions = [
  { year: 2026, motto: "거룩한 향기의 해", isCurrent: true },
  { year: 2025, motto: "사랑으로 하나 되는 공동체", isCurrent: false },
  { year: 2024, motto: "말씀 안에서 성장하는 해", isCurrent: false },
  { year: 2023, motto: "새로운 출발, 함께하는 신앙", isCurrent: false },
  { year: 2022, motto: "희망을 향하여", isCurrent: false },
  { year: 2021, motto: "창립 10주년 — 감사와 새로운 다짐", isCurrent: false },
  { year: 2020, motto: "코로나를 넘어 — 연결된 신앙", isCurrent: false },
  { year: 2019, motto: "하느님 안에서 하나 되는 공동체", isCurrent: false },
];

export default function VisionPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-[var(--color-primary)] mb-2">
          사목지표
        </h1>
        <p className="text-[var(--color-text-muted)]">
          매년 신부님이 제시하는 사목지표는 한 해의 씨앗입니다.
        </p>
      </div>

      {/* 현재 지표 강조 */}
      <div className="bg-[var(--color-primary)] text-white rounded-xl p-8 mb-8 text-center">
        <p className="text-white/70 text-sm mb-2">{visions[0].year}년 사목지표</p>
        <blockquote className="font-serif text-3xl font-bold">
          "{visions[0].motto}"
        </blockquote>
        <p className="text-white/60 text-sm mt-4">주임신부 박○○ 신부</p>
      </div>

      {/* 역대 지표 */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--color-border)]">
          <h2 className="font-serif font-bold text-[var(--color-primary)]">역대 사목지표</h2>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {visions.map((v) => (
            <div
              key={v.year}
              className={`flex items-center gap-6 px-6 py-4 ${
                v.isCurrent ? "bg-blue-50" : "hover:bg-[var(--color-surface-warm)]"
              } transition-colors`}
            >
              <span
                className={`text-sm font-bold w-12 shrink-0 ${
                  v.isCurrent ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"
                }`}
              >
                {v.year}
              </span>
              <span
                className={`font-serif ${
                  v.isCurrent ? "font-bold text-[var(--color-primary)]" : ""
                }`}
              >
                "{v.motto}"
              </span>
              {v.isCurrent && (
                <span className="ml-auto text-xs bg-[var(--color-primary)] text-white px-2 py-0.5 rounded-full">
                  올해
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-[var(--color-text-muted)]">
        지표는 씨앗이고, 한 해의 기록은 그 씨앗이 자란 나무입니다.
      </p>
    </div>
  );
}
