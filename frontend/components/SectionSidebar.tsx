"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useArchiveCounts, isArchiveLinkHidden } from "./useArchiveCounts";
import type { MenuItem } from "./useNavigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Props {
  groupTitle: string;
  imageSrc?: string;
  imageAlt?: string;
  widthPx?: number;
  items: MenuItem[];      // 트리 구조 (children 포함)
}

/** 현재 pathname이 item이나 그 자식 중 어디에 매칭되는지 */
function isItemActive(item: MenuItem, pathname: string): boolean {
  if (item.href === pathname) return true;
  return (item.children ?? []).some((c) => isItemActive(c, pathname));
}

/** 현재 pathname에 매칭되는 top-level item을 찾음 (mobile 2-row에서 사용) */
function findActiveTopLevel(items: MenuItem[], pathname: string): MenuItem | null {
  for (const it of items) {
    if (isItemActive(it, pathname)) return it;
  }
  return null;
}

export default function SectionSidebar({ groupTitle, imageSrc, imageAlt, widthPx = 220, items }: Props) {
  const pathname = usePathname();
  const archiveCounts = useArchiveCounts();
  const filterArchive = (its: MenuItem[]): MenuItem[] =>
    its
      .filter((it) => !isArchiveLinkHidden(it.href, archiveCounts))
      .map((it) => ({ ...it, children: filterArchive(it.children ?? []) }));
  const visibleItems = filterArchive(items);
  const activeTopLevel = findActiveTopLevel(visibleItems, pathname);

  const resolvedImage =
    imageSrc && imageSrc.startsWith("/uploads/") ? `${API}${imageSrc}` : imageSrc;

  function Chip({ item, kind }: { item: MenuItem; kind: "top" | "sub" }) {
    const active = pathname === item.href || (kind === "top" && isItemActive(item, pathname));
    return (
      <Link
        href={item.href}
        target={item.is_external ? "_blank" : undefined}
        rel={item.is_external ? "noopener noreferrer" : undefined}
        className={`inline-block px-3 py-1.5 text-xs rounded-full border transition-colors whitespace-nowrap ${
          active
            ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
            : kind === "sub"
            ? "border-[var(--color-border)] text-[var(--color-text-muted)] bg-[var(--color-surface-warm)]"
            : "border-[var(--color-border)] text-[var(--color-text-muted)] bg-white"
        }`}
        aria-current={pathname === item.href ? "page" : undefined}
      >
        {item.label}
        {item.is_external && <span className="ml-1">↗</span>}
      </Link>
    );
  }

  function DesktopRow({ item, depth }: { item: MenuItem; depth: number }) {
    const active = pathname === item.href;
    const childActive = (item.children ?? []).some((c) => isItemActive(c, pathname));
    const expanded = active || childActive;
    return (
      <li className="border-b border-[var(--color-border)] last:border-b-0">
        <Link
          href={item.href}
          target={item.is_external ? "_blank" : undefined}
          rel={item.is_external ? "noopener noreferrer" : undefined}
          className={`block py-2.5 text-sm transition-colors ${
            active
              ? "text-[var(--color-primary)] font-bold"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
          }`}
          style={{ paddingLeft: depth === 0 ? undefined : `${depth * 12}px` }}
          aria-current={active ? "page" : undefined}
        >
          {item.label}
          {item.is_external && <span className="text-xs text-gray-400 ml-1">↗</span>}
        </Link>
        {expanded && (item.children?.length ?? 0) > 0 && (
          <ul className="border-t border-[var(--color-border)]/40 bg-[var(--color-surface-warm)]/40">
            {item.children!.map((c) => (
              <DesktopRow key={c.id} item={c} depth={depth + 1} />
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <aside
      className="w-full shrink-0 md:max-w-[var(--sidebar-w)]"
      style={{ ["--sidebar-w" as string]: `${widthPx}px` } as React.CSSProperties}
    >
      {/* 모바일: 2-row 칩 (Header 아래 sticky) */}
      <nav className="md:hidden -mx-4 px-4 mb-4 sticky top-16 z-30 bg-white border-b border-[var(--color-border)]">
        <ul className="flex gap-1.5 overflow-x-auto py-2" style={{ WebkitOverflowScrolling: "touch" }}>
          {visibleItems.map((it) => (
            <li key={it.id} className="shrink-0">
              <Chip item={it} kind="top" />
            </li>
          ))}
        </ul>
        {activeTopLevel && (activeTopLevel.children?.length ?? 0) > 0 && (
          <ul className="flex gap-1.5 overflow-x-auto pb-2 border-t border-[var(--color-border)]/40" style={{ WebkitOverflowScrolling: "touch" }}>
            {activeTopLevel.children!.map((c) => (
              <li key={c.id} className="shrink-0 py-2">
                <Chip item={c} kind="sub" />
              </li>
            ))}
          </ul>
        )}
      </nav>

      {/* 데스크톱: 이미지 + 트리 (자동 펼침) */}
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
          {visibleItems.map((it) => (
            <DesktopRow key={it.id} item={it} depth={0} />
          ))}
        </ul>
      </nav>
    </aside>
  );
}
