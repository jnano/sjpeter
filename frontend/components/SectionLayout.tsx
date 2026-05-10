import type { ReactNode } from "react";
import SectionSidebar from "./SectionSidebar";
import { SECTION_META, type SectionGroup } from "./sectionMeta";

interface Props {
  group: SectionGroup;
  children: ReactNode;
}

/**
 * 섹션 페이지(성당 소개·본당 공동체·말씀과 기도) 공통 2단 레이아웃.
 * 좌측 사이드바(섹션 메뉴) + 우측 본문.
 */
export default function SectionLayout({ group, children }: Props) {
  const meta = SECTION_META[group];
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:gap-10">
        <SectionSidebar
          groupTitle={meta.title}
          imageSrc={meta.imageSrc}
          items={meta.items}
        />
        <div className="flex-1 min-w-0 mt-6 md:mt-0">{children}</div>
      </div>
    </div>
  );
}
