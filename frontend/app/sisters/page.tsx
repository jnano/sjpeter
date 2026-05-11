import type { Metadata } from "next";
import Image from "next/image";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "역대 수녀님",
  description: "세종성베드로성당을 거쳐 가신 수녀님들",
};

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Sister {
  id: number;
  name: string;
  title: string;
  appointed_at: string | null;
  resigned_at: string | null;
  photo_url: string | null;
  bio: string | null;
  sort_order: number;
  category: string;
}

async function getSisters(): Promise<Sister[]> {
  try {
    const res = await fetch(`${API}/api/archive/pastors?category=sister`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

function formatPeriod(appointed: string | null, resigned: string | null): string {
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("ko-KR", { year: "numeric", month: "long" });
  if (appointed && resigned) return `${fmt(appointed)} — ${fmt(resigned)}`;
  if (appointed) return `${fmt(appointed)} — 현재`;
  return "기간 미상";
}

export default async function SistersPage() {
  const sisters = await getSisters();

  return (
    <>
      <PageHeader group="성당 소개" title="역대 수녀님" subtitle="세종성베드로성당을 거쳐 가신 수녀님들" />
      <SectionLayout group="about">
        {sisters.length === 0 ? (
          <div className="text-center py-20 text-[var(--color-text-muted)]">
            <div className="text-5xl mb-4">✝</div>
            <p className="font-serif text-lg text-[var(--color-primary)] mb-1">준비 중입니다</p>
            <p className="text-sm">수녀님 정보를 곧 등록하겠습니다.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {sisters.map((s) => (
              <div key={s.id} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
                <div className="flex flex-col sm:flex-row">
                  {/* 사진 */}
                  <div className="sm:w-44 shrink-0 bg-[var(--color-surface-warm)] flex items-center justify-center">
                    {s.photo_url ? (
                      <div className="relative w-full h-44 sm:h-full">
                        <Image
                          src={s.photo_url.startsWith("/") ? `${API}${s.photo_url}` : s.photo_url}
                          alt={s.name}
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
                      <h2 className="font-serif text-xl font-bold text-[var(--color-primary)]">{s.name}</h2>
                      <span className="text-sm text-[var(--color-text-muted)]">{s.title}</span>
                    </div>
                    <p className="text-sm text-[var(--color-accent)] font-medium mb-3">
                      {formatPeriod(s.appointed_at, s.resigned_at)}
                    </p>
                    {s.bio && (
                      <p className="text-sm text-[var(--color-text)] leading-relaxed whitespace-pre-wrap">
                        {s.bio}
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
