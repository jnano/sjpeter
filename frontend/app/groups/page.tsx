import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "분과와 단체",
  description: "세종성베드로성당 각 분과 및 단체 소개",
};

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface CommunityGroup {
  id: number;
  name: string;
  description: string | null;
  activity_time: string | null;
  link_url: string | null;
  board_slug: string | null;
  sort_order: number;
}

async function getGroups(): Promise<CommunityGroup[]> {
  try {
    const res = await fetch(`${API}/api/content/community`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function GroupsPage() {
  const groups = await getGroups();

  return (
    <>
      <PageHeader group="본당 공동체" title="분과와 단체" subtitle="함께 믿음을 키워가는 분과와 단체들" />
      <div className="max-w-4xl mx-auto px-4 py-8">

      {groups.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-text-muted)]">
          <div className="text-5xl mb-4">✝</div>
          <p className="font-serif text-lg text-[var(--color-primary)] mb-2">준비 중입니다</p>
          <p className="text-sm">단체 정보를 곧 등록하겠습니다.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {groups.map((group) => {
            const inner = (
              <div className="flex items-start gap-3">
                <span className="text-[var(--color-accent)] text-xl mt-0.5">✝</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-serif font-bold text-[var(--color-primary)] text-lg">
                      {group.name}
                    </h3>
                    {(group.board_slug || group.link_url) && (
                      <span className="text-xs text-[var(--color-primary)] border border-[var(--color-primary)]/30 px-1.5 py-0.5 rounded shrink-0">
                        게시판 →
                      </span>
                    )}
                  </div>
                  {group.description && (
                    <p className="text-sm text-[var(--color-text)] leading-relaxed mb-2">
                      {group.description}
                    </p>
                  )}
                  {group.activity_time && (
                    <p className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-warm)] border border-[var(--color-border)] inline-block px-2 py-0.5 rounded">
                      {group.activity_time}
                    </p>
                  )}
                </div>
              </div>
            );

            const href = group.board_slug
              ? `/boards/${group.board_slug}`
              : group.link_url ?? null;

            return href ? (
              <Link
                key={group.id}
                href={href}
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 hover:border-[var(--color-primary)] hover:shadow-sm transition-all block"
              >
                {inner}
              </Link>
            ) : (
              <div
                key={group.id}
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6"
              >
                {inner}
              </div>
            );
          })}
        </div>
      )}
    </div>
    </>
  );
}
