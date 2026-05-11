"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { DataEvent, useInvalidationListener } from "./dataEvents";
import { useMenusContext } from "./MenusProvider";

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
 * 메뉴 데이터: MenusContext가 있으면 그 값 사용 (SSR 일관성), 없으면 자체 fetch (fallback).
 * pathname 변경 시 currentGroup 재계산, DataEvent.MENUS 수신 시 갱신.
 */
export function useNavigation(): NavData {
  const ctxGroups = useMenusContext();
  const [fallbackGroups, setFallbackGroups] = useState<MenuGroup[]>([]);
  const [loading, setLoading] = useState(ctxGroups === null);
  const pathname = usePathname();

  const fetchMenus = useCallback(() => {
    fetch(`${API}/api/menus/public`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d: MenuGroup[]) => setFallbackGroups(Array.isArray(d) ? d : []))
      .catch(() => setFallbackGroups([]))
      .finally(() => setLoading(false));
  }, []);

  // context가 없는 경우만 fallback fetch
  useEffect(() => {
    if (ctxGroups === null) fetchMenus();
    else setLoading(false);
  }, [ctxGroups, fetchMenus]);

  useInvalidationListener(DataEvent.MENUS, () => {
    if (ctxGroups === null) fetchMenus();
    // ctxGroups가 있을 땐 MenusProvider가 자체 갱신
  });

  const groups = ctxGroups ?? fallbackGroups;

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
