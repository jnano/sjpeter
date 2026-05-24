import type { Metadata } from "next";
import Link from "next/link";
import SectionLayout from "@/components/SectionLayout";
import CrossIcon from "@/components/icons/CrossIcon";
import MeditationArticle, { type MeditationData, type NeighborBrief } from "./MeditationArticle";
import { fetchParishMin } from "@/lib/parish";

export async function generateMetadata(): Promise<Metadata> {
  const p = await fetchParishMin();
  return { title: "주일 말씀 묵상과 실천", description: `${p.name} 주일 말씀 묵상과 실천` };
}

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function getCurrentMeditation(): Promise<MeditationData | null> {
  try {
    const res = await fetch(`${API}/api/content/meditations/current`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}
async function getNeighbors(id: number): Promise<{ prev: NeighborBrief | null; next: NeighborBrief | null }> {
  try {
    const res = await fetch(`${API}/api/content/meditations/${id}/neighbors`, { cache: "no-store" });
    if (!res.ok) return { prev: null, next: null };
    const d = await res.json();
    return { prev: d.prev ?? null, next: d.next ?? null };
  } catch { return { prev: null, next: null }; }
}
async function getRecent(excludeId: number): Promise<NeighborBrief[]> {
  try {
    const res = await fetch(`${API}/api/content/meditations?page=1`, { cache: "no-store" });
    if (!res.ok) return [];
    const d = await res.json();
    const items = Array.isArray(d?.items) ? d.items : [];
    return items.filter((m: { id: number }) => m.id !== excludeId).slice(0, 4);
  } catch { return []; }
}

function fmt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function PageHead() {
  return (
    <div className="med-ph">
      <div className="med-ph-inner">
        <div className="med-breadcrumb">
          <Link href="/word">말씀과 기도</Link>
          <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4"><polyline points="4 2 6.5 5 4 8" /></svg>
          <span className="current">주일 말씀 묵상과 실천</span>
        </div>
        <h1 className="med-ph-title">주일 말씀 묵상과 실천</h1>
        <p className="med-ph-sub">말씀 앞에 잠시 멈추는 시간.</p>
      </div>
    </div>
  );
}

export default async function MeditationPage() {
  const meditation = await getCurrentMeditation();
  const parish = await fetchParishMin();

  if (!meditation) {
    return (
      <>
        <PageHead />
        <SectionLayout group="word">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-8">
            <div className="text-center py-16 text-[var(--color-text-muted)]">
              <div className="text-5xl mb-4 flex justify-center"><CrossIcon /></div>
              <p className="font-serif text-lg text-[var(--color-primary)] mb-2">준비 중입니다</p>
              <p className="text-sm">곧 묵상 글이 올라올 예정입니다.</p>
            </div>
          </div>
        </SectionLayout>
      </>
    );
  }

  const [neighbors, recent] = await Promise.all([getNeighbors(meditation.id), getRecent(meditation.id)]);

  return (
    <>
      <PageHead />
      <SectionLayout group="word">
        <div className="med-layout">
          <MeditationArticle meditation={meditation} parishName={parish.name} prev={neighbors.prev} next={neighbors.next} />
          <aside className="med-rail">
            <div className="med-recent">
              <h4>최근 묵상</h4>
              {recent.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)] pt-2">최근 묵상이 없습니다.</p>
              ) : (
                <ul>
                  {recent.map((r) => (
                    <li key={r.id}>
                      <Link href={`/meditation/archive/${r.id}`}>
                        <h6>{r.title}</h6>
                        <span className="info"><b>{fmt(r.published_date)}</b>{r.scripture ? ` · ${r.scripture}` : ""}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      </SectionLayout>
    </>
  );
}
