import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SectionLayout from "@/components/SectionLayout";
import MeditationArticle, { type MeditationData, type NeighborBrief } from "../../MeditationArticle";
import { fetchParishMin } from "@/lib/parish";

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function getMeditation(id: number): Promise<MeditationData | null> {
  try {
    const res = await fetch(`${API}/api/content/meditations/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getNeighbors(id: number): Promise<{ prev: NeighborBrief | null; next: NeighborBrief | null }> {
  try {
    const res = await fetch(`${API}/api/content/meditations/${id}/neighbors`, { cache: "no-store" });
    if (!res.ok) return { prev: null, next: null };
    const d = await res.json();
    return { prev: d.prev ?? null, next: d.next ?? null };
  } catch {
    return { prev: null, next: null };
  }
}

async function getRecent(excludeId: number): Promise<NeighborBrief[]> {
  try {
    const res = await fetch(`${API}/api/content/meditations?page=1`, { cache: "no-store" });
    if (!res.ok) return [];
    const d = await res.json();
    const items: NeighborBrief[] = Array.isArray(d?.items) ? d.items : [];
    return items.filter((m) => m.id !== excludeId).slice(0, 4);
  } catch {
    return [];
  }
}

function excerpt(body: string, len = 120) {
  const clean = body.replace(/\n+/g, " ").trim();
  return clean.length > len ? clean.slice(0, len) + "…" : clean;
}

function absoluteImageUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API}${path}`;
}

function fmt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isFinite(numId) || numId <= 0) {
    return { title: "묵상 아카이브" };
  }
  const [p, m] = await Promise.all([
    fetchParishMin(),
    getMeditation(numId),
  ]);
  if (!m) {
    return { title: "묵상 아카이브", description: `${p.name} 묵상 아카이브` };
  }
  const description = excerpt(m.body, 120);
  // background_image_url 은 MeditationData 타입에 없지만 백엔드 응답이 포함하는 경우가 있어 안전 접근
  const ogImage = absoluteImageUrl((m as MeditationData & { background_image_url?: string | null }).background_image_url);
  return {
    title: `${m.title} — 묵상 아카이브`,
    description,
    openGraph: {
      title: m.title,
      description,
      type: "article",
      publishedTime: m.published_date,
      authors: m.author ? [m.author] : undefined,
      images: ogImage ? [{ url: ogImage }] : undefined,
      siteName: p.name,
    },
  };
}

/** /meditation 메인과 같은 톤의 PageHead — meditation.html 시안의 .med-ph */
function PageHead({ currentId }: { currentId: number }) {
  return (
    <div className="med-ph">
      <div className="med-ph-inner">
        <div className="med-breadcrumb">
          <Link href="/word">말씀과 기도</Link>
          <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4"><polyline points="4 2 6.5 5 4 8" /></svg>
          <Link href={`/meditation/archive?focus=${currentId}`}>묵상 아카이브</Link>
        </div>
        <h1 className="med-ph-title">지난 묵상</h1>
        <p className="med-ph-sub">말씀 앞에 잠시 멈추는 시간.</p>
      </div>
    </div>
  );
}

export default async function MeditationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isFinite(numId) || numId <= 0) notFound();

  const [meditation, neighbors, recent, parish] = await Promise.all([
    getMeditation(numId),
    getNeighbors(numId),
    getRecent(numId),
    fetchParishMin(),
  ]);
  if (!meditation) notFound();

  return (
    <>
      <PageHead currentId={numId} />
      <SectionLayout group="word">
        <div className="med-layout">
          <MeditationArticle
            meditation={meditation}
            parishName={parish.name}
            prev={neighbors.prev}
            next={neighbors.next}
          />
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
                        <span className="info">
                          <b>{fmt(r.published_date)}</b>
                          {r.scripture ? ` · ${r.scripture}` : ""}
                        </span>
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
