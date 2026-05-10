import type { ReactNode } from "react";
import SectionSidebar from "./SectionSidebar";
import AutoPageHero from "./AutoPageHero";
import { SECTION_META, type SectionGroup } from "./sectionMeta";

interface Props {
  group: SectionGroup;
  children: ReactNode;
  /** true(기본)이면 본문 최상단에 자동 페이지 사진 슬라이드쇼를 삽입. */
  autoHero?: boolean;
}

/**
 * 섹션 페이지(성당 소개·본당 공동체·말씀과 기도) 공통 2단 레이아웃.
 * 좌측 사이드바(섹션 메뉴) + 우측 본문.
 * 본문 최상단에 AutoPageHero를 자동 삽입(사진이 등록된 페이지만 노출).
 */
export default function SectionLayout({ group, children, autoHero = true }: Props) {
  const meta = SECTION_META[group];
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:gap-10">
        <SectionSidebar
          groupTitle={meta.title}
          imageSrc={meta.imageSrc}
          items={meta.items}
        />
        <div className="flex-1 min-w-0 mt-6 md:mt-0">
          {autoHero && <AutoPageHero />}
          {children}
        </div>
      </div>
    </div>
  );
}
