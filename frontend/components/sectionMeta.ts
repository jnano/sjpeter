import type { SidebarItem } from "./SectionSidebar";

// 성당 소개
export const ABOUT_SIDEBAR_ITEMS: SidebarItem[] = [
  { href: "/about", label: "성당 안내" },
  { href: "/pastor", label: "주임신부" },
  { href: "/saint", label: "수호성인 성 베드로" },
  { href: "/history", label: "본당 연혁" },
  { href: "/pastors", label: "역대 사목자" },
  { href: "/priests", label: "본당 출신 사제" },
  { href: "/info", label: "찾아오시는 길" },
];

// 본당 공동체
export const COMMUNITY_SIDEBAR_ITEMS: SidebarItem[] = [
  { href: "/council", label: "사목평의회" },
  { href: "/groups", label: "분과와 단체" },
  { href: "/vision", label: "올해의 사목 방향" },
];

// 말씀과 기도
export const WORD_SIDEBAR_ITEMS: SidebarItem[] = [
  { href: "/word", label: "오늘의 복음" },
  { href: "/bulletin", label: "주보 아카이브" },
  { href: "/meditation", label: "묵상 글" },
  { href: "/prayer", label: "기도문" },
];

export const SECTION_META = {
  about: {
    title: "성당 소개",
    items: ABOUT_SIDEBAR_ITEMS,
    imageSrc: "/yakhoun.jpg",
  },
  community: {
    title: "본당 공동체",
    items: COMMUNITY_SIDEBAR_ITEMS,
    imageSrc: "/yakhoun.jpg",
  },
  word: {
    title: "말씀과 기도",
    items: WORD_SIDEBAR_ITEMS,
    imageSrc: "/yakhoun.jpg",
  },
} as const;

export type SectionGroup = keyof typeof SECTION_META;
