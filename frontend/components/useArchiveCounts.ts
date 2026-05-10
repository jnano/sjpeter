"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface ArchiveCounts {
  pastors: number;
  priests: number;
}

/**
 * /pastors(역대 사목자)·/priests(본당 출신 사제)에 등록된 데이터 수.
 * 0건이면 메뉴에서 해당 링크를 숨기는 데 사용.
 *
 * 데이터가 도착하기 전(null)에는 일단 메뉴를 보여주고,
 * 도착 후 0건이면 숨기는 방식이라 첫 진입 시 깜빡일 수 있다(허용 범위).
 */
export function useArchiveCounts(): ArchiveCounts | null {
  const [counts, setCounts] = useState<ArchiveCounts | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`${API}/api/archive/pastors`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch(`${API}/api/archive/priests`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ]).then(([pastors, priests]) => {
      if (cancelled) return;
      setCounts({
        pastors: Array.isArray(pastors) ? pastors.length : 0,
        priests: Array.isArray(priests) ? priests.length : 0,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return counts;
}

/**
 * 주어진 href가 빈 archive 때문에 숨겨져야 하는지 판단.
 * counts가 null(로딩 중)이면 false(보임 유지).
 */
export function isArchiveLinkHidden(href: string, counts: ArchiveCounts | null): boolean {
  if (!counts) return false;
  if (href === "/pastors" && counts.pastors === 0) return true;
  if (href === "/priests" && counts.priests === 0) return true;
  return false;
}
