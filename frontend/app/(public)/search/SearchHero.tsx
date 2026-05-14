"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface Props {
  initialQ: string;
}

export default function SearchHero({ initialQ }: Props) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const inputRef = useRef<HTMLInputElement>(null);

  // URL의 q가 바뀌면 입력란도 동기화 (페이지네이션·인기/추천 검색어 클릭 등)
  useEffect(() => {
    setQ(initialQ);
  }, [initialQ]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = q.trim();
    if (!value) {
      router.replace("/search");
      return;
    }
    router.push(`/search?q=${encodeURIComponent(value)}`);
  }

  function handleClear() {
    setQ("");
    inputRef.current?.focus();
    // 결과 페이지에 들어와 있는 상태라면 빈 상태(추천 검색어)로 전환
    router.replace("/search");
  }

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      aria-label="통합 검색"
      className="relative"
    >
      <span
        aria-hidden
        className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl pointer-events-none"
      >
        🔍
      </span>
      <input
        ref={inputRef}
        type="search"
        name="q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && q) {
            e.preventDefault();
            handleClear();
          }
        }}
        autoFocus={!initialQ}
        placeholder="기도문·공지·주보·행사·본당 가족을 한 번에 검색"
        aria-label="검색어"
        className="w-full pl-14 pr-32 py-4 text-base sm:text-lg rounded-2xl bg-white text-[var(--color-text)] placeholder-[var(--color-text-muted)] border border-[var(--color-border)] shadow-sm focus:outline-none focus:border-[var(--color-primary)] focus:shadow-md transition-all"
      />
      {q && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="검색어 지우기"
          title="검색어 지우기 (Esc)"
          className="absolute right-24 top-1/2 -translate-y-1/2 w-7 h-7 inline-flex items-center justify-center rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-gray-100 transition-colors"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
      <button
        type="submit"
        className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2.5 text-sm font-medium bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white rounded-xl transition-colors"
      >
        검색
      </button>
    </form>
  );
}
