"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import SectionSidebar from "./SectionSidebar";
import AutoPageHero from "./AutoPageHero";
import ArticleTools from "./ArticleTools";
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
  /** true면 본문 우상단에 글자 크기·인쇄 도구(ArticleTools) 표시 + 본문을 .reading-zoom 으로 감싸
   *  글자 크기 토글이 임의 마크업에도 적용되게 함. 긴 글 읽는 정적 페이지(소개·연혁 등)용. */
  tools?: boolean;
  /** true면 useNavigation 의 prefix 매칭(자식 라우트가 부모 그룹 사이드바를 자동 따라가는 동작)을 끔.
   *  현재 pathname 과 메뉴 항목 href 가 **정확히** 일치할 때만 사이드바 표시. 정확 일치가 없으면 풀폭 렌더.
   *  ── admin/menus 에 등록되지 않은 페이지에 prefix 부작용으로 사이드바가 자동 붙는 것을 막을 때 사용 (v1.5.413). */
  strictMatch?: boolean;
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
 * 사이드바 접기/펼치기 토글.
 * - 펼친 상태: '‹ 메뉴 접기' pill (사이드바 sticky 영역 상단).
 * - 접힌 상태: '›' 원형 — 본문 영역에 렌더되며, 펼침 pill과 **같은 화면 위치**(콘텐츠 행 좌상단)에
 *   오도록 -ml-10(=md:gap-10 만큼 왼쪽으로) + sticky top-44 로 맞춤. 펼침/접힘 전환 시 토글이 제자리 유지.
 *   -mb-7 로 자기 높이를 상쇄해 본문을 아래로 밀지 않음. (v1.5.369)
 * 데스크탑(md+) 한정 노출. 접힘 원형은 본문(부모 md:relative) 안에서 쓰임.
 * SectionLayout 외에 SectionSidebar 를 자체 호출하는 페이지(/calendar 등)에서도 사용.
 */
export function SidebarCollapseTab({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  // 접힌 상태 — 동그라미 안 '›' 만 (텍스트 없음). 펼침 pill 과 동일 위치(콘텐츠 행 좌상단·sticky top-44).
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={collapsed}
        aria-label="메뉴 펼치기"
        title="메뉴 펼치기"
        className="hidden md:flex items-center justify-center md:sticky md:top-44 z-10 w-7 h-7 -ml-10 -mb-7 bg-white border border-[var(--color-border)] rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-surface-warm)] hover:text-[var(--color-text)] transition-colors"
      >
        <svg width="11" height="11" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <polyline points="4 2 6.5 5 4 8" />
        </svg>
      </button>
    );
  }
  // 펼친 상태 — '‹ 메뉴 접기' (시안 .side-collapse: 완전 둥근 pill · 전체 테두리 · 사이드바 상단)
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={collapsed}
      aria-label="메뉴 접기"
      title="메뉴 접기"
      className="hidden md:inline-flex items-center gap-1.5 mb-5 px-3 py-1.5 rounded-full border border-[var(--color-border)] text-[11px] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-warm)] hover:text-[var(--color-text)] transition-colors"
    >
      <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <polyline points="6 2 3 5 6 8" />
      </svg>
      <span>메뉴 접기</span>
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
export default function SectionLayout({ children, autoHero = true, chipsOnly = false, tools = false, strictMatch = false }: Props) {
  const pathname = usePathname() ?? "";
  const { currentGroup } = useNavigation();
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();

  // strictMatch=true: pathname 정확 일치 메뉴 항목이 있을 때만 사이드바.
  // 메뉴 미등록 페이지가 prefix 부작용으로 부모 그룹 사이드바를 가져가는 것을 막음 (v1.5.413).
  const exactMatched = currentGroup?.items.some((it) => it.href === pathname) ?? false;
  const effectiveGroup = strictMatch && !exactMatched ? null : currentGroup;

  // tools=true: 본문 우상단 글자크기·인쇄 도구 + children 을 .reading-zoom 으로 감쌈
  const toolbar = tools ? <div className="flex justify-end mb-3"><ArticleTools /></div> : null;
  const bodyChildren = tools ? <div className="reading-zoom">{children}</div> : children;

  // 매칭된 그룹이 없거나 항목이 없으면 사이드바·칩·토글 모두 생략
  if (!effectiveGroup || effectiveGroup.items.length === 0) {
    return (
      <div className="max-w-[1320px] mx-auto px-5 lg:px-14 py-8">
        {toolbar}
        {autoHero && <AutoPageHero />}
        {bodyChildren}
      </div>
    );
  }

  // chipsOnly: 풀폭 본문 + 본문 위 가로 칩 메뉴 — 사이드바 자체가 없어 토글 의미 없음
  if (chipsOnly) {
    return (
      <div className="max-w-[1320px] mx-auto px-5 lg:px-14 py-8">
        <SectionSidebar
          groupTitle={effectiveGroup.label}
          items={effectiveGroup.items}
          chipsOnly
        />
        {autoHero && <AutoPageHero />}
        {children}
      </div>
    );
  }

  return (
    <div className="max-w-[1320px] mx-auto px-5 lg:px-14 py-8">
      <div className="flex flex-col md:flex-row md:gap-10">
        {/* 사이드바 영역 — collapsed 시 width 0 + opacity 0 로 transition.
            접힘 시 펼치기 토글은 본문(아래 md:relative 컬럼)에서 sticky 로 렌더된다. */}
        <div
          data-print-hide
          className={`shrink-0 md:relative md:transition-[width,opacity] md:duration-300 md:ease-out ${
            collapsed ? "md:w-0 md:opacity-0" : "md:w-[var(--sidebar-w)] md:opacity-100"
          }`}
          style={{ ["--sidebar-w" as string]: `${effectiveGroup.sidebar_width_px}px` } as React.CSSProperties}
          aria-hidden={collapsed ? true : undefined}
        >
          {/* overflow-hidden 은 SectionSidebar 의 collapsed 시 width 0 으로 줄어들 때 내용물 잘림 보완.
              그러나 overflow-hidden ancestor 는 자식 sticky 의 컨테이너가 되어 sticky 를 깸 →
              이 wrapper 자체에 sticky 를 적용해 viewport 추종 효과 유지 (v1.5.324).
              '메뉴 접기' 토글도 이 sticky 안에 두어 스크롤 시 사진·메뉴와 함께 따라오게 함 (v1.5.368). */}
          <div className="md:overflow-hidden md:sticky md:self-start md:top-44">
            <SidebarCollapseTab collapsed={collapsed} onToggle={toggleCollapsed} />
            <SectionSidebar
              groupTitle={effectiveGroup.label}
              imageSrc={effectiveGroup.sidebar_image_url ?? undefined}
              widthPx={effectiveGroup.sidebar_width_px}
              heightPx={effectiveGroup.sidebar_height_px ?? undefined}
              imagePosition={effectiveGroup.sidebar_image_position}
              items={effectiveGroup.items}
            />
          </div>
        </div>
        <div className="flex-1 min-w-0 mt-6 md:mt-0 md:relative">
          {/* 데스크탑 collapsed 시: 본문 영역 좌상단에 펼치기 토글 (사이드바 자리가 없으므로) */}
          {collapsed && <SidebarCollapseTab collapsed={collapsed} onToggle={toggleCollapsed} />}
          {toolbar}
          {autoHero && <AutoPageHero />}
          {bodyChildren}
        </div>
      </div>
    </div>
  );
}
