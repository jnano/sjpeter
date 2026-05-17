/** 미사 시간 관련 공용 헬퍼. 순수 함수만 — 서버/클라이언트 양쪽 import 가능. */

export interface MassEntry {
  day: string;
  time: string;
  note: string;
}

export interface MassSchedule {
  entries: MassEntry[];
  note: string;
}

const WEEKDAYS = ["월요일", "화요일", "수요일", "목요일", "금요일"];
const SHORT: Record<string, string> = {
  "월요일": "월",
  "화요일": "화",
  "수요일": "수",
  "목요일": "목",
  "금요일": "금",
};

// "HH:MM" → "16시" 또는 "8시 30분"
export function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  return m === 0 ? `${h}시` : `${h}시 ${String(m).padStart(2, "0")}분`;
}

// 여러 시각을 오전·오후 순으로 "8시 30분, 10시 30분, 17시" 형식으로
export function formatTimesRow(times: string[]): string {
  const am = times.filter((t) => parseInt(t) < 12).map(formatTime);
  const pm = times.filter((t) => parseInt(t) >= 12).map(formatTime);
  return [...am, ...pm].join(", ");
}

// [{day, time, note}] 항목들을 "주일 / 평일(혹은 요일별) / 토요일" 행 배열로
export function buildMassRows(entries: MassEntry[]): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];

  const sunday = entries.filter((e) => e.day === "주일").map((e) => e.time);
  if (sunday.length) rows.push({ label: "주일", value: formatTimesRow(sunday) });

  const wdMap: Record<string, string[]> = {};
  for (const e of entries) {
    if (WEEKDAYS.includes(e.day)) {
      (wdMap[e.day] ??= []).push(e.time);
    }
  }
  const wdKeys = WEEKDAYS.filter((d) => wdMap[d]);
  if (wdKeys.length) {
    const first = JSON.stringify(wdMap[wdKeys[0]]);
    const allSame = wdKeys.every((d) => JSON.stringify(wdMap[d]) === first);
    if (allSame) {
      rows.push({ label: "평일", value: formatTimesRow(wdMap[wdKeys[0]]) });
    } else {
      for (const day of wdKeys) {
        rows.push({ label: SHORT[day], value: formatTimesRow(wdMap[day]) });
      }
    }
  }

  const sat = entries.filter((e) => e.day === "토요일").map((e) => e.time);
  if (sat.length) rows.push({ label: "토요일", value: formatTimesRow(sat) });

  return rows;
}

// 오늘 요일의 미사 시간(들). 정렬된 "HH:MM" 배열.
export function getTodayMassTimes(entries: MassEntry[], now: Date = new Date()): string[] {
  const dayNames = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
  const todayName = dayNames[now.getDay()];
  // 일요일 → DB에는 "주일"
  const targetDay = now.getDay() === 0 ? "주일" : todayName;
  return entries
    .filter((e) => e.day === targetDay)
    .map((e) => e.time)
    .sort();
}

// "오늘 미사는 16시, 18시 입니다." / 없으면 "오늘은 정해진 미사가 없습니다."
export function formatTodayMass(entries: MassEntry[], now: Date = new Date()): string {
  const times = getTodayMassTimes(entries, now);
  if (times.length === 0) return "오늘은 정해진 미사가 없습니다.";
  return `오늘 미사는 ${formatTimesRow(times)} 입니다.`;
}
