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
  title: string | null;
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
    if (!res.ok) {
      console.error("[pastor] staff fetch failed:", res.status);
      return [];
    }
    return res.json();
  } catch (e) {
    console.error("[pastor] staff fetch error:", e);
    return [];
  }
}

function resolvePhoto(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${API}${url}`;
}

export default async function PastorPage() {
  const all = await getStaff();

  return (
    <>
      <PageHeader group="성당 소개" title="주임신부님" subtitle="본당의 영성을 이끄시는 사목자" />
      <SectionLayout group="about">
        {all.length === 0 ? (
          <div className="text-center py-16 border border-[var(--color-border)] rounded-xl text-[var(--color-text-muted)]">
            <p className="text-3xl mb-2"><CrossIcon /></p>
            <p className="text-sm">아직 등록된 사목자가 없습니다.</p>
            <p className="text-xs mt-1">관리자 페이지에서 등록할 수 있습니다.</p>
          </div>
        ) : (
          <div className="relative">
            {all.map((staff, idx) => (
              <StoryRow
                key={staff.id}
                staff={staff}
                reversed={idx % 2 === 1}
                isLast={idx === all.length - 1}
                isPriest={staff.role === "주임신부" || staff.role === "보좌신부"}
              />
            ))}
          </div>
        )}
      </SectionLayout>
    </>
  );
}

function StoryRow({
  staff,
  reversed,
  isLast,
  isPriest,
}: {
  staff: Staff;
  reversed: boolean;
  isLast: boolean;
  isPriest: boolean;
}) {
  const photo = resolvePhoto(staff.photo_url);
  const careerLines = (staff.career_items ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <section className="relative">
      <div
        className={`flex flex-col gap-5 md:gap-10 items-start ${
          reversed ? "md:flex-row-reverse" : "md:flex-row"
        }`}
      >
        {/* 사진 */}
        <div className="w-full md:w-auto md:shrink-0 flex justify-center md:block">
          <div
            className={`relative bg-[var(--color-surface-warm)] rounded-lg overflow-hidden ${
              isPriest ? "w-44 h-56 md:w-56 md:h-72" : "w-36 h-44 md:w-44 md:h-56"
            }`}
          >
            {photo ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={photo}
                alt={staff.name}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-5xl text-[var(--color-border-dark)]">
                <CrossIcon />
              </div>
            )}
          </div>
        </div>

        {/* 본문 */}
        <div className="flex-1 min-w-0 w-full">
          <p className="text-[11px] tracking-[0.15em] text-[var(--color-text-muted)] uppercase mb-1">
            {staff.role}
          </p>
          <h2 className="font-serif text-xl md:text-2xl font-bold text-[var(--color-primary)]">
            {staff.name}
            {staff.title && (
              <span className="font-normal text-sm md:text-base text-[var(--color-text-muted)] ml-2">
                {staff.title}
              </span>
            )}
          </h2>
          {staff.feast_day && (
            <p className="text-xs text-[var(--color-text-muted)] mt-1">· 축일 {staff.feast_day}</p>
          )}

          {staff.introduction && (
            <p className="mt-4 text-sm leading-relaxed text-[var(--color-text)] whitespace-pre-line">
              {staff.introduction}
            </p>
          )}

          {careerLines.length > 0 && (
            <ul className="mt-4 list-disc pl-5 space-y-1 text-[13px] text-[var(--color-text-muted)]">
              {careerLines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}

          {(staff.scripture_quote || staff.scripture_reference) && (
            <blockquote className="mt-5 pl-4 border-l-2 border-[var(--color-primary)]/40 italic text-sm text-[var(--color-text)]">
              {staff.scripture_quote && <p>{`"${staff.scripture_quote}"`}</p>}
              {staff.scripture_reference && (
                <p className="text-xs text-[var(--color-text-muted)] mt-1 not-italic">
                  — {staff.scripture_reference}
                </p>
              )}
            </blockquote>
          )}
        </div>
      </div>

      {/* 행 사이 구분 장식 (마지막 행은 생략) */}
      {!isLast && (
        <div className="flex justify-center my-10 md:my-14" aria-hidden="true">
          <span className="text-[var(--color-border-dark)] text-base tracking-[0.6em]">
            ✦ ✦ ✦
          </span>
        </div>
      )}
    </section>
  );
}
