import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SectionLayout from "@/components/SectionLayout";

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface NoticeAttachment {
  id: number;
  file_url: string;
  original_name: string | null;
}

interface Notice {
  id: number;
  title: string;
  content: string | null;
  is_pinned: boolean;
  created_at: string;
  attachments?: NoticeAttachment[];
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
    <SectionLayout autoHero={false}>
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
      {notice.content ? (
        <div className="min-h-16 text-[var(--color-text)] text-sm leading-relaxed whitespace-pre-wrap">
          {notice.content}
        </div>
      ) : (
        !notice.attachments?.length && (
          <div className="text-[var(--color-text-muted)] italic text-sm">내용이 없습니다.</div>
        )
      )}

      {/* 사진 (있을 때) */}
      {notice.attachments && notice.attachments.length > 0 && (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {notice.attachments.map((a) => {
            const src = a.file_url.startsWith("http") ? a.file_url : `${API}${a.file_url}`;
            return (
              <a
                key={a.id}
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-xl overflow-hidden border border-[var(--color-border)] bg-white hover:shadow-md transition-shadow"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={a.original_name ?? "공지 사진"}
                  className="w-full h-auto object-contain"
                />
              </a>
            );
          })}
        </div>
      )}

      {/* 하단 목록 이동 */}
      <div className="mt-12 pt-6 border-t border-[var(--color-border)]">
        <Link
          href="/boards/notice"
          className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
        >
          ← 목록으로
        </Link>
      </div>
    </SectionLayout>
  );
}
