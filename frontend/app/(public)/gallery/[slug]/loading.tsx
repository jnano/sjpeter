// 갤러리 게시판 로딩 UI — Next.js App Router 자동.
// '목록으로' 등 client-side navigation 으로 진입 시 RSC 응답 도착 전까지
// 이 컴포넌트가 즉시 표시되어 이전 페이지의 footer 잔상이 보이지 않음.
//
// 디자인: 헤더 자리(스페이서) + 사진 그리드 skeleton (6 × aspect-square).
// 갤러리 페이지의 실제 그리드 구조(grid-cols-2 sm:grid-cols-3 gap-3)를 그대로
// 따라가 mount 시점 layout shift 를 최소화.
export default function GalleryLoading() {
  return (
    <div className="min-h-[60vh]">
      {/* PageHeader 자리 - 실제와 동일한 높이 확보 */}
      <div className="bg-white border-b border-[var(--color-border)] w-full">
        <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
          <div className="h-3 w-32 mb-3 bg-[var(--color-surface-warm)] rounded animate-pulse" />
          <div className="h-7 w-56 bg-[var(--color-surface-warm)] rounded animate-pulse" />
        </div>
      </div>

      {/* 본문 영역 skeleton (사진 그리드) */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:gap-10">
          {/* 사이드바 자리 — 폭만 확보 (collapsed 상태면 사라지지만 비대칭 회피 위해 reserve) */}
          <div className="hidden md:block shrink-0 w-[170px]" aria-hidden />
          {/* 사진 그리드 placeholder */}
          <div className="flex-1 min-w-0">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Array.from({ length: 6 }, (_, i) => (
                <div
                  key={i}
                  className="aspect-square bg-[var(--color-surface-warm)] rounded animate-pulse"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
