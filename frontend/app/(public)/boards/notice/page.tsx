import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";
import { fetchParishMin } from "@/lib/parish";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const p = await fetchParishMin();
  return { title: "공지·알림", description: `${p.name} 공지사항` };
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const PAGE_SIZE = 20;

interface Notice {
  id: number;
  title: string;
  content: string | null;
  is_pinned: boolean;
  created_at: string;
  attachments?: { id: number }[];
}

interface NoticePagedOut {
  pinned: Notice[];
  items: Notice[];
  total: number;
  page: number;
  size: number;
}

async function getNoticesPaged(page: number): Promise<NoticePagedOut | null> {
  try {
    const res = await fetch(
      `${API}/api/notices/paged?page=${page}&size=${PAGE_SIZE}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function getPaginationRange(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "…")[] = [1];
  if (current > 3) pages.push("…");
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push("…");
  pages.push(total);
  return pages;
}

function fmtDate(s: string): string {
  return new Date(s)
    .toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })
    .replace(/\. /g, ".")
    .replace(/\.$/, "");
}

export default async function NoticePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageStr = "1" } = await searchParams;
  const page = Math.max(1, parseInt(pageStr) || 1);

  const data = await getNoticesPaged(page);
  if (data === null) notFound();

  const { pinned, items: regular, total } = data;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const paginationRange = getPaginationRange(page, totalPages);
  const isEmpty = pinned.length === 0 && regular.length === 0;

  return (
    <>
      <PageHeader group="알림과 게시판" title="공지·알림" subtitle="성당 주요 공지사항을 안내합니다." />
      <SectionLayout autoHero={false}>

      {isEmpty ? (
        <div className="text-center py-16 text-[var(--color-text-muted)]">
          등록된 공지사항이 없습니다.
        </div>
      ) : (
        <div className="divide-y divide-[var(--color-border)]">
          {/* 고정 공지 — 페이지와 무관하게 항상 상단 */}
          {pinned.map((n) => (
            <Link
              key={n.id}
              href={`/boards/notice/${n.id}`}
              className="flex items-baseline justify-between gap-3 py-4 group hover:text-[var(--color-primary)] transition-colors"
            >
              <div className="flex items-baseline gap-2 flex-1 min-w-0">
                <span className="text-xs px-2 py-0.5 bg-[var(--color-primary)] text-white rounded shrink-0">
                  고정
                </span>
                <span className="font-semibold text-[var(--color-primary)] truncate group-hover:underline">
                  {n.title}
                </span>
                {!!n.attachments?.length && (
                  <span className="text-xs text-[var(--color-text-muted)] shrink-0" title={`사진 ${n.attachments.length}장`}>
                    📷 {n.attachments.length}
                  </span>
                )}
              </div>
              <span className="text-xs text-[var(--color-text-muted)] shrink-0">
                {fmtDate(n.created_at)}
              </span>
            </Link>
          ))}
          {/* 일반 공지 — 현재 페이지 분량 */}
          {regular.map((n) => (
            <Link
              key={n.id}
              href={`/boards/notice/${n.id}`}
              className="flex items-baseline justify-between gap-3 py-4 group hover:text-[var(--color-primary)] transition-colors"
            >
              <span className="flex-1 font-medium text-[var(--color-text)] truncate group-hover:text-[var(--color-primary)]">
                {n.title}
              </span>
              {!!n.attachments?.length && (
                <span className="text-xs text-[var(--color-text-muted)] shrink-0" title={`사진 ${n.attachments.length}장`}>
                  📷 {n.attachments.length}
                </span>
              )}
              <span className="text-xs text-[var(--color-text-muted)] shrink-0">
                {fmtDate(n.created_at)}
              </span>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-10">
          <Link
            href={`/boards/notice?page=${Math.max(1, page - 1)}`}
            aria-disabled={page === 1}
            className={`px-3 py-1.5 text-sm rounded-lg border border-[var(--color-border)] transition-colors ${
              page === 1 ? "pointer-events-none opacity-30" : "hover:bg-gray-50"
            }`}
          >
            ‹
          </Link>
          {paginationRange.map((p, i) =>
            p === "…" ? (
              <span key={`e-${i}`} className="px-2 text-sm text-[var(--color-text-muted)]">…</span>
            ) : (
              <Link
                key={p}
                href={`/boards/notice?page=${p}`}
                className={`w-9 h-9 flex items-center justify-center text-sm rounded-lg border transition-colors ${
                  p === page
                    ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                    : "border-[var(--color-border)] hover:bg-gray-50"
                }`}
              >
                {p}
              </Link>
            )
          )}
          <Link
            href={`/boards/notice?page=${Math.min(totalPages, page + 1)}`}
            aria-disabled={page === totalPages}
            className={`px-3 py-1.5 text-sm rounded-lg border border-[var(--color-border)] transition-colors ${
              page === totalPages ? "pointer-events-none opacity-30" : "hover:bg-gray-50"
            }`}
          >
            ›
          </Link>
        </div>
      )}
      </SectionLayout>
    </>
  );
}
