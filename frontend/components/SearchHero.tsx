"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface Props {
  initialQ: string;
  // 기본 true: /search 페이지에서 첫 진입 시 자동 포커스. 홈처럼 진입 즉시 키보드 올라오면 안 되는 곳은 false.
  autoFocus?: boolean;
  // "default": 기존 /search 페이지 스타일 (rounded-2xl + 텍스트 "검색" 버튼)
  // "pill":    pill 형태 + 원형 아이콘 제출 버튼 (홈 모바일)
  variant?: "default" | "pill";
  // 단일 placeholder. rotatingPlaceholders 가 지정되면 무시됨.
  placeholder?: string;
  // 회전 placeholder — 입력이 비어있을 때 일정 간격으로 다음 문구로 교체. 검색 유도용.
  rotatingPlaceholders?: string[];
  // 회전 간격 (ms). 기본 2800.
  rotateMs?: number;
}

export default function SearchHero({
  initialQ,
  autoFocus,
  variant = "default",
  placeholder,
  rotatingPlaceholders,
  rotateMs = 2800,
}: Props) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const inputRef = useRef<HTMLInputElement>(null);

  // 회전 placeholder index
  const [phIndex, setPhIndex] = useState(0);
  useEffect(() => {
    if (!rotatingPlaceholders || rotatingPlaceholders.length < 2) return;
    const id = setInterval(() => {
      setPhIndex((i) => (i + 1) % rotatingPlaceholders.length);
    }, rotateMs);
    return () => clearInterval(id);
  }, [rotatingPlaceholders, rotateMs]);

  const activePlaceholder =
    rotatingPlaceholders && rotatingPlaceholders.length > 0
      ? rotatingPlaceholders[phIndex]
      : placeholder;

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

  const shouldAutoFocus = (autoFocus ?? true) && !initialQ;

  if (variant === "pill") {
    return (
      <form
        onSubmit={handleSubmit}
        role="search"
        aria-label="통합 검색"
        className="relative"
        suppressHydrationWarning
      >
        <span
          aria-hidden
          className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--color-primary)] text-2xl font-serif font-bold pointer-events-none leading-none"
        >
          ✝
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
          autoFocus={shouldAutoFocus}
          placeholder={activePlaceholder ?? "기도문·공지·주보 검색"}
          aria-label="검색어"
          // style.fontSize: iOS Safari가 font-size < 16px 인 input에 포커스 시 자동 줌하는 동작 방지용 안전망 (Tailwind 클래스로도 17px 지정했지만 인라인이 가장 확실)
          style={{ fontSize: "17px" }}
          // suppressHydrationWarning: 사파리 자동완성/스마트락이 __gcruniqueid 같은 속성을 hydration 전에 주입하는 경우 mismatch 무시
          suppressHydrationWarning
          className="w-full pl-14 pr-16 py-4 text-[17px] rounded-full bg-white text-[var(--color-text)] placeholder-[var(--color-primary)] placeholder:font-medium border border-[var(--color-border)] shadow-sm focus:outline-none focus:border-[var(--color-primary)] focus:shadow-md focus-visible:outline-[var(--color-primary)] transition-all"
        />
        {q && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="검색어 지우기"
            title="검색어 지우기 (Esc)"
            className="absolute right-14 top-1/2 -translate-y-1/2 w-7 h-7 inline-flex items-center justify-center rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-gray-100 transition-colors"
          >
            <svg
              width="12"
              height="12"
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
          aria-label="검색"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-10 h-10 inline-flex items-center justify-center bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white rounded-full transition-colors"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      </form>
    );
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
        autoFocus={shouldAutoFocus}
        placeholder={activePlaceholder ?? "기도문·공지·주보·행사·본당 가족을 한 번에 검색"}
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
