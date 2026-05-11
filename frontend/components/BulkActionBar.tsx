"use client";

interface Props {
  selectedCount: number;
  total: number;
  allSelected: boolean;
  someSelected: boolean;
  onToggleAll: () => void;
  onDelete: () => void;
  deleting: boolean;
  /** 기본 "선택 N개 삭제" */
  deleteLabel?: string;
  /** 추가 우측 버튼 (예: "선택 게시" 등) */
  extra?: React.ReactNode;
  className?: string;
}

/** admin 목록 상단의 다중 선택 액션 바 */
export default function BulkActionBar({
  selectedCount,
  total,
  allSelected,
  someSelected,
  onToggleAll,
  onDelete,
  deleting,
  deleteLabel,
  extra,
  className = "",
}: Props) {
  if (total === 0) return null;
  return (
    <div className={`flex items-center justify-between mb-3 px-1 ${className}`}>
      <label className="inline-flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={allSelected}
          ref={(el) => {
            if (el) el.indeterminate = someSelected;
          }}
          onChange={onToggleAll}
          className="rounded"
        />
        전체 선택 ({selectedCount}/{total})
      </label>
      {selectedCount > 0 && (
        <div className="flex items-center gap-2">
          {extra}
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="px-3 py-1.5 text-xs rounded-lg border border-red-300 bg-red-50 text-red-700 font-medium hover:bg-red-100 disabled:opacity-50 transition-colors"
          >
            {deleting ? "삭제 중…" : (deleteLabel ?? `선택 ${selectedCount}개 삭제`)}
          </button>
        </div>
      )}
    </div>
  );
}
