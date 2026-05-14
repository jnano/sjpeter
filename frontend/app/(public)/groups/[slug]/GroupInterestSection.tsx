"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface SubGroup {
  id: number;
  name: string;
  parent_id: number | null;
  board_slug?: string | null;
  link_url?: string | null;
}

interface Props {
  parentId: number;
  parentName: string;
  subGroups: SubGroup[];
}

export default function GroupInterestSection({ parentId, parentName, subGroups }: Props) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [interests, setInterests] = useState<Set<number>>(new Set());
  const [notifyKakao, setNotifyKakao] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") {
      setLoaded(true);
      return;
    }
    const token = session?.accessToken;
    if (!token) return;
    fetch(`${API}/api/members/me/interests`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.groups)) {
          setInterests(new Set(data.groups.map((g: { id: number }) => g.id)));
        }
        if (data && typeof data.notify_kakao === "boolean") {
          setNotifyKakao(data.notify_kakao);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [status, session?.accessToken]);

  async function commit(nextIds: Set<number>) {
    const token = session?.accessToken;
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/members/me/interests`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          community_ids: Array.from(nextIds),
          notify_kakao: notifyKakao,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setInterests(new Set(data.groups.map((g: { id: number }) => g.id)));
        if (typeof data.notify_kakao === "boolean") setNotifyKakao(data.notify_kakao);
      }
    } finally {
      setSaving(false);
    }
  }

  function requireLogin() {
    const callback = encodeURIComponent(pathname || "/");
    router.push(`/members/login?callbackUrl=${callback}`);
  }

  async function toggleParent() {
    if (status !== "authenticated") return requireLogin();
    const next = new Set(interests);
    const isAdding = !next.has(parentId);
    if (isAdding) {
      next.add(parentId);
    } else {
      // 분과 해제 시 등록된 소속단체도 함께 해제 (백엔드 자동 부모 포함 정책과 일관)
      const registeredChildren = subGroups.filter((sg) => next.has(sg.id));
      if (registeredChildren.length > 0) {
        const ok = confirm(
          `이 분과의 소속단체 ${registeredChildren.length}개도 함께 관심 해제됩니다. 계속하시겠습니까?`
        );
        if (!ok) return;
        for (const c of registeredChildren) next.delete(c.id);
      }
      next.delete(parentId);
    }
    await commit(next);
  }

  async function toggleChild(sg: SubGroup) {
    if (status !== "authenticated") return requireLogin();
    const next = new Set(interests);
    if (next.has(sg.id)) {
      next.delete(sg.id);
    } else {
      next.add(sg.id);
      // 백엔드가 부모 자동 포함하지만 UI 즉시 반영 위해 같이 추가
      next.add(parentId);
    }
    await commit(next);
  }

  const parentRegistered = interests.has(parentId);
  const unauthenticated = status === "unauthenticated";

  return (
    <section className="bg-[var(--color-surface-warm)] border border-[var(--color-border)] rounded-xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="font-serif font-bold text-[var(--color-primary)] text-base mb-1">관심 등록</h2>
          {unauthenticated ? (
            <p className="text-xs text-[var(--color-text-muted)]">
              로그인하시면 “{parentName}”의 새 소식을 받아볼 수 있습니다.
            </p>
          ) : parentRegistered ? (
            <p className="text-xs text-[var(--color-text-muted)]">
              “{parentName}”을(를) 내 관심 목록에 등록했습니다. 마이페이지에서 카톡 알림도 켤 수 있어요.
            </p>
          ) : (
            <p className="text-xs text-[var(--color-text-muted)]">
              관심 등록 시 새 글·행사 소식을 받아볼 수 있습니다.
            </p>
          )}
        </div>

        {unauthenticated ? (
          <Link
            href={`/members/login?callbackUrl=${encodeURIComponent(pathname || "/")}`}
            className="shrink-0 px-4 py-2 text-sm font-medium bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
          >
            로그인하고 등록
          </Link>
        ) : !loaded ? (
          <div className="shrink-0 px-4 py-2 text-sm text-[var(--color-text-muted)]">불러오는 중…</div>
        ) : (
          <button
            type="button"
            onClick={toggleParent}
            disabled={saving}
            aria-pressed={parentRegistered}
            className={`shrink-0 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-60 ${
              parentRegistered
                ? "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)]"
                : "border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5"
            }`}
          >
            {parentRegistered ? "✓ 관심 등록됨" : "관심 등록"}
          </button>
        )}
      </div>

      {/* 소속단체 토글 (있을 때만) */}
      {subGroups.length > 0 && status === "authenticated" && loaded && (
        <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
          <p className="text-xs text-[var(--color-text-muted)] mb-2">소속단체 개별 등록</p>
          <div className="flex flex-wrap gap-2">
            {subGroups.map((sg) => {
              const on = interests.has(sg.id);
              return (
                <button
                  key={sg.id}
                  type="button"
                  onClick={() => toggleChild(sg)}
                  disabled={saving}
                  aria-pressed={on}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors disabled:opacity-60 ${
                    on
                      ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                      : "bg-white text-[var(--color-text)] border-[var(--color-border)] hover:border-[var(--color-primary)]/40"
                  }`}
                >
                  {on ? "✓ " : "+ "}
                  {sg.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
