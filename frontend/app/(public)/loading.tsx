/**
 * 공개 사이트 streaming fallback (v1.5.453).
 * 헤더는 부모 layout 에 살아있고 본문만 placeholder.
 */
export default function Loading() {
  return (
    <div className="max-w-[1320px] mx-auto px-5 lg:px-14 py-12">
      <div className="animate-pulse space-y-5">
        <div className="h-9 w-48 bg-[var(--color-surface-warm)] rounded" />
        <div className="h-4 w-72 bg-[var(--color-surface-warm)]/70 rounded" />
        <div className="h-64 bg-[var(--color-surface-warm)]/60 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 bg-[var(--color-surface-warm)]/50 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
