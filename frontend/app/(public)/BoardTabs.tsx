"use client";
import Link from "next/link";
import { useState } from "react";

export interface BoardTabItem {
  id: number;
  title: string;
  is_pinned: boolean;
  created_at: string;
  href?: string; // 지정 시 `${itemBase}/${id}` 대신 이 경로 사용
}

export interface BoardTab {
  key: string;
  label: string;
  moreHref: string;
  itemBase: string; // "/boards/notice" → 게시글 링크는 `${itemBase}/${id}`
  items: BoardTabItem[];
}

export default function BoardTabs({ tabs }: { tabs: BoardTab[] }) {
  const [active, setActive] = useState(tabs[0]?.key ?? "");
  const current = tabs.find((t) => t.key === active) ?? tabs[0];
  if (!current) return null;

  return (
    <div className="border border-[var(--color-border)] rounded-xl bg-white overflow-hidden">
      {/* 탭 헤더 */}
      <div className="flex items-stretch border-b border-[var(--color-border)] bg-[var(--color-surface-warm)]">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`px-3.5 py-2.5 text-[12.5px] font-bold transition-colors border-b-2 -mb-px ${
              active === t.key
                ? "text-[var(--color-primary)] border-[var(--color-primary)] bg-white"
                : "text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-primary)]"
            }`}
          >
            {t.label}
          </button>
        ))}
        <Link
          href={current.moreHref}
          className="ml-auto self-center pr-4 text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
        >
          더 보기 →
        </Link>
      </div>

      {/* 게시글 목록 */}
      {current.items.length === 0 ? (
        <p className="text-[12px] text-[var(--color-text-muted)] text-center py-10">
          등록된 글이 없습니다.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]/60">
          {current.items.slice(0, 7).map((item) => (
            <li key={item.id}>
              <Link
                href={item.href ?? `${current.itemBase}/${item.id}`}
                className="flex items-baseline gap-2 px-4 py-2.5 hover:bg-[var(--color-surface-warm)] transition-colors"
              >
                {item.is_pinned ? (
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"
                    aria-label="고정"
                  />
                ) : (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-border-dark)]/40 shrink-0" />
                )}
                <span
                  className={`flex-1 truncate text-[12px] ${
                    item.is_pinned
                      ? "font-semibold text-[var(--color-text)]"
                      : "text-[var(--color-text)]"
                  }`}
                >
                  {item.title}
                </span>
                <span className="text-[11px] text-[var(--color-text-muted)] shrink-0">
                  {new Date(item.created_at).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
