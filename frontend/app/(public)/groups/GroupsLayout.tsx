// /groups, /groups/[slug] 페이지에서 사용하는 데이터 fetcher + 타입.
// 사이드바는 /admin/menus의 'groups' 그룹으로 통합되어 SectionLayout이 처리.

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface CommunityGroup {
  id: number;
  name: string;
  description: string | null;
  activity_time: string | null;
  link_url: string | null;
  board_slug: string | null;
  slug: string | null;
  parent_id: number | null;
  sort_order: number;
  activities: string | null;
  photo_urls: string[] | null;
  photo_display_mode: string | null;
  representative_photo_url: string | null;
}

export async function fetchGroups(): Promise<CommunityGroup[]> {
  try {
    const res = await fetch(`${API}/api/content/community`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}
