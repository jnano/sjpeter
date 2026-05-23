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
  board_slug: string | null;
  read_at: string | null;
  created_at: string;
}

function targetHref(n: NotificationItem): string | null {
  if (n.kind === "vision") return "/vision";
  if (n.kind === "meditation") return "/meditation";
  if (n.post_id) return `/boards/${n.board_slug ?? "notice"}/${n.post_id}`;
  if (n.event_id) return "/calendar";
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
          <ul className="divide-y divide-[var(--color-border)]/60 border border-[var(--color-border)] rounded-lg bg-white overflow-hidden">
            {items.map((n) => {
              const href = targetHref(n);
              const isUnread = !n.read_at;
              // 원글 삭제 판정: community 알림인데 post_id·event_id 가 둘 다 NULL — FK SET NULL 결과
              const isDeleted = n.kind === "community" && !n.post_id && !n.event_id;
              const inner = (
                <div
                  className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                    isUnread ? "bg-[var(--color-primary)]/5" : "bg-white"
                  } ${isDeleted ? "opacity-60" : ""} ${href && !isDeleted ? "hover:bg-[var(--color-surface-warm)] cursor-pointer" : ""}`}
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
                      {isDeleted && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 border border-gray-300 text-gray-600 font-semibold"
                          title="원글이 삭제되었습니다"
                        >
                          🗑️ 삭제됨
                        </span>
                      )}
                      <span
                        className={`text-sm ${
                          isDeleted
                            ? "line-through text-[var(--color-text-muted)]"
                            : isUnread
                              ? "font-semibold text-[var(--color-text)]"
                              : "text-[var(--color-text-muted)]"
                        }`}
                      >
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
                      {isDeleted && " · 원글이 삭제되어 이동할 수 없습니다"}
                    </p>
                  </div>
                  {isUnread && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        markRead(n.id);
                      }}
                      className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] shrink-0 mt-1"
                    >
                      읽음
                    </button>
                  )}
                </div>
              );
              return (
                <li key={n.id}>
                  {href && !isDeleted ? (
                    <Link
                      href={href}
                      onClick={() => isUnread && markRead(n.id)}
                      className="block"
                    >
                      {inner}
                    </Link>
                  ) : (
                    inner
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
