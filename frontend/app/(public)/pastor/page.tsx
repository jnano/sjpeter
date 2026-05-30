import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";
import CrossIcon from "@/components/icons/CrossIcon";
import { fetchParishMin } from "@/lib/parish";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const p = await fetchParishMin();
  return { title: "주임신부님", description: `${p.name} 현재 사목자 — 주임신부, 보좌신부, 수녀, 사무장` };
}

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Staff {
  id: number;
  role: string;
  name: string;
  title: string | null;          // 본명/세례명
  feast_day: string | null;
  photo_url: string | null;
  introduction: string | null;
  career_items: string | null;
  scripture_quote: string | null;
  scripture_reference: string | null;
}

async function getStaff(): Promise<Staff[]> {
  try {
    const res = await fetch(`${API}/api/parish-staff/`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

function resolvePhoto(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${API}${url}`;
}

// career_items 한 줄을 "year(연도/기간) + desc(설명)" 로 가르려 시도.
// 매칭 실패하면 전체를 desc 로 두고 year 칸 비움. — 시안 timeline-list 톤 호환.
function parseCareerLine(line: string): { year: string; desc: string } {
  // 1) "2024.03 — 설명" / "2024.03 - 설명" / "2024.03 설명"
  const m1 = line.match(/^\s*(\d{4}(?:[.\-/]\d{1,2})?(?:\s*[–—-]\s*\d{4}(?:[.\-/]\d{1,2})?)?)\s*[–—:·\-]?\s*(.*)$/);
  if (m1 && m1[1] && m1[2]) {
    return { year: m1[1].trim(), desc: m1[2].trim() };
  }
  return { year: "", desc: line };
}

export default async function PastorPage() {
  const all = await getStaff();

  return (
    <>
      <PageHeader group="성당 소개" title="주임신부님" subtitle="본당의 영성을 이끄시는 사목자" />
      <SectionLayout group="about" tools>
        {all.length === 0 ? (
          <div className="text-center py-16 border border-[var(--color-border)] rounded-xl text-[var(--color-text-muted)]">
            <p className="text-3xl mb-2"><CrossIcon /></p>
            <p className="text-sm">아직 등록된 사목자가 없습니다.</p>
            <p className="text-xs mt-1">관리자 페이지에서 등록할 수 있습니다.</p>
          </div>
        ) : (
          <div className="space-y-14">
            {all.map((staff) => (
              <PriestBlock key={staff.id} staff={staff} />
            ))}
          </div>
        )}
      </SectionLayout>
    </>
  );
}

/* ───────── 시안 priest.html — hero + timeline ───────── */
function PriestBlock({ staff }: { staff: Staff }) {
  const photo = resolvePhoto(staff.photo_url);
  const careerLines = (staff.career_items ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map(parseCareerLine);

  const isPriest = staff.role.includes("신부");

  return (
    <article className="ps-priest">
      {/* HERO — 320 portrait + info, bg-2 surface, ✠ decoration */}
      <section
        className="relative overflow-hidden rounded-3xl bg-[var(--color-surface-warm)] p-6 md:p-9 mb-10 grid grid-cols-1 md:grid-cols-[clamp(220px,30%,320px)_1fr] gap-6 md:gap-10 items-center"
      >
        <div
          aria-hidden
          className="hidden sm:block absolute right-8 -top-8 text-[120px] md:text-[160px] leading-none pointer-events-none select-none font-serif"
          style={{ color: "rgba(122,31,43,0.06)" }}
        >
          ✠
        </div>

        {/* Portrait */}
        <div className="w-full max-w-[320px] mx-auto md:mx-0 aspect-[4/5] rounded-2xl bg-white border border-[var(--color-border)] overflow-hidden relative">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt={staff.name} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-5xl text-[var(--color-border-dark)]">
              <CrossIcon />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="relative">
          {/* v1.5.430 — wine role-pill·본명 알약 원복: 와인 라인 + uppercase eyebrow + 평문 본명 */}
          <span className="inline-flex items-center gap-2.5 text-[11px] tracking-[0.18em] text-[var(--color-primary)] uppercase font-bold mb-3">
            <span aria-hidden className="w-5 h-px bg-[var(--color-primary)]" />
            {isPriest && <span aria-hidden>✠</span>}
            {staff.role}
          </span>

          {/* Name + baptismal (평문) */}
          <h2 className="text-[28px] md:text-[40px] font-bold tracking-[-0.03em] leading-[1.1] mb-3 text-[var(--color-text)]">
            {staff.name}
            {staff.title && (
              <span className="font-medium text-[14px] md:text-base text-[var(--color-text-muted)] ml-2 tracking-tight align-middle">
                {staff.title}
              </span>
            )}
          </h2>

          {/* Meta row */}
          {staff.feast_day && (
            <div className="flex flex-wrap gap-4 items-center text-[13px] text-[var(--color-text-muted)] py-3 border-y border-[var(--color-border)] mb-5">
              <span>
                축일 <b className="text-[var(--color-text)] font-bold">{staff.feast_day}</b>
              </span>
            </div>
          )}

          {/* Quote */}
          {staff.scripture_quote && (
            <p className="text-[14px] md:text-base leading-[1.7] text-[var(--color-text)] font-medium max-w-[520px] tracking-tight">
              <em
                className="not-italic font-bold"
                style={{ color: "var(--color-primary)" }}
              >
                {"“"}
              </em>
              {staff.scripture_quote}
              <em
                className="not-italic font-bold"
                style={{ color: "var(--color-primary)" }}
              >
                {"”"}
              </em>
            </p>
          )}
          {staff.scripture_reference && (
            <p className="mt-2 text-[11px] font-bold tracking-wider uppercase text-[var(--color-text-muted)]">
              — {staff.scripture_reference}
            </p>
          )}
        </div>
      </section>

      {/* Greeting / Introduction body — letter-body 톤 (drop-cap) */}
      {staff.introduction && (
        <section className="mb-14">
          <div className="mb-6">
            <div
              className="text-[11px] tracking-[0.18em] uppercase font-bold inline-flex items-center gap-3 mb-3"
              style={{ color: "var(--color-primary)" }}
            >
              <span className="w-6 h-px" style={{ background: "var(--color-primary)" }} />
              인사말 · Greeting
            </div>
            <h3 className="text-[22px] md:text-[28px] font-bold tracking-[-0.025em] text-[var(--color-text)]">
              여러분께 드리는 글
            </h3>
          </div>
          <div
            className="text-[14px] md:text-base leading-[1.85] text-[var(--color-text)] tracking-tight whitespace-pre-line ps-letter-body"
          >
            {staff.introduction}
          </div>
        </section>
      )}

      {/* Timeline — 이력 */}
      {careerLines.length > 0 && (
        <section className="mb-6">
          <div className="mb-6">
            <div
              className="text-[11px] tracking-[0.18em] uppercase font-bold inline-flex items-center gap-3 mb-3"
              style={{ color: "var(--color-primary)" }}
            >
              <span className="w-6 h-px" style={{ background: "var(--color-primary)" }} />
              이력 · Ministry
            </div>
            <h3 className="text-[22px] md:text-[28px] font-bold tracking-[-0.025em] text-[var(--color-text)]">
              걸어오신 길
            </h3>
          </div>
          <div className="bg-white border border-[var(--color-border)] rounded-2xl px-5 md:px-8 py-1">
            {careerLines.map((row, i) => (
              <div
                key={i}
                className="grid grid-cols-[88px_1fr] md:grid-cols-[100px_1fr] gap-4 md:gap-8 py-4 md:py-[22px] border-b border-[var(--color-border)] last:border-b-0 items-baseline"
              >
                <span
                  className="text-[15px] md:text-[18px] font-bold tracking-[-0.02em] tabular-nums"
                  style={{ color: "var(--color-primary)" }}
                >
                  {row.year || "·"}
                </span>
                <span className="text-[13px] md:text-[15px] text-[var(--color-text)] leading-relaxed">
                  {row.desc}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
