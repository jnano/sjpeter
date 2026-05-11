"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { DataEvent, useInvalidationListener } from "./dataEvents";
import type { MenuGroup } from "./useNavigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const MenusContext = createContext<MenuGroup[] | null>(null);

/**
 * SSR로 fetch한 메뉴 데이터를 client context로 주입.
 * client에서 admin 변경(DataEvent.MENUS) 시 자동 refetch.
 */
export function MenusProvider({
  initial,
  children,
}: {
  initial: MenuGroup[];
  children: ReactNode;
}) {
  const [groups, setGroups] = useState<MenuGroup[]>(initial);

  const refetch = useCallback(() => {
    fetch(`${API}/api/menus/public`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d: MenuGroup[]) => setGroups(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  // initial 변경(드물게 부모가 re-mount)되면 동기화
  useEffect(() => {
    setGroups(initial);
  }, [initial]);

  useInvalidationListener(DataEvent.MENUS, refetch);

  return <MenusContext.Provider value={groups}>{children}</MenusContext.Provider>;
}

/** client 컴포넌트에서 context에 주입된 메뉴 데이터 읽기. context 없으면 null. */
export function useMenusContext(): MenuGroup[] | null {
  return useContext(MenusContext);
}
