import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-[var(--color-primary-dark)] text-white/80 mt-16">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* 성당 정보 */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[var(--color-accent-light)] text-xl">✝</span>
              <span className="font-serif font-bold text-white text-lg">세종성베드로성당</span>
            </div>
            <address className="not-italic text-sm leading-relaxed space-y-1">
              <p>세종특별자치시 도움5로 00</p>
              <p>☏ 044-000-0000</p>
              <p>대전교구 소속</p>
            </address>
          </div>

          {/* 미사 시간 */}
          <div>
            <h3 className="font-serif font-bold text-white mb-4">미사 시간</h3>
            <table className="text-sm w-full">
              <tbody className="space-y-1">
                <tr>
                  <td className="text-white/60 pr-4 pb-1">주일</td>
                  <td>오전 7:00, 10:00 / 오후 6:00</td>
                </tr>
                <tr>
                  <td className="text-white/60 pr-4 pb-1">평일</td>
                  <td>오전 6:30</td>
                </tr>
                <tr>
                  <td className="text-white/60 pr-4">토요일</td>
                  <td>오전 9:00 / 오후 6:00</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 바로가기 */}
          <div>
            <h3 className="font-serif font-bold text-white mb-4">바로가기</h3>
            <nav className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {[
                { href: "/bulletin", label: "주보" },
                { href: "/about", label: "성당 소개" },
                { href: "/pastor", label: "신부님" },
                { href: "/history", label: "우리의 역사" },
                { href: "/word", label: "오늘의 말씀" },
                { href: "/info", label: "오시는 길" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="hover:text-white transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        <div className="border-t border-white/10 mt-8 pt-6 text-center text-xs text-white/40">
          © {new Date().getFullYear()} 세종성베드로성당. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
