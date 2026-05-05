import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "함께하는 이들",
  description: "세종성베드로성당 사목평의회 및 각 분과 소개",
};

const councils = [
  {
    name: "사목평의회",
    desc: "본당 운영 전반을 논의하고 결정하는 최고 의결 기구",
    members: "회장단 및 각 분과 대표",
  },
  {
    name: "레지아 마리애",
    desc: "성모 마리아를 통한 사도직 수행 — 병자 방문, 본당 봉사",
    members: "매주 화요일 활동",
  },
  {
    name: "성가대",
    desc: "미사의 전례 음악을 담당하는 봉사자 모임",
    members: "주일 미사 봉사",
  },
  {
    name: "청년회",
    desc: "20–40대 청년 신앙 공동체. 신앙 활동 및 봉사",
    members: "매달 모임",
  },
  {
    name: "교리반",
    desc: "예비신자, 어린이, 청소년 교리 교육 담당",
    members: "주일 오전",
  },
  {
    name: "구역·반 모임",
    desc: "지역별 소공동체 모임. 신앙 나눔 및 상호 돌봄",
    members: "구역별 자율 운영",
  },
];

export default function CommunityPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-[var(--color-primary)] mb-2">
          함께하는 이들
        </h1>
        <p className="text-[var(--color-text-muted)]">
          세종성베드로성당을 이루는 사람들과 모임을 소개합니다.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {councils.map((group) => (
          <div
            key={group.name}
            className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 hover:border-[var(--color-primary)] hover:shadow-sm transition-all"
          >
            <div className="flex items-start gap-3">
              <span className="text-[var(--color-accent)] text-xl mt-0.5">✝</span>
              <div>
                <h3 className="font-serif font-bold text-[var(--color-primary)] text-lg mb-1">
                  {group.name}
                </h3>
                <p className="text-sm text-[var(--color-text)] leading-relaxed mb-2">
                  {group.desc}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-warm)] border border-[var(--color-border)] inline-block px-2 py-0.5 rounded">
                  {group.members}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-[var(--color-surface-warm)] border border-[var(--color-border)] rounded-xl p-6 text-center">
        <p className="font-serif text-lg text-[var(--color-primary)] mb-2">
          새가족이신가요?
        </p>
        <p className="text-sm text-[var(--color-text-muted)]">
          본당 사무실(044-000-0000)로 연락하시거나 주일 미사 후 안내 데스크를 방문해 주세요.
        </p>
      </div>
    </div>
  );
}
