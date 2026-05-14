"use client";

import Link from "next/link";
import { useFocusItem, FOCUS_RING_CLASS } from "@/components/useFocusItem";

interface Meditation {
  id: number;
  title: string;
  scripture: string | null;
  body: string;
  author: string | null;
  published_date: string;
}

interface Props {
  items: Meditation[];
  showLatestBadge: boolean;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

function excerpt(body: string, len = 80) {
  const clean = body.replace(/\n+/g, " ").trim();
  return clean.length > len ? clean.slice(0, len) + "…" : clean;
}

export default function MeditationArchiveList({ items, showLatestBadge }: Props) {
  const focusId = useFocusItem();

  return (
    <div className="space-y-3">
      {items.map((item, idx) => {
        const isLatest = showLatestBadge && idx === 0;
        const isFocused = focusId === item.id;
        return (
          <Link
            key={item.id}
            href={`/meditation/archive/${item.id}`}
            data-focus-id={item.id}
            className={`block bg-[var(--color-surface)] border rounded-xl p-6 transition-colors hover:bg-[var(--color-surface-warm)] ${
              isFocused
                ? FOCUS_RING_CLASS
                : isLatest
                  ? "border-[var(--color-primary)]/30 bg-[var(--color-primary)]/[0.02] hover:bg-[var(--color-primary)]/[0.05]"
                  : "border-[var(--color-border)]"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                {item.scripture && (
                  <p className="text-[10px] font-medium text-[var(--color-accent)] uppercase tracking-widest mb-1">
                    {item.scripture}
                  </p>
                )}
                <h3 className="font-serif font-semibold text-[var(--color-text)] text-base leading-snug mb-1">
                  {isLatest && (
                    <span className="inline-block text-[10px] font-sans font-medium bg-[var(--color-primary)] text-white px-1.5 py-0.5 rounded mr-2 align-middle">
                      최신
                    </span>
                  )}
                  {item.title}
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed line-clamp-2">
                  {excerpt(item.body)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">
                  {formatDate(item.published_date)}
                </p>
                {item.author && (
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{item.author}</p>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
