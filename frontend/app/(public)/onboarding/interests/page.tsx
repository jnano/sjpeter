"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import PageHeader from "@/components/PageHeader";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface CommunityGroup {
  id: number;
  name: string;
  description?: string | null;
  parent_id?: number | null;
  sort_order: number;
  slug?: string | null;
}

export default function OnboardingInterestsPage() {
  const router = useRouter();
  const { data: session, status, update } = useSession();
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [notify, setNotify] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false); // 이미 응답한 회원이 수정 모드로 재진입

  // 인증 확인 + 이미 응답한 회원은 마이페이지로
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/members/login?callbackUrl=/onboarding/interests");
    }
  }, [status, router]);

  // 분과/단체 목록 + 현재 회원 상태 동시 로드
  useEffect(() => {
    if (status !== "authenticated") return;
    const token = session?.accessToken;
    if (!token) return;

    Promise.all([
      fetch(`${API}/api/content/community`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API}/api/members/me/interests`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([groupsData, mine]) => {
        if (Array.isArray(groupsData)) setGroups(groupsData);
        if (Array.isArray(mine?.groups)) {
          setSelected(new Set(mine.groups.map((g: CommunityGroup) => g.id)));
        }
        if (typeof mine?.notify_kakao === "boolean") setNotify(mine.notify_kakao);
        setIsEditing(!!mine?.interest_prompt_completed);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [status, session?.accessToken, router]);

  // 분과(parent_id=null) → 자식 단체 묶기
  const tree = useMemo(() => {
    const parents = groups.filter((g) => !g.parent_id).sort((a, b) => a.sort_order - b.sort_order);
    const childrenByParent = new Map<number, CommunityGroup[]>();
    for (const g of groups) {
      if (g.parent_id) {
        const list = childrenByParent.get(g.parent_id) ?? [];
        list.push(g);
        childrenByParent.set(g.parent_id, list);
      }
    }
    for (const list of childrenByParent.values()) {
      list.sort((a, b) => a.sort_order - b.sort_order);
    }
    return parents.map((p) => ({ parent: p, children: childrenByParent.get(p.id) ?? [] }));
  }, [groups]);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // 분과 해제 시 자식들도 함께 해제 (UX: 부모 unchecked → 자식 잔존하면 어색)
        const children = groups.filter((g) => g.parent_id === id);
        for (const c of children) next.delete(c.id);
      } else {
        next.add(id);
        // 단체 선택 시 부모 분과도 자동 체크 (UI 시각화 — 서버도 동일 처리)
        const target = groups.find((g) => g.id === id);
        if (target?.parent_id) next.add(target.parent_id);
      }
      return next;
    });
  }

  async function handleSubmit() {
    const token = session?.accessToken;
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/members/me/interests`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          community_ids: Array.from(selected),
          notify_kakao: notify && selected.size > 0,
        }),
      });
      if (res.ok) {
        await update({ refreshAdmin: true }).catch(() => {});
        router.replace("/members/me");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSkip() {
    const token = session?.accessToken;
    if (!token) return;
    setSubmitting(true);
    try {
      await fetch(`${API}/api/members/me/interests/skip`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      router.replace("/");
    } finally {
      setSubmitting(false);
    }
  }

  if (status !== "authenticated" || loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <p className="text-[var(--color-text-muted)]">불러오는 중...</p>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        group="본당 공동체"
        title={isEditing ? "관심 분과·단체 수정" : "관심 분과·단체 선택"}
        subtitle="관심 있는 분과·단체를 선택하면 해당 소식을 받아볼 수 있습니다."
      />
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-[var(--color-surface-warm)] border border-[var(--color-border)] rounded-xl p-5 text-sm text-[var(--color-text)] leading-relaxed flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-medium mb-1">
              {isEditing ? "관심 분과·단체를 자유롭게 바꿔보세요" : "잠깐, 어디에 관심이 있으신가요?"}
            </p>
            <p className="text-[var(--color-text-muted)] text-xs">
              단체를 선택하면 소속 분과는 자동으로 함께 등록됩니다. 언제든 마이페이지에서 다시 바꿀 수 있어요.
            </p>
            {!isEditing && (
              <p className="text-[var(--color-text-muted)] text-xs mt-2">
                이 창을 닫으시려면 관심분과를 선택하거나 “관심분과 선택 안함” 버튼을 누르세요.
              </p>
            )}
          </div>
          {!isEditing && (
            <button
              type="button"
              onClick={handleSkip}
              disabled={submitting}
              className="shrink-0 px-4 py-2 text-xs bg-white border border-[var(--color-border)] text-[var(--color-text-muted)] rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              관심분과 선택 안함
            </button>
          )}
        </div>

        {tree.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] text-center py-8">
            등록된 분과·단체가 아직 없습니다.
          </p>
        ) : (
          <div className="space-y-4">
            {tree.map(({ parent, children }) => {
              const parentChecked = selected.has(parent.id);
              return (
                <div key={parent.id} className="bg-white border border-[var(--color-border)] rounded-xl p-4">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={parentChecked}
                      onChange={() => toggle(parent.id)}
                      className="w-5 h-5 accent-[var(--color-primary)] shrink-0"
                    />
                    <span className="font-semibold text-[var(--color-primary)]">{parent.name}</span>
                  </label>
                  {children.length > 0 && (
                    <div className="mt-3 pl-8 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {children.map((c) => (
                        <label
                          key={c.id}
                          className="flex items-center gap-2 text-sm cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={selected.has(c.id)}
                            onChange={() => toggle(c.id)}
                            className="w-4 h-4 accent-[var(--color-primary)] shrink-0"
                          />
                          <span>{c.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 카톡 알림 동의 — 분과 1개 이상 선택 시에만 활성 */}
        <div className={`bg-white border border-[var(--color-border)] rounded-xl p-4 ${selected.size === 0 ? "opacity-50" : ""}`}>
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={notify}
              onChange={(e) => setNotify(e.target.checked)}
              disabled={selected.size === 0}
              className="w-5 h-5 accent-[var(--color-primary)] shrink-0 mt-0.5"
            />
            <div>
              <p className="text-sm font-medium">카카오톡으로 소식 받기</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                선택한 분과·단체에 새 글이나 행사가 등록되면 카톡으로 알려드립니다. (준비 중 — 채널 개설 후 활성화)
              </p>
            </div>
          </label>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          {isEditing ? (
            <button
              type="button"
              onClick={() => router.push("/members/me")}
              disabled={submitting}
              className="flex-1 sm:flex-none px-5 py-3 text-sm border border-[var(--color-border)] text-[var(--color-text-muted)] rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              취소
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSkip}
              disabled={submitting}
              className="flex-1 sm:flex-none px-5 py-3 text-sm border border-[var(--color-border)] text-[var(--color-text-muted)] rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              관심분과 선택 안함
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || (selected.size === 0 && !isEditing)}
            className="flex-1 px-5 py-3 text-sm font-medium bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-40"
          >
            {submitting ? "저장 중…" : isEditing ? `저장 (${selected.size})` : `선택 완료 (${selected.size})`}
          </button>
        </div>
      </div>
    </>
  );
}
