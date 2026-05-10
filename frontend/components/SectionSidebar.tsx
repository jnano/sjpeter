"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface SidebarItem {
  href: string;
  label: string;
}

interface Props {
  groupTitle: string;
  imageSrc?: string;
  imageAlt?: string;
  items: SidebarItem[];
}

export default function SectionSidebar({ groupTitle, imageSrc, imageAlt, items }: Props) {
  const pathname = usePathname();

  return (
    <aside className="w-full md:w-56 lg:w-60 shrink-0">
      {imageSrc && (
        <div className="relative w-full aspect-[5/4] rounded-lg overflow-hidden mb-5 hidden md:block">
          <Image
            src={imageSrc}
            alt={imageAlt ?? groupTitle}
            fill
            className="object-cover"
            sizes="240px"
          />
        </div>
      )}
      <nav>
        <ul>
          {items.map((it) => {
            const active = pathname === it.href;
            return (
              <li key={it.href} className="border-b border-[var(--color-border)] last:border-b-0">
                <Link
                  href={it.href}
                  className={`block py-2.5 text-sm transition-colors ${
                    active
                      ? "text-[var(--color-primary)] font-bold"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  {it.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

// 메타/상수는 server에서도 import 가능하도록 sectionMeta.ts에 분리됨.
// 호환성을 위해 here에서 re-export.
export {
  ABOUT_SIDEBAR_ITEMS,
  COMMUNITY_SIDEBAR_ITEMS,
  WORD_SIDEBAR_ITEMS,
  SECTION_META,
  type SectionGroup,
} from "./sectionMeta";
