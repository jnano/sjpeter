import type { Metadata } from "next";
import Image from "next/image";
import PageHeader from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "성당 소개",
  description: "세종성베드로성당 소개 — 세종시 최초 본당",
};

const API = process.env.NEXT_PUBLIC_API_URL;

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
    const res = await fetch(`${API}/api/parish/`, { next: { revalidate: 3600 } });
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
      <PageHeader group="우리 성당" title="성당 소개" subtitle="세종시 첫 본당, 교회 공동체의 이야기" />
      <div className="max-w-5xl mx-auto px-4 py-8">

      <div className="relative w-full h-72 md:h-96 rounded-xl overflow-hidden mb-8">
        <Image
          src="/yakhoun.jpg"
          alt="세종성베드로성당"
          fill
          className="object-cover"
          style={{ objectPosition: "center 30%" }}
          priority
        />
      </div>

      {/* 본당 소개 + 기본 정보 */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-8 space-y-6 mb-12">
        {parish?.description && (
          <>
            <section>
              <h2 className="font-serif text-xl font-bold text-[var(--color-primary)] mb-3">본당 소개</h2>
              <p className="leading-relaxed text-[var(--color-text)] whitespace-pre-line">
                {parish.description}
              </p>
            </section>
            <div className="border-t border-[var(--color-border)]" />
          </>
        )}

        {infoRows.length > 0 && (
          <section>
            <h2 className="font-serif text-xl font-bold text-[var(--color-primary)] mb-4">안내</h2>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-[var(--color-border)]">
                {infoRows.map((row) => (
                  <tr key={row.label}>
                    <td className="py-3 pr-6 text-[var(--color-text-muted)] w-32">{row.label}</td>
                    <td className="py-3 font-medium">
                      {"href" in row && row.href ? (
                        <a
                          href={row.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--color-primary)] hover:underline"
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
          </section>
        )}
      </div>

      {/* 미사 시간표 */}
      <section>
        {/* 섹션 헤더 */}
        <p className="text-xs tracking-[0.3em] mb-2" style={{ color: GOLD }}>MASS SCHEDULE</p>
        <h2 className="font-serif text-4xl font-bold text-[var(--color-primary)] mb-3">미사 시간표</h2>
        <div className="w-10 h-0.5 mb-8" style={{ backgroundColor: GOLD }} />

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
                    <div key={day} className="bg-white p-6">
                      <p className="font-serif italic text-lg mb-1" style={{ color: GOLD }}>
                        {day}
                        <span className="font-light text-base"> · {DAY_EN[day]}</span>
                      </p>
                      <div className="border-b border-[var(--color-border)] mb-5" />
                      <div className="space-y-4">
                        {dayEntries.map((e, i) => (
                          <div key={i} className="flex flex-col gap-0.5">
                            <span className="text-[1.313rem] font-thin text-[var(--color-text)] tabular-nums">
                              {e.time}
                            </span>
                            {e.note && (
                              <span className="text-xs text-[var(--color-text-muted)]">
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
                className="p-6"
                style={{ backgroundColor: "var(--color-surface-warm)" }}
              >
                <p className="font-serif italic text-lg mb-1" style={{ color: GOLD }}>
                  주일
                  <span className="font-light text-base"> · Sunday</span>
                </p>
                <div className="border-b border-[var(--color-border)] mb-6" />
                <div className="flex flex-wrap gap-x-12 gap-y-4">
                  {sundayEntries.map((e, i) => (
                    <div key={i} className="flex flex-col gap-0.5">
                      <span className="text-[1.313rem] font-thin text-[var(--color-text)] tabular-nums">
                        {e.time}
                      </span>
                      {e.note && (
                        <span className="text-xs text-[var(--color-text-muted)]">{e.note}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {parish?.mass_schedule?.note && (
          <p className="mt-5 text-sm text-[var(--color-text-muted)]">
            ※ {parish.mass_schedule.note}
          </p>
        )}
      </section>
    </div>
    </>
  );
}
