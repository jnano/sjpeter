import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "작은 묵상",
  description: "세종성베드로성당 작은 묵상",
};

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Meditation {
  id: number;
  title: string;
  scripture: string | null;
  body: string;
  author: string | null;
  published_date: string;
  is_published: boolean;
}

async function getCurrentMeditation(): Promise<Meditation | null> {
  try {
    const res = await fetch(`${API}/api/content/meditations/current`, {
      next: { revalidate: 1800 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

export default async function MeditationPage() {
  const meditation = await getCurrentMeditation();

  return (
    <>
      <PageHeader
        group="말씀과 기도"
        title="작은 묵상"
        subtitle="말씀 앞에 잠시 멈추는 시간"
      />
      <div className="max-w-3xl mx-auto px-4 py-8">
        {meditation ? (
          <article className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden">
            {/* 헤더 */}
            <div className="px-8 pt-8 pb-6 border-b border-[var(--color-border)]">
              {meditation.scripture && (
                <p className="text-xs font-medium text-[var(--color-accent)] uppercase tracking-widest mb-3">
                  {meditation.scripture}
                </p>
              )}
              <h2 className="font-serif text-2xl font-bold text-[var(--color-text)] mb-3 leading-snug">
                {meditation.title}
              </h2>
              <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                <span>{formatDate(meditation.published_date)}</span>
                {meditation.author && (
                  <>
                    <span className="text-[var(--color-border)]">·</span>
                    <span>{meditation.author}</span>
                  </>
                )}
              </div>
            </div>

            {/* 본문 */}
            <div className="px-8 py-8">
              <div className="text-[var(--color-text)] leading-[2] whitespace-pre-line font-serif text-[0.95rem]">
                {meditation.body}
              </div>
            </div>

            {/* 하단 */}
            <div className="px-8 pb-6 flex justify-end">
              <Link
                href="/meditation/archive"
                className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
              >
                이전 묵상 보기 →
              </Link>
            </div>
          </article>
        ) : (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-8">
            <div className="text-center py-16 text-[var(--color-text-muted)]">
              <div className="text-5xl mb-4">✝</div>
              <p className="font-serif text-lg text-[var(--color-primary)] mb-2">준비 중입니다</p>
              <p className="text-sm">곧 묵상 글이 올라올 예정입니다.</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
