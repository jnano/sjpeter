// 갤러리 라우트는 /boards/{slug} 로 통합됨 (v1.5.201).
// 옛 URL 호환을 위해 redirect 만 남긴다. board.kind==='gallery' 면
// /boards/[slug] 페이지가 자동으로 photo 그리드 뷰를 디폴트로 표시.
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function GallerySlugRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") qs.set(k, v);
  }
  const suffix = qs.toString();
  redirect(`/boards/${slug}${suffix ? `?${suffix}` : ""}`);
}
