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
          {/* 분과명 + 설명 — 시안 mission/header 톤 */}
          <header className="border-b border-[var(--color-border)] pb-7">
            <span className="inline-flex items-center gap-3 text-[11px] tracking-[0.2em] uppercase text-[var(--color-primary)] font-bold mb-3">
              <span className="w-6 h-px bg-[var(--color-primary)]" />
              본당 공동체 · Community
            </span>
            <div className="flex items-center flex-wrap gap-3 mb-4">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-text)]">
                {group.name}
              </h1>
              {group.board_slug && (
                <Link
                  href={`/boards/${group.board_slug}`}
                  className="inline-flex items-center gap-1 text-[12px] font-semibold px-3 py-1.5 border border-[var(--color-primary)] text-[var(--color-primary)] rounded-full hover:bg-[var(--color-primary)]/5 transition-colors"
                >
                  게시판 보기 →
                </Link>
              )}
            </div>
            {group.description && (
              <p className="text-[15px] leading-[1.8] text-[var(--color-text)] whitespace-pre-line tracking-tight">
                {group.description}
              </p>
            )}
            {group.activity_time && (
              <p className="text-[11px] text-[var(--color-text-muted)] bg-[var(--color-surface-warm)] border border-[var(--color-border)] inline-block px-3 py-1 rounded-full mt-4 font-semibold">
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

          {/* 주요 활동 — 시안 .act-grid 2-col act-card 톤 */}
          {activityLines.length > 0 && (
            <section>
              <h2 className="text-[13px] tracking-[0.12em] uppercase font-bold text-[var(--color-primary)] mb-4">주요 활동</h2>
              <div className="grid sm:grid-cols-2 gap-3.5">
                {activityLines.map((line, i) => (
                  <div key={i} className="bg-white border border-[var(--color-border)] rounded-2xl p-5 sm:p-6 flex flex-col gap-2.5">
                    <div className="flex items-center gap-3">
                      <span
                        className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-[14px] tabular-nums"
                        style={{ background: "rgba(122,31,43,0.06)", color: "var(--color-primary)" }}
                      >
                        {i + 1}
                      </span>
                      <h4 className="text-[15px] font-bold tracking-tight leading-snug">{line.split(/[:：—-]/)[0].trim()}</h4>
                    </div>
                    {line.includes(":") || line.includes("：") || line.includes("—") || line.includes("-") ? (
                      <p className="text-[13px] leading-relaxed text-[var(--color-text-muted)]">
                        {line.split(/[:：—-]/).slice(1).join(":").trim()}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 소속단체 — 시안 톤 단순 칩 + 우측 rail join-card */}
          {subGroups.length > 0 && (
            <section className="bg-white border border-[var(--color-border)] rounded-2xl p-6">
              <h2 className="text-[13px] tracking-[0.12em] uppercase font-bold text-[var(--color-primary)] mb-4">소속단체</h2>
              <ul className="flex flex-wrap gap-2">
                {subGroups.map((sg) => {
                  const href = sg.board_slug
                    ? `/boards/${sg.board_slug}`
                    : sg.link_url ?? null;
                  return href ? (
                    <li key={sg.id}>
                      <Link href={href} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[var(--color-surface-warm)] hover:bg-[var(--color-primary)]/10 rounded-full text-[12px] font-semibold text-[var(--color-text)] transition-colors">
                        {sg.name}
                      </Link>
                    </li>
                  ) : (
                    <li key={sg.id} className="px-3.5 py-1.5 bg-[var(--color-surface-warm)] rounded-full text-[12px] font-semibold text-[var(--color-text-muted)]">
                      {sg.name}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* join-card — 시안 .join-card (와인색 + 골드 액션) */}
          {group.board_slug && (
            <section
              className="rounded-2xl p-7 sm:p-8 text-white"
              style={{ background: "var(--color-primary)" }}
            >
              <span className="block text-[11px] tracking-[0.14em] uppercase font-bold mb-2.5" style={{ color: "var(--color-accent, #C9A961)" }}>
                Join Us
              </span>
              <h3 className="text-lg sm:text-xl font-bold tracking-tight mb-2.5 leading-snug">
                {group.name}에 함께하고 싶으신가요?
              </h3>
              <p className="text-[13px] leading-relaxed text-white/70 mb-5">
                관심을 등록하시면 분과에서 안내드립니다. 본당 게시판에서 활동 소식도 확인하세요.
              </p>
              <Link
                href={`/boards/${group.board_slug}`}
                className="inline-block px-5 py-3 rounded-full text-[13px] font-bold"
                style={{ background: "var(--color-accent, #C9A961)", color: "var(--color-text)" }}
              >
                게시판 보기 →
              </Link>
            </section>
          )}

          {/* 사진 — admin이 선택한 표시 방식 + 1장이면 무조건 가로 전체 */}
          {group.photo_urls && group.photo_urls.length > 0 && (
            <section>
              {group.photo_urls.length === 1 ? (
                <div className="relative w-full aspect-[16/9] rounded-xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-warm)]">
                  <Image
                    src={group.photo_urls[0].startsWith("http") ? group.photo_urls[0] : `${API}${group.photo_urls[0]}`}
                    alt={`${group.name} 사진`}
                    fill
                    className="object-contain"
                    sizes="(max-width: 768px) 100vw, 720px"
                    priority
                  />
                </div>
              ) : group.photo_display_mode === "grid" ? (
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {group.photo_urls.map((url, i) => (
                    <div key={i} className="relative aspect-[4/3] rounded-xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-warm)]">
                      <Image
                        src={url.startsWith("http") ? url : `${API}${url}`}
                        alt={`${group.name} 사진 ${i + 1}`}
                        fill
                        className="object-contain"
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
