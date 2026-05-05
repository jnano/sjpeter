import Link from "next/link";

// Phase 2에서 API로 교체
const massTimes = [
  { day: "주일", times: ["오전 7:00", "오전 10:00", "오후 6:00"] },
  { day: "평일 (월–금)", times: ["오전 6:30"] },
  { day: "토요일", times: ["오전 9:00", "오후 6:00"] },
  { day: "첫째 주 금요일", times: ["오전 6:30", "오후 7:30 (성시간 포함)"] },
];

const latestBulletin = {
  issueNumber: 623,
  date: "2026년 5월 3일",
  liturgicalSeason: "부활 제5주일",
  gospel: "요한 15,1-8",
  pdfUrl: null as string | null,
};

const notices = [
  {
    id: 1,
    title: "2026년 5월 성모성월 묵주기도 안내",
    date: "2026.05.01",
    isPinned: true,
  },
  {
    id: 2,
    title: "본당 어린이 첫영성체 준비 시작",
    date: "2026.04.28",
    isPinned: false,
  },
  {
    id: 3,
    title: "사목평의회 정기 회의 결과 공지",
    date: "2026.04.25",
    isPinned: false,
  },
];

const quickLinks = [
  { href: "/bulletin", icon: "📖", label: "주보", desc: "이번 주 주보 보기" },
  { href: "/word", icon: "✝", label: "오늘의 말씀", desc: "오늘 전례 말씀" },
  { href: "/info", icon: "📍", label: "오시는 길", desc: "찾아오시는 방법" },
  { href: "/history", icon: "📜", label: "우리의 역사", desc: "본당 연표" },
];

export default function HomePage() {
  return (
    <div>
      {/* 히어로 — 이번 주 전례 */}
      <section className="bg-[var(--color-primary)] text-white">
        <div className="max-w-6xl mx-auto px-4 py-10 md:py-14">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            {/* 이번 주 전례 정보 */}
            <div>
              <p className="text-[var(--color-accent-light)] text-sm font-medium mb-2 uppercase tracking-wider">
                {new Date().toLocaleDateString("ko-KR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  weekday: "long",
                })}
              </p>
              <h1 className="font-serif text-3xl md:text-4xl font-bold mb-2 leading-tight">
                {latestBulletin.liturgicalSeason}
              </h1>
              <p className="text-white/70 text-lg mb-6">
                복음 · {latestBulletin.gospel}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/bulletin"
                  className="inline-flex items-center gap-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-light)] text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
                >
                  📖 제{latestBulletin.issueNumber}호 주보 보기
                </Link>
                <Link
                  href="/word"
                  className="inline-flex items-center gap-2 border border-white/30 hover:bg-white/10 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
                >
                  오늘의 말씀
                </Link>
              </div>
            </div>

            {/* 주보 미리보기 카드 */}
            <div className="bg-white/10 rounded-xl p-6 backdrop-blur-sm border border-white/20">
              <div className="text-center">
                <div className="text-[var(--color-accent-light)] text-4xl mb-3">✝</div>
                <div className="font-serif text-xl font-bold mb-1">
                  세종성베드로성당
                </div>
                <div className="text-white/60 text-sm mb-4">
                  주보 제{latestBulletin.issueNumber}호
                </div>
                <div className="bg-white/10 rounded-lg p-4 text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-white/60">발행일</span>
                    <span>{latestBulletin.date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">전례 시기</span>
                    <span>{latestBulletin.liturgicalSeason}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">복음</span>
                    <span>{latestBulletin.gospel}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-10 space-y-12">
        {/* 바로가기 */}
        <section>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 text-center hover:border-[var(--color-primary)] hover:shadow-md transition-all group"
              >
                <div className="text-3xl mb-2">{link.icon}</div>
                <div className="font-serif font-bold text-[var(--color-primary)] group-hover:text-[var(--color-primary-light)] mb-1">
                  {link.label}
                </div>
                <div className="text-sm text-[var(--color-text-muted)]">
                  {link.desc}
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* 미사 시간 + 공지사항 */}
        <section className="grid md:grid-cols-2 gap-8">
          {/* 미사 시간표 */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6">
            <h2 className="font-serif text-xl font-bold text-[var(--color-primary)] mb-5 pb-3 border-b border-[var(--color-border)]">
              미사 시간
            </h2>
            <div className="space-y-4">
              {massTimes.map((row) => (
                <div key={row.day} className="flex gap-4">
                  <span className="text-sm text-[var(--color-text-muted)] w-28 shrink-0 pt-0.5">
                    {row.day}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {row.times.map((time) => (
                      <span
                        key={time}
                        className="bg-[var(--color-surface-warm)] border border-[var(--color-border)] text-sm px-2.5 py-1 rounded"
                      >
                        {time}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-5 text-xs text-[var(--color-text-muted)] border-t border-[var(--color-border)] pt-3">
              * 시간 변경 시 주보 및 공지사항을 확인해 주세요.
            </p>
          </div>

          {/* 공지사항 */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-[var(--color-border)]">
              <h2 className="font-serif text-xl font-bold text-[var(--color-primary)]">
                공지사항
              </h2>
            </div>
            <ul className="space-y-3">
              {notices.map((notice) => (
                <li
                  key={notice.id}
                  className="flex items-start gap-3 py-2 border-b border-[var(--color-border)] last:border-0"
                >
                  {notice.isPinned && (
                    <span className="mt-0.5 shrink-0 text-xs bg-[var(--color-primary)] text-white px-1.5 py-0.5 rounded font-medium">
                      고정
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-snug">{notice.title}</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                      {notice.date}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 사목지표 배너 */}
        <section className="bg-[var(--color-surface-warm)] border border-[var(--color-border)] rounded-xl p-8 text-center">
          <p className="text-sm text-[var(--color-text-muted)] mb-2">
            2026년 사목지표
          </p>
          <h2 className="font-serif text-2xl md:text-3xl font-bold text-[var(--color-primary)]">
            "거룩한 향기의 해"
          </h2>
          <p className="text-[var(--color-text-muted)] mt-3 text-sm">
            주임신부 박○○ 신부
          </p>
        </section>
      </div>
    </div>
  );
}
