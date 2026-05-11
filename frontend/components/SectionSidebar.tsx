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
      className="w-full shrink-0"
      style={{ maxWidth: widthPx ? `${widthPx}px` : undefined }}
    >
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
      <nav>
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
