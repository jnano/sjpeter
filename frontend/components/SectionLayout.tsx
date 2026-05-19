"use client";

import { useEffect, useState, type ReactNode } from "react";
import SectionSidebar from "./SectionSidebar";
import AutoPageHero from "./AutoPageHero";
import { useNavigation } from "./useNavigation";

interface Props {
  /** 호환성 유지용 — 사용 안 함. pathname으로 자동 매칭됨. */
  group?: string;
  children: ReactNode;
  /** true(기본)이면 본문 최상단에 자동 페이지 사진 슬라이드쇼를 삽입. */
  autoHero?: boolean;
  /** true면 좌측 사이드바 대신 본문 위 가로 칩 메뉴만 노출(풀폭 본문).
   *  /calendar·/gallery 처럼 본문 폭이 중요한 페이지용. */
  chipsOnly?: boolean;
}

/** 데스크탑 사이드바 접힘 상태 — 전역 (localStorage). 같은 키를 다른 탭/페이지가 공유. */
const COLLAPSE_KEY = "section-sidebar-collapsed";

export function useSidebarCollapsed(): [boolean, () => void] {
  // SSR/첫 렌더는 false(=펼침) 로 시작해 hydration mismatch 회피.
  // mount 후 localStorage 값을 동기화.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* localStorage 차단 환경 무시 */
    }
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return [collapsed, toggle];
}

/**
 * PageHeader 하단 구분선에 걸친 「아래로 처진 탭」 모양의 사이드바 접기/펼치기 토글.
 * 데스크탑(md+) 한정 노출. 부모는 position: relative 이어야 한다 (top 음수로 끌어올림).
 * SectionLayout 외에 SectionSidebar 를 자체 호출하는 페이지(/calendar 등)에서도 사용.
 */
export function SidebarCollapseTab({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={collapsed}
      aria-label={collapsed ? "메뉴 펼치기" : "메뉴 접기"}
      title={collapsed ? "메뉴 펼치기" : "메뉴 접기"}
      style={{ top: "calc(-2rem - 1px)" }}
      className="hidden md:inline-flex items-center gap-1 absolute left-0 z-10 px-3 py-1 bg-white border border-[var(--color-border)] border-t-0 rounded-b-md text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-surface-warm)] hover:text-[var(--color-text)] transition-colors"
    >
      <span aria-hidden="true">{collapsed ? "»" : "«"}</span>
      <span>{collapsed ? "메뉴 펼치기" : "메뉴 접기"}</span>
    </button>
  );
}

/**
 * 섹션 페이지 공통 2단 레이아웃.
 * useNavigation으로 현재 pathname이 속한 menu_group을 자동 매칭하여
 * 좌측 사이드바(메뉴 admin 관리) + 우측 본문 렌더.
 * chipsOnly=true 이면 사이드바 없이 풀폭 + 가로 칩 메뉴만 표시.
 *
 * 데스크탑(md+) 한정: 본문 좌상단의 「메뉴 접기/펼치기」 토글로 사이드바를
 * 숨기고 본문을 확장할 수 있다. 상태는 localStorage 전역.
 * 모바일은 사이드바가 본문 위에 column 으로 오므로 토글 영향 받지 않음.
 */
export default function SectionLayout({ children, autoHero = true, chipsOnly = false }: Props) {
  const { currentGroup } = useNavigation();
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();

  // 매칭된 그룹이 없거나 항목이 없으면 사이드바·칩·토글 모두 생략
  if (!currentGroup || currentGroup.items.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        {autoHero && <AutoPageHero />}
        {children}
      </div>
    );
  }

  // chipsOnly: 풀폭 본문 + 본문 위 가로 칩 메뉴 — 사이드바 자체가 없어 토글 의미 없음
  if (chipsOnly) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <SectionSidebar
          groupTitle={currentGroup.label}
          items={currentGroup.items}
          chipsOnly
        />
        {autoHero && <AutoPageHero />}
        {children}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:gap-10">
        {/* 사이드바: 모바일은 항상 표시(상단 column), 데스크탑은 collapsed면 숨김 */}
        <div className={collapsed ? "md:hidden" : ""}>
          <SectionSidebar
            groupTitle={currentGroup.label}
            imageSrc={currentGroup.sidebar_image_url ?? undefined}
            widthPx={currentGroup.sidebar_width_px}
            heightPx={currentGroup.sidebar_height_px ?? undefined}
            imagePosition={currentGroup.sidebar_image_position}
            items={currentGroup.items}
          />
        </div>
        <div className="flex-1 min-w-0 mt-6 md:mt-0 md:relative">
          <SidebarCollapseTab collapsed={collapsed} onToggle={toggleCollapsed} />
          {autoHero && <AutoPageHero />}
          {children}
        </div>
      </div>
    </div>
  );
}
