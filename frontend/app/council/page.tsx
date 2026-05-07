import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "사목평의회",
  description: "세종성베드로성당 사목평의회 소개",
};

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface StaticPage {
  slug: string;
  title: string;
  subtitle: string | null;
  body: string | null;
}

async function getPage(): Promise<StaticPage | null> {
  try {
    const res = await fetch(`${API}/api/content/pages/council`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function CouncilPage() {
  const page = await getPage();

  const title = page?.title ?? "사목평의회";
  const subtitle = page?.subtitle ?? "본당 사목을 함께 이끌어 가는 의결 기구";
  const body = page?.body;

  return (
    <>
      <PageHeader group="본당 가족" title={title} subtitle={subtitle} />
      <div className="max-w-3xl mx-auto px-4 py-8">

      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-8">
        {body ? (
          <div className="text-[var(--color-text)] leading-relaxed whitespace-pre-line text-sm">
            {body}
          </div>
        ) : (
          <div className="text-center py-16 text-[var(--color-text-muted)]">
            <div className="text-5xl mb-4">✝</div>
            <p className="font-serif text-lg text-[var(--color-primary)] mb-2">준비 중입니다</p>
            <p className="text-sm">관리자 페이지에서 내용을 입력해 주세요.</p>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
