import type { Metadata } from "next";
import Image from "next/image";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";
import { fetchParishMin } from "@/lib/parish";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const p = await fetchParishMin();
  return { title: "역대 신부님", description: `${p.name} 역대 신부님 소개` };
}

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Pastor {
  id: number;
  name: string;
  title: string;
  appointed_at: string | null;
  resigned_at: string | null;
  photo_url: string | null;
  bio: string | null;
  sort_order: number;
}

async function getPastors(): Promise<Pastor[]> {
  try {
    const res = await fetch(`${API}/api/archive/pastors?category=priest`);
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

function formatPeriod(appointed: string | null, resigned: string | null): string {
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("ko-KR", { year: "numeric", month: "long" });
  if (appointed && resigned) return `${fmt(appointed)} — ${fmt(resigned)}`;
  if (appointed) return `${fmt(appointed)} — 현재`;
  return "기간 미상";
}

export default async function PastorsPage() {
  const [pastors, p] = await Promise.all([getPastors(), fetchParishMin()]);

  return (
    <>
      <PageHeader group="성당 소개" title="역대 신부님" subtitle={`${p.name}을 이끌어 오신 신부님들`} />
      <SectionLayout group="about">
        {pastors.length === 0 ? (
          <div className="text-center py-20 text-[var(--color-text-muted)]">
            <div className="text-5xl mb-4">✝</div>
            <p className="font-serif text-lg text-[var(--color-primary)] mb-1">준비 중입니다</p>
            <p className="text-sm">신부님 정보를 곧 등록하겠습니다.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {pastors.map((p) => (
              <div key={p.id} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
                <div className="flex flex-col sm:flex-row">
                  {/* 사진 */}
                  <div className="sm:w-44 shrink-0 bg-[var(--color-surface-warm)] flex items-center justify-center">
                    {p.photo_url ? (
                      <div className="relative w-full h-44 sm:h-full">
                        <Image
                          src={p.photo_url.startsWith("/") ? `${API}${p.photo_url}` : p.photo_url}
                          alt={p.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-44 sm:h-full flex items-center justify-center text-5xl text-[var(--color-border)]">
                        ✝
                      </div>
                    )}
                  </div>
                  {/* 정보 */}
                  <div className="flex-1 p-6">
                    <div className="flex items-baseline gap-3 mb-1">
                      <h2 className="font-serif text-xl font-bold text-[var(--color-primary)]">{p.name}</h2>
                      <span className="text-sm text-[var(--color-text-muted)]">{p.title}</span>
                    </div>
                    <p className="text-sm text-[var(--color-accent)] font-medium mb-3">
                      {formatPeriod(p.appointed_at, p.resigned_at)}
                    </p>
                    {p.bio && (
                      <p className="text-sm text-[var(--color-text)] leading-relaxed whitespace-pre-wrap">
                        {p.bio}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionLayout>
    </>
  );
}
