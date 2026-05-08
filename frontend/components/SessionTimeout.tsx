"use client";

import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";

const INACTIVE_MS = 25 * 60 * 1000; // 25분 → 경고
const WARN_MS     =  5 * 60 * 1000; // 경고 후 5분 → 로그아웃
const THROTTLE_MS =  1_000;          // 활동 감지 최소 간격

function clearAdminSession() {
  localStorage.removeItem("admin_token");
  localStorage.removeItem("admin_display_name");
  localStorage.removeItem("admin_role");
  localStorage.removeItem("admin_is_super");
  document.cookie = "admin_authed=; path=/; max-age=0";
}

export default function SessionTimeout() {
  const { status } = useSession();
  const [warning, setWarning] = useState(false);
  const [remaining, setRemaining] = useState(WARN_MS / 1000); // 초

  const inactiveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countTimer    = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivity  = useRef(0);

  function logout() {
    clearAdminSession();
    signOut({ callbackUrl: "/" });
  }

  function clearWarn() {
    if (warnTimer.current)  clearTimeout(warnTimer.current);
    if (countTimer.current) clearInterval(countTimer.current);
    warnTimer.current  = null;
    countTimer.current = null;
    setWarning(false);
    setRemaining(WARN_MS / 1000);
  }

  function resetTimers() {
    if (inactiveTimer.current) clearTimeout(inactiveTimer.current);
    clearWarn();

    inactiveTimer.current = setTimeout(() => {
      setWarning(true);
      setRemaining(WARN_MS / 1000);

      // 카운트다운
      countTimer.current = setInterval(() => {
        setRemaining((s) => {
          if (s <= 1) {
            clearInterval(countTimer.current!);
            return 0;
          }
          return s - 1;
        });
      }, 1000);

      // 5분 후 자동 로그아웃
      warnTimer.current = setTimeout(logout, WARN_MS);
    }, INACTIVE_MS);
  }

  useEffect(() => {
    if (status !== "authenticated") return;

    const onActivity = () => {
      const now = Date.now();
      if (now - lastActivity.current < THROTTLE_MS) return;
      lastActivity.current = now;
      resetTimers();
    };

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    resetTimers();

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      if (inactiveTimer.current) clearTimeout(inactiveTimer.current);
      clearWarn();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (!warning) return null;

  const min = Math.floor(remaining / 60);
  const sec = remaining % 60;
  const timeStr = min > 0
    ? `${min}분 ${sec.toString().padStart(2, "0")}초`
    : `${sec}초`;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
        <div className="text-4xl mb-4">⏱</div>
        <h2 className="font-serif text-xl font-bold text-[var(--color-primary)] mb-2">
          자동 로그아웃 안내
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-1">
          30분간 활동이 없어 곧 로그아웃됩니다.
        </p>
        <p className="text-2xl font-bold text-[var(--color-accent)] my-4">
          {timeStr}
        </p>
        <p className="text-xs text-[var(--color-text-muted)] mb-6">
          계속 이용하시려면 아래 버튼을 눌러주세요.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => { resetTimers(); }}
            className="flex-1 py-2.5 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
          >
            계속 이용
          </button>
          <button
            onClick={logout}
            className="flex-1 py-2.5 border border-[var(--color-border)] text-[var(--color-text-muted)] text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            로그아웃
          </button>
        </div>
      </div>
    </div>
  );
}
