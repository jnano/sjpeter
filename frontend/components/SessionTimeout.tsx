"use client";

import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";

const INACTIVE_MS = 25 * 60 * 1000; // 25분 → 경고
const WARN_MS     =  5 * 60 * 1000; // 경고 후 5분 → 로그아웃
const THROTTLE_MS =  1_000;          // 활동 감지 최소 간격
const ABSOLUTE_CHECK_MS = 60 * 1000; // 절대 만료 체크 주기 (1분)

function clearAdminSession() {
  localStorage.removeItem("admin_token");
  localStorage.removeItem("admin_display_name");
  localStorage.removeItem("admin_role");
  localStorage.removeItem("admin_is_super");
  localStorage.removeItem("admin_token_exp");
  localStorage.removeItem("admin_remember");
  document.cookie = "admin_authed=; path=/; max-age=0";
}

function clearMemberMarkers() {
  localStorage.removeItem("member_remember");
}

function hasAdminSession(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem("admin_token");
}

function getAdminAbsoluteExpiry(): number {
  if (typeof window === "undefined") return 0;
  const v = localStorage.getItem("admin_token_exp");
  return v ? Number(v) : 0;
}

function isAdminRemember(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("admin_remember") === "1";
}

function isMemberRemember(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("member_remember") === "1";
}

type SessionWithExtras = {
  remember?: boolean;
  absoluteExpiry?: number;
};

export default function SessionTimeout() {
  const { status, data: session } = useSession();
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  const [warning, setWarning] = useState(false);
  const [remaining, setRemaining] = useState(WARN_MS / 1000); // 초

  const inactiveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countTimer    = useRef<ReturnType<typeof setInterval> | null>(null);
  const absoluteTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivity  = useRef(0);
  // v1.5.453 — stale closure 방지용 ref. useEffect 의 exhaustive-deps 비활성화 대체.
  // logout/resetTimers 가 매 렌더에서 다시 만들어지지만 useEffect 는 deps 최소화 유지.
  const logoutRef       = useRef<() => void>(() => {});
  const resetTimersRef  = useRef<() => void>(() => {});

  // 관리자 로그인 상태 폴링 (localStorage 변화 감지)
  useEffect(() => {
    const check = () => setAdminLoggedIn(hasAdminSession());
    check();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "admin_token") check();
    };
    window.addEventListener("storage", onStorage);
    const id = setInterval(check, 5_000);
    return () => {
      window.removeEventListener("storage", onStorage);
      clearInterval(id);
    };
  }, []);

  const memberAuthed = status === "authenticated";
  const isAuthed = memberAuthed || adminLoggedIn;
  const memberRemember = memberAuthed
    ? ((session as SessionWithExtras | null)?.remember ?? isMemberRemember())
    : false;
  const adminRemember = adminLoggedIn ? isAdminRemember() : false;
  // 두 세션 중 하나라도 "로그인 유지"가 아니면 idle 타이머 작동
  const idleEnabled = isAuthed && !(
    (memberAuthed ? memberRemember : true) &&
    (adminLoggedIn ? adminRemember : true)
  );

  function logout() {
    if (adminLoggedIn) clearAdminSession();
    if (memberAuthed) {
      clearMemberMarkers();
      signOut({ callbackUrl: "/" });
    } else if (adminLoggedIn) {
      // 관리자만 로그아웃 → 관리자 로그인 페이지로
      window.location.href = "/admin";
    }
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

      countTimer.current = setInterval(() => {
        setRemaining((s) => {
          if (s <= 1) {
            clearInterval(countTimer.current!);
            return 0;
          }
          return s - 1;
        });
      }, 1000);

      warnTimer.current = setTimeout(() => logoutRef.current(), WARN_MS);
    }, INACTIVE_MS);
  }

  // ref 항상 최신 함수로 동기화 — useEffect 가 stale 클로저를 잡지 않도록 (v1.5.453)
  useEffect(() => {
    logoutRef.current = logout;
    resetTimersRef.current = resetTimers;
  });

  // 절대 만료 감시 (remember 여부와 무관하게 작동)
  useEffect(() => {
    if (!isAuthed) {
      if (absoluteTimer.current) clearInterval(absoluteTimer.current);
      absoluteTimer.current = null;
      return;
    }
    const check = () => {
      const now = Date.now();
      const memberExp = memberAuthed
        ? (session as SessionWithExtras | null)?.absoluteExpiry ?? 0
        : 0;
      const adminExp = adminLoggedIn ? getAdminAbsoluteExpiry() : 0;
      const memberExpired = memberAuthed && memberExp > 0 && now >= memberExp;
      const adminExpired = adminLoggedIn && adminExp > 0 && now >= adminExp;
      if (memberExpired || adminExpired) {
        logoutRef.current();
      }
    };
    check();
    absoluteTimer.current = setInterval(check, ABSOLUTE_CHECK_MS);
    return () => {
      if (absoluteTimer.current) clearInterval(absoluteTimer.current);
      absoluteTimer.current = null;
    };
  }, [isAuthed, memberAuthed, adminLoggedIn, session]);

  // idle 타이머
  useEffect(() => {
    if (!idleEnabled) {
      if (inactiveTimer.current) clearTimeout(inactiveTimer.current);
      clearWarn();
      return;
    }

    const onActivity = () => {
      const now = Date.now();
      if (now - lastActivity.current < THROTTLE_MS) return;
      lastActivity.current = now;
      resetTimersRef.current();
    };

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    resetTimersRef.current();

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      if (inactiveTimer.current) clearTimeout(inactiveTimer.current);
      clearWarn();
    };
  }, [idleEnabled]);

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
