"use client";

import { useState } from "react";

/**
 * 복음 본문 — 기본 3줄 요약, 클릭 시 전체 펼치기.
 * 본문 길이가 짧으면 펼치기 버튼 없이 그대로 표시.
 */
export default function GospelText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  // 줄 수 추정: 본문이 3줄을 넘는지 단순 휴리스틱 — 길이 또는 줄바꿈 개수
  // 18px · leading 1.8 · 흰색 텍스트 · 카드 폭 약 600px 기준 한 줄 ≈ 25~30자
  const lines = text.split("\n");
  const showToggle = lines.length > 3 || text.length > 90;

  return (
    <div>
      <p
        className={`text-white text-[18px] leading-[1.8] tracking-wide whitespace-pre-line ${
          showToggle && !expanded ? "line-clamp-3" : ""
        }`}
      >
        {text}
      </p>
      {showToggle && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-4 text-sm text-white/80 hover:text-white underline underline-offset-4 transition-colors"
          aria-expanded={expanded}
        >
          {expanded ? "접기 ↑" : "전체 복음 보기 ↓"}
        </button>
      )}
    </div>
  );
}
