import MarkdownContent from "@/components/MarkdownContent";

interface SectionCard {
  title?: string;
  body?: string;
}

interface Props {
  bodyMarkdown: string;
  payload: Record<string, unknown>;
}

/**
 * 본문 + 하단 카드 리스트 레이아웃.
 * payload.sections는 [{title, body}, ...] 형식 — FAQ, 연혁, 단계별 안내 등에 적합.
 */
export default function DynamicPageSections({ bodyMarkdown, payload }: Props) {
  const rawSections = payload.sections;
  const sections: SectionCard[] = Array.isArray(rawSections)
    ? (rawSections as SectionCard[])
    : [];

  return (
    <div className="space-y-10">
      {bodyMarkdown.trim() && <MarkdownContent content={bodyMarkdown} />}

      {sections.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {sections.map((s, i) => (
            <article
              key={i}
              className="border border-[var(--color-border)] rounded-xl p-5 bg-white"
            >
              {s.title && (
                <h3 className="text-base font-semibold text-[var(--color-primary)] mb-2">
                  {s.title}
                </h3>
              )}
              {s.body && (
                <div className="text-sm text-[var(--color-text)] leading-relaxed">
                  <MarkdownContent content={s.body} />
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {!bodyMarkdown.trim() && sections.length === 0 && (
        <p className="text-sm text-gray-400">아직 작성된 내용이 없습니다.</p>
      )}
    </div>
  );
}
