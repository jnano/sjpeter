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
  /** AI 추출 pending 항목 수 변경 (AdminSidebar 뱃지 — 본당 사목지표 검토 누락 방지) */
  EXTRACTIONS_COUNT: "data:extractions-count",
  /** 홈 메인 배너 변경 (HomeHero) */
  HOME_BANNERS: "data:home-banners",
  /** photo·liturgy 게시판 사진 변경 (홈 PhotoSlider) */
  PHOTO_POSTS: "data:photo-posts",
  /** 오늘의 묵상 변경 (홈 MeditationCredits) */
  MEDITATION_CURRENT: "data:meditation-current",
  /** 페이지 사진 슬러그/사진/설정 변경 (AutoPageHero, PageHeroSlideshow) */
  PAGE_PHOTOS: "data:page-photos",
  /** 메뉴 그룹·항목 변경 (Header, SectionSidebar) */
  MENUS: "data:menus",
  /** 회원 알림 변경 (헤더 종 카운터 — 알림 읽음·전체 읽음 후) */
  NOTIFICATIONS: "data:notifications",
} as const;

export type DataEventName = (typeof DataEvent)[keyof typeof DataEvent];

// 탭 간 통신용 BroadcastChannel (지연 초기화 — SSR 안전)
let channel: BroadcastChannel | null = null;
function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (!channel && "BroadcastChannel" in window) {
    channel = new BroadcastChannel("faithandme-data-events");
  }
  return channel;
}

/** 데이터 변경 알림 발행 (admin 저장/삭제 직후 호출). 같은 탭 + 다른 탭 모두 수신. */
export function notify(event: DataEventName): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(event));
  getChannel()?.postMessage(event);
}

/** 데이터 변경 알림 수신 → refetch 호출 */
export function useInvalidationListener(event: DataEventName, refetch: () => void): void {
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.addEventListener(event, refetch);
    const handleBroadcast = (e: MessageEvent) => {
      if (e.data === event) refetch();
    };
    const ch = getChannel();
    ch?.addEventListener("message", handleBroadcast);
    return () => {
      window.removeEventListener(event, refetch);
      ch?.removeEventListener("message", handleBroadcast);
    };
  }, [event, refetch]);
}
