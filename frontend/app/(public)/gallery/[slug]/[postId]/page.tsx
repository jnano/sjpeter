// 갤러리 글 상세는 /boards/{slug}/{postId} 로 통합됨 (v1.5.201). 옛 URL 호환 redirect.
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function GalleryPostRedirect({
  params,
}: {
  params: Promise<{ slug: string; postId: string }>;
}) {
  const { slug, postId } = await params;
  redirect(`/boards/${slug}/${postId}`);
}
