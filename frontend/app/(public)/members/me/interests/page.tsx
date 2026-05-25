"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface CommunityGroup {
  id: number;
  name: string;
  description?: string | null;
  parent_id?: number | null;
  sort_order: number;
  slug?: string | null;
}

export default function MyInterestsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [notifyKakao, setNotifyKakao] = useState(false);
  const [notifyVision, setNotifyVision] = useState(false);
  const [notifyMeditation, setNotifyMeditation] = useState(false);
  const [hasPhone, setHasPhone] = useState(true);  // 카톡 알림 전화번호 가드
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/members/login?callbackUrl=/members/me/interests");
    }
  }, [status, router]);

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
        if (typeof mine?.notify_kakao === "boolean") setNotifyKakao(mine.notify_kakao);
        if (typeof mine?.notify_vision === "boolean") setNotifyVision(mine.notify_vision);
        if (typeof mine?.notify_meditation === "boolean") setNotifyMeditation(mine.notify_meditation);
        if (typeof mine?.has_phone === "boolean") setHasPhone(mine.has_phone);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [status, session?.accessToken]);

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
        const children = groups.filter((g) => g.parent_id === id);
        for (const c of children) next.delete(c.id);
      } else {
        next.add(id);
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
    setSavedMsg("");
    try {
      const res = await fetch(`${API}/api/members/me/interests`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          community_ids: Array.from(selected),
          notify_kakao: notifyKakao && selected.size > 0 && hasPhone,
          notify_vision: notifyVision,
          notify_meditation: notifyMeditation,
        }),
      });
      if (res.ok) {
        setSavedMsg("저장되었습니다.");
        setTimeout(() => setSavedMsg(""), 2500);
      } else {
        setSavedMsg("저장에 실패했습니다.");
      }
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

  const body = (
        <div className={embedded ? "space-y-6" : "max-w-3xl mx-auto space-y-6"}>
          {!embedded && (
          <div>
            <Link href="/members/me" className="text-sm text-[var(--color-primary)] hover:underline">← 마이페이지</Link>
          </div>
          )}

          {/* 관심 콘텐츠 알림 (사목지표·주일말씀) */}
          <div className="bg-white border border-[var(--color-border)] rounded-xl p-5">
            <h2 className="text-sm font-bold text-[var(--color-primary)] mb-1">관심 콘텐츠 알림</h2>
            <p className="text-xs text-[var(--color-text-muted)] mb-3">
              새 사목지표·주일말씀이 등록되면 이메일과 사이트 알림으로 받아볼 수 있습니다.
            </p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={notifyVision}
                  onChange={(e) => setNotifyVision(e.target.checked)}
                  className="w-5 h-5 accent-[var(--color-primary)] shrink-0" />
                <span className="text-sm">사목지표 알림 받기</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={notifyMeditation}
                  onChange={(e) => setNotifyMeditation(e.target.checked)}
                  className="w-5 h-5 accent-[var(--color-primary)] shrink-0" />
                <span className="text-sm">주일말씀 알림 받기</span>
              </label>
            </div>
          </div>

          {/* 분과·단체 트리 */}
          <div>
            <h2 className="text-sm font-bold text-[var(--color-primary)] mb-3">관심 분과·단체</h2>
            {tree.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)] text-center py-8 border border-[var(--color-border)] rounded-xl bg-white">
                등록된 분과·단체가 아직 없습니다.
              </p>
            ) : (
              <div className="space-y-3">
                {tree.map(({ parent, children }) => {
                  const parentChecked = selected.has(parent.id);
                  return (
                    <div key={parent.id} className="bg-white border border-[var(--color-border)] rounded-xl p-4">
                      <label className="flex items-center gap-3 cursor-pointer select-none">
                        <input type="checkbox" checked={parentChecked} onChange={() => toggle(parent.id)}
                          className="w-5 h-5 accent-[var(--color-primary)] shrink-0" />
                        <span className="font-semibold text-[var(--color-primary)]">{parent.name}</span>
                      </label>
                      {children.length > 0 && (
                        <div className="mt-3 pl-8 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {children.map((c) => (
                            <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                              <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)}
                                className="w-4 h-4 accent-[var(--color-primary)] shrink-0" />
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
          </div>

          {/* 카톡 알림 — 분과 1개 이상 선택 + 전화번호 등록 시 활성 */}
          {(() => {
            const kakaoDisabled = selected.size === 0 || !hasPhone;
            return (
              <div className={`bg-white border border-[var(--color-border)] rounded-xl p-4 ${kakaoDisabled ? "opacity-60" : ""}`}>
                <label className={`flex items-start gap-3 select-none ${kakaoDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
                  <input type="checkbox" checked={notifyKakao && !kakaoDisabled} disabled={kakaoDisabled}
                    onChange={(e) => setNotifyKakao(e.target.checked)}
                    className="w-5 h-5 accent-[var(--color-primary)] shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">카카오톡으로 분과·단체 소식 받기</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      선택한 분과·단체에 새 글이나 행사가 등록되면 카톡으로 알려드립니다. (준비 중 — 채널 개설 후 활성화)
                    </p>
                    {!hasPhone && (
                      <p className="text-xs text-amber-700 mt-2">
                        ⚠️ 전화번호가 등록되어 있지 않습니다 — 카톡 발송이 불가합니다.{" "}
                        <Link href="/members/me/profile" className="underline font-medium">프로필에서 전화번호 등록</Link>
                      </p>
                    )}
                  </div>
                </label>
              </div>
            );
          })()}

          {/* 저장 버튼 */}
          <div className="flex items-center gap-3 pt-2">
            <button type="button" onClick={handleSubmit} disabled={submitting}
              className="flex-1 px-5 py-3 text-sm font-medium bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-40">
              {submitting ? "저장 중…" : `저장 (${selected.size}개 분과)`}
            </button>
            {savedMsg && <span className="text-xs text-green-600">{savedMsg}</span>}
          </div>
        </div>
  );
  if (embedded) return body;
  return (
    <>
      <PageHeader group="회원" title="관심 분과·콘텐츠 알림" subtitle="관심 있는 분과·단체와 받고 싶은 콘텐츠 알림을 선택합니다." />
      <SectionLayout>{body}</SectionLayout>
    </>
  );
}
