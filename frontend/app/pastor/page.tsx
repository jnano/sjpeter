import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "주임신부님",
  description: "세종성베드로성당 본당 가족 — 주임신부, 보좌신부, 수녀, 사무장",
};

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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
  const priests = all.filter((s) => s.role === "주임신부" || s.role === "보좌신부");
  const others = all.filter((s) => s.role !== "주임신부" && s.role !== "보좌신부");

  return (
    <>
      <PageHeader group="성당 소개" title="주임신부님" subtitle="주임 신부님과 함께하는 본당 공동체" />
      <SectionLayout group="about">
        <h1 className="font-serif text-2xl font-bold text-[var(--color-primary)] mb-5 pb-3 border-b border-[var(--color-border)]">
          본당 가족
        </h1>

        {all.length === 0 && (
          <div className="text-center py-16 border border-[var(--color-border)] rounded-xl text-[var(--color-text-muted)]">
            <p className="text-3xl mb-2">✝</p>
            <p className="text-sm">아직 등록된 본당 가족 정보가 없습니다.</p>
            <p className="text-xs mt-1">관리자 페이지에서 등록할 수 있습니다.</p>
          </div>
        )}

        {priests.map((p) => (
          <PriestCard key={p.id} staff={p} />
        ))}

        {others.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            {others.map((o) => (
              <CompactCard key={o.id} staff={o} />
            ))}
          </div>
        )}
      </SectionLayout>
    </>
  );
}

function PriestCard({ staff }: { staff: Staff }) {
  const photo = resolvePhoto(staff.photo_url);
  const careerLines = (staff.career_items ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <article className="bg-white border border-[var(--color-border)] rounded-xl p-6 sm:p-7 mb-5">
      <div className="flex flex-col sm:flex-row gap-6">
        {/* 좌: 사진 + 이름 + 직함 + 축일 */}
        <div className="sm:w-44 shrink-0 text-center">
          <div className="relative w-32 h-40 sm:w-36 sm:h-44 mx-auto bg-[var(--color-surface-warm)] rounded overflow-hidden">
            {photo ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={photo} alt={staff.name} className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-4xl text-[var(--color-border-dark)]">
                ✝
              </div>
            )}
          </div>
          <p className="mt-2.5 font-serif font-bold text-sm text-[var(--color-text)]">
            {staff.name}
            {staff.title && (
              <span className="font-normal text-[var(--color-text-muted)]"> {staff.title}</span>
            )}
          </p>
          {staff.feast_day && (
            <p className="text-[11px] text-[var(--color-text-muted)] mt-1">· 축일 : {staff.feast_day}</p>
          )}
        </div>

        {/* 우: 소개 + 약력 */}
        <div className="flex-1 text-sm leading-relaxed">
          {staff.introduction && (
            <p className="text-[var(--color-text)] whitespace-pre-line mb-4">{staff.introduction}</p>
          )}
          {careerLines.length > 0 && (
            <ul className="list-disc pl-5 space-y-1 text-[var(--color-text-muted)] text-[13px]">
              {careerLines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 하단 인용구 */}
      {(staff.scripture_quote || staff.scripture_reference) && (
        <div className="mt-6 pt-5 border-t border-dashed border-[var(--color-border)] text-center text-sm">
          {staff.scripture_quote && (
            <p className="text-[var(--color-text)]">{staff.scripture_quote}</p>
          )}
          {staff.scripture_reference && (
            <p className="text-[var(--color-text-muted)] mt-0.5">{staff.scripture_reference}</p>
          )}
        </div>
      )}
    </article>
  );
}

function CompactCard({ staff }: { staff: Staff }) {
  const photo = resolvePhoto(staff.photo_url);
  return (
    <article className="bg-white border border-[var(--color-border)] rounded-xl p-4 flex items-start gap-4">
      <div className="relative w-20 h-24 shrink-0 bg-[var(--color-surface-warm)] rounded overflow-hidden">
        {photo ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={photo} alt={staff.name} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-2xl text-[var(--color-border-dark)]">
            ✝
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-serif font-bold text-sm text-[var(--color-text)]">
          {staff.name}
          {staff.title && (
            <span className="font-normal text-[var(--color-text-muted)]"> {staff.title}</span>
          )}
        </p>
        {staff.introduction && (
          <p className="text-xs text-[var(--color-text-muted)] mt-1 line-clamp-2">{staff.introduction}</p>
        )}
        {staff.feast_day && (
          <p className="text-xs text-[var(--color-text-muted)] mt-2">· 축일 : {staff.feast_day}</p>
        )}
      </div>
    </article>
  );
}
