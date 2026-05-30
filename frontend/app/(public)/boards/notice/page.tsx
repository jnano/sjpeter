import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";
import NoticeAdminWriteButton from "./NoticeAdminWriteButton";
import BoardList from "../[slug]/BoardList";
import { fetchParishMin } from "@/lib/parish";

// admin 게시판 설정·공지 변경이 새로고침 없이 반영되도록
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const p = await fetchParishMin();
  return { title: "공지사항", description: `${p.name} 공지사항` };
}

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const SLUG = "notice";

// 게시판 설정 — /boards/[slug] 와 동일 구조 (admin/boards 의 공지사항 설정 반영)
interface Board {
  id: number;
  name: string;
  description: string;
  posts_per_page: number;
  kind: string;
  list_show_number: boolean;
  list_show_author: boolean;
  list_show_date: boolean;
  list_show_views: boolean;
  list_show_likes: boolean;
  list_show_comments: boolean;
  list_show_shares: boolean;
  share_enabled: boolean;
  show_view_list: boolean;
  show_view_card: boolean;
  show_view_photo: boolean;
  show_search_form: boolean;
}

interface NoticeAtt { id: number; file_url: string }
interface Notice {
  id: number;
  title: string;
  is_pinned: boolean;
  created_at: string;
  author?: string | null;
  view_count?: number;
  comment_count?: number;
  like_count?: number;
  share_count?: number;
  expires_at?: string | null;
  attachments?: NoticeAtt[];
}
interface NoticePaged { pinned: Notice[]; items: Notice[]; total: number }

