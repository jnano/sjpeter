"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { flattenItems, useNavigation, type MenuGroup, type MenuItem } from "./useNavigation";

interface Props {
  /** Fallback. 메뉴에 등록된 경로면 메뉴 그룹 라벨이 자동으로 이김. */
  group: string;
  /** Fallback. 메뉴에 등록된 경로면 메뉴 항목 라벨이 자동으로 이김. */
  title: string;
  subtitle: string;
  action?: ReactNode;
}

/**
 * 현재 pathname과 정확히 일치하는 메뉴 항목을 찾아 (그룹, 항목) 반환.
 * 동적 페이지/하위 페이지(예: /meditation/archive/3)는 매칭 안 됨 → props fallback.
 */
function findExactMenuMatch(
  groups: MenuGroup[],
  pathname: string,
): { group: MenuGroup; item: MenuItem } | null {
  for (const g of groups) {
    for (const it of flattenItems(g.items)) {
      if (it.is_external) continue;
      if (it.href === pathname) return { group: g, item: it };
    }
  }
  return null;
}

export default function PageHeader({ group, title, subtitle, action }: Props) {
  const ref = useRef<HTMLParagraphElement>(null);
  const pathname = usePathname();
  const { groups } = useNavigation();

  // 메뉴에 등록된 경로면 메뉴 라벨이 단일 진실 소스.
  // 매칭 안 되는 페이지(동적 상세, 하위 페이지 등)는 props 유지.
  const match = findExactMenuMatch(groups, pathname);
  const resolvedTitle = match?.item.label ?? title;
  const resolvedGroup = match?.group.label ?? group;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        window.dispatchEvent(
          new CustomEvent(entry.isIntersecting ? "breadcrumb-show" : "breadcrumb-hide", {
            detail: { group: resolvedGroup, title: resolvedTitle },
          })
        );
      },
      // 헤더 높이(~100px)를 rootMargin으로 설정
      { rootMargin: "-100px 0px 0px 0px", threshold: 0 }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      window.dispatchEvent(new CustomEvent("breadcrumb-show"));
    };
  }, [resolvedGroup, resolvedTitle]);

  return (
    <div className="bg-white border-b border-[var(--color-border)] w-full">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
        <p
          ref={ref}
          className="text-xs text-[var(--color-text-muted)] mb-3 truncate"
        >
          {resolvedGroup}
          <span className="mx-2 text-[var(--color-border-dark)]">›</span>
          {resolvedTitle}
        </p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-serif text-[1.4rem] sm:text-[1.6rem] font-bold text-[var(--color-primary)] mb-1 break-words tracking-tight">
              {resolvedTitle}
            </h1>
            <p className="text-sm text-[var(--color-text-muted)]">{subtitle}</p>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      </div>
    </div>
  );
}
