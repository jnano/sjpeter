import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "사이트맵",
  description: "세종성베드로성당 홈페이지 전체 페이지 안내",
};

const sections = [
  {
    group: "성당 소개",
    subtitle: "본당과 사목자",
    icon: "⛪",
    pages: [
      { href: "/about",    title: "성당 안내",          desc: "세종시 첫 본당, 교회 공동체 소개" },
      { href: "/pastor",   title: "주임신부님",         desc: "현재 주임 신부님 소개" },
      { href: "/saint",    title: "수호성인 성 베드로", desc: "본당 주보성인 사도 베드로" },
      { href: "/history",  title: "본당 연혁",          desc: "창립부터 현재까지의 연표" },
      { href: "/pastors",  title: "역대 신부님",        desc: "본당을 거쳐간 신부님들" },
      { href: "/sisters",  title: "역대 수녀님",        desc: "본당을 거쳐간 수녀님들" },
      { href: "/priests",  title: "본당 출신 사제",     desc: "본당에서 성소를 받은 사제들" },
      { href: "/info",     title: "찾아오시는 길",      desc: "주소, 미사 시간, 오시는 방법" },
    ],
  },
  {
    group: "본당 공동체",
    subtitle: "조직과 활동",
    icon: "🤝",
    pages: [
      { href: "/community", title: "공동체 안내",       desc: "본당 공동체 전체 구성 안내" },
      { href: "/council",   title: "사목평의회",        desc: "본당 사목을 함께 이끄는 의결 기구" },
      { href: "/groups",    title: "분과와 단체",       desc: "함께 믿음을 키우는 분과와 단체" },
      { href: "/vision",    title: "올해의 사목 방향",  desc: "매년 신부님이 제시하는 사목 방향" },
    ],
  },
  {
    group: "말씀과 기도",
    subtitle: "전례와 영성",
    icon: "✝",
    pages: [
      { href: "/word",       title: "오늘의 복음",   desc: "오늘 선포되는 하느님의 말씀" },
      { href: "/bulletin",   title: "주보 아카이브", desc: "지난 주보 모아보기" },
      { href: "/meditation", title: "묵상 글",       desc: "말씀 안에서 머무는 시간" },
      { href: "/prayer",     title: "기도문",        desc: "함께 바치는 기도" },
    ],
  },
  {
    group: "알림과 게시판",
    subtitle: "공지와 소통",
    icon: "📢",
    pages: [
      { href: "/boards/notice", title: "공지·알림",   desc: "본당 공지사항과 주요 안내" },
      { href: "/calendar",      title: "행사 일정",   desc: "본당 행사·모임 일정" },
      { href: "/boards",        title: "자유 게시판", desc: "자유롭게 이야기 나누는 공간" },
      { href: "/boards/news",   title: "공동체 소식", desc: "공동체 소식과 나눔" },
    ],
  },
  {
    group: "사진 갤러리",
    subtitle: "전례·행사 사진",
    icon: "📷",
    pages: [
      { href: "/gallery/liturgy", title: "전례 사진", desc: "미사와 성사의 거룩한 순간들" },
      { href: "/gallery/events",  title: "행사 사진", desc: "공동체 행사와 나눔의 기록" },
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
                <p className="text-white/60 text-xs">{section.subtitle}</p>
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
