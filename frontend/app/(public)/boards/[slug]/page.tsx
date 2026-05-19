import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import BoardList from "./BoardList";
import LineBoard from "./LineBoard";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";

// admin에서 변경한 게시판/게시글이 새로고침 없이 반영되도록
export const dynamic = "force-dynamic";

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL;

interface Author {
  id: number;
  nickname: string;
}

interface Post {
  id: number;
  title: string;
  member: Author;
  view_count: number;
  comment_count: number;
  created_at: string;
  thumbnail_url: string | null;
  is_pinned: boolean;
}

interface PostListOut {
  posts: Post[];
  total: number;
  posts_per_page: number;
}

interface Board {
  id: number;
  name: string;
  slug: string;
  description: string;
  members_only_write: boolean;
  members_only_read: boolean;
  moderator_only_write: boolean;
  moderator_id: number | null;
  posts_per_page: number;
  kind: string;
  list_show_number: boolean;
  list_show_author: boolean;
  list_show_date: boolean;
  list_show_views: boolean;
  list_show_likes: boolean;
  list_show_comments: boolean;
  show_view_list: boolean;
  show_view_card: boolean;
  show_view_photo: boolean;
  show_search_form: boolean;
  list_show_shares: boolean;
  share_enabled: boolean;
}

async function getBoard(slug: string): Promise<Board | null> {
  try {
    // admin에서 kind/제목 등 변경 시 즉시 반영되도록 캐시 비활성
    const res = await fetch(`${API}/api/boards/${slug}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getPosts(
  slug: string,
  page: number,
  q: string,
  sort: string,
  category: string,
  token?: string,
): Promise<PostListOut> {
  try {
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    const qp = new URLSearchParams({ page: String(page) });
    if (q) qp.set("q", q);
    if (sort && sort !== "latest") qp.set("sort", sort);
    if (category) qp.set("category", category);
    const res = await fetch(`${API}/api/boards/${slug}/posts?${qp}`, {
      cache: "no-store",
      headers,
    });
    if (!res.ok) return { posts: [], total: 0, posts_per_page: 20 };
    return res.json();
  } catch {
    return { posts: [], total: 0, posts_per_page: 20 };
  }
}

async function getCategories(slug: string): Promise<string[]> {
  try {
    const res = await fetch(`${API}/api/boards/${slug}/categories`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "latest",   label: "최신순" },
  { value: "views",    label: "조회순" },
  { value: "likes",    label: "추천순" },
  { value: "comments", label: "댓글순" },
];

const VIEW_OPTIONS: { value: "list" | "card" | "photo"; label: string }[] = [
  { value: "list",  label: "목록" },
  { value: "card",  label: "카드" },
  { value: "photo", label: "사진" },
];

export default async function BoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; view?: string; q?: string; sort?: string; category?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1") || 1);
  const requestedView: "list" | "card" | "photo" =
    sp.view === "photo" ? "photo" : sp.view === "card" ? "card" : "list";
  const q = (sp.q ?? "").trim();
  const sort = SORT_OPTIONS.some((o) => o.value === sp.sort) ? sp.sort! : "latest";
  const category = (sp.category ?? "").trim();

  const [board, session] = await Promise.all([getBoard(slug), auth()]);

  if (!board) notFound();

  // 갤러리 종류 게시판은 사진 그리드 뷰가 자연스러운 진입점.
  // /boards/{slug} 로 들어와도 /gallery/{slug} 로 통일 (사이드바·photo view·메뉴 매칭 일관성).
  // 게시글 상세의 「목록으로」링크가 항상 /boards/{slug} 로 가도 여기서 redirect 되어 정상 화면.
  if (board.kind === "gallery") {
    const qs = new URLSearchParams();
    if (sp.page) qs.set("page", sp.page);
    if (sp.q) qs.set("q", sp.q);
    if (sp.sort) qs.set("sort", sp.sort);
    if (sp.category) qs.set("category", sp.category);
    const suffix = qs.toString();
    redirect(`/gallery/${slug}${suffix ? `?${suffix}` : ""}`);
  }

  // 활성 뷰 계산 — admin 토글이 켠 뷰들. 모두 꺼지면 list 폴백.
  const activeViews = VIEW_OPTIONS.filter((v) => {
    if (v.value === "list") return board.show_view_list;
    if (v.value === "card") return board.show_view_card;
    return board.show_view_photo;
  });
  const fallbackView = activeViews[0]?.value ?? "list";
  const currentView = activeViews.some((v) => v.value === requestedView) ? requestedView : fallbackView;

  if (board.members_only_read && !session) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/boards" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)]">
          ← 게시판 목록
        </Link>
        <h1 className="text-2xl font-bold text-[var(--color-primary)] mt-4">{board.name}</h1>
        <div className="mt-12 text-center py-16 border border-[var(--color-border)] rounded-xl">
          <p className="text-4xl mb-4">🔒</p>
          <p className="font-semibold text-[var(--color-text)]">회원 전용 게시판입니다.</p>
          <p className="text-sm text-[var(--color-text-muted)] mt-1 mb-6">로그인 후 이용하실 수 있습니다.</p>
          <Link
            href={`/members/login?callbackUrl=/boards/${slug}`}
            className="px-6 py-2.5 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
          >
            로그인
          </Link>
        </div>
      </div>
    );
  }

  const token = (session as { accessToken?: string } | null)?.accessToken;
  const memberId = (session as { memberId?: number } | null)?.memberId ?? null;
  // 운영자 권한: admin / 운영자(is_admin 회원) / 게시판 운영자
  const isOperator = !!(session as { isAdmin?: boolean } | null)?.isAdmin;
  const canWrite = board.moderator_only_write
    ? memberId !== null && (memberId === board.moderator_id || isOperator)
    : !board.members_only_write || !!session;

  // 한 줄 메시지 게시판은 별도 UI로 분기 (목록·작성·추천을 카드 그리드로 노출)
  if (board.kind === "line") {
    return (
      <>
        <PageHeader
          group="알림과 게시판"
          title={board.name}
          subtitle={board.description || ""}
        />
        <SectionLayout autoHero={false}>
          <LineBoard
            slug={slug}
            canWrite={canWrite}
            membersOnlyWrite={board.members_only_write}
            description=""
          />
        </SectionLayout>
      </>
    );
  }

  const [postList, categories] = await Promise.all([
    getPosts(slug, page, q, sort, category, token),
    getCategories(slug),
  ]);
  const totalPages = Math.max(1, Math.ceil(postList.total / postList.posts_per_page));

  return (
    <>
      <PageHeader
        group="알림과 게시판"
        title={board.name}
        subtitle={board.description || ""}
        action={
          canWrite ? (
            <Link
              href={`/boards/${slug}/write`}
              className="px-4 py-1.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white text-xs font-medium rounded-lg transition-colors"
            >
              글쓰기
            </Link>
          ) : undefined
        }
      />
      <SectionLayout autoHero={false}>
        {/* 카테고리 필터 칩 (등록된 카테고리가 있을 때만) */}
        {categories.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {(() => {
              const baseQp = new URLSearchParams();
              if (q) baseQp.set("q", q);
              if (sort !== "latest") baseQp.set("sort", sort);
              if (currentView !== "list") baseQp.set("view", currentView);
              const allHref = `/boards/${slug}${baseQp.toString() ? `?${baseQp}` : ""}`;
              return (
                <>
                  <Link
                    href={allHref}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      !category
                        ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                        : "border-[var(--color-border)] hover:bg-[var(--color-surface-warm)]"
                    }`}
                  >
                    전체
                  </Link>
                  {categories.map((c) => {
                    const qp = new URLSearchParams(baseQp);
                    qp.set("category", c);
                    const active = category === c;
                    return (
                      <Link
                        key={c}
                        href={`/boards/${slug}?${qp}`}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                          active
                            ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                            : "border-[var(--color-border)] hover:bg-[var(--color-surface-warm)]"
                        }`}
                      >
                        {c}
                      </Link>
                    );
                  })}
                </>
              );
            })()}
          </div>
        )}

        {/* 게시판 자체 검색 + 정렬 */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {board.show_search_form && (
            <form action={`/boards/${slug}`} method="get" role="search" className="flex items-center gap-2 flex-1 min-w-[200px]">
              {currentView !== "list" && <input type="hidden" name="view" value={currentView} />}
              {sort !== "latest" && <input type="hidden" name="sort" value={sort} />}
              {category && <input type="hidden" name="category" value={category} />}
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="제목·본문 검색"
                className="flex-1 min-w-0 border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--color-primary)]"
              />
              {q && (
                <Link
                  href={`/boards/${slug}${currentView !== "list" ? `?view=${currentView}` : ""}`}
                  className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] whitespace-nowrap"
                >
                  지우기
                </Link>
              )}
              <button
                type="submit"
                className="text-xs bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors"
              >
                검색
              </button>
            </form>
          )}
          <div className="flex items-center gap-1.5 shrink-0">
            {SORT_OPTIONS.map((o) => {
              const qp = new URLSearchParams();
              if (q) qp.set("q", q);
              if (currentView !== "list") qp.set("view", currentView);
              if (category) qp.set("category", category);
              if (o.value !== "latest") qp.set("sort", o.value);
              const href = `/boards/${slug}${qp.toString() ? `?${qp}` : ""}`;
              const active = sort === o.value;
              return (
                <Link
                  key={o.value}
                  href={href}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                    active
                      ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                      : "border-[var(--color-border)] hover:bg-[var(--color-surface-warm)]"
                  }`}
                >
                  {o.label}
                </Link>
              );
            })}
          </div>
          {/* 뷰 형식 토글 — admin이 켠 뷰가 2개 이상일 때만 표시.
              1개 이하면 선택지가 없으므로 토글 자체를 숨김 (UI 노이즈 제거). */}
          {activeViews.length >= 2 && (
            <div className="flex items-center gap-1.5 shrink-0">
              {activeViews.map((o) => {
                const qp = new URLSearchParams();
                if (q) qp.set("q", q);
                if (sort !== "latest") qp.set("sort", sort);
                if (category) qp.set("category", category);
                if (o.value !== "list") qp.set("view", o.value);
                const href = `/boards/${slug}${qp.toString() ? `?${qp}` : ""}`;
                const active = currentView === o.value;
                return (
                  <Link
                    key={o.value}
                    href={href}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                      active
                        ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                        : "border-[var(--color-border)] hover:bg-[var(--color-surface-warm)]"
                    }`}
                  >
                    {o.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* 검색 결과 카운트 */}
        {q && (
          <p className="text-xs text-[var(--color-text-muted)] mb-3">
            <span className="text-[var(--color-primary)] font-medium">&ldquo;{q}&rdquo;</span> 검색 결과 {postList.total}건
          </p>
        )}

        <BoardList
          posts={postList.posts}
          slug={slug}
          currentPage={page}
          totalPages={totalPages}
          currentView={currentView}
          cols={{
            list_show_number: board.list_show_number ?? false,
            list_show_author: board.list_show_author ?? true,
            list_show_date: board.list_show_date ?? true,
            list_show_views: board.list_show_views ?? true,
            list_show_likes: board.list_show_likes ?? false,
            list_show_comments: board.list_show_comments ?? true,
            list_show_shares: board.list_show_shares ?? false,
            share_enabled: board.share_enabled ?? true,
          }}
          currentQ={q}
          currentSort={sort}
          currentCategory={category}
        />
      </SectionLayout>
    </>
  );
}
