import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";
import CrossIcon from "@/components/icons/CrossIcon";
import { fetchParishMin } from "@/lib/parish";

// v1.5.452 — force-dynamic → 5분 ISR + 태그 기반 무효화. admin 저장 시 revalidateTag 로 즉시 반영.
export const revalidate = 300;

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Parish {
  name: string;
  patron_name: string | null;
  patron_feast_day: string | null;
  patron_intro: string | null;
  patron_quote: string | null;
  patron_quote_ref: string | null;
  patron_image_url: string | null;
}

async function getParish(): Promise<Parish | null> {
  try {
    const res = await fetch(`${API}/api/parish/`, { next: { revalidate: 300, tags: ["parish"] } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const [p, parish] = await Promise.all([fetchParishMin(), getParish()]);
  const title = parish?.patron_name ? `수호 성인 — ${parish.patron_name}` : "수호 성인";
  return {
    title,
    description: parish?.patron_quote
      ? parish.patron_quote.replace(/\s+/g, " ").slice(0, 120)
      : `${p.name}이 모시는 수호 성인`,
  };
}

/** 축일 문자열에서 "6월 29일" → { d: '29', m: '6월' } 분리 (시안 .date-block). */
function parseFeastDate(s: string | null | undefined): { d: string; m: string } | null {
  if (!s) return null;
  const m = s.match(/(\d+)\s*월\s*(\d+)\s*일/);
  if (m) return { m: `${m[1]}월`, d: m[2] };
  return null;
}

export default async function PatronPage() {
  const parish = await getParish();
  const parishMin = await fetchParishMin();

  // 데이터가 비어있는 경우 안내
  if (!parish?.patron_name) {
    return (
      <>
        <PageHeader group="성당 소개" title="수호 성인" subtitle={`${parishMin.name}이 모시는 수호 성인`} />
        <SectionLayout group="about" tools>
          <div className="bg-white border border-[var(--color-border)] rounded-2xl p-12 text-center">
            <p className="text-5xl mb-3 inline-block text-[var(--color-accent)]"><CrossIcon /></p>
            <p className="font-semibold text-[var(--color-primary)] mb-2">수호 성인 정보가 아직 등록되지 않았습니다</p>
            <p className="text-sm text-[var(--color-text-muted)]">
              관리자 페이지 <code className="px-1 py-0.5 bg-[var(--color-surface-warm)] rounded">/admin/parish/patron</code> 에서 입력하실 수 있습니다.
            </p>
          </div>
        </SectionLayout>
      </>
    );
  }

  const imageUrl = parish.patron_image_url
    ? (parish.patron_image_url.startsWith("http") ? parish.patron_image_url : `${API}${parish.patron_image_url}`)
    : null;
  const feast = parseFeastDate(parish.patron_feast_day);
  const introParagraphs = (parish.patron_intro ?? "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const quoteLines = (parish.patron_quote ?? "").split("\n").map((l) => l.trim()).filter(Boolean);

  return (
    <>
      <PageHeader group="성당 소개" title="수호 성인" subtitle={parish.patron_name} />
      <SectionLayout group="about" tools>

        {/* ── saint-hero ─────────────────────────────────── */}
        <section className="bg-[var(--color-surface-warm)] rounded-3xl p-7 sm:p-10 mb-10 grid lg:grid-cols-[200px_1fr] gap-7 lg:gap-10 items-center">
          {/* 좌측 아이콘 또는 사진 */}
          <div className="mx-auto w-40 h-40 sm:w-48 sm:h-48 lg:w-[200px] lg:h-[200px] rounded-2xl bg-white border border-[var(--color-border)] flex items-center justify-center overflow-hidden">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt={parish.patron_name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-7xl text-[var(--color-primary)]" aria-hidden>✠</span>
            )}
          </div>

          {/* 우측 정보 */}
          <div className="min-w-0">
            <span className="inline-flex items-center gap-3 text-[11px] tracking-[0.2em] uppercase text-[var(--color-primary)] font-bold mb-4">
              <span className="w-6 h-px bg-[var(--color-primary)]" />
              수호 성인 · Patron Saint
            </span>
            {quoteLines.length > 0 && (
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight leading-snug text-balance text-[var(--color-text)] mb-2">
                {quoteLines.map((line, i) => (
                  <span key={i} className="block">
                    {i === 0 ? <em className="not-italic" style={{ color: "var(--color-primary)" }}>{line}</em> : line}
                  </span>
                ))}
              </h2>
            )}
            {parish.patron_quote_ref && (
              <p className="text-[12px] font-bold tracking-wider uppercase text-[var(--color-text-muted)]">
                — {parish.patron_quote_ref}
              </p>
            )}

            {/* quick — 본명·축일 등 */}
            <dl className="mt-6 grid grid-cols-2 gap-4 text-[13px]">
              <div>
                <dt className="text-[10px] tracking-[0.14em] uppercase font-bold text-[var(--color-text-muted)] mb-1">본명</dt>
                <dd className="font-semibold text-[var(--color-text)]">{parish.patron_name}</dd>
              </div>
              {parish.patron_feast_day && (
                <div>
                  <dt className="text-[10px] tracking-[0.14em] uppercase font-bold text-[var(--color-text-muted)] mb-1">축일</dt>
                  <dd className="font-semibold text-[var(--color-text)]">{parish.patron_feast_day}</dd>
                </div>
              )}
            </dl>
          </div>
        </section>

        {/* ── intro ──────────────────────────────────────── */}
        {introParagraphs.length > 0 && (
          <section className="mb-10">
            <h3 className="text-[13px] tracking-[0.12em] uppercase font-bold text-[var(--color-primary)] mb-4">생애와 신앙</h3>
            <article className="bg-white border border-[var(--color-border)] rounded-2xl p-7 sm:p-10 reading-zoom">
              {introParagraphs.map((p, i) => (
                <p key={i} className="text-[15px] sm:text-[16px] leading-[1.85] text-[var(--color-text)] mb-4 last:mb-0 whitespace-pre-line">
                  {p}
                </p>
              ))}
            </article>
          </section>
        )}

        {/* ── feast card ─────────────────────────────────── */}
        {parish.patron_feast_day && (
          <section>
            <h3 className="text-[13px] tracking-[0.12em] uppercase font-bold text-[var(--color-primary)] mb-4">기념 축일</h3>
            <div className="bg-[var(--color-primary)] text-white rounded-2xl p-6 sm:p-7 grid grid-cols-[80px_1fr] sm:grid-cols-[100px_1fr] gap-5 sm:gap-7 items-center">
              <div
                className="text-center py-3 px-2 rounded-xl"
                style={{ background: "rgba(255,255,255,0.1)" }}
              >
                {feast ? (
                  <>
                    <div className="text-3xl sm:text-4xl font-bold tabular-nums leading-none" style={{ color: "var(--color-accent, #C9A961)" }}>
                      {feast.d}
                    </div>
                    <div className="text-[11px] font-bold mt-1.5 text-white/70">{feast.m}</div>
                  </>
                ) : (
                  <div className="text-[13px] font-bold text-white/90 leading-tight py-2">{parish.patron_feast_day}</div>
                )}
              </div>
              <div className="min-w-0">
                <h4 className="text-base sm:text-lg font-bold tracking-tight mb-1">{parish.patron_name} 축일</h4>
                <p className="text-[13px] text-white/70 leading-relaxed">
                  {parishMin.name}이 본당의 이름과 함께 한 해 가장 큰 축제로 지내는 날입니다.
                </p>
              </div>
            </div>
          </section>
        )}
      </SectionLayout>
    </>
  );
}
