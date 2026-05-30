"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

const API = process.env.NEXT_PUBLIC_API_URL;

interface ReactionState {
  grace: number;
  reflect: number;
  my_grace: boolean;
  my_reflect: boolean;
  bookmarked: boolean;
}

/**
 * 묵상 반응·공유 바 — 시안 meditation.html .art-foot 재현.
 * 은혜로워요(grace)·되새겨요(reflect) 반응 토글 + 공유·링크복사·저장(북마크).
 * 반응·저장은 회원 로그인 필요(미로그인 시 안내 토스트), 카운트는 누구나 조회.
 */
export default function MeditationReactions({ meditationId, title }: { meditationId: number; title?: string }) {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken ?? "";
  const [st, setSt] = useState<ReactionState>({ grace: 0, reflect: 0, my_grace: false, my_reflect: false, bookmarked: false });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`${API}/api/content/meditations/${meditationId}/reactions`, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setSt(d); })
      .catch(() => {});
  }, [meditationId, token]);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(""), 1800);
  }

  async function toggleReaction(kind: "grace" | "reflect") {
    if (!token) { showToast("로그인 후 이용할 수 있어요"); return; }
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/content/meditations/${meditationId}/reactions/${kind}`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) setSt(await r.json());
    } catch { /* 무시 */ } finally { setBusy(false); }
  }

  async function toggleBookmark() {
    if (!token) { showToast("로그인 후 이용할 수 있어요"); return; }
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/content/meditations/${meditationId}/bookmark`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) { const d = await r.json(); setSt(d); showToast(d.bookmarked ? "보관함에 저장했어요" : "저장을 해제했어요"); }
    } catch { /* 무시 */ } finally { setBusy(false); }
  }

  async function share() {
    const url = window.location.href;
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ title: title ?? "주일 말씀 묵상", url }); } catch { /* 취소 무시 */ }
    } else {
      await copyLink();
    }
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(window.location.href); showToast("링크를 복사했어요"); }
    catch { showToast("복사에 실패했어요"); }
  }

  return (
    <div className="art-foot">
      <div className="reactions">
        <button type="button" className={`react-btn ${st.my_grace ? "on" : ""}`} onClick={() => toggleReaction("grace")} aria-pressed={st.my_grace}>
          <svg viewBox="0 0 14 14" fill={st.my_grace ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6">
            <path d="M7 12s-5-3-5-7a3 3 0 0 1 5-2 3 3 0 0 1 5 2c0 4-5 7-5 7z" />
          </svg>
          은혜로워요 <span className="cnt">{st.grace}</span>
        </button>
        <button type="button" className={`react-btn ${st.my_reflect ? "on" : ""}`} onClick={() => toggleReaction("reflect")} aria-pressed={st.my_reflect}>
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="7" cy="7" r="5" /><line x1="7" y1="4" x2="7" y2="8" /><circle cx="7" cy="10" r="0.5" fill="currentColor" />
          </svg>
          되새겨요 <span className="cnt">{st.reflect}</span>
        </button>
      </div>
      <div className="share-btns">
        <button type="button" onClick={share} aria-label="공유" title="공유">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="3.5" cy="7" r="1.5" /><circle cx="10.5" cy="3.5" r="1.5" /><circle cx="10.5" cy="10.5" r="1.5" /><line x1="4.8" y1="6.3" x2="9.2" y2="4.2" /><line x1="4.8" y1="7.7" x2="9.2" y2="9.8" /></svg>
        </button>
        <button type="button" onClick={copyLink} aria-label="링크 복사" title="링크 복사">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 8L8 6M4 8a2.5 2.5 0 0 1 0-3.5l1.5-1.5a2.5 2.5 0 0 1 3.5 3.5M10 6a2.5 2.5 0 0 1 0 3.5L8.5 11a2.5 2.5 0 0 1-3.5-3.5" /></svg>
        </button>
        <button type="button" onClick={toggleBookmark} aria-label="저장" title="저장" aria-pressed={st.bookmarked} className={st.bookmarked ? "on" : ""}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill={st.bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6"><path d="M3.5 2h7v10l-3.5-2.5L3.5 12z" strokeLinejoin="round" /></svg>
        </button>
      </div>
      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[60] bg-[var(--color-text)] text-white text-sm px-4 py-2 rounded-full shadow-lg pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  );
}
