"use client";

import Link from "next/link";
import { useFocusItem, FOCUS_RING_CLASS } from "@/components/useFocusItem";
import { prayerCategoryLabel } from "@/lib/prayer";

interface Prayer {
  id: number;
  title: string;
  category: string;
  scripture: string | null;
  body: string;
  author: string | null;
  is_featured: boolean;
}

function excerpt(body: string, len = 80) {
  const clean = body.replace(/\n+/g, " ").trim();
  return clean.length > len ? clean.slice(0, len) + "…" : clean;
}

export default function PrayerList({ items }: { items: Prayer[] }) {
  const focusId = useFocusItem();

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const isFocused = focusId === item.id;
        return (
          <Link
            key={item.id}
            href={`/prayer/${item.id}`}
            data-focus-id={item.id}
            className={`block bg-[var(--color-surface)] border rounded-xl p-6 transition-colors hover:bg-[var(--color-surface-warm)] ${
              isFocused
                ? FOCUS_RING_CLASS
                : item.is_featured
                  ? "border-[var(--color-primary)]/30 bg-[var(--color-primary)]/[0.02] hover:bg-[var(--color-primary)]/[0.05]"
                  : "border-[var(--color-border)]"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[10px] font-medium text-[var(--color-accent)] uppercase tracking-widest">
                    {prayerCategoryLabel(item.category)}
                  </span>
                  {item.is_featured && (
                    <span className="text-[10px] font-sans font-medium bg-[var(--color-primary)] text-white px-1.5 py-0.5 rounded">
                      본당
                    </span>
                  )}
                </div>
                <h3 className="font-serif font-semibold text-[var(--color-text)] text-base leading-snug mb-1">
                  {item.title}
                </h3>
                {item.scripture && (
                  <p className="text-[10px] text-[var(--color-text-muted)] mb-1">
                    {item.scripture}
                  </p>
                )}
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed line-clamp-2">
                  {excerpt(item.body)}
                </p>
              </div>
              {item.author && (
                <div className="shrink-0 text-right">
                  <p className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">
                    {item.author}
                  </p>
                </div>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
