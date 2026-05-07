import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "함께하는 이들",
  description: "세종성베드로성당 사목평의회 및 각 분과 소개",
};

const API = process.env.NEXT_PUBLIC_API_URL;

interface CommunityGroup {
  id: number;
  name: string;
  description: string | null;
  activity_time: string | null;
  link_url: string | null;
  sort_order: number;
}

async function getCommunity(): Promise<CommunityGroup[]> {
  try {
    const res = await fetch(`${API}/api/content/community`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function getPhone(): Promise<string | null> {
  try {
    const res = await fetch(`${API}/api/parish/`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = await res.json();
    return data.phone ?? null;
  } catch {
    return null;
  }
}

export default async function CommunityPage() {
  const [groups, phone] = await Promise.all([getCommunity(), getPhone()]);

  return (
    <>
      <PageHeader group="우리 성당" title="우리 가족" subtitle="세종성베드로성당을 이루는 사람들과 모임을 소개합니다" />
      <div className="max-w-4xl mx-auto px-4 py-8">

      <div className="grid sm:grid-cols-2 gap-4">
        {groups.map((group) => {
          const inner = (
            <div className="flex items-start gap-3">
              <span className="text-[var(--color-accent)] text-xl mt-0.5">✝</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-serif font-bold text-[var(--color-primary)] text-lg">
                    {group.name}
                  </h3>
                  {group.link_url && (
                    <span className="text-xs text-[var(--color-primary)] border border-[var(--color-primary)]/30 px-1.5 py-0.5 rounded shrink-0">
                      게시판 →
                    </span>
                  )}
                </div>
                {group.description && (
                  <p className="text-sm text-[var(--color-text)] leading-relaxed mb-2">
                    {group.description}
                  </p>
                )}
                {group.activity_time && (
                  <p className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-warm)] border border-[var(--color-border)] inline-block px-2 py-0.5 rounded">
                    {group.activity_time}
                  </p>
                )}
              </div>
            </div>
          );

          return group.link_url ? (
            <Link
              key={group.id}
              href={group.link_url}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 hover:border-[var(--color-primary)] hover:shadow-sm transition-all block"
            >
              {inner}
            </Link>
          ) : (
            <div
              key={group.id}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6"
            >
              {inner}
            </div>
          );
        })}
      </div>

      <div className="mt-8 bg-[var(--color-surface-warm)] border border-[var(--color-border)] rounded-xl p-6 text-center">
        <p className="font-serif text-lg text-[var(--color-primary)] mb-2">
          새가족이신가요?
        </p>
        <p className="text-sm text-[var(--color-text-muted)]">
          {phone
            ? `본당 사무실(${phone})로 연락하시거나 주일 미사 후 안내 데스크를 방문해 주세요.`
            : "본당 사무실로 연락하시거나 주일 미사 후 안내 데스크를 방문해 주세요."}
        </p>
      </div>
    </div>
    </>
  );
}
