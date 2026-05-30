/**
 * /boards/* 그룹 streaming fallback (v1.5.453).
 * Next.js App Router 가 RSC 로딩 중 자동 표시.
 */
export default function Loading() {
  return (
    <div className="max-w-[1320px] mx-auto px-5 lg:px-14 py-12">
      <div className="animate-pulse space-y-4">
        <div className="h-7 w-32 bg-[var(--color-surface-warm)] rounded" />
        <div className="h-px bg-[var(--color-border)]" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 bg-[var(--color-surface-warm)]/60 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
