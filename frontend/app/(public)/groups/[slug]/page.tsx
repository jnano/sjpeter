import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";
import { fetchGroups, type CommunityGroup } from "../GroupsLayout";
import CommunitySlideshow from "./CommunitySlideshow";
import GroupInterestSection from "./GroupInterestSection";
import { fetchParishMin } from "@/lib/parish";

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const dynamic = "force-dynamic";

async function fetchGroupBySlug(slug: string): Promise<CommunityGroup | null> {
  try {
    const res = await fetch(`${API}/api/content/community/slug/${slug}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [g, p] = await Promise.all([fetchGroupBySlug(slug), fetchParishMin()]);
  return {
    title: g ? `${g.name} | 분과와 단체` : "분과와 단체",
    description: g?.description ?? `${p.name} 분과 소개`,
  };
}

export default async function GroupDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [group, allGroups] = await Promise.all([fetchGroupBySlug(slug), fetchGroups()]);

  if (!group || group.parent_id) notFound();

  const subGroups = allGroups
    .filter((g) => g.parent_id === group.id)
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);

  const activityLines = (group.activities ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <>
      <PageHeader group="본당 공동체" title="분과와 단체" subtitle={group.name} />
      <SectionLayout autoHero={false}>
        <article className="space-y-8">
          {/* 분과명 + 설명 */}
          <header>
            <div className="flex items-center flex-wrap gap-3 mb-3">
              <h1 className="font-serif text-2xl font-bold text-[var(--color-primary)]">
                {group.name}
              </h1>
              {group.board_slug && (
                <Link
                  href={`/boards/${group.board_slug}`}
                  className="inline-flex items-center gap-1 text-xs px-3 py-1.5 border border-[var(--color-primary)] text-[var(--color-primary)] rounded-full hover:bg-[var(--color-primary)]/5 transition-colors"
                >
                  게시판 보기 →
                </Link>
              )}
            </div>
            {group.description && (
              <p className="text-sm text-[var(--color-text)] leading-relaxed whitespace-pre-line">
                {group.description}
              </p>
            )}
            {group.activity_time && (
              <p className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-warm)] border border-[var(--color-border)] inline-block px-2 py-0.5 rounded mt-3">
                {group.activity_time}
              </p>
            )}
          </header>

          {/* 관심 등록 패널 (분과 + 소속단체 토글) */}
          <GroupInterestSection
            parentId={group.id}
            parentName={group.name}
            subGroups={subGroups.map((sg) => ({
              id: sg.id,
              name: sg.name,
              parent_id: sg.parent_id ?? null,
              board_slug: sg.board_slug ?? null,
              link_url: sg.link_url ?? null,
            }))}
          />

          {/* 주요 활동 + 소속단체 (2열) */}
          {(activityLines.length > 0 || subGroups.length > 0) && (
            <div className="grid sm:grid-cols-2 gap-6">
              {activityLines.length > 0 && (
                <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5">
                  <h2 className="font-serif font-bold text-[var(--color-primary)] text-base mb-3">주요 활동</h2>
                  <ol className="space-y-1.5 text-sm text-[var(--color-text)] leading-relaxed">
                    {activityLines.map((line, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-[var(--color-accent)] shrink-0">{i + 1}.</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {subGroups.length > 0 && (
                <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5">
                  <h2 className="font-serif font-bold text-[var(--color-primary)] text-base mb-3">소속단체</h2>
                  <ul className="flex flex-wrap gap-x-3 gap-y-1.5 text-sm text-[var(--color-text)]">
                    {subGroups.map((sg) => {
                      const href = sg.board_slug
                        ? `/boards/${sg.board_slug}`
                        : sg.link_url ?? null;
                      return href ? (
                        <li key={sg.id}>
                          <Link href={href} className="hover:text-[var(--color-primary)] underline decoration-dotted">
                            {sg.name}
                          </Link>
                        </li>
                      ) : (
                        <li key={sg.id}>{sg.name}</li>
                      );
                    })}
                  </ul>
                </section>
              )}
            </div>
          )}

          {/* 사진 — admin이 선택한 표시 방식 + 1장이면 무조건 가로 전체 */}
          {group.photo_urls && group.photo_urls.length > 0 && (
            <section>
              {group.photo_urls.length === 1 ? (
                <div className="relative w-full aspect-[16/9] rounded-xl overflow-hidden border border-[var(--color-border)]">
                  <Image
                    src={group.photo_urls[0].startsWith("http") ? group.photo_urls[0] : `${API}${group.photo_urls[0]}`}
                    alt={`${group.name} 사진`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 720px"
                    priority
                  />
                </div>
              ) : group.photo_display_mode === "grid" ? (
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {group.photo_urls.map((url, i) => (
                    <div key={i} className="relative aspect-[4/3] rounded-xl overflow-hidden border border-[var(--color-border)]">
                      <Image
                        src={url.startsWith("http") ? url : `${API}${url}`}
                        alt={`${group.name} 사진 ${i + 1}`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, 50vw"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <CommunitySlideshow photos={group.photo_urls} alt={group.name} />
              )}
            </section>
          )}

        </article>
      </SectionLayout>
    </>
  );
}
