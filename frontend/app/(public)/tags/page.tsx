import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";
import TagCloud from "@/components/TagCloud";

export const dynamic = "force-dynamic";

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface TagItem { id: number; name: string; slug: string | null; count: number; }

async function getTags(): Promise<TagItem[]> {
  try {
    const r = await fetch(`${API}/api/content/community/post-counts`, { cache: "no-store" });
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data) ? data as TagItem[] : [];
  } catch { return []; }
}

export default async function TagsPage() {
  const tags = await getTags();
  return (
    <>
      <PageHeader group="알림과 게시판" title="분과 태그" subtitle="활성 분과·단체와 글 수" />
      <SectionLayout autoHero={false}>
        <div className="py-6">
          <p className="text-xs text-[var(--color-text-muted)] mb-4 text-center">
            글 수에 비례한 크기로 표시됩니다. 클릭하면 해당 분과로 태그된 글 모아보기로 이동합니다.
          </p>
          <TagCloud items={tags} minSize={14} maxSize={48} />
        </div>
      </SectionLayout>
    </>
  );
}
