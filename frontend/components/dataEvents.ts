"use client";

import { useEffect } from "react";

/**
 * 루트 layout에 영구 마운트되는 컴포넌트(Header, AdminSidebar 등)가
 * 데이터 변경 직후 즉시 갱신되도록 하는 커스텀 이벤트 패턴.
 *
 * - 변경을 일으키는 쪽: notify(EVENT)
 * - 데이터를 보여주는 쪽: useInvalidationListener(EVENT, refetch)
 *
 * pathname 변경 시에도 자연스럽게 재조회되도록 컴포넌트는
 * 가능하면 pathname 의존성도 함께 두는 게 좋다. (이중 안전망)
 */

export const DataEvent = {
  /** /pastors, /sisters, /priests counts 변경 (Header 메뉴 노출 여부) */
  ARCHIVE_COUNTS: "data:archive-counts",
  /** AI 추출 임시저장 글 수 변경 (AdminSidebar 뱃지) */
  DRAFTS_COUNT: "data:drafts-count",
} as const;

export type DataEventName = (typeof DataEvent)[keyof typeof DataEvent];

/** 데이터 변경 알림 발행 (admin 저장/삭제 직후 호출) */
export function notify(event: DataEventName): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(event));
}

/** 데이터 변경 알림 수신 → refetch 호출 */
export function useInvalidationListener(event: DataEventName, refetch: () => void): void {
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.addEventListener(event, refetch);
    return () => window.removeEventListener(event, refetch);
  }, [event, refetch]);
}
