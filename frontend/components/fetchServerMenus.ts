import "server-only";
import type { MenuGroup } from "./useNavigation";

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** 서버 컴포넌트에서 메뉴를 미리 fetch. RootLayout에서 호출해 MenusProvider initial에 전달. */
export async function fetchServerMenus(): Promise<MenuGroup[]> {
  try {
    const res = await fetch(`${API}/api/menus/public`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}
