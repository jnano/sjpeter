import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import SectionLayout from "@/components/SectionLayout";
import MarkdownContent from "@/components/MarkdownContent";
import ArticleTools from "@/components/ArticleTools";
import NoticeAdminActions from "./NoticeAdminActions";

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
  is_ai_generated?: boolean;
  created_at: string;
  expires_at?: string | null;
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

  // 운영자 이상만 만료일 노출
  const session = await auth();
  const ck = await cookies();
  const isOperator = !!(session as { isAdmin?: boolean } | null)?.isAdmin || !!(ck.get("admin_token")?.value || ck.get("admin_authed")?.value);

  return (
    <SectionLayout autoHero={false}>
      {/* 뒤로 가기 */}
      <Link
        href="/boards/notice"
        className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors mb-4"
      >
        ← 공지·알림 목록
      </Link>

      {/* admin/운영자 전용 액션 (admin_token 보유 시 노출) */}
      <NoticeAdminActions noticeId={notice.id} />

      {/* 제목 영역 */}
      <div className="border-b-2 border-[var(--color-primary)] pb-4 mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
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
          <p className="text-xs text-[var(--color-text-muted)] mt-2 flex items-center gap-1.5">
            <span>
              {new Date(notice.created_at).toLocaleDateString("ko-KR", {
                year: "numeric",
                month: "long",
                day: "numeric",
                weekday: "short",
              })}
            </span>
            {notice.is_ai_generated && (
              <span
                className="px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 border border-violet-200 text-[10px] font-medium"
                title="주보 PDF에서 AI가 추출한 공지입니다"
              >
                AI
              </span>
            )}
            {/* 만료일 — 운영자 이상만 */}
            {isOperator && (
              notice.expires_at ? (
                <span className={new Date(notice.expires_at) <= new Date() ? "text-red-500" : "text-[var(--color-text-muted)]"}>
                  📆 만료 {new Date(notice.expires_at).toLocaleDateString("ko-KR")}{new Date(notice.expires_at) <= new Date() ? " (지남)" : ""}
                </span>
              ) : (
                <span className="text-[var(--color-text-muted)]/60">📆 만료 없음</span>
              )
            )}
          </p>
        </div>
        <ArticleTools className="mt-0.5" />
      </div>

      {/* 본문 — 마크다운 + 신뢰 콘텐츠 raw HTML 허용 (AI 출처 표기에 <span><small> 사용) */}
      {notice.content ? (
        <div className="min-h-16">
          <MarkdownContent content={notice.content} />
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
