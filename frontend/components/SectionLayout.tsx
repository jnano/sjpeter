"use client";

import type { ReactNode } from "react";
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

/**
 * 섹션 페이지 공통 2단 레이아웃.
 * useNavigation으로 현재 pathname이 속한 menu_group을 자동 매칭하여
 * 좌측 사이드바(메뉴 admin 관리) + 우측 본문 렌더.
 * chipsOnly=true 이면 사이드바 없이 풀폭 + 가로 칩 메뉴만 표시.
 */
export default function SectionLayout({ children, autoHero = true, chipsOnly = false }: Props) {
  const { currentGroup } = useNavigation();

  // 매칭된 그룹이 없거나 항목이 없으면 사이드바·칩 모두 생략
  if (!currentGroup || currentGroup.items.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        {autoHero && <AutoPageHero />}
        {children}
      </div>
    );
  }

  // chipsOnly: 풀폭 본문 + 본문 위 가로 칩 메뉴
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
        <SectionSidebar
          groupTitle={currentGroup.label}
          imageSrc={currentGroup.sidebar_image_url ?? undefined}
          widthPx={currentGroup.sidebar_width_px}
          heightPx={currentGroup.sidebar_height_px ?? undefined}
          imagePosition={currentGroup.sidebar_image_position}
          items={currentGroup.items}
        />
        <div className="flex-1 min-w-0 mt-6 md:mt-0">
          {autoHero && <AutoPageHero />}
          {children}
        </div>
      </div>
    </div>
  );
}
