// 갤러리 글쓰기는 /boards/{slug}/write 로 통합됨 (v1.5.201). 옛 URL 호환 redirect.
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function GalleryWriteRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/boards/${slug}/write`);
}
