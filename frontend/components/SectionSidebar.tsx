"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useArchiveCounts, isArchiveLinkHidden } from "./useArchiveCounts";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface SidebarItem {
  href: string;
  label: string;
  is_external?: boolean;
}

interface Props {
  groupTitle: string;
  imageSrc?: string;
  imageAlt?: string;
  /** menu_groups.sidebar_width_px (기본 220) */
  widthPx?: number;
  items: SidebarItem[];
}

export default function SectionSidebar({ groupTitle, imageSrc, imageAlt, widthPx = 220, items }: Props) {
  const pathname = usePathname();
  const archiveCounts = useArchiveCounts();
  const visibleItems = items.filter((it) => !isArchiveLinkHidden(it.href, archiveCounts));

  // 외부 URL → 그대로, 내부 절대경로 → 그대로, 백엔드 상대경로 → API 붙임
  const resolvedImage =
    imageSrc && imageSrc.startsWith("/uploads/") ? `${API}${imageSrc}` : imageSrc;

  return (
    <aside
      className="w-full shrink-0 md:max-w-[var(--sidebar-w)]"
      style={{ ["--sidebar-w" as string]: `${widthPx}px` } as React.CSSProperties}
    >
      {/* 모바일: 가로 스크롤 칩 (Header 바로 아래 sticky) */}
      <nav className="md:hidden -mx-4 px-4 mb-4 sticky top-16 z-30 bg-white border-b border-[var(--color-border)]">
        <ul className="flex gap-1.5 overflow-x-auto py-2" style={{ WebkitOverflowScrolling: "touch" }}>
          {visibleItems.map((it) => {
            const active = pathname === it.href;
            return (
              <li key={it.href} className="shrink-0">
                <Link
                  href={it.href}
                  target={it.is_external ? "_blank" : undefined}
                  rel={it.is_external ? "noopener noreferrer" : undefined}
                  className={`inline-block px-3 py-1.5 text-xs rounded-full border transition-colors ${
                    active
                      ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                      : "border-[var(--color-border)] text-[var(--color-text-muted)] bg-white"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  {it.label}
                  {it.is_external && <span className="ml-1">↗</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* 데스크톱: 이미지 + 세로 목록 */}
      {resolvedImage && (
        <div className="relative w-full aspect-[5/4] rounded-lg overflow-hidden mb-5 hidden md:block">
          <Image
            src={resolvedImage}
            alt={imageAlt ?? groupTitle}
            fill
            className="object-cover"
            sizes={`${widthPx}px`}
          />
        </div>
      )}
      <nav className="hidden md:block">
        <ul>
          {visibleItems.map((it) => {
            const active = pathname === it.href;
            return (
              <li key={it.href} className="border-b border-[var(--color-border)] last:border-b-0">
                <Link
                  href={it.href}
                  target={it.is_external ? "_blank" : undefined}
                  rel={it.is_external ? "noopener noreferrer" : undefined}
                  className={`block py-2.5 text-sm transition-colors ${
                    active
                      ? "text-[var(--color-primary)] font-bold"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  {it.label}
                  {it.is_external && <span className="text-xs text-gray-400 ml-1">↗</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

// 호환성: 기존 import 깨지지 않도록 re-export (deprecated)
export {
  ABOUT_SIDEBAR_ITEMS,
  COMMUNITY_SIDEBAR_ITEMS,
  WORD_SIDEBAR_ITEMS,
  SECTION_META,
  type SectionGroup,
} from "./sectionMeta";
