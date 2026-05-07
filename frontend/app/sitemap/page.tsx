import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "사이트맵",
  description: "세종성베드로성당 홈페이지 전체 페이지 안내",
};

const sections = [
  {
    group: "우리 성당",
    subtitle: "반석 위에",
    icon: "⛪",
    pages: [
      { href: "/about",     title: "성당 소개",       desc: "세종시 첫 본당, 교회 공동체의 이야기" },
      { href: "/saint",     title: "성 베드로",        desc: "우리 성당의 이름, 주보성인 사도 베드로" },
      { href: "/community", title: "우리 가족",        desc: "본당 신자 공동체와 모임 소개" },
      { href: "/history",   title: "걸어온 길",        desc: "창립부터 현재까지의 연표" },
      { href: "/pastor",    title: "사제의 발자취",     desc: "주임 신부님과 함께하는 본당 공동체" },
      { href: "/info",      title: "찾아오시는 길",     desc: "주소, 미사 시간, 오시는 방법" },
    ],
  },
  {
    group: "본당 가족",
    subtitle: "어부의 뜰",
    icon: "🐟",
    pages: [
      { href: "/council", title: "사목평의회",      desc: "본당 사목을 함께 이끌어 가는 의결 기구" },
      { href: "/groups",  title: "분과와 단체",      desc: "함께 믿음을 키워가는 분과와 단체들" },
      { href: "/vision",  title: "이 해의 사목 방향", desc: "매년 신부님이 제시하는 한 해의 씨앗" },
    ],
  },
  {
    group: "말씀과 기도",
    subtitle: "말씀의 그물",
    icon: "✝",
    pages: [
      { href: "/word",       title: "오늘의 복음",   desc: "오늘 선포되는 하느님의 말씀" },
      { href: "/bulletin",   title: "주보 아카이브", desc: "지난 주보를 한 자리에서 만납니다" },
      { href: "/meditation", title: "작은 묵상",     desc: "말씀 안에서 머무는 시간" },
      { href: "/prayer",     title: "기도문 모음",   desc: "함께 바치는 기도" },
    ],
  },
  {
    group: "알림과 나눔",
    subtitle: "열린 문",
    icon: "📢",
    pages: [
      { href: "/boards/notice", title: "공지·알림",  desc: "본당 공지사항과 주요 안내" },
      { href: "/boards/free",   title: "자유 글터",  desc: "자유롭게 이야기 나누는 공간" },
      { href: "/boards/news",   title: "공동체 소식", desc: "공동체 소식과 나눔" },
    ],
  },
  {
    group: "사진 기록",
    subtitle: "갈릴래아의 기억",
    icon: "📷",
    pages: [
      { href: "/gallery/liturgy", title: "전례의 순간", desc: "미사와 성사의 거룩한 순간들" },
      { href: "/gallery/events",  title: "함께한 시간",  desc: "공동체 행사와 나눔의 기록" },
    ],
  },
];

export default function SitemapPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-10">
        <p className="text-xs tracking-wide text-[var(--color-text-muted)] mb-3">
          세종성베드로성당
          <span className="mx-1.5 opacity-40">›</span>
          사이트맵
        </p>
        <h1 className="font-serif text-3xl font-bold text-[var(--color-primary)] mb-2">
          사이트맵
        </h1>
        <p className="text-[var(--color-text-muted)]">홈페이지의 모든 페이지를 한 눈에 확인하세요.</p>
      </div>

      <div className="space-y-6">
        {sections.map((section) => (
          <section
            key={section.group}
            className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden"
          >
            {/* 섹션 헤더 */}
            <div className="bg-[var(--color-primary)] px-6 py-4 flex items-center gap-3">
              <span className="text-xl">{section.icon}</span>
              <div>
                <h2 className="font-serif font-bold text-white text-lg leading-tight">
                  {section.group}
                </h2>
                <p className="text-white/60 text-xs italic">{section.subtitle}</p>
              </div>
            </div>

            {/* 페이지 목록 */}
            <ul className="divide-y divide-[var(--color-border)]">
              {section.pages.map((page) => (
                <li key={page.href}>
                  <Link
                    href={page.href}
                    className="flex items-center justify-between px-6 py-4 hover:bg-[var(--color-surface-warm)] transition-colors group"
                  >
                    <div>
                      <span className="font-medium text-sm text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors">
                        {page.title}
                      </span>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{page.desc}</p>
                    </div>
                    <span className="text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] transition-colors ml-4 shrink-0 text-sm">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
