import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import GroupsLayout, { fetchGroups } from "./GroupsLayout";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "분과와 단체",
  description: "세종성베드로성당 각 분과 및 단체 소개",
};

export default async function GroupsPage() {
  const groups = await fetchGroups();
  const topLevel = groups
    .filter((g) => !g.parent_id)
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);

  return (
    <>
      <PageHeader group="본당 공동체" title="분과와 단체" subtitle="좌측에서 분과를 선택하면 상세 내용을 볼 수 있습니다" />
      <GroupsLayout groups={groups}>
        {topLevel.length === 0 ? (
          <div className="text-center py-16 text-[var(--color-text-muted)]">
            <div className="text-5xl mb-4">✝</div>
            <p className="font-serif text-lg text-[var(--color-primary)] mb-2">준비 중입니다</p>
            <p className="text-sm">분과 정보를 곧 등록하겠습니다.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {topLevel.map((g) => (
              <Link
                key={g.id}
                href={g.slug ? `/groups/${g.slug}` : "#"}
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 hover:border-[var(--color-primary)] hover:shadow-sm transition-all block"
              >
                <div className="flex items-start gap-3">
                  <span className="text-[var(--color-accent)] text-xl mt-0.5">✝</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-serif font-bold text-[var(--color-primary)] text-lg mb-1">
                      {g.name}
                    </h3>
                    {g.description && (
                      <p className="text-sm text-[var(--color-text)] leading-relaxed">
                        {g.description}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </GroupsLayout>
    </>
  );
}
