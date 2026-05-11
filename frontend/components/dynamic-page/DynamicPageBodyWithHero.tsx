import PageHeroSlideshow from "@/components/PageHeroSlideshow";
import MarkdownContent from "@/components/MarkdownContent";

interface Props {
  slug: string;
  bodyMarkdown: string;
}

/**
 * 슬라이드쇼 + 본문 레이아웃.
 * 슬라이드 사진은 /admin/page-photos에서 같은 slug로 등록해야 표시됨.
 * 사진이 없으면 슬라이드쇼는 렌더 안 함 (PageHeroSlideshow 동작 그대로).
 */
export default function DynamicPageBodyWithHero({ slug, bodyMarkdown }: Props) {
  return (
    <div className="space-y-8">
      <PageHeroSlideshow
        slug={slug}
        className="relative w-full aspect-[3/1] md:aspect-[16/6] rounded-xl overflow-hidden border border-[var(--color-border)]"
        sizes="(max-width: 768px) 100vw, 1024px"
        priority
      />
      {bodyMarkdown.trim() ? (
        <MarkdownContent content={bodyMarkdown} />
      ) : (
        <p className="text-sm text-gray-400">아직 작성된 내용이 없습니다.</p>
      )}
    </div>
  );
}
