import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";
import CrossIcon from "@/components/icons/CrossIcon";
import { fetchGroups, type CommunityGroup } from "./GroupsLayout";
import { fetchParishMin } from "@/lib/parish";

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const p = await fetchParishMin();
  return { title: "분과와 단체", description: `${p.name} 각 분과 및 단체 소개` };
}

// 시안 dept-card 좌측 보더 색상 카테고리 매핑 — 부모 그룹명 키워드 기반.
const CAT_COLORS: { keyword: string[]; key: string; bg: string; border: string; ink: string }[] = [
  { keyword: ["사목"], key: "rosary", bg: "rgba(122,31,43,0.06)", border: "var(--color-primary)", ink: "var(--color-primary)" },
  { keyword: ["신심", "기도"], key: "recite", bg: "rgba(201,169,97,0.18)", border: "var(--color-accent, #C9A961)", ink: "#B5934A" },
  { keyword: ["봉사"], key: "service", bg: "rgba(46,107,67,0.12)", border: "#2E6B43", ink: "#2E6B43" },
  { keyword: ["연령", "청년", "학생", "청소년", "어린이"], key: "event", bg: "rgba(122,31,43,0.06)", border: "#A93232", ink: "#A93232" },
];
const DEFAULT_CAT = { key: "meeting", bg: "var(--color-surface-warm)", border: "var(--color-text-muted)", ink: "var(--color-text-muted)" };

function categoryOf(parentName: string | undefined) {
  if (!parentName) return DEFAULT_CAT;
  for (const c of CAT_COLORS) {
    if (c.keyword.some((k) => parentName.includes(k))) return c;
  }
  return DEFAULT_CAT;
}

export default async function GroupsPage() {
  const groups = await fetchGroups();

  // parent_id 가 있는 자식 = 분과/단체. parent 그룹은 카테고리로 사용.
  const parents = groups.filter((g) => !g.parent_id).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  const children = groups.filter((g) => g.parent_id);
  const childrenByParent = new Map<number, CommunityGroup[]>();
  for (const c of children) {
    if (c.parent_id == null) continue;
    if (!childrenByParent.has(c.parent_id)) childrenByParent.set(c.parent_id, []);
    childrenByParent.get(c.parent_id)!.push(c);
  }

  // 자식이 없으면 parents 만 단일 그룹으로 표시 (역호환)
  const hasChildren = children.length > 0;

  return (
    <>
      <PageHeader group="본당 공동체" title="분과와 단체" subtitle="본당의 사목 활동을 함께 짊어지는 분과와 단체" />
      <SectionLayout autoHero={false}>
        {parents.length === 0 ? (
          <div className="text-center py-16 text-[var(--color-text-muted)]">
            <div className="text-5xl mb-4"><CrossIcon /></div>
            <p className="font-serif text-lg text-[var(--color-primary)] mb-2">준비 중입니다</p>
            <p className="text-sm">분과 정보를 곧 등록하겠습니다.</p>
          </div>
        ) : hasChildren ? (
          // ── 시안 톤: 그룹별 섹션 + cat-filter (anchor 칩) ─────
          <div>
            {/* cat-filter (anchor) */}
            <div className="flex gap-1.5 flex-wrap mb-7 sticky top-32 z-10 bg-[var(--color-background)]/95 backdrop-blur py-2 -mx-1 px-1">
              <a
                href="#all"
                className="px-4 py-2 rounded-full bg-[var(--color-text)] text-white text-[13px] font-bold border border-[var(--color-text)]"
              >
                전체
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-white/15">
                  {children.length}
                </span>
              </a>
              {parents.map((p) => {
                const kids = childrenByParent.get(p.id) ?? [];
                if (kids.length === 0) return null;
                return (
                  <a
                    key={p.id}
                    href={`#cat-${p.id}`}
                    className="px-4 py-2 rounded-full bg-white border border-[var(--color-border)] text-[var(--color-text-muted)] text-[13px] font-bold hover:text-[var(--color-text)]"
                  >
                    {p.name}
                    <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--color-surface-warm)] text-[var(--color-text-muted)] tabular-nums">
                      {kids.length}
                    </span>
                  </a>
                );
              })}
            </div>

            <div id="all" />

            {parents.map((p) => {
              const kids = childrenByParent.get(p.id) ?? [];
              if (kids.length === 0) return null;
              const cat = categoryOf(p.name);
              return (
                <section key={p.id} id={`cat-${p.id}`} className="scroll-mt-32 mb-10">
                  <div className="flex items-center gap-3 pb-2.5 border-b border-[var(--color-text)] mb-5">
                    <h3 className="text-lg font-bold tracking-tight">{p.name}</h3>
                    <span className="text-[11px] px-2.5 py-1 bg-[var(--color-surface-warm)] text-[var(--color-text-muted)] rounded-full font-bold tabular-nums">
                      {kids.length}개
                    </span>
                    {p.description && (
                      <span className="ml-auto text-[12px] text-[var(--color-text-muted)] truncate hidden sm:inline">
                        {p.description}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {kids.map((g) => (
                      <DeptCard key={g.id} g={g} cat={cat} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          // ── 자식이 없는 경우: parents 만 단일 카드 그리드 ─
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {parents.map((g) => (
              <DeptCard key={g.id} g={g} cat={DEFAULT_CAT} />
            ))}
          </div>
        )}
      </SectionLayout>
    </>
  );
}

function DeptCard({
  g,
  cat,
}: {
  g: CommunityGroup;
  cat: { key: string; bg: string; border: string; ink: string };
}) {
  const repUrl = g.representative_photo_url
    ? (g.representative_photo_url.startsWith("http")
        ? g.representative_photo_url
        : `${API}${g.representative_photo_url}`)
    : null;
  const href = g.slug ? `/groups/${g.slug}` : g.link_url ?? "#";

  return (
    <Link
      href={href}
      className="bg-white border border-[var(--color-border)] rounded-2xl p-5 flex flex-col gap-2.5 transition-all hover:-translate-y-0.5 hover:border-[var(--color-text-muted)]"
      style={{ borderLeft: `3px solid ${cat.border}` }}
    >
      <div className="flex items-center gap-3">
        <span
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: cat.bg, color: cat.ink }}
        >
          {repUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={repUrl} alt={g.name} className="w-full h-full object-cover rounded-lg" />
          ) : (
            <CrossIcon className="text-base" />
          )}
        </span>
        <h4 className="text-[15px] font-bold tracking-tight min-w-0 truncate">{g.name}</h4>
      </div>
      {g.description && (
        <p className="text-[12px] leading-snug text-[var(--color-text-muted)] line-clamp-2">
          {g.description}
        </p>
      )}
      <div className="mt-auto pt-2.5 border-t border-dashed border-[var(--color-border)] flex items-center justify-between gap-2 text-[11px] text-[var(--color-text-muted)] tabular-nums">
        <span>{g.activity_time ? <span className="truncate">{g.activity_time}</span> : <span className="opacity-60">활동 시간 미정</span>}</span>
        <span className="font-semibold" style={{ color: cat.ink }}>자세히 →</span>
      </div>
    </Link>
  );
}
