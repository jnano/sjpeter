import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  content: string;
}

export default function MarkdownContent({ content }: Props) {
  return (
    <div className="prose prose-sm max-w-none text-[var(--color-text)] leading-relaxed
      prose-headings:text-[var(--color-primary)] prose-headings:font-bold
      prose-a:text-[var(--color-primary)] prose-a:no-underline hover:prose-a:underline
      prose-blockquote:border-l-4 prose-blockquote:border-l-[var(--color-primary)]
      prose-blockquote:bg-[var(--color-surface-warm)] prose-blockquote:rounded-r-lg
      prose-blockquote:px-5 prose-blockquote:py-3 prose-blockquote:not-italic
      prose-blockquote:text-[var(--color-text)] prose-blockquote:my-4
      prose-blockquote:[&_p]:my-1
      prose-code:bg-gray-100 prose-code:px-1 prose-code:rounded prose-code:text-sm
      prose-pre:bg-gray-100 prose-pre:rounded-lg prose-pre:overflow-x-auto
      prose-img:rounded-lg prose-img:border prose-img:border-[var(--color-border)]
      prose-hr:border-[var(--color-border)]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          img({ src, alt }) {
            if (!src) return null;
            // eslint-disable-next-line @next/next/no-img-element
            return <img src={src} alt={alt ?? ""} className="rounded-lg border border-[var(--color-border)]" />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
