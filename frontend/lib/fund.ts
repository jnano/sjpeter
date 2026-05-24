/** 건축 헌금 모금 현황 표시용 공용 헬퍼. 순수 함수만 — 서버/클라이언트 양쪽 import 가능. */

/** 원 단위 금액을 "18.5억" / "3,200만" / "8,500" 처럼 한국식 축약 표기. */
export function formatKRWShort(won: number): string {
  if (won >= 100_000_000) {
    const ok = won / 100_000_000;
    return `${Number.isInteger(ok) ? ok : Number(ok.toFixed(1))}억`;
  }
  if (won >= 10_000) {
    return `${Math.round(won / 10_000).toLocaleString("ko-KR")}만`;
  }
  return won.toLocaleString("ko-KR");
}

/** 정확한 전체 금액 — "1,850,000,000원". */
export function formatKRWFull(won: number): string {
  return `${won.toLocaleString("ko-KR")}원`;
}

/** 달성률(0~100 정수). 목표액이 0이면 0. */
export function fundPercent(raised: number, goal: number): number {
  return goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
}
