import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";
import MarkdownContent from "@/components/MarkdownContent";
import { fetchParishMin } from "@/lib/parish";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const p = await fetchParishMin();
  return { title: "사목 지표", description: `${p.name} 역대 사목지표` };
}

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL;

interface VisionOut {
  id: number;
  year: number;
  motto: string;
  body: string | null;
  is_current: boolean;
}

async function getVisions(): Promise<VisionOut[]> {
  try {
    // admin에서 본문 수정 시 즉시 반영되도록 캐시 비활성
    const res = await fetch(`${API}/api/content/visions`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function getPastorName(): Promise<string | null> {
  try {
    const res = await fetch(`${API}/api/parish-staff/`);
    if (!res.ok) return null;
    const staff: { role: string; name: string }[] = await res.json();
    return staff.find((s) => s.role === "주임신부")?.name ?? null;
  } catch {
    return null;
  }
}

export default async function VisionPage() {
  const [rawVisions, pastorName] = await Promise.all([getVisions(), getPastorName()]);
  // 정렬: year DESC, 동률이면 id DESC — 최근 등록이 항상 위. 목록·current 동일 적용.
  const visions = [...rawVisions].sort((a, b) => b.year - a.year || b.id - a.id);
  const current = visions[0];

  return (
    <>
      <PageHeader group="본당 공동체" title="올해의 사목 방향" subtitle="매년 신부님이 제시하는 한 해의 씨앗" />
      <SectionLayout group="community">

      {current && (
        <div className="bg-[var(--color-primary)] text-white rounded-xl p-8 mb-8 text-center">
          <p className="text-white/70 text-sm mb-2">{current.year}년 사목지표</p>
          <blockquote className="font-serif text-3xl font-bold">
            &ldquo;{current.motto}&rdquo;
          </blockquote>
          {pastorName && (
            <p className="text-white/60 text-sm mt-4">주임신부 {pastorName}</p>
          )}
        </div>
      )}

      {current?.body && (
        <article className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 sm:p-8 mb-8">
          <MarkdownContent content={current.body} />
        </article>
      )}

      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--color-border)]">
          <h2 className="font-serif font-bold text-[var(--color-primary)]">역대 사목지표</h2>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {visions.map((v) => {
            // "올해" 배지는 페이지 상단에 노출된 current(가장 최근 등록 1건) 와 일치하는 행에만.
            // DB 의 is_current 가 여러 건 TRUE 인 경우에도 표시는 1건으로 보정.
            const isLatest = v.id === current?.id;
            return (
              <div
                key={v.id}
                className={`flex items-center gap-6 px-6 py-4 ${
                  isLatest ? "bg-blue-50" : "hover:bg-[var(--color-surface-warm)]"
                } transition-colors`}
              >
                <span
                  className={`text-sm font-bold w-12 shrink-0 ${
                    isLatest ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"
                  }`}
                >
                  {v.year}
                </span>
                <span
                  className={`font-serif ${
                    isLatest ? "font-bold text-[var(--color-primary)]" : ""
                  }`}
                >
                  &ldquo;{v.motto}&rdquo;
                </span>
                {isLatest && (
                  <span className="ml-auto text-xs bg-[var(--color-primary)] text-white px-2 py-0.5 rounded-full">
                    올해
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-[var(--color-text-muted)]">
        지표는 씨앗이고, 한 해의 기록은 그 씨앗이 자란 나무입니다.
      </p>
    </SectionLayout>
    </>
  );
}
