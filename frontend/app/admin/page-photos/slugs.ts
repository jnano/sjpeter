/**
 * 페이지 사진(슬라이드쇼)을 등록할 수 있는 슬러그 목록.
 * 새 페이지를 추가하려면 여기에만 항목 추가하면 된다.
 */

export interface PagePhotoSlug {
  slug: string;
  label: string;
  publicHref: string;
  description?: string;
}

export const PAGE_PHOTO_SLUGS: PagePhotoSlug[] = [
  { slug: "saint", label: "성 베드로", publicHref: "/saint", description: "/saint 본문 상단 히어로 이미지" },
  { slug: "history", label: "본당 연혁", publicHref: "/history", description: "/history 상단 히어로 이미지" },
  { slug: "vision", label: "사목 지표", publicHref: "/vision", description: "/vision 상단 히어로 이미지" },
  { slug: "council", label: "사목 위원회", publicHref: "/council", description: "/council 상단 히어로 이미지" },
  { slug: "groups", label: "공동체", publicHref: "/groups", description: "/groups 상단 히어로 이미지" },
  { slug: "pastor", label: "주임 신부", publicHref: "/pastor", description: "/pastor 상단 히어로 이미지" },
];
