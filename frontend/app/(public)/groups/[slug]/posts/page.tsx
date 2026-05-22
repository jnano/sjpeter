import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";

export const dynamic = "force-dynamic";

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface CommunityGroup { id: number; name: string; slug: string | null; description?: string | null; }
interface TaggedItem {
  kind: "post" | "event";
  id: number;
  title: string;
  excerpt: string | null;
  item_date: string | null;
  href: string;
  is_pinned: boolean;
  temporal_kind: string | null;
}

async function getGroup(slug: string): Promise<CommunityGroup | null> {
  try {
    const r = await fetch(`${API}/api/content/community/slug/${encodeURIComponent(slug)}`, { cache: "no-store" });
    return r.ok ? r.json() : null;
  } catch { return null; }
}

async function getItems(slug: string): Promise<TaggedItem[]> {
  try {
    const r = await fetch(`${API}/api/content/community/${encodeURIComponent(slug)}/tagged-items?limit=100`, { cache: "no-store" });
    return r.ok ? r.json() : [];
  } catch { return []; }
}

export default async function GroupPostsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [group, items] = await Promise.all([getGroup(slug), getItems(slug)]);
  if (!group) notFound();

  return (
    <>
      <PageHeader
        group="알림과 게시판"
        title={`${group.name} 태그 글`}
        subtitle={items.length > 0 ? `${items.length}건` : "아직 태그된 글이 없습니다"}
        action={
          <Link
            href={group.slug ? `/groups/${group.slug}` : "/groups"}
            className="text-sm text-[var(--color-primary)] hover:underline"
          >
            ← {group.name} 소개
          </Link>
        }
      />
      <SectionLayout autoHero={false}>
        <div className="py-6">
          {items.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-10">
              이 분과·단체로 태그된 글이 아직 없습니다.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]/60 border border-[var(--color-border)] rounded-lg bg-white">
              {items.map((it) => (
                <li key={`${it.kind}-${it.id}`}>
                  <Link
                    href={it.href}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-[var(--color-surface-warm)] transition-colors"
                  >
                    <span
                      className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-semibold border ${
                        it.kind === "event"
                          ? "bg-blue-50 border-blue-200 text-blue-700"
                          : "bg-violet-50 border-violet-200 text-violet-700"
                      }`}
                    >
                      {it.kind === "event" ? "행사" : "글"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {it.is_pinned && (
                          <span className="text-[10px] text-red-600 font-bold">📌</span>
                        )}
                        <span className="text-sm font-semibold text-[var(--color-text)] truncate">
                          {it.title}
                        </span>
                      </div>
                      {it.excerpt && (
                        <p className="text-xs text-[var(--color-text-muted)] line-clamp-2 mt-0.5 leading-snug">
                          {it.excerpt}
                        </p>
                      )}
                      {it.item_date && (
                        <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                          {it.item_date}
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SectionLayout>
    </>
  );
}
