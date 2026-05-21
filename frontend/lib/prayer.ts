export type PrayerCategory =
  | "daily"
  | "memorize"
  | "mass"
  | "rosary"
  | "liturgy_season"
  | "special"
  | "memorial"
  | "parish";

export const PRAYER_CATEGORIES: PrayerCategory[] = [
  "daily",
  "memorize",
  "mass",
  "rosary",
  "liturgy_season",
  "special",
  "memorial",
  "parish",
];

export const PRAYER_CATEGORY_LABELS: Record<PrayerCategory, string> = {
  daily: "일상 기도",
  memorize: "암송할 기도문",
  mass: "미사 기도",
  rosary: "묵주 기도",
  liturgy_season: "전례 시기",
  special: "특별·청원",
  memorial: "위령·환자",
  parish: "본당 자체",
};

export const PRAYER_CATEGORY_HINTS: Record<PrayerCategory, string> = {
  daily: "성호경·주님의 기도·성모송·영광송 등 매일 바치는 기도",
  memorize: "신자가 외워서 바치는 기본 기도문 모음",
  mass: "미사 전·후·식사 전·후 기도",
  rosary: "환희·고통·영광·빛의 신비",
  liturgy_season: "대림·사순·부활 등 시기에 따른 기도",
  special: "청원·감사·치유 기도",
  memorial: "위령·환자·고해성사 준비",
  parish: "본당 사목 지표 기도 등 자체 작성 기도",
};

export function prayerCategoryLabel(value: string | null | undefined): string {
  if (!value) return "";
  return PRAYER_CATEGORY_LABELS[value as PrayerCategory] ?? value;
}
