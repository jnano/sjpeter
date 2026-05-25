/** 예비자교리 공용 헬퍼. 순수 함수 — 서버/클라이언트 양쪽 import 가능. */

export interface CatechumenClass {
  id: number;
  round_no: number | null;
  start_date: string | null;
  baptism_at: string | null;
  apply_open: boolean;
  apply_start_date: string | null;
  apply_note: string | null;
  note: string | null;
  sort_order: number;
  member_count: number;
  photo_count: number;
}

const DAY = 86400000;

/** 차수 목록에서 현재 상태별 차수를 골라냄.
 *  educating: 교육 시작~세례성사 사이, recruiting: 입교신청 접수중, latest: 가장 최근(목록 정렬 첫 항목). */
export function pickActive(classes: CatechumenClass[], now: Date = new Date()) {
  const today = now.getTime();
  const educating = classes.find((c) => {
    if (!c.start_date || !c.baptism_at) return false;
    return new Date(c.start_date).getTime() <= today && today <= new Date(c.baptism_at).getTime();
  }) ?? null;
  const recruiting = classes.find((c) => c.apply_open) ?? null;
  const latest = classes[0] ?? null;
  return { educating, recruiting, latest };
}

/** 교육 시작일 기준 "N주차" (1-indexed). 시작 전이면 0. */
export function weeksSince(startDate: string, now: Date = new Date()): number {
  const diff = now.getTime() - new Date(startDate).getTime();
  if (diff < 0) return 0;
  return Math.floor(diff / (7 * DAY)) + 1;
}

/** 목표일까지 남은 일수 (올림). 지났으면 음수. */
export function daysUntil(target: string, now: Date = new Date()): number {
  return Math.ceil((new Date(target).getTime() - now.getTime()) / DAY);
}

/** 세례성사 일시 → "26.12.24. 10:30" (YY.MM.DD. HH:MM) */
export function formatBaptism(at: string): string {
  const d = new Date(at);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yy}.${mm}.${dd}. ${hh}:${mi}`;
}

/** 접수 시작 예정일 → "2027.5.24일" (YYYY.M.D일) */
export function formatStartDate(date: string): string {
  const d = new Date(date);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}일`;
}
