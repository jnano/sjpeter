"use client";

import Script from "next/script";
import type { Bulletin } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// API 데이터가 없을 때 보여줄 정적 샘플
const SAMPLE_BULLETINS: Bulletin[] = [
  {
    id: 0,
    issue_number: 623,
    published_date: "2026-05-03",
    liturgical_season: "부활 제5주일",
    gospel_reference: "요한 15,1-8",
    pdf_url: null,
    ai_summary: null,
  },
];

const KAKAO_KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY ?? "";

function shareToKakao(b: Bulletin) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kakao = (window as any).Kakao;
  if (!kakao?.isInitialized()) return;
  kakao.Share.sendDefault({
    objectType: "feed",
    content: {
      title: b.issue_number ? `세종성베드로성당 주보 제${b.issue_number}호` : "세종성베드로성당 주보",
      description: [b.liturgical_season, b.gospel_reference].filter(Boolean).join(" · ") || "이번 주 주보를 확인하세요",
      imageUrl: "https://t1.kakaocdn.net/kakao_js_sdk/1.1/kakao_thumbnail.png",
      link: { mobileWebUrl: window.location.href, webUrl: window.location.href },
    },
    buttons: [
      { title: "주보 보기", link: { mobileWebUrl: window.location.href, webUrl: window.location.href } },
    ],
  });
}

export default function BulletinClient({ bulletins }: { bulletins: Bulletin[] }) {
  const list = bulletins.length > 0 ? bulletins : SAMPLE_BULLETINS;
  const latest = list[0];

  // 연도별 그룹핑
  const byYear = list.reduce<Record<number, Bulletin[]>>((acc, b) => {
    const year = new Date(b.published_date).getFullYear();
    (acc[year] ??= []).push(b);
    return acc;
  }, {});
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);

  function formatDate(iso: string) {
    const d = new Date(iso);
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Script
        src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js"
        strategy="lazyOnload"
        onLoad={() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const k = (window as any).Kakao;
          if (k && !k.isInitialized() && KAKAO_KEY) k.init(KAKAO_KEY);
        }}
      />

      <div className="grid md:grid-cols-5 gap-8">
        {/* 이번 주 주보 */}
        <div className="md:col-span-3">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden">
            <div className="bg-[var(--color-primary)] text-white px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-white/70 text-sm">이번 주 주보</p>
                <h2 className="font-serif text-xl font-bold mt-0.5">
                  {latest.issue_number ? `제${latest.issue_number}호` : "주보"}
                </h2>
              </div>
              <div className="text-right text-sm text-white/70">
                <p>{new Date(latest.published_date).getFullYear()}년 {formatDate(latest.published_date)}</p>
                {latest.liturgical_season && (
                  <p className="text-[var(--color-accent-light)] font-medium mt-0.5">
                    {latest.liturgical_season}
                  </p>
                )}
              </div>
            </div>

            <div className="bg-[var(--color-surface-warm)] flex flex-col items-center justify-center min-h-96 p-12 text-center">
              {latest.pdf_url ? (
                <iframe
                  src={`${API}${latest.pdf_url}`}
                  className="w-full h-[600px] rounded border border-[var(--color-border)]"
                  title={`주보 ${latest.issue_number ? `제${latest.issue_number}호` : ""}`}
                />
              ) : (
                <div>
                  <div className="text-6xl mb-4 text-[var(--color-border-dark)]">📄</div>
                  <p className="text-[var(--color-text-muted)] text-lg mb-2">PDF 준비 중입니다</p>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    관리자가 주보를 업로드하면 여기에 표시됩니다.
                  </p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-[var(--color-border)] flex gap-3">
              <a
                href={latest.pdf_url ? `${API}${latest.pdf_url}` : "#"}
                download
                className={`flex-1 text-center py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  latest.pdf_url
                    ? "bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white"
                    : "bg-[var(--color-surface-warm)] text-[var(--color-text-muted)] cursor-not-allowed"
                }`}
              >
                ↓ PDF 내려받기
              </a>
              <a
                href={latest.pdf_url ? `${API}${latest.pdf_url}` : "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center border border-[var(--color-border)] hover:bg-[var(--color-surface-warm)] py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                ↗ 새 창으로 보기
              </a>
              {KAKAO_KEY && (
                <button
                  onClick={() => shareToKakao(latest)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  style={{ backgroundColor: "#FEE500", color: "#3C1E1E" }}
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                    <path d="M12 3C6.48 3 2 6.48 2 10.8c0 2.74 1.57 5.16 3.96 6.64l-.99 3.69 4.28-2.82c.88.17 1.8.26 2.75.26 5.52 0 10-3.48 10-7.77C22 6.48 17.52 3 12 3z" />
                  </svg>
                  카카오 공유
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 아카이브 */}
        <div className="md:col-span-2">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--color-border)]">
              <h3 className="font-serif font-bold text-[var(--color-primary)]">지난 주보 아카이브</h3>
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              {years.map((year) => (
                <div key={year}>
                  <div className="px-5 py-2.5 bg-[var(--color-surface-warm)] text-sm font-bold text-[var(--color-text-muted)]">
                    {year}년
                  </div>
                  {byYear[year].map((b) => (
                    <div
                      key={b.id}
                      className={`px-5 py-3 flex items-center justify-between hover:bg-[var(--color-surface-warm)] transition-colors ${
                        b.id === latest.id ? "bg-blue-50 border-l-4 border-l-[var(--color-primary)]" : ""
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {b.issue_number ? `제${b.issue_number}호` : formatDate(b.published_date)}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {formatDate(b.published_date)}
                          {b.liturgical_season && ` · ${b.liturgical_season}`}
                        </p>
                      </div>
                      {b.pdf_url ? (
                        <a
                          href={`${API}${b.pdf_url}`}
                          className="text-xs text-[var(--color-primary)] hover:underline"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          보기
                        </a>
                      ) : (
                        <span className="text-xs text-[var(--color-border-dark)]">준비 중</span>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
