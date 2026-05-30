/**
 * /admin/* streaming fallback (v1.5.453).
 * admin 페이지 로딩 중 표시. 단순 스피너 + 텍스트.
 */
export default function Loading() {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span className="inline-block w-4 h-4 border-2 border-gray-300 border-t-[var(--color-primary)] rounded-full animate-spin" />
          불러오는 중…
        </div>
      </div>
    </div>
  );
}
