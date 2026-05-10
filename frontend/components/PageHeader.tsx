"use client";
import { useEffect, useRef, type ReactNode } from "react";

interface Props {
  group: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
}

export default function PageHeader({ group, title, subtitle, action }: Props) {
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        window.dispatchEvent(
          new CustomEvent(entry.isIntersecting ? "breadcrumb-show" : "breadcrumb-hide", {
            detail: { group, title },
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
  }, [group, title]);

  return (
    <div className="bg-white border-b border-[var(--color-border)] w-full">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
        <p
          ref={ref}
          className="text-xs text-[var(--color-text-muted)] mb-3 truncate"
        >
          {group}
          <span className="mx-2 text-[var(--color-border-dark)]">›</span>
          {title}
        </p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-serif text-[1.4rem] sm:text-[1.6rem] font-bold text-[var(--color-primary)] mb-1 break-words tracking-tight">
              {title}
            </h1>
            <p className="text-sm text-[var(--color-text-muted)]">{subtitle}</p>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      </div>
    </div>
  );
}
