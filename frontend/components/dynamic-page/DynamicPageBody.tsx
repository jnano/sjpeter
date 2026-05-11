import MarkdownContent from "@/components/MarkdownContent";

interface Props {
  bodyMarkdown: string;
}

export default function DynamicPageBody({ bodyMarkdown }: Props) {
  if (!bodyMarkdown.trim()) {
    return <p className="text-sm text-gray-400">아직 작성된 내용이 없습니다.</p>;
  }
  return <MarkdownContent content={bodyMarkdown} />;
}
