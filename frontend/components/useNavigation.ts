"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { DataEvent, useInvalidationListener } from "./dataEvents";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface MenuItem {
  id: number;
  group_id: number;
  label: string;
  href: string;
  is_external: boolean;
  sort_order: number;
  is_active: boolean;
  source_type: string;
  source_id: string | null;
}

export interface MenuGroup {
  id: number;
  key: string;
  label: string;
  subtitle: string | null;
  icon: string | null;
  sidebar_image_url: string | null;
  sidebar_width_px: number;
  sort_order: number;
  is_active: boolean;
  items: MenuItem[];
}

export interface NavData {
  groups: MenuGroup[];
  currentGroup: MenuGroup | null;
  loading: boolean;
}

/**
 * 메뉴 관리(menu_groups + menu_items)를 한 번 fetch해 헤더·사이드바 모두에 공급.
 * pathname 변경 시 currentGroup 재계산. 메뉴 admin 변경 시 이벤트로 refetch.
 */
export function useNavigation(): NavData {
  const [groups, setGroups] = useState<MenuGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  const fetchMenus = useCallback(() => {
    fetch(`${API}/api/menus/public`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d: MenuGroup[]) => setGroups(Array.isArray(d) ? d : []))
      .catch(() => setGroups([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchMenus(); }, [fetchMenus]);
  useInvalidationListener(DataEvent.MENUS, fetchMenus);

  // 현재 pathname이 속한 그룹: 가장 긴 href prefix 매칭
  let currentGroup: MenuGroup | null = null;
  let bestLength = -1;
  for (const g of groups) {
    for (const it of g.items) {
      if (it.is_external) continue;
      if (it.href === pathname || pathname.startsWith(it.href + "/")) {
        if (it.href.length > bestLength) {
          bestLength = it.href.length;
          currentGroup = g;
        }
      }
    }
  }

  return { groups, currentGroup, loading };
}
