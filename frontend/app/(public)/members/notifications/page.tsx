"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import PageHeader from "@/components/PageHeader";
import { DataEvent, notify } from "@/components/dataEvents";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface NotificationItem {
  id: number;
  kind: string;
  title: string;
  body: string | null;
  post_id: number | null;
  event_id: number | null;
  community_group_id: number | null;
  community_group_name: string | null;
  read_at: string | null;
  created_at: string;
}

function targetHref(n: NotificationItem): string | null {
  // 분과 글 → 분과 글 모아보기 (P4 에서 신설 예정). 임시로 그룹 페이지.
  if (n.event_id) return `/calendar`;
  if (n.post_id) return `/boards/notice/${n.post_id}`;
  return null;
}

export default function NotificationsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const token = (session as { accessToken?: string } | null)?.accessToken;
    if (!token) return;
    try {
      const r = await fetch(`${API}/api/members/me/notifications?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setItems(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "알림을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.replace("/members/login?callbackUrl=/members/notifications");
      return;
    }
    load();
  }, [status, session, router, load]);

  async function markRead(id: number) {
    const token = (session as { accessToken?: string } | null)?.accessToken;
    if (!token) return;
    await fetch(`${API}/api/members/me/notifications/${id}/read`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    notify(DataEvent.NOTIFICATIONS);
  }

  async function markAllRead() {
    const token = (session as { accessToken?: string } | null)?.accessToken;
    if (!token) return;
    await fetch(`${API}/api/members/me/notifications/read-all`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    notify(DataEvent.NOTIFICATIONS);
  }

  const unreadCount = items.filter((n) => !n.read_at).length;

  return (
    <>
      <PageHeader group="회원" title="알림함" subtitle={unreadCount > 0 ? `읽지 않은 알림 ${unreadCount}건` : "새 알림이 없습니다"} />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-4">
          <Link href="/members/me" className="text-sm text-[var(--color-primary)] hover:underline">
            ← 마이페이지
          </Link>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs px-3 py-1.5 border border-[var(--color-border)] rounded hover:bg-[var(--color-surface-warm)] transition-colors"
            >
              모두 읽음
            </button>
          )}
        </div>

        {error && (
          <p className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
        )}
        {loading ? (
          <p className="text-sm text-[var(--color-text-muted)] text-center py-12">불러오는 중…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] text-center py-12">알림이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]/60 border border-[var(--color-border)] rounded-lg bg-white">
            {items.map((n) => {
              const href = targetHref(n);
              const isUnread = !n.read_at;
              return (
                <li key={n.id}>
                  <div
                    className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                      isUnread ? "bg-[var(--color-primary)]/5" : "bg-white"
                    }`}
                  >
                    <span
                      className={`inline-block w-2 h-2 mt-2 rounded-full shrink-0 ${
                        isUnread ? "bg-red-500" : "bg-transparent"
                      }`}
                      aria-hidden
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        {n.community_group_name && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 border border-violet-200 text-violet-700 font-semibold">
                            {n.community_group_name}
                          </span>
                        )}
                        <span className={`text-sm ${isUnread ? "font-semibold text-[var(--color-text)]" : "text-[var(--color-text-muted)]"}`}>
                          {n.title}
                        </span>
                      </div>
                      {n.body && (
                        <p className="text-xs text-[var(--color-text-muted)] line-clamp-2 leading-snug">
                          {n.body}
                        </p>
                      )}
                      <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                        {new Date(n.created_at).toLocaleString("ko-KR")}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      {href && (
                        <Link
                          href={href}
                          onClick={() => isUnread && markRead(n.id)}
                          className="text-xs px-2 py-1 bg-[var(--color-primary)] text-white rounded hover:opacity-90"
                        >
                          보기
                        </Link>
                      )}
                      {isUnread && (
                        <button
                          onClick={() => markRead(n.id)}
                          className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                        >
                          읽음
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
