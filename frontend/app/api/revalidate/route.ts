import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

// tag 쿼리 파라미터로 특정 태그만, 없으면 전체 무효화
// POST /api/revalidate          → bulletins 태그 (기존 주보 등록 흐름)
// POST /api/revalidate?tag=parish → parish 태그
export async function POST(req: NextRequest) {
  const tag = req.nextUrl.searchParams.get("tag");
  if (tag) {
    revalidateTag(tag);
  } else {
    revalidateTag("bulletins");
  }
  return NextResponse.json({ revalidated: true, tag: tag ?? "bulletins" });
}
