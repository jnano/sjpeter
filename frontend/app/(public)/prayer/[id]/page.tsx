import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";
import { fetchParishMin } from "@/lib/parish";
import { prayerCategoryLabel } from "@/lib/prayer";
import PrayerActionBar from "./PrayerActionBar";

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface PrayerOut {
  id: number;
  title: string;
  category: string;
  scripture: string | null;
  body: string;
  author: string | null;
}
interface NeighborItem { id: number; title: string; }
interface NeighborsOut { prev: NeighborItem | null; next: NeighborItem | null; }
interface RelatedItem { id: number; title: string; scripture: string | null; }

async function getPrayer(id: number): Promise<PrayerOut | null> {
  try {
    const res = await fetch(`${API}/api/content/prayers/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}
async function getNeighbors(id: number): Promise<NeighborsOut> {
  try {
    const res = await fetch(`${API}/api/content/prayers/${id}/neighbors`, { cache: "no-store" });
    if (!res.ok) return { prev: null, next: null };
    return res.json();
  } catch { return { prev: null, next: null }; }
}
async function getRelated(category: string): Promise<RelatedItem[]> {
  if (!category) return [];
  try {
    const res = await fetch(`${API}/api/content/prayers?category=${encodeURIComponent(category)}&limit=12`, { cache: "no-store" });
    if (!res.ok) return [];
    const d = await res.json();
    return ((d.items ?? []) as RelatedItem[]).slice(0, 6);
  } catch { return []; }
}

function excerpt(body: string, len = 120) {
  const clean = (body || "").replace(/\n+/g, " ").trim();
  return clean.length > len ? clean.slice(0, len) + "…" : clean;
}

/** 본문 → 빈 줄 단위 단락(번호 stanza). 끝의 짧은 '아멘' 줄은 amen 으로 분리. */
function parseBody(body: string): { stanzas: string[][]; amen: string | null; plain: boolean } {
  const blocks = (body || "").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  let amen: string | null = null;
  if (blocks.length && /아멘/.test(blocks[blocks.length - 1]) && blocks[blocks.length - 1].length < 80) {
    amen = blocks.pop() ?? null;
  }
  const plain = blocks.length <= 1;
  const stanzas = blocks.map((b) => b.split(/\n/).map((l) => l.trim()).filter(Boolean));
  return { stanzas, amen, plain };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isFinite(numId) || numId <= 0) return { title: "기도문" };
  const [p, m] = await Promise.all([fetchParishMin(), getPrayer(numId)]);
  if (!m) return { title: "기도문", description: `${p.name} 기도문` };
  const description = excerpt(m.body, 120);
  return {
    title: `${m.title} — 기도문`,
    description,
    openGraph: { title: m.title, description, type: "article", authors: m.author ? [m.author] : undefined, siteName: p.name },
  };
}

export default async function PrayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isFinite(numId) || numId <= 0) notFound();

  const prayer = await getPrayer(numId);
  if (!prayer) notFound();
  const [neighbors, related] = await Promise.all([getNeighbors(numId), getRelated(prayer.category)]);

  const catLabel = prayerCategoryLabel(prayer.category) || "기도";
  const { stanzas, amen, plain } = parseBody(prayer.body);

  return (
    <>
      <PageHeader group="말씀과 기도" title="기도문" subtitle={catLabel} />
      <SectionLayout group="word">
        <article className="pr-root" data-pcat={prayer.category}>
          <Link href="/prayer" className="pr-back">
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6"><polyline points="7 3 4 6 7 9" /></svg>
            기도문 목록
          </Link>

          {/* hero */}
          <div className="pr-hero">
            <span className="pr-catpill"><span className="dot" />{catLabel}</span>
            <h1 className="pr-title">{prayer.title}</h1>
            <div className="pr-metarow">
              {prayer.scripture ? (
                <div className="pr-scref">
                  <span className="label">기반 성서</span>
                  <span className="ref">{prayer.scripture}</span>
                  {prayer.author && <span className="text-[var(--color-text-muted)] font-medium">· {prayer.author}</span>}
                </div>
              ) : prayer.author ? (
                <div className="pr-scref"><span className="label">필자</span><span className="text-[var(--color-text)] font-medium">{prayer.author}</span></div>
              ) : <span />}
              <PrayerActionBar prayerId={prayer.id} title={prayer.title} bodyText={prayer.body} />
            </div>
          </div>

          {/* body */}
          <div className="pr-body">
            {plain ? (
              <div className="plain">{stanzas[0]?.map((l, i) => <p key={i}>{l}</p>)}</div>
            ) : (
              stanzas.map((lines, i) => (
                <div className="stanza" key={i}>
                  <span className="n">{String(i + 1).padStart(2, "0")}</span>
                  <div className="lines">{lines.map((l, j) => <p key={j}>{l}</p>)}</div>
                </div>
              ))
            )}
            {amen && <p className="amen">{amen}</p>}
          </div>

          {/* 같은 카테고리 */}
          {related.length > 1 && (
            <section className="pr-related">
              <div className="head">
                <h3><small>같은 카테고리 · {catLabel}</small>이 기도와 함께</h3>
                <Link href={`/prayer`} className="more">전체 보기 →</Link>
              </div>
              <ol>
                {related.map((r, i) => (
                  <li className="item" key={r.id}>
                    <span className="n">{String(i + 1).padStart(2, "0")}</span>
                    {r.id === prayer.id
                      ? <span className="title current">{r.title}</span>
                      : <Link href={`/prayer/${r.id}`} className="title">{r.title}</Link>}
                    {r.scripture && <span className="ref-small">{r.scripture}</span>}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* prev / next */}
          <nav className="pr-pn">
            {neighbors.prev ? (
              <Link href={`/prayer/${neighbors.prev.id}`} className="card">
                <span className="arrow"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="3" y1="8" x2="13" y2="8" /><polyline points="7 4 3 8 7 12" /></svg></span>
                <div className="info"><div className="lbl">이전 기도</div><h5>{neighbors.prev.title}</h5></div>
              </Link>
            ) : (
              <Link href="/prayer" className="card">
                <span className="arrow"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="3" y1="8" x2="13" y2="8" /><polyline points="7 4 3 8 7 12" /></svg></span>
                <div className="info"><div className="lbl">목록</div><h5>기도문 전체 목록으로</h5></div>
              </Link>
            )}
            {neighbors.next ? (
              <Link href={`/prayer/${neighbors.next.id}`} className="card next">
                <span className="arrow"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="3" y1="8" x2="13" y2="8" /><polyline points="9 4 13 8 9 12" /></svg></span>
                <div className="info"><div className="lbl">다음 기도</div><h5>{neighbors.next.title}</h5></div>
              </Link>
            ) : <span />}
          </nav>
        </article>
      </SectionLayout>
    </>
  );
}
