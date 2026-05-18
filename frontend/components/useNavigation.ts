"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { DataEvent, useInvalidationListener } from "./dataEvents";
import { useMenusContext } from "./MenusProvider";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface MenuItem {
  id: number;
  group_id: number;
  parent_id: number | null;
  label: string;
  href: string;
  is_external: boolean;
  sort_order: number;
  is_active: boolean;
  link_type: "page" | "board" | "external";
  static_page_slug: string | null;
  board_id: number | null;
  external_url: string | null;
  image_url: string | null;
  children: MenuItem[];
}

/** 트리에서 한 항목과 그 자식들을 평평하게 펼침. */
export function flattenItems(items: MenuItem[]): MenuItem[] {
  const out: MenuItem[] = [];
  for (const it of items) {
    out.push(it);
    if (it.children?.length) out.push(...flattenItems(it.children));
  }
  return out;
}

export interface MenuGroup {
  id: number;
  key: string;
  label: string;
  subtitle: string | null;
  icon: string | null;
  sidebar_image_url: string | null;
  sidebar_width_px: number;
  sidebar_height_px: number | null;
  sidebar_image_position: string;
  landing_href: string | null;
  sort_order: number;
  is_active: boolean;
  show_in_header: boolean;
  show_in_footer: boolean;
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

  // 현재 그룹 결정: 사이드바 전용 그룹(show_in_header=false) 우선,
  // 그 안에서도 모든 자식까지 평평하게 본 후 가장 긴 prefix 매칭.
  // link_type 도입으로 같은 page/board 참조가 여러 그룹에 동시 존재할 수 없으므로
  // 단순히 길이 우선 — 충돌 우선순위 휴리스틱 불필요.
  function matchInGroups(pool: MenuGroup[]): MenuGroup | null {
    let best: MenuGroup | null = null;
    let bestLen = -1;
    for (const g of pool) {
      for (const it of flattenItems(g.items)) {
        if (it.is_external) continue;
        if (it.href === pathname || pathname.startsWith(it.href + "/")) {
          if (it.href.length > bestLen) {
            bestLen = it.href.length;
            best = g;
          }
        }
      }
    }
    return best;
  }

  // footer 전용 그룹(show_in_footer=true 이고 헤더에도 안 보이는)은 사이드바 매칭 풀에서 제외 — 외부 링크 모음은 본문 사이드바와 무관.
  const sidebarOnly = groups.filter((g) => !g.show_in_header && !g.show_in_footer);
  const headerVisible = groups.filter((g) => g.show_in_header);
  const currentGroup = matchInGroups(sidebarOnly) ?? matchInGroups(headerVisible);

  return { groups, currentGroup, loading };
}
