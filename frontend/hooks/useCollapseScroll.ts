"use client";
import { useCallback, useState } from "react";

/**
 * 펼치기/접기 토글의 표준 hook (v1.5.331~).
 *
 * 접을 때(expanded=true → false) 페이지 최상단으로 부드럽게 스크롤한다.
 * 펼친 후 길어진 본문을 접으면 사용자가 페이지 한가운데 머물러 있는 문제를 회피.
 *
 * 공개 페이지 내 모든 펼치기/접기 컴포넌트는 이 hook 을 사용해 동작을 통일.
 *
 * 사용 예:
 * ```tsx
 * const { expanded, toggle } = useCollapseScroll();
 * <button onClick={toggle}>{expanded ? "접기" : "더 보기"}</button>
 * ```
 */
export function useCollapseScroll(initial = false) {
  const [expanded, setExpanded] = useState(initial);

  const toggle = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev;
      // 접을 때만 페이지 최상단으로
      if (!next && typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      return next;
    });
  }, []);

  return { expanded, toggle };
}
