import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";
import DynamicPageBody from "@/components/dynamic-page/DynamicPageBody";
import DynamicPageBodyWithHero from "@/components/dynamic-page/DynamicPageBodyWithHero";
import DynamicPageSections from "@/components/dynamic-page/DynamicPageSections";

// 동적 페이지는 매 요청 시 fresh 데이터를 가져옴 — admin 편집 즉시 반영
export const dynamic = "force-dynamic";

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type LayoutKind = "body" | "body_with_hero" | "sections" | "html" | "html_in_layout";

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
  /** 시스템 불변량: 메뉴 등록 자원은 사이드바를 강제. layout_kind='html' 이라도 true 면 wrap. */
  in_menu?: boolean;
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

  // 시스템 불변량 가드 — admin/menus 에 등록된 자원은 어떤 layout 이든 사이드바를 가진다.
  // layout_kind='html' 이라도 in_menu=true 면 SectionLayout/PageHeader 강제 wrap.
  // (메뉴 미등록 자유 HTML 페이지는 기존 동작 — raw HTML 만 출력)
  if (data.layout_kind === "html") {
    if (!data.in_menu) {
      return (
        <div
          className="dynamic-html-page"
          dangerouslySetInnerHTML={{ __html: data.body_markdown ?? "" }}
        />
      );
    }
    // in_menu=true: html_in_layout 처럼 동작 (사이드바 강제)
    return (
      <>
        <PageHeader
          group={data.group_label ?? ""}
          title={data.title}
          subtitle={data.subtitle ?? ""}
        />
        <SectionLayout autoHero={true}>
          <div
            className="dynamic-html-in-layout"
            dangerouslySetInnerHTML={{ __html: data.body_markdown ?? "" }}
          />
        </SectionLayout>
      </>
    );
  }

  // body_with_hero 레이아웃은 자체 슬라이드쇼를 그리므로 SectionLayout의 autoHero는 끔
  const useAutoHero = data.layout_kind !== "body_with_hero";

  return (
    <>
      <PageHeader
        group={data.group_label ?? ""}
        title={data.title}
        subtitle={data.subtitle ?? ""}
      />
      <SectionLayout autoHero={useAutoHero}>
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
        {data.layout_kind === "html_in_layout" && (
          <div
            className="dynamic-html-in-layout"
            dangerouslySetInnerHTML={{ __html: data.body_markdown ?? "" }}
          />
        )}
      </SectionLayout>
    </>
  );
}
