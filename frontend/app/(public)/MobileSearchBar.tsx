"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** 모바일 시안 홈 상단 검색 pill (md 미만). */
export default function MobileSearchBar() {
  const [q, setQ] = useState("");
  const router = useRouter();
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = q.trim();
    if (v) router.push(`/search?q=${encodeURIComponent(v)}`);
  }
  return (
    <form className="search-bar md:hidden" onSubmit={submit} role="search">
      <svg className="lupe" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8" cy="8" r="5.5" /><line x1="12.5" y1="12.5" x2="16" y2="16" strokeLinecap="round" /></svg>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="무엇을 찾으시나요?" aria-label="검색어" />
      <button className="go" type="submit" aria-label="검색">
        <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="8" cy="8" r="5.5" /><line x1="12.5" y1="12.5" x2="16" y2="16" strokeLinecap="round" /></svg>
      </button>
    </form>
  );
}
