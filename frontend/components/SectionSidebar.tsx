"use client";

import * as React from "react";
import { createPortal } from "react-dom";
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
  /** 사이드바 상단 이미지 높이(px). undefined면 자동 비율(aspect-[5/4]). */
  heightPx?: number;
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

export default function SectionSidebar({ groupTitle, imageSrc, imageAlt, widthPx = 220, heightPx, items }: Props) {
  const pathname = usePathname();
  const archiveCounts = useArchiveCounts();

  // 사이드바를 페이지 로드 시 viewport에서 보이는 위치 그대로 고정.
  // PageHeader 높이가 페이지마다 달라 단순 sticky top 클래스로 못 맞춤 → 초기 측정 후 적용.
  const asideRef = React.useRef<HTMLElement>(null);
  const [stickyTopPx, setStickyTopPx] = React.useState<number | null>(null);
  React.useLayoutEffect(() => {
    if (!asideRef.current) return;
    // 스크롤 0에서만 측정 (이미 스크롤된 상태에서 마운트되면 측정 의미 없음 → fallback 80px)
    if (window.scrollY === 0) {
      const top = asideRef.current.getBoundingClientRect().top;
      setStickyTopPx(Math.max(64, top));  // 헤더 h-16(64px)보다 작아질 일은 없게
    } else {
      setStickyTopPx(80);
    }
  }, [pathname]);
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

  function DesktopRow({ item }: { item: MenuItem }) {
    const active = pathname === item.href;
    const childActive = (item.children ?? []).some((c) => isItemActive(c, pathname));
    const hasChildren = (item.children?.length ?? 0) > 0;
    const [hovered, setHovered] = React.useState(false);
    const [popupMaxH, setPopupMaxH] = React.useState<number>(440);
    const [popupPos, setPopupPos] = React.useState<{ top: number; left: number } | null>(null);
    const [mounted, setMounted] = React.useState(false);
    const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const liRef = React.useRef<HTMLLIElement>(null);

    React.useEffect(() => setMounted(true), []);

    const recalcPopupGeometry = () => {
      const rect = liRef.current?.getBoundingClientRect();
      if (!rect) return;
      // popup은 fixed 좌표로 띄움 — 부모 sticky의 stacking context 영향 회피
      setPopupPos({ top: rect.top, left: rect.right + 8 });
      const available = window.innerHeight - rect.top - 24;
      setPopupMaxH(Math.max(160, available));
    };

    const openPopup = () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      recalcPopupGeometry();
      setHovered(true);
    };
    const schedulePopupClose = () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => setHovered(false), 200);
    };
    React.useEffect(() => () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    }, []);

    return (
      <li
        ref={liRef}
        className="border-b border-[var(--color-border)] last:border-b-0 relative"
        onMouseEnter={openPopup}
        onMouseLeave={schedulePopupClose}
      >
        <Link
          href={item.href}
          target={item.is_external ? "_blank" : undefined}
          rel={item.is_external ? "noopener noreferrer" : undefined}
          className={`flex items-center justify-between gap-2 py-2.5 text-sm transition-colors ${
            active || childActive
              ? "text-[var(--color-primary)] font-bold"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
          }`}
          aria-current={active ? "page" : undefined}
        >
          <span className="truncate min-w-0">
            {item.label}
            {item.is_external && <span className="text-xs text-gray-400 ml-1">↗</span>}
          </span>
          {hasChildren && <span className="text-xs text-gray-400 shrink-0">▸</span>}
        </Link>

        {/* hover 시 자식 레이어 — React Portal로 body에 마운트해 부모 stacking context 완전 회피 */}
        {hasChildren && hovered && popupPos && mounted && createPortal(
          <div
            className="fixed z-[9999]"
            style={{ top: popupPos.top, left: popupPos.left }}
            onMouseEnter={openPopup}
            onMouseLeave={schedulePopupClose}
          >
            <div className="w-56 bg-white border border-[var(--color-border)] rounded-lg shadow-lg overflow-hidden" style={{ minWidth: "200px" }}>
            <ul className="py-1 overflow-y-auto overscroll-contain" style={{ maxHeight: `${popupMaxH}px` }}>
              {item.children!.map((c) => {
                const cActive = pathname === c.href;
                return (
                  <li key={c.id}>
                    <Link
                      href={c.href}
                      target={c.is_external ? "_blank" : undefined}
                      rel={c.is_external ? "noopener noreferrer" : undefined}
                      className={`block px-3 py-1.5 text-sm transition-colors ${
                        cActive
                          ? "text-[var(--color-primary)] font-semibold bg-[var(--color-surface-warm)]"
                          : "text-[var(--color-text)] hover:bg-[var(--color-surface-warm)] hover:text-[var(--color-primary)]"
                      }`}
                      aria-current={cActive ? "page" : undefined}
                    >
                      {c.label}
                      {c.is_external && <span className="text-xs text-gray-400 ml-1">↗</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
            </div>
          </div>,
          document.body
        )}
      </li>
    );
  }

  return (
    <aside
      ref={asideRef}
      className="w-full shrink-0 md:max-w-[var(--sidebar-w)] md:sticky md:self-start"
      style={{
        ["--sidebar-w" as string]: `${widthPx}px`,
        top: stickyTopPx !== null ? `${stickyTopPx}px` : "5rem",
        // overflow를 잡지 않음 — 자식 popup(absolute left-full)이 사이드바 박스를
        // 넘쳐 표시되므로 overflow-y:auto를 두면 가로/세로 양쪽 스크롤바가 생긴다.
        // 사이드바 컨텐츠 자체는 짧아 viewport 안에 들어가므로 sticky만으로 충분.
      } as React.CSSProperties}
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

      {/* 데스크톱: 이미지 + 트리 (자동 펼침)
          heightPx 지정 시 그 높이로 고정(+ object-cover), 미지정 시 aspect-[5/4] */}
      {resolvedImage && (
        <div
          className={`relative w-full rounded-lg overflow-hidden mb-5 hidden md:block ${
            heightPx && heightPx > 0 ? "" : "aspect-[5/4]"
          }`}
          style={heightPx && heightPx > 0 ? { height: `${heightPx}px` } : undefined}
        >
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
            <DesktopRow key={it.id} item={it} />
          ))}
        </ul>
      </nav>
    </aside>
  );
}
