"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { DataEvent, useInvalidationListener } from "./dataEvents";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/**
 * 회원 헤더 종 아이콘 + 미읽 카운터.
 * - session 있을 때만 렌더
 * - mount + pathname 변경 + NOTIFICATIONS invalidation 시 unread-count fetch
 * - 클릭 = /members/notifications 페이지로 이동
 */
export default function NotificationBell() {
  const { data: session } = useSession();
  const [count, setCount] = useState(0);

  const refetch = useCallback(async () => {
    const token = (session as { accessToken?: string } | null)?.accessToken;
    if (!token) return;
    try {
      const r = await fetch(`${API}/api/members/me/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return;
      const d = await r.json();
      setCount(Number(d.count ?? 0));
    } catch {
      // 네트워크 오류는 silent — 카운터는 0 으로 fallback
    }
  }, [session]);

  useEffect(() => {
    refetch();
  }, [refetch]);
  useInvalidationListener(DataEvent.NOTIFICATIONS, refetch);

  if (!session) return null;

  return (
    <Link
      href="/members/notifications"
      className="relative inline-flex items-center justify-center w-7 h-7 rounded-full hover:bg-[var(--color-surface-warm)] transition-colors"
      aria-label={count > 0 ? `읽지 않은 알림 ${count}건` : "알림함"}
      title={count > 0 ? `읽지 않은 알림 ${count}건` : "알림함"}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold leading-none flex items-center justify-center">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
