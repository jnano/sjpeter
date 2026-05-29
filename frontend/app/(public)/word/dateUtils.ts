/**
 * 한국 사이트(/word) 전용 날짜 유틸.
 *
 * `Date.prototype.toISOString()` 은 UTC 기준이라 KST 자정이 UTC 전날 15:00 으로
 * 변환되어 .slice(0,10) 가 하루 빠진 날짜를 반환한다. 이는 "토요일 클릭 시
 * 금요일 복음이 나옴" 같은 off-by-one 버그의 원인.
 *
 * `getFullYear / getMonth / getDate` 는 로컬 TZ 기반이라 한국 사이트(서버·클라이언트
 * 모두 KST) 에서 안전. 이 유틸은 그 패턴으로 통일하기 위한 thin wrapper.
 */

/** 주어진 Date 의 **로컬 TZ** YYYY-MM-DD. */
export function toLocalIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 오늘(로컬 TZ) YYYY-MM-DD. */
export function todayIso(): string {
  return toLocalIso(new Date());
}
