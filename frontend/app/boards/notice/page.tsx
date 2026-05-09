import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "공지·알림",
  description: "세종성베드로성당 공지사항",
};

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Notice {
  id: number;
  title: string;
  content: string | null;
  is_pinned: boolean;
  created_at: string;
}

async function getNotices(): Promise<Notice[] | null> {
  try {
    const res = await fetch(`${API}/api/notices/`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function NoticePage() {
  const notices = await getNotices();
  if (notices === null) notFound();

  const pinned = notices.filter((n) => n.is_pinned);
  const regular = notices.filter((n) => !n.is_pinned);

  return (
    <>
      <PageHeader group="알림과 나눔" title="공지·알림" subtitle="성당 주요 공지사항을 안내합니다." />
      <div className="max-w-3xl mx-auto px-4 py-8">

      {notices.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-text-muted)]">
          등록된 공지사항이 없습니다.
        </div>
      ) : (
        <div className="divide-y divide-[var(--color-border)]">
          {/* 고정 공지 */}
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
              </div>
              <span className="text-xs text-[var(--color-text-muted)] shrink-0">
                {new Date(n.created_at).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\. /g, ".").replace(/\.$/, "")}
              </span>
            </Link>
          ))}
          {/* 일반 공지 */}
          {regular.map((n) => (
            <Link
              key={n.id}
              href={`/boards/notice/${n.id}`}
              className="flex items-baseline justify-between gap-3 py-4 group hover:text-[var(--color-primary)] transition-colors"
            >
              <span className="flex-1 font-medium text-[var(--color-text)] truncate group-hover:text-[var(--color-primary)]">
                {n.title}
              </span>
              <span className="text-xs text-[var(--color-text-muted)] shrink-0">
                {new Date(n.created_at).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\. /g, ".").replace(/\.$/, "")}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
    </>
  );
}
