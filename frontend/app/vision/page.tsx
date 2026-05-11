import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "사목지표",
  description: "세종성베드로성당 역대 사목지표",
};

const API = process.env.NEXT_PUBLIC_API_URL;

interface VisionOut {
  id: number;
  year: number;
  motto: string;
  is_current: boolean;
}

async function getVisions(): Promise<VisionOut[]> {
  try {
    const res = await fetch(`${API}/api/content/visions`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function getPastorName(): Promise<string | null> {
  try {
    const res = await fetch(`${API}/api/parish-staff/`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const staff: { role: string; name: string }[] = await res.json();
    return staff.find((s) => s.role === "주임신부")?.name ?? null;
  } catch {
    return null;
  }
}

export default async function VisionPage() {
  const [visions, pastorName] = await Promise.all([getVisions(), getPastorName()]);
  const current = visions.find((v) => v.is_current) ?? visions[0];

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

      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--color-border)]">
          <h2 className="font-serif font-bold text-[var(--color-primary)]">역대 사목지표</h2>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {visions.map((v) => (
            <div
              key={v.id}
              className={`flex items-center gap-6 px-6 py-4 ${
                v.is_current ? "bg-blue-50" : "hover:bg-[var(--color-surface-warm)]"
              } transition-colors`}
            >
              <span
                className={`text-sm font-bold w-12 shrink-0 ${
                  v.is_current ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"
                }`}
              >
                {v.year}
              </span>
              <span
                className={`font-serif ${
                  v.is_current ? "font-bold text-[var(--color-primary)]" : ""
                }`}
              >
                &ldquo;{v.motto}&rdquo;
              </span>
              {v.is_current && (
                <span className="ml-auto text-xs bg-[var(--color-primary)] text-white px-2 py-0.5 rounded-full">
                  올해
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-[var(--color-text-muted)]">
        지표는 씨앗이고, 한 해의 기록은 그 씨앗이 자란 나무입니다.
      </p>
    </SectionLayout>
    </>
  );
}
