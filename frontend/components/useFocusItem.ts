"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * URL `?focus=N` 으로 전달된 항목을 자동 스크롤·강조하기 위한 훅.
 *
 * 사용 방법:
 * ```tsx
 * const focusId = useFocusItem();
 * ...
 * <div
 *   key={item.id}
 *   data-focus-id={item.id}
 *   className={focusId === item.id ? "ring-2 ring-yellow-400 bg-yellow-50" : ""}
 * >
 * ```
 *
 * 동작:
 * - 데이터가 화면에 그려진 직후 `[data-focus-id="N"]` 엘리먼트를 찾아 부드럽게 스크롤
 * - 3초 후 강조 해제 (사용자가 시선을 옮긴 뒤에는 자연스럽게 사라짐)
 * - focus 가 없으면 null 반환
 */
export function useFocusItem(): number | null {
  const sp = useSearchParams();
  const focusStr = sp.get("focus");
  const focusId = focusStr ? Number(focusStr) : null;
  const [active, setActive] = useState<number | null>(focusId);

  useEffect(() => {
    if (!focusId || !Number.isFinite(focusId)) {
      setActive(null);
      return;
    }
    setActive(focusId);
    // 데이터 로드 직후를 노리고 약간 지연. 짧은 지연 + 한 번 더 재시도.
    let attempts = 0;
    const trySc = () => {
      const el = document.querySelector<HTMLElement>(`[data-focus-id="${focusId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        return true;
      }
      return false;
    };
    const tick = () => {
      if (trySc() || attempts >= 8) return;
      attempts += 1;
      window.setTimeout(tick, 250);
    };
    const initial = window.setTimeout(tick, 150);
    const clearHi = window.setTimeout(() => setActive(null), 3500);
    return () => {
      window.clearTimeout(initial);
      window.clearTimeout(clearHi);
    };
  }, [focusId]);

  return active;
}

/** 강조 표시용 공통 클래스 (Tailwind). 페이지마다 직접 className 에 합쳐서 사용. */
export const FOCUS_RING_CLASS =
  "ring-2 ring-yellow-400 ring-offset-1 bg-yellow-50 transition-shadow";
