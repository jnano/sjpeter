"use client";

import { useCallback, useState } from "react";

/**
 * admin 목록 페이지의 다중 선택 + 일괄 삭제 패턴 공통 훅.
 *
 * 사용:
 *   const select = useBulkSelect(boards.map(b => b.id));
 *   <input checked={select.isSelected(b.id)} onChange={() => select.toggle(b.id)} />
 *   <BulkActionBar {...select} onDelete={handleBulkDelete} deleting={bulkDeleting} />
 */
export function useBulkSelect(allIds: number[]) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const total = allIds.length;
  const selectedCount = selected.size;
  const allSelected = selectedCount > 0 && selectedCount === total;
  const someSelected = selectedCount > 0 && selectedCount < total;

  const isSelected = useCallback((id: number) => selected.has(id), [selected]);

  const toggle = useCallback((id: number) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((s) => (s.size === allIds.length ? new Set() : new Set(allIds)));
  }, [allIds]);

  const clear = useCallback(() => setSelected(new Set()), []);

  const remove = useCallback((id: number) => {
    setSelected((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
  }, []);

  const removeMany = useCallback((ids: Iterable<number>) => {
    setSelected((s) => {
      const n = new Set(s);
      for (const id of ids) n.delete(id);
      return n;
    });
  }, []);

  return {
    selected,
    selectedCount,
    total,
    allSelected,
    someSelected,
    isSelected,
    toggle,
    toggleAll,
    clear,
    remove,
    removeMany,
  };
}
