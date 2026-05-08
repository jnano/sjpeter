import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Notice {
  id: number;
  title: string;
  content: string | null;
  is_pinned: boolean;
  created_at: string;
}

async function getNotice(id: string): Promise<Notice | null> {
  try {
    const res = await fetch(`${API}/api/notices/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ postId: string }>;
}): Promise<Metadata> {
  const { postId } = await params;
  const notice = await getNotice(postId);
  return { title: notice?.title ?? "공지사항" };
}

export default async function NoticeDetailPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  const notice = await getNotice(postId);
  if (!notice) notFound();

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      {/* 뒤로 가기 */}
      <Link
        href="/boards/notice"
        className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors mb-8"
      >
        ← 공지·알림 목록
      </Link>

      {/* 제목 영역 */}
      <div className="border-b-2 border-[var(--color-primary)] pb-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          {notice.is_pinned && (
            <span className="text-xs px-2 py-0.5 bg-[var(--color-primary)] text-white rounded">
              고정
            </span>
          )}
          <span className="text-xs text-[var(--color-text-muted)]">공지·알림</span>
        </div>
        <h1 className="text-xl font-bold text-[var(--color-primary)] leading-snug">
          {notice.title}
        </h1>
        <p className="text-xs text-[var(--color-text-muted)] mt-2">
          {new Date(notice.created_at).toLocaleDateString("ko-KR", {
            year: "numeric",
            month: "long",
            day: "numeric",
            weekday: "short",
          })}
        </p>
      </div>

      {/* 본문 */}
      <div className="min-h-32 text-[var(--color-text)] text-sm leading-relaxed whitespace-pre-wrap">
        {notice.content ?? (
          <span className="text-[var(--color-text-muted)] italic">내용이 없습니다.</span>
        )}
      </div>

      {/* 하단 목록 이동 */}
      <div className="mt-12 pt-6 border-t border-[var(--color-border)]">
        <Link
          href="/boards/notice"
          className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
        >
          ← 목록으로
        </Link>
      </div>
    </div>
  );
}
