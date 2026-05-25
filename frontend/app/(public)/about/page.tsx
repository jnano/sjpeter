import type { Metadata } from "next";
import Image from "next/image";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";
import BannerSlider from "@/components/BannerSlider";
import { fetchParishMin } from "@/lib/parish";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const p = await fetchParishMin();
  return { title: "성당 안내", description: `${p.name} 소개 — 세종시 최초 본당` };
}

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL;

const GOLD = "#B8933C";

interface MassEntry {
  day: string;
  time: string;
  note: string;
}

interface MassSchedule {
  entries: MassEntry[];
  note: string;
}

interface ParishOut {
  name: string;
  diocese: string | null;
  address: string | null;
  phone: string | null;
  fax: string | null;
  cafe_url: string | null;
  band_url: string | null;
  description: string | null;
  member_count: number | null;
  founded_at: string | null;
  about_photo_url: string | null;
  mass_schedule: MassSchedule | null;
}

const DAY_ORDER: Record<string, number> = {
  "주일": 0, "월요일": 1, "화요일": 2, "수요일": 3,
  "목요일": 4, "금요일": 5, "토요일": 6, "공휴일": 7,
};

const DAY_EN: Record<string, string> = {
  "주일": "Sunday", "월요일": "Monday", "화요일": "Tuesday",
  "수요일": "Wednesday", "목요일": "Thursday", "금요일": "Friday",
  "토요일": "Saturday", "공휴일": "Holiday",
};

