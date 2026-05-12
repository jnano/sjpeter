"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const INTENTION_KINDS = ["위령", "감사", "청원", "기타"] as const;
const KIND_COLOR: Record<string, string> = {
  위령: "bg-gray-100 text-gray-700",
  감사: "bg-amber-100 text-amber-800",
  청원: "bg-blue-100 text-blue-700",
  기타: "bg-green-100 text-green-700",
};
const MAX_MESSAGE = 100;

interface Author {
  id: number;
  nickname: string;
  avatar_url?: string | null;
}

interface LinePost {
  id: number;
  title: string;
  created_at: string;
  intention_kind: string | null;
  intention_for: string | null;
  like_count: number;
  liked_by_me: boolean;
  member: Author | null;
}

interface Props {
  slug: string;
  canWrite: boolean;
  membersOnlyWrite: boolean;
  description: string;
}

export default function LineBoard({ slug, canWrite, membersOnlyWrite, description }: Props) {
  const { data: session, status } = useSession();
  const [posts, setPosts] = useState<LinePost[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // 작성 폼 state
  const [formOpen, setFormOpen] = useState(false);
  const [kind, setKind] = useState<string>("청원");
  const [intentionFor, setIntentionFor] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = (session as { accessToken?: string } | null)?.accessToken ?? null;

  const reload = useCallback(
    async (targetPage = page) => {
      setLoading(true);
      try {
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`${API}/api/boards/${slug}/posts?page=${targetPage}`, {
          headers,
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          setPosts(data.posts);
          setTotalPages(Math.max(1, Math.ceil(data.total / data.posts_per_page)));
        }
      } finally {
        setLoading(false);
      }
    },
    [slug, page, token]
  );

  useEffect(() => {
    reload(page);
  }, [page, reload]);

  async function submit() {
    setError(null);
    const trimmed = message.trim();
    if (!trimmed) {
      setError("한 줄 메시지를 입력해 주세요.");
      return;
    }
    if (trimmed.length > MAX_MESSAGE) {
      setError(`메시지는 ${MAX_MESSAGE}자 이내로 작성해 주세요.`);
      return;
    }
    if (!token) {
      setError("로그인이 필요합니다.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/boards/${slug}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: trimmed,
          content: "",
          intention_kind: kind,
          intention_for: intentionFor.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || "등록 실패");
        return;
      }
      setKind("청원");
      setIntentionFor("");
      setMessage("");
      setFormOpen(false);
      await reload(1);
      setPage(1);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleLike(p: LinePost) {
    if (!token) return; // 비로그인은 버튼 disabled로 처리
    // 낙관적 업데이트
    setPosts((prev) =>
      prev.map((x) =>
        x.id === p.id
          ? { ...x, liked_by_me: !x.liked_by_me, like_count: x.like_count + (x.liked_by_me ? -1 : 1) }
          : x
      )
    );
    try {
      const res = await fetch(`${API}/api/boards/${slug}/posts/${p.id}/like`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        // 롤백
        setPosts((prev) =>
          prev.map((x) =>
            x.id === p.id
              ? { ...x, liked_by_me: p.liked_by_me, like_count: p.like_count }
              : x
          )
        );
      }
    } catch {
      // 그대로 둠 (네트워크 오류)
    }
  }

  const showLoginCta = membersOnlyWrite && status === "unauthenticated";

  return (
    <div className="space-y-6">
      {description && (
        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{description}</p>
      )}

      {/* 작성 영역 */}
      {canWrite ? (
        formOpen ? (
          <div className="bg-white border border-[var(--color-primary)]/30 rounded-xl p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <label className="text-xs font-medium text-[var(--color-text-muted)]">종류</label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                className="px-2.5 py-1.5 border border-[var(--color-border)] rounded-lg text-sm bg-white focus:outline-none focus:border-[var(--color-primary)]"
              >
                {INTENTION_KINDS.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
              <label className="text-xs font-medium text-[var(--color-text-muted)] ml-2">대상·의도 (선택)</label>
              <input
                type="text"
                value={intentionFor}
                onChange={(e) => setIntentionFor(e.target.value)}
                placeholder="예: 故 김 파우로 형제, 가족 건강"
                maxLength={100}
                className="flex-1 min-w-[200px] px-3 py-1.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <div>
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="한 줄로 마음을 남겨주세요."
                maxLength={MAX_MESSAGE}
                className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
              />
              <p className="mt-1 text-[11px] text-[var(--color-text-muted)] text-right">
                {message.length} / {MAX_MESSAGE}자
              </p>
            </div>
            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setFormOpen(false); setError(null); }}
                className="px-4 py-2 text-sm border border-[var(--color-border)] rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={submitting || !message.trim()}
                className="px-4 py-2 text-sm font-medium bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] disabled:opacity-40 transition-colors"
              >
                {submitting ? "올리는 중…" : "봉헌하기"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="w-full px-5 py-4 text-sm font-medium bg-[var(--color-primary)] text-white rounded-xl hover:bg-[var(--color-primary-dark)] transition-colors"
          >
            ✍ 한 줄 봉헌하기
          </button>
        )
      ) : showLoginCta ? (
        <div className="bg-[var(--color-surface-warm)] border border-[var(--color-border)] rounded-xl px-5 py-4 text-sm text-[var(--color-text)] flex items-center justify-between">
          <span>로그인하면 한 줄 메시지를 남기고 다른 분의 글에 함께 기도할 수 있어요.</span>
          <Link
            href={`/members/login?callbackUrl=/boards/${slug}`}
            className="shrink-0 px-3 py-1.5 text-sm font-medium bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
          >
            로그인
          </Link>
        </div>
      ) : null}

      {/* 카드 그리드 */}
      {loading && posts.length === 0 ? (
        <p className="text-center py-12 text-[var(--color-text-muted)]">불러오는 중...</p>
      ) : posts.length === 0 ? (
        <p className="text-center py-12 text-[var(--color-text-muted)] text-sm border border-dashed border-[var(--color-border)] rounded-xl">
          아직 등록된 메시지가 없습니다. 첫 한 줄을 남겨주세요.
        </p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {posts.map((p) => {
            const kindLabel = p.intention_kind ?? "기타";
            const kindCls = KIND_COLOR[kindLabel] ?? KIND_COLOR["기타"];
            return (
              <li
                key={p.id}
                className="bg-white border border-[var(--color-border)] rounded-xl p-4 flex flex-col gap-3"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${kindCls}`}>
                    {kindLabel}
                  </span>
                  {p.intention_for && (
                    <span className="text-xs text-[var(--color-text-muted)] truncate">{p.intention_for}</span>
                  )}
                </div>
                <p className="text-sm text-[var(--color-text)] leading-relaxed whitespace-pre-line flex-1">
                  {p.title}
                </p>
                <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
                  <span className="truncate">
                    {p.member?.nickname ?? "회원"}
                    <span className="mx-1.5 text-[var(--color-border-dark)]">·</span>
                    {new Date(p.created_at).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleLike(p)}
                    disabled={status !== "authenticated"}
                    aria-pressed={p.liked_by_me}
                    title={status !== "authenticated" ? "로그인 후 공감하실 수 있어요" : undefined}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      p.liked_by_me
                        ? "bg-[var(--color-primary)] text-white"
                        : "bg-gray-50 text-[var(--color-text-muted)] hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)]"
                    } disabled:opacity-60`}
                  >
                    <span>🙏</span>
                    <span>함께 기도</span>
                    <span className="font-bold">{p.like_count}</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            이전
          </button>
          <span className="text-sm text-[var(--color-text-muted)]">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
