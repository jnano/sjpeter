import type { Metadata } from "next";
import Image from "next/image";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";
import { fetchParishMin } from "@/lib/parish";

// admin에서 변경한 데이터가 새로고침 없이 반영되도록 SSR 강제
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const p = await fetchParishMin();
  return { title: "본당 출신 사제", description: `${p.name}에서 탄생한 사제들` };
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Priest {
  id: number;
  name: string;
  baptism_date: string | null;
  ordained_date: string;
  role: string | null;
  photo_url: string | null;
  bio: string | null;
  sort_order: number;
}

async function getPriests(): Promise<Priest[]> {
  try {
    const res = await fetch(`${API}/api/archive/priests`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

export default async function PriestsPage() {
  const [priests, p] = await Promise.all([getPriests(), fetchParishMin()]);

  return (
    <>
      <PageHeader group="성당 소개" title="본당 출신 사제" subtitle={`${p.name}에서 성소의 씨앗이 자라난 분들`} />
      <SectionLayout group="about">
        {priests.length === 0 ? (
          <div className="text-center py-20 text-[var(--color-text-muted)]">
            <div className="text-5xl mb-4">✝</div>
            <p className="font-serif text-lg text-[var(--color-primary)] mb-1">준비 중입니다</p>
            <p className="text-sm">사제 정보를 곧 등록하겠습니다.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {priests.map((p) => (
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
                      {p.role && <span className="text-sm text-[var(--color-text-muted)]">{p.role}</span>}
                    </div>
                    <div className="space-y-1 mb-3">
                      <p className="text-sm text-[var(--color-accent)] font-medium">
                        사제서품: {formatDate(p.ordained_date)}
                      </p>
                      {p.baptism_date && (
                        <p className="text-xs text-[var(--color-text-muted)]">
                          세례: {formatDate(p.baptism_date)}
                        </p>
                      )}
                    </div>
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