async function getParish(): Promise<ParishOut | null> {
  try {
    const res = await fetch(`${API}/api/parish/`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function AboutPage() {
  const parish = await getParish();

  const entries = parish?.mass_schedule?.entries ?? [];
  const sortedEntries = [...entries].sort((a, b) => {
    const dayDiff = (DAY_ORDER[a.day] ?? 99) - (DAY_ORDER[b.day] ?? 99);
    return dayDiff !== 0 ? dayDiff : a.time.localeCompare(b.time);
  });

  const allDayOrder = ["주일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "공휴일"];
  const groupedDays = allDayOrder.filter((d) => sortedEntries.some((e) => e.day === d));
  const sundayEntries = sortedEntries.filter((e) => e.day === "주일");
  const weekdayDays = groupedDays.filter((d) => d !== "주일");

  const foundedYear = parish?.founded_at
    ? new Date(parish.founded_at).getFullYear() + "년"
    : null;

  const infoRows = [
    { label: "설립일", value: foundedYear },
    { label: "소속 교구", value: parish?.diocese ? `천주교 ${parish.diocese}` : null },
    { label: "주소", value: parish?.address },
    {
      label: "전화",
      value: parish?.phone
        ? parish.fax
          ? `${parish.phone} | (fax) ${parish.fax}`
          : parish.phone
        : null,
    },
    { label: "신자 수", value: parish?.member_count ? `약 ${parish.member_count.toLocaleString()}명` : null },
    { label: "카페", value: parish?.cafe_url ?? null, href: parish?.cafe_url ?? undefined },
    { label: "밴드", value: parish?.band_url ?? null, href: parish?.band_url ?? undefined },
  ].filter((r) => r.value);

  return (
    <>
      <PageHeader group="성당 소개" title="성당 소개" subtitle="세종시 첫 본당, 교회 공동체의 이야기" />
      <SectionLayout group="about" tools>

      <BannerSlider placement="about_top" className="mb-6" />

      {/* 상단 2단: 좌 40% 사진 / 우 60% 안내 */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8 items-stretch">
        {/* 사진 — 좌측 40% */}
        <div className="md:col-span-2 relative w-full aspect-[4/3] md:aspect-auto md:min-h-[280px] rounded-xl overflow-hidden">
          <Image
            src={parish?.about_photo_url ? `${API}${parish.about_photo_url}` : "/yakhoun.jpg"}
            alt={parish?.name ?? "본당 홈페이지"}
            fill
            className="object-cover"
            style={{ objectPosition: "center 30%" }}
            sizes="(max-width: 768px) 100vw, 40vw"
            priority
          />
        </div>

        {/* 안내 — 우측 60% */}
        <div className="md:col-span-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 sm:p-8">
          {infoRows.length > 0 ? (
            <>
              <h2 className="font-serif text-xl font-bold text-[var(--color-primary)] mb-4 flex items-center gap-2">
                <svg
                  viewBox="0 0 14 14"
                  role="img"
                  focusable="false"
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="#FFD0A1"
                  className="w-10 h-10"
                >
                  <g id="SVGRepo_bgCarrier" strokeWidth={0} />
                  <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round" />
                  <g id="SVGRepo_iconCarrier">
                    <path d="m 12.00625,2.6364725 -2.9125,0 c -1.0020833,0 -1.8729167,0.69375 -2.0916667,1.67291 C 6.78125,3.3302225 5.9125,2.6364725 4.9104167,2.6364725 L 2,2.6364725 c -0.5520833,0 -1,0.44791 -1,1 l 0,5.12083 c 0,0.55208 0.4479167,1 1,1 l 1.86875,0 c 2.1291667,0 2.7645833,0.5083305 3.06875,1.5625005 0.014583,0.0583 0.1083333,0.0583 0.125,0 0.30625,-1.05417 0.9416667,-1.5625005 3.06875,-1.5625005 l 1.86875,0 c 0.552083,0 1,-0.44792 1,-1 l 0,-5.11875 c 0,-0.55 -0.44375,-0.99792 -0.99375,-1.00208 z m -5.9645833,5.52916 c 0,0.0396 -0.03125,0.0729 -0.072917,0.0729 l -3.3395833,0 c -0.039583,0 -0.072917,-0.0312 -0.072917,-0.0729 l 0,-0.47708 c 0,-0.0396 0.03125,-0.0729 0.072917,-0.0729 l 3.3416666,0 c 0.039583,0 0.072917,0.0312 0.072917,0.0729 l 0,0.47708 z m 0,-1.26875 c 0,0.0396 -0.03125,0.0729 -0.072917,0.0729 l -3.3395833,0 c -0.039583,0 -0.072917,-0.0312 -0.072917,-0.0729 l 0,-0.47708 c 0,-0.0396 0.03125,-0.0729 0.072917,-0.0729 l 3.3416666,0 c 0.039583,0 0.072917,0.0312 0.072917,0.0729 l 0,0.47708 z m 0,-1.26875 c 0,0.0396 -0.03125,0.0729 -0.072917,0.0729 l -3.3395833,0 c -0.039583,0 -0.072917,-0.0312 -0.072917,-0.0729 l 0,-0.47708 c 0,-0.0396 0.03125,-0.0729 0.072917,-0.0729 l 3.3416666,0 c 0.039583,0 0.072917,0.0312 0.072917,0.0729 l 0,0.47708 z m 5.4020833,2.53542 c 0,0.0396 -0.03125,0.0729 -0.07292,0.0729 l -3.339583,0 c -0.039583,0 -0.072917,-0.0312 -0.072917,-0.0729 l 0,-0.47708 c 0,-0.0396 0.03125,-0.0729 0.072917,-0.0729 l 3.341667,0 c 0.03958,0 0.07292,0.0312 0.07292,0.0729 l 0,0.47708 z m 0,-1.26875 c 0,0.0396 -0.03125,0.0729 -0.07292,0.0729 l -3.339583,0 c -0.039583,0 -0.072917,-0.0312 -0.072917,-0.0729 l 0,-0.47708 c 0,-0.0396 0.03125,-0.0729 0.072917,-0.0729 l 3.341667,0 c 0.03958,0 0.07292,0.0312 0.07292,0.0729 l 0,0.47708 z m 0,-1.26875 c 0,0.0396 -0.03125,0.0729 -0.07292,0.0729 l -3.339583,0 c -0.039583,0 -0.072917,-0.0312 -0.072917,-0.0729 l 0,-0.475 c 0,-0.0396 0.03125,-0.0729 0.072917,-0.0729 l 3.341667,0 c 0.03958,0 0.07292,0.0312 0.07292,0.0729 l 0,0.475 z" />
                  </g>
                </svg>
                안내
              </h2>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-[var(--color-border)]">
                  {infoRows.map((row) => (
                    <tr key={row.label}>
                      <td className="py-3 pr-6 text-[var(--color-text-muted)] w-28">{row.label}</td>
                      <td className="py-3 font-medium">
                        {"href" in row && row.href ? (
                          <a
                            href={row.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[var(--color-primary)] hover:underline break-all"
                          >
                            {row.value}
                          </a>
                        ) : (
                          row.value
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">안내 정보가 없습니다.</p>
          )}
        </div>
      </div>

      {/* 본당 소개 (별도 카드) */}
      {parish?.description && (
        <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-8 mb-12">
          <h2 className="font-serif text-xl font-bold text-[var(--color-primary)] mb-3">본당 소개</h2>
          <p className="leading-relaxed text-[var(--color-text)] whitespace-pre-line">
            {parish.description}
          </p>
        </section>
      )}

      {/* 미사 시간표 */}
      <section>
        {/* 섹션 헤더 */}
        <p className="text-[10px] tracking-[0.3em] mb-1.5" style={{ color: GOLD }}>MASS SCHEDULE</p>
        <h2 className="font-serif text-xl font-bold text-[var(--color-primary)] mb-2 flex items-center gap-2">
          <svg
            viewBox="0 0 57.674 57.674"
            xmlns="http://www.w3.org/2000/svg"
            xmlSpace="preserve"
            fill="#000000"
            aria-hidden
            className="w-10 h-10"
          >
            <g id="SVGRepo_bgCarrier" strokeWidth={0} />
            <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round" />
            <g id="SVGRepo_iconCarrier">
              <path style={{ fill: "#FFD0A1" }} d="M33.317,39.442l-4.222,2.422l-2.436-4.292L22.337,40l2.436,4.292l-4.272,2.425l2.425,4.272 l4.272-2.425l4.774,8.41c0.377,0.664,1.221,0.897,1.885,0.52l1.901-1.079c0.666-0.378,0.898-1.226,0.517-1.89l-4.805-8.385 l4.272-2.425L33.317,39.442z" />
              <circle style={{ fill: "#FFD0A1" }} cx="24.337" cy="3" r="3" />
              <circle style={{ fill: "#FFD0A1" }} cx="33.337" cy="4" r="3" />
              <circle style={{ fill: "#FFD0A1" }} cx="42.337" cy="6" r="3" />
              <circle style={{ fill: "#FFD0A1" }} cx="47.337" cy="13" r="3" />
              <circle style={{ fill: "#FFD0A1" }} cx="44.337" cy="21" r="3" />
              <circle style={{ fill: "#FFD0A1" }} cx="37.337" cy="27" r="3" />
              <circle style={{ fill: "#FFD0A1" }} cx="30.337" cy="33" r="3" />
              <circle style={{ fill: "#FFD0A1" }} cx="16.337" cy="6" r="3" />
              <circle style={{ fill: "#FFD0A1" }} cx="11.337" cy="13" r="3" />
              <circle style={{ fill: "#FFD0A1" }} cx="10.337" cy="22" r="3" />
              <circle style={{ fill: "#FFD0A1" }} cx="12.337" cy="31" r="3" />
              <circle style={{ fill: "#FFD0A1" }} cx="16.337" cy="39" r="3" />
            </g>
          </svg>
          미사 시간표
        </h2>
        <div className="w-8 h-0.5 mb-6" style={{ backgroundColor: GOLD }} />

        {sortedEntries.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">미사 시간 정보가 없습니다.</p>
        ) : (
          <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">

            {/* 평일 그리드 */}
            {weekdayDays.length > 0 && (
              <div className="overflow-x-auto">
              <div
                className="grid divide-x divide-[var(--color-border)]"
                style={{ gridTemplateColumns: `repeat(${weekdayDays.length}, minmax(110px, 1fr))` }}
              >
                {weekdayDays.map((day) => {
                  const dayEntries = sortedEntries.filter((e) => e.day === day);
                  return (
                    <div key={day} className="bg-white p-4">
                      <p className="font-serif italic text-sm mb-1" style={{ color: GOLD }}>
                        {day}
                        <span className="font-light text-xs"> · {DAY_EN[day]}</span>
                      </p>
                      <div className="border-b border-[var(--color-border)] mb-3" />
                      <div className="space-y-2.5">
                        {dayEntries.map((e, i) => (
                          <div key={i} className="flex flex-col gap-0.5">
                            <span className="text-base font-light text-[var(--color-text)] tabular-nums">
                              {e.time}
                            </span>
                            {e.note && (
                              <span className="text-[11px] text-[var(--color-text-muted)]">
                                {e.note}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              </div>
            )}

            {/* 주일 행 */}
            {sundayEntries.length > 0 && (
              <div
                className="p-4"
                style={{ backgroundColor: "var(--color-surface-warm)" }}
              >
                <p className="font-serif italic text-sm mb-1" style={{ color: GOLD }}>
                  주일
                  <span className="font-light text-xs"> · Sunday</span>
                </p>
                <div className="border-b border-[var(--color-border)] mb-3" />
                <div className="flex flex-wrap gap-x-8 gap-y-2.5">
                  {sundayEntries.map((e, i) => (
                    <div key={i} className="flex flex-col gap-0.5">
                      <span className="text-base font-light text-[var(--color-text)] tabular-nums">
                        {e.time}
                      </span>
                      {e.note && (
                        <span className="text-[11px] text-[var(--color-text-muted)]">{e.note}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {parish?.mass_schedule?.note && (
          <p className="mt-4 text-xs text-[var(--color-text-muted)]">
            ※ {parish.mass_schedule.note}
          </p>
        )}
      </section>

      <BannerSlider placement="about_bottom" className="mt-8" />
      </SectionLayout>
    </>
  );
}
