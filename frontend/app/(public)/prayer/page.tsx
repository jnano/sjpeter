import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";
import CrossIcon from "@/components/icons/CrossIcon";
import { fetchParishMin } from "@/lib/parish";
import PrayerListView, { type PrayerItem } from "./PrayerListView";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const p = await fetchParishMin();
  return { title: "기도문", description: `${p.name} 기도문 모음` };
}

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function getAllPrayers(): Promise<PrayerItem[]> {
  try {
    const res = await fetch(`${API}/api/content/prayers?limit=500`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items ?? []) as PrayerItem[];
  } catch {
    return [];
  }
}

export default async function PrayerPage() {
  const prayers = await getAllPrayers();

  return (
    <>
      <PageHeader group="말씀과 기도" title="기도문" subtitle="함께 바치는 가톨릭 기도" />
      <SectionLayout group="word">
        {prayers.length === 0 ? (
          <div className="text-center py-20 text-[var(--color-text-muted)]">
            <div className="text-5xl mb-4"><CrossIcon /></div>
            <p className="font-serif text-lg text-[var(--color-primary)] mb-2">준비 중입니다</p>
            <p className="text-sm">관리자가 기도문을 등록하면 여기에 노출됩니다.</p>
          </div>
        ) : (
          <PrayerListView prayers={prayers} />
        )}
      </SectionLayout>
    </>
  );
}
