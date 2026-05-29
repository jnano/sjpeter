"use client";

import { useEffect, useState } from "react";

/**
 * 시안 .read-tabs 재현 — 4탭 (1독서·화답송·복음환호송·복음).
 * 클릭 시 해당 reading 카드(#anchor)로 스크롤 점프.
 * 스크롤 위치에 따라 현재 활성 탭을 자동 추적(IntersectionObserver).
 */
interface Tab {
  id: string;          // anchor id (e.g. "first")
  label: string;       // "제1독서"
  reference: string;   // "1코린"
}

/**
 * 긴 reference 를 탭에 맞게 축약. 풀 reference 는 title 속성으로 노출.
 *   "사도 바오로의 코린토 1서 12,3ㄷ-7.12-13" → "1코린 12,3"
 *   "마카베오기 하권 6,18.21.24-31" → "2마카 6,18"
 *   "시편 104(103),1ㄱㄴ과 24..."   → "시편 104"
 *   "다니 3,52ㄱ.52ㄷ.53.54.55.56"  → "다니 3,52"
 */
function shortenRef(ref: string): string {
  if (!ref) return "";
  let r = ref;
  // "사도 바오로의 X" 형태 책명 약어
  const apostleMap: [RegExp, string][] = [
    [/^사도\s*바오로의?\s*코린토\s*1서/, "1코린"],
    [/^사도\s*바오로의?\s*코린토\s*2서/, "2코린"],
    [/^사도\s*바오로의?\s*테살로니카\s*1서/, "1테살"],
    [/^사도\s*바오로의?\s*테살로니카\s*2서/, "2테살"],
    [/^사도\s*바오로의?\s*티모테오\s*1서/, "1티모"],
    [/^사도\s*바오로의?\s*티모테오\s*2서/, "2티모"],
    [/^사도\s*바오로의?\s*로마(서)?/, "로마"],
    [/^사도\s*바오로의?\s*갈라티아(서)?/, "갈라"],
    [/^사도\s*바오로의?\s*에페소(서)?/, "에페"],
    [/^사도\s*바오로의?\s*필리피(서)?/, "필리"],
    [/^사도\s*바오로의?\s*콜로새(서)?/, "콜로"],
    [/^사도\s*바오로의?\s*티토(서)?/, "티토"],
    [/^사도\s*바오로의?\s*필레몬(서)?/, "필레"],
    [/^사도\s*바오로의?\s*히브리(서)?/, "히브"],
    [/^사도행전/, "사도"],
    [/^마카베오기\s*상권/, "1마카"],
    [/^마카베오기\s*하권/, "2마카"],
    [/^베드로\s*1서/, "1베드"],
    [/^베드로\s*2서/, "2베드"],
    [/^요한\s*1서/, "1요한"],
    [/^요한\s*2서/, "2요한"],
    [/^요한\s*3서/, "3요한"],
  ];
  for (const [re, short] of apostleMap) {
    if (re.test(r)) { r = r.replace(re, short); break; }
  }
  // 첫 콤마+첫 절 번호까지만 유지 (절 끝의 ㄱㄴㄷ·다중 절 표기 제거)
  // "1코린 12,3ㄷ-7.12-13" → "1코린 12,3"
  // "시편 104(103),1ㄱㄴ과 24..." → "시편 104,1" → 후처리에서 "시편 104"
  const m = r.match(/^([^,]+),\s*([\d]+)/);
  if (m) r = `${m[1]},${m[2]}`;
  else {
    // 콤마가 없으면 책명+장 까지만
    const m2 = r.match(/^([가-힣A-Za-z0-9]+\s*\d+)/);
    if (m2) r = m2[1];
  }
  // 괄호 안 보조 표기 제거 (예: "시편 104(103)")
  r = r.replace(/\s*\(\s*[^)]*\)\s*/g, "").trim();
  return r;
}

export default function ReadTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState<string>(tabs[0]?.id ?? "");

  useEffect(() => {
    const els = tabs
      .map((t) => document.getElementById(t.id))
      .filter((el): el is HTMLElement => !!el);
    if (els.length === 0) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: 0 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [tabs]);

  function jump(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    // 헤더 + sticky tab 만큼 보정. 모바일은 app-header(50px)+tab(약 50px), 데스크탑은 헤더+브레드크럼+tab.
    const offset = window.innerWidth < 768 ? 110 : 140;
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: "smooth" });
    setActive(id);
  }

  return (
    <div className="flex gap-1 p-1 bg-white border border-[var(--color-border)] rounded-full mb-6 sticky top-14 md:top-32 z-10">
      {tabs.map((t) => {
        const on = active === t.id;
        const short = shortenRef(t.reference);
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => jump(t.id)}
            title={`${t.label} — ${t.reference}`}
            className={`flex-1 min-w-0 px-2 py-2 rounded-full font-semibold transition-colors flex flex-col items-center leading-tight ${
              on ? "bg-[var(--color-text)] text-white" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            <span className={`text-[9px] sm:text-[10px] opacity-70 ${on ? "opacity-100" : ""}`} style={on ? { color: "var(--color-accent, #C9A961)" } : undefined}>
              {t.label}
            </span>
            <span className="block w-full truncate text-center text-[10px] sm:text-[12px] tracking-tight">
              {short}
            </span>
          </button>
        );
      })}
    </div>
  );
}