async function getBoard(): Promise<Board | null> {
  try {
    const res = await fetch(`${API}/api/boards/${SLUG}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

async function getNotices(page: number, size: number, q: string, archived: boolean, token?: string): Promise<NoticePaged | null> {
  try {
    const qp = new URLSearchParams({ page: String(page), size: String(size) });
    if (q) qp.set("q", q);
    if (archived) qp.set("archived", "true");
    // archived(지난 공지)는 운영자 토큰 필요 — admin_token 쿠키 또는 운영자 세션 토큰을 Bearer 로 전달
    const res = await fetch(`${API}/api/notices/paged?${qp}`, {
      cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

// 공지(NoticeOut) → BoardList 의 Post 형태로 매핑. author 없으면 member=null('성당' 표기)
function noticeToPost(n: Notice) {
  const img = n.attachments?.find((a) => /\.(jpe?g|png|gif|webp)$/i.test(a.file_url));
  return {
    id: n.id,
    title: n.title,
    member: n.author ? { id: 0, nickname: n.author } : null,
    view_count: n.view_count ?? 0,
    comment_count: n.comment_count ?? 0,
    like_count: n.like_count ?? 0,
    share_count: n.share_count ?? 0,
    created_at: n.created_at,
    thumbnail_url: img?.file_url ?? null,
    is_pinned: n.is_pinned,
    expires_at: n.expires_at ?? null,
  };
}

const VIEW_OPTIONS = [
  { value: "list" as const, label: "목록" },
  { value: "card" as const, label: "카드" },
  { value: "photo" as const, label: "사진" },
];

export default async function NoticePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; view?: string; q?: string; tab?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1") || 1);
  const explicitView: "list" | "card" | "photo" | null =
    sp.view === "photo" ? "photo" : sp.view === "card" ? "card" : sp.view === "list" ? "list" : null;
  const q = (sp.q ?? "").trim();

  // 운영자 이상 판단 — 슈퍼관리자(admin_token/admin_authed 쿠키) 또는 운영자(session.isAdmin).
  // '지난 공지(만료)'는 운영자 이상만 — 비운영자는 탭 숨김 + tab=archived 직접 접근도 차단.
  const session = await auth();
  const ck = await cookies();
  const adminCookie = ck.get("admin_token")?.value || ck.get("admin_authed")?.value;
  const isOperator = !!(session as { isAdmin?: boolean } | null)?.isAdmin || !!adminCookie;
  const tab: "current" | "archived" = (sp.tab === "archived" && isOperator) ? "archived" : "current";

  const board = await getBoard();
  if (!board) notFound();

  // 활성 뷰 — admin 토글이 켠 것. 모두 꺼지면 list 폴백.
  const activeViews = VIEW_OPTIONS.filter((v) => {
    if (v.value === "list") return board.show_view_list;
    if (v.value === "card") return board.show_view_card;
    return board.show_view_photo;
  });
  const kindDefault: "list" | "photo" = board.kind === "gallery" ? "photo" : "list";
  const requestedView = explicitView ?? kindDefault;
  const fallbackView = activeViews.some((v) => v.value === kindDefault) ? kindDefault : (activeViews[0]?.value ?? "list");
  const currentView = activeViews.some((v) => v.value === requestedView) ? requestedView : fallbackView;

  const size = Math.max(1, board.posts_per_page || 20);
  // 지난 공지(archived)는 운영자 토큰 전달 (슈퍼관리자 admin_token 쿠키 또는 운영자 세션 토큰)
  const opToken = ck.get("admin_token")?.value ?? (session as { accessToken?: string } | null)?.accessToken;
  const data = await getNotices(page, size, q, tab === "archived", tab === "archived" ? opToken : undefined);
  if (!data) notFound();
  const { pinned, items, total } = data;
  const totalPages = Math.max(1, Math.ceil(total / size));

  // 고정 공지는 항상 상단 전체 + 현재 페이지 일반 공지
  const posts = [...pinned.map(noticeToPost), ...items.map(noticeToPost)];

  return (
    <>
      <PageHeader group="알림과 게시판" title="공지·알림" subtitle="성당 주요 공지사항을 안내합니다." />
      <SectionLayout autoHero={false}>
        <NoticeAdminWriteButton />

        {/* 현재 공지 / 지난 공지(만료) 탭 — '지난 공지'는 운영자 이상만 */}
        {isOperator && (
          <div className="flex gap-1.5 mb-3">
            {([["current", "현재 공지"], ["archived", "지난 공지"]] as const).map(([v, label]) => (
              <a
                key={v}
                href={v === "current" ? "/boards/notice" : "/boards/notice?tab=archived"}
                className={`text-sm px-3.5 py-1.5 rounded-full border transition-colors ${
                  tab === v
                    ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                    : "border-[var(--color-border)] hover:bg-[var(--color-surface-warm)]"
                }`}
              >
                {label}{v === "archived" && <span className="ml-1 text-[10px] opacity-70">운영자</span>}
              </a>
            ))}
          </div>
        )}

        {/* 검색 + 보기 토글 (게시판 설정 따름) */}
        {(board.show_search_form || activeViews.length >= 2) && (
          <div className="bd-toolbar">
            {board.show_search_form && (
              <form action="/boards/notice" method="get" role="search" className="flex gap-2 flex-1 min-w-[220px]">
                {currentView !== kindDefault && <input type="hidden" name="view" value={currentView} />}
                {tab === "archived" && <input type="hidden" name="tab" value="archived" />}
                <span className="bd-search">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="7" cy="7" r="5" /><line x1="11" y1="11" x2="14" y2="14" strokeLinecap="round" /></svg>
                  <input type="search" name="q" defaultValue={q} placeholder="제목·본문 검색" />
                </span>
                <button type="submit" className="bd-search-go">검색</button>
              </form>
            )}
            {activeViews.length >= 2 && (
              <div className="bd-segview" role="group" aria-label="보기 형식">
                {activeViews.map((o) => {
                  const qp = new URLSearchParams();
                  if (q) qp.set("q", q);
                  if (tab === "archived") qp.set("tab", "archived");
                  if (o.value !== kindDefault) qp.set("view", o.value);
                  const href = `/boards/notice${qp.toString() ? `?${qp}` : ""}`;
                  return <a key={o.value} href={href} className={currentView === o.value ? "on" : ""}>{o.label}</a>;
                })}
              </div>
            )}
          </div>
        )}

        <div className="bd-meta">
          <span className="count">
            {q && <span className="text-[var(--color-primary)] font-medium">&ldquo;{q}&rdquo; </span>}
            {q ? "검색 결과 " : "전체 "}<b>{total}</b>건
          </span>
        </div>

        <BoardList
          posts={posts}
          slug={SLUG}
          currentPage={page}
          totalPages={totalPages}
          currentView={currentView}
          kindDefault={kindDefault}
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
          extraParams={tab === "archived" ? { tab: "archived" } : undefined}
          showExpiry={isOperator}
        />
      </SectionLayout>
    </>
  );
}
