"use client";

import { useEffect, useState } from "react";

/**
 * 글자 크기·인쇄 도구 — 시안 meditation.html 의 .art-meta-tools 재현.
 * - 글자 크기: 'Aa' 원형 버튼. 클릭 시 3단계(100% → 112% → 125%) 순환.
 *   document.documentElement 의 --reading-scale 를 갱신 → .med-body·.prose 가 calc 로 따라 커짐.
 *   선택값은 localStorage 에 저장돼 페이지 이동·새로고침에도 유지.
 * - 인쇄: 프린터 원형 버튼 → window.print(). 인쇄 시 @media print 가 헤더·사이드바 등 부속을 숨김.
 *
 * 시안 위치: 아티클 메타 행(저자·날짜) 오른쪽. divider=true 면 좌측 구분선(시안 .art-meta-tools).
 */
const SCALES = [1, 1.12, 1.25];
const STORAGE_KEY = "reading-scale-level";

export default function ArticleTools({ divider = false, className = "" }: { divider?: boolean; className?: string }) {
  const [level, setLevel] = useState(0);

  // 마운트 시 저장된 글자 크기 단계 복원
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(STORAGE_KEY) || 0);
      if (saved > 0 && saved < SCALES.length) {
        setLevel(saved);
        document.documentElement.style.setProperty("--reading-scale", String(SCALES[saved]));
      }
    } catch {
      /* localStorage 차단 환경 무시 */
    }
  }, []);

  function cycleFont() {
    const next = (level + 1) % SCALES.length;
    setLevel(next);
    document.documentElement.style.setProperty("--reading-scale", String(SCALES[next]));
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      /* ignore */
    }
  }

  return (
    <div className={`art-tools ${divider ? "art-tools--divider" : ""} ${className}`}>
      <button
        type="button"
        onClick={cycleFont}
        aria-label="글자 크기"
        title={`글자 크기 (현재 ${Math.round(SCALES[level] * 100)}%)`}
      >
        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6">
          <text x="2" y="11" fontSize="11" fill="currentColor" stroke="none" fontWeight="700">A</text>
          <text x="7" y="11" fontSize="8" fill="currentColor" stroke="none">A</text>
        </svg>
      </button>
      <button type="button" onClick={() => window.print()} aria-label="인쇄" title="인쇄">
        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
          <rect x="4" y="2" width="6" height="3" />
          <rect x="2" y="5" width="10" height="6" />
          <rect x="4" y="8" width="6" height="3" />
        </svg>
      </button>
    </div>
  );
}
