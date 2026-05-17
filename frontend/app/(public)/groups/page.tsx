import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";
import { fetchGroups } from "./GroupsLayout";
import { fetchParishMin } from "@/lib/parish";

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const p = await fetchParishMin();
  return { title: "분과와 단체", description: `${p.name} 각 분과 및 단체 소개` };
}

export default async function GroupsPage() {
  const groups = await fetchGroups();
  const topLevel = groups
    .filter((g) => !g.parent_id)
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);

  return (
    <>
      <PageHeader group="본당 공동체" title="분과와 단체" subtitle="좌측에서 분과를 선택하면 상세 내용을 볼 수 있습니다" />
      <SectionLayout autoHero={false}>
        {topLevel.length === 0 ? (
          <div className="text-center py-16 text-[var(--color-text-muted)]">
            <div className="text-5xl mb-4">✝</div>
            <p className="font-serif text-lg text-[var(--color-primary)] mb-2">준비 중입니다</p>
            <p className="text-sm">분과 정보를 곧 등록하겠습니다.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {topLevel.map((g) => {
              const repUrl = g.representative_photo_url
                ? (g.representative_photo_url.startsWith("http")
                    ? g.representative_photo_url
                    : `${API}${g.representative_photo_url}`)
                : null;
              return (
                <Link
                  key={g.id}
                  href={g.slug ? `/groups/${g.slug}` : "#"}
                  className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 hover:border-[var(--color-primary)] hover:shadow-sm transition-all block"
                >
                  <div className="flex items-center gap-4">
                    {/* 원형 대표 이미지 (없으면 ✝ placeholder) */}
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-[var(--color-surface-warm)] border border-[var(--color-border)] flex items-center justify-center shrink-0">
                      {repUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={repUrl}
                          alt={g.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-[var(--color-accent)] text-2xl sm:text-3xl">✝</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-serif font-bold text-[var(--color-primary)] text-lg mb-1 truncate">
                        {g.name}
                      </h3>
                      {g.description && (
                        <p className="text-sm text-[var(--color-text)] leading-relaxed line-clamp-2">
                          {g.description}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </SectionLayout>
    </>
  );
}
