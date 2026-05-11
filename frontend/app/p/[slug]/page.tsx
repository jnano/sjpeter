import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import DynamicPageBody from "@/components/dynamic-page/DynamicPageBody";
import DynamicPageBodyWithHero from "@/components/dynamic-page/DynamicPageBodyWithHero";
import DynamicPageSections from "@/components/dynamic-page/DynamicPageSections";

// 동적 페이지는 매 요청 시 fresh 데이터를 가져옴 — admin 편집 즉시 반영
export const dynamic = "force-dynamic";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type LayoutKind = "body" | "body_with_hero" | "sections";

interface PageData {
  id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  group_label: string | null;
  layout_kind: LayoutKind;
  payload: Record<string, unknown>;
  body_markdown: string | null;
  is_active: boolean;
}

async function fetchPage(slug: string): Promise<PageData | null> {
  const res = await fetch(`${API}/api/pages/by-slug/${encodeURIComponent(slug)}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  return res.json();
}

export default async function DynamicPageRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await fetchPage(slug);
  if (!data) notFound();

  return (
    <>
      <PageHeader
        group={data.group_label ?? ""}
        title={data.title}
        subtitle={data.subtitle ?? ""}
      />
      <div className="max-w-4xl mx-auto px-4 py-8">
        {data.layout_kind === "body" && (
          <DynamicPageBody bodyMarkdown={data.body_markdown ?? ""} />
        )}
        {data.layout_kind === "body_with_hero" && (
          <DynamicPageBodyWithHero
            slug={data.slug}
            bodyMarkdown={data.body_markdown ?? ""}
          />
        )}
        {data.layout_kind === "sections" && (
          <DynamicPageSections
            bodyMarkdown={data.body_markdown ?? ""}
            payload={data.payload}
          />
        )}
      </div>
    </>
  );
}
