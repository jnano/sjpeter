"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * 오늘의 복음 페이지 상단 날짜 네비.
 * - 이전/다음: 현재 표시 날짜에서 ±1일 한 ISO 를 ?date= 쿼리로 push
 * - 가운데 날짜: 클릭 시 <input type="date"> 열어 임의 날짜 점프
 * - "오늘" 버튼: ?date= 쿼리 제거(=오늘로 복귀)
 *
 * 시안 .date-nav (둥근 pill 4px 패딩, 36px 원형 버튼 + 가운데 날짜 텍스트) 톤.
 */
export default function DateNav({ currentIso }: { currentIso: string }) {
  const router = useRouter();
  const [picking, setPicking] = useState(false);

  const current = new Date(currentIso + "T00:00:00");
  const todayIso = new Date().toISOString().slice(0, 10);
  const isToday = currentIso === todayIso;

  function shift(days: number) {
    const next = new Date(current);
    next.setDate(next.getDate() + days);
    const iso = next.toISOString().slice(0, 10);
    router.push(iso === todayIso ? "/word" : `/word?date=${iso}`);
  }

  function jumpTo(iso: string) {
    setPicking(false);
    if (!iso) return;
    router.push(iso === todayIso ? "/word" : `/word?date=${iso}`);
  }

  const label = current.toLocaleDateString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
  }).replace(/\.\s/g, ".").replace(/\.$/, "");

  return (
    <div className="inline-flex items-center gap-1 bg-white border border-[var(--color-border)] rounded-full p-1">
      <button
        type="button"
        onClick={() => shift(-1)}
        aria-label="이전 날짜"
        className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[var(--color-surface-warm)]"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6">
          <polyline points="9 3 5 7 9 11" />
        </svg>
      </button>

      <button
        type="button"
        onClick={() => setPicking(true)}
        className="px-4 text-[13px] font-bold tracking-tight inline-flex items-center gap-2 hover:text-[var(--color-primary)]"
      >
        {label}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" className="opacity-50">
          <polyline points="3 5 6 8 9 5" />
        </svg>
      </button>

      <button
        type="button"
        onClick={() => shift(1)}
        aria-label="다음 날짜"
        className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[var(--color-surface-warm)]"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6">
          <polyline points="5 3 9 7 5 11" />
        </svg>
      </button>

      {!isToday && (
        <button
          type="button"
          onClick={() => router.push("/word")}
          className="ml-1 px-3 py-1.5 text-[11px] font-semibold text-[var(--color-primary)] rounded-full hover:bg-[var(--color-primary)]/10"
          title="오늘로"
        >
          오늘
        </button>
      )}

      {/* date picker — 가운데 텍스트 클릭 시 열림 */}
      {picking && (
        <input
          type="date"
          autoFocus
          defaultValue={currentIso}
          onChange={(e) => jumpTo(e.target.value)}
          onBlur={() => setPicking(false)}
          className="ml-2 px-2 py-1 text-xs border border-[var(--color-border)] rounded"
        />
      )}
    </div>
  );
}
