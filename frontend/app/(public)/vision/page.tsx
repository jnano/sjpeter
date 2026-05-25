import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";
import MarkdownContent from "@/components/MarkdownContent";
import { fetchParishMin } from "@/lib/parish";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const p = await fetchParishMin();
  return { title: "사목 지표", description: `${p.name} 역대 본당 사목지표` };
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

/** 본문 → '## 제목' 섹션(번호 카드) + 끝의 '>' 인용(맺음 성구) 분리. 섹션이 없으면 raw 그대로. */
function parseVisionBody(body: string): {
  items: { title: string; text: string }[];
  verse: { text: string; cite: string | null } | null;
  raw: string;
} {
  // 래핑 raw HTML(span/div) 제거 후 정규화
  let src = (body || "").replace(/\r/g, "").replace(/<\/?(?:span|div|p)[^>]*>/gi, "").trim();
  let main = src;
  let verse: { text: string; cite: string | null } | null = null;

  // 끝의 연속된 '>' 인용 블록 → 맺음 성구
  const m = src.match(/(?:^>.*$\n?)+\s*$/m);
  if (m) {
    const qlines = m[0].split("\n").map((l) => l.replace(/^>\s?/, "").trim()).filter(Boolean);
    const cite = qlines.find((l) => /^[—–-]/.test(l)) ?? null;
    const text = qlines.filter((l) => !/^[—–-]/.test(l)).join("\n");
    if (text) verse = { text, cite: cite ? cite.replace(/^[—–-]\s*/, "") : null };
    main = src.slice(0, m.index).trim();
  }

  // ##~#### 제목(앞에 'N.' 번호 접두 허용) → 번호 카드
  const headingRe = /^#{2,4}\s+/m;
  const items: { title: string; text: string }[] = [];
  if (headingRe.test(main)) {
    for (const part of main.split(/^#{2,4}\s+/m).map((s) => s.trim()).filter(Boolean)) {
      const nl = part.indexOf("\n");
      let title = (nl === -1 ? part : part.slice(0, nl)).trim().replace(/^\d+[.)]\s*/, "");
      const text = (nl === -1 ? "" : part.slice(nl + 1)).trim().replace(/\n{2,}/g, "\n\n");
      if (title) items.push({ title, text });
    }
  }
  return { items, verse, raw: main };
}

export default async function VisionPage() {
  const [rawVisions, pastorName] = await Promise.all([getVisions(), getPastorName()]);
  const visions = [...rawVisions].sort((a, b) => b.year - a.year || b.id - a.id);
  const current = visions[0];
  const parsed = current?.body ? parseVisionBody(current.body) : null;
  const priestInitial = (pastorName ?? "신").trim().charAt(0) || "신";

  return (
    <>
      <PageHeader group="본당 공동체" title="사목 지표" subtitle="매년 주임신부님이 제시하는 한 해의 씨앗" />
      <SectionLayout group="community" tools>
        {!current ? (
          <div className="text-center py-20 text-[var(--color-text-muted)]">아직 등록된 사목지표가 없습니다.</div>
        ) : (
          <>
            {/* statement hero */}
            <section className="vz-hero">
              <div className="year">{current.year}년 · 본당 사목지표</div>
              <h2><span className="q">“</span>{current.motto}<span className="q">”</span></h2>
              {pastorName && (
                <div className="priest"><span className="av">{priestInitial}</span><span>주임신부 {pastorName}</span></div>
              )}
            </section>

            {/* numbered points or fallback */}
            {parsed && parsed.items.length > 0 ? (
              <section className="vz-body">
                {parsed.items.map((it, i) => (
                  <article className="vz-item" key={i}>
                    <div className="num">{String(i + 1).padStart(2, "0")}</div>
                    <div className="content">
                      <h3>{it.title}</h3>
                      {it.text && <p>{it.text}</p>}
                    </div>
                  </article>
                ))}
              </section>
            ) : (
              parsed?.raw && (
                <article className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 sm:p-8 mb-14">
                  <MarkdownContent content={parsed.raw} />
                </article>
              )
            )}

            {/* closing verse */}
            {parsed?.verse && (
              <div className="vz-verse">
                <div className="sym">✠</div>
                <p>{parsed.verse.text.split("\n").map((l, i) => (<span key={i}>{l}{i < parsed.verse!.text.split("\n").length - 1 && <br />}</span>))}</p>
                {parsed.verse.cite && <cite>— {parsed.verse.cite}</cite>}
              </div>
            )}
          </>
        )}

        {/* archive */}
        {visions.length > 0 && (
          <section>
            <div className="vz-arch-head">
              <h3><small>역대 본당 사목지표</small>한 해 한 해의 씨앗</h3>
            </div>
            <div>
              {visions.map((v) => {
                const isLatest = v.id === current?.id;
                return (
                  <Link key={v.id} href={`/vision/${v.id}`} className={`vz-row ${isLatest ? "this" : ""}`}>
                    <span className="y">{v.year}</span>
                    <div>
                      <div className="ttl">“{v.motto}”</div>
                      {isLatest && pastorName && <div className="priest-small">주임신부 {pastorName}</div>}
                    </div>
                    {isLatest && <span className="badge">올해</span>}
                  </Link>
                );
              })}
            </div>
            <p className="vz-note">지표는 씨앗이고, <em>한 해의 기록은 그 씨앗이 자란 나무</em>입니다.</p>
          </section>
        )}
      </SectionLayout>
    </>
  );
}
