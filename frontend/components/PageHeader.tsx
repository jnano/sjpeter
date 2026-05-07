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
    <div className="bg-[var(--color-primary)] w-full border-b-4 border-[var(--color-accent)]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p
          ref={ref}
          className="text-xs text-white/50 uppercase mb-4"
          style={{ letterSpacing: "0.02em", transform: "scaleX(0.92) scaleY(0.92)", transformOrigin: "left" }}
        >
          {group}
          <span className="mx-2 text-white/30">›</span>
          {title}
        </p>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-sans text-[1.594rem] font-bold text-white mb-2">{title}</h1>
            <p className="text-sm text-white/70">{subtitle}</p>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      </div>
    </div>
  );
}
