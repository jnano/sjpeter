"use client";
import dynamic from "next/dynamic";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-64 border border-[var(--color-border)] rounded-lg bg-gray-50 flex items-center justify-center text-sm text-[var(--color-text-muted)]">
      에디터 불러오는 중...
    </div>
  ),
});

interface Props {
  value: string;
  onChange: (value: string) => void;
  height?: number;
}

export default function MarkdownEditor({ value, onChange, height = 300 }: Props) {
  return (
    <div data-color-mode="light">
      <MDEditor
        value={value}
        onChange={(v) => onChange(v ?? "")}
        height={height}
        preview="edit"
        textareaProps={{
          placeholder: "내용을 입력하세요... (마크다운 지원)",
          required: true,
        }}
      />
    </div>
  );
}
