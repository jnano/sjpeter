import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "성당 소개",
  description: "세종성베드로성당 소개 — 세종시 최초 본당",
};

const API = process.env.NEXT_PUBLIC_API_URL;

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
  description: string | null;
  member_count: number | null;
  founded_at: string | null;
  mass_schedule: MassSchedule | null;
}

const DAY_ORDER: Record<string, number> = {
  "주일": 0, "월요일": 1, "화요일": 2, "수요일": 3,
  "목요일": 4, "금요일": 5, "토요일": 6, "공휴일": 7,
};

async function getParish(): Promise<ParishOut | null> {
  try {
    const res = await fetch(`${API}/api/parish/`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function AboutPage() {
  const parish = await getParish();

  const entries = parish?.mass_schedule?.entries ?? [];
  const days = ["주일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "공휴일"];
  const sortedEntries = [...entries].sort((a, b) => {
    const dayDiff = (DAY_ORDER[a.day] ?? 99) - (DAY_ORDER[b.day] ?? 99);
    return dayDiff !== 0 ? dayDiff : a.time.localeCompare(b.time);
  });
  const groupedDays = days.filter((d) => sortedEntries.some((e) => e.day === d));

  const foundedYear = parish?.founded_at
    ? new Date(parish.founded_at).getFullYear() + "년"
    : null;

  const infoRows = [
    { label: "설립일", value: foundedYear },
    { label: "소속 교구", value: parish?.diocese ? `천주교 ${parish.diocese}` : null },
    { label: "주소", value: parish?.address },
    { label: "전화", value: parish?.phone },
    { label: "신자 수", value: parish?.member_count ? `약 ${parish.member_count.toLocaleString()}명` : null },
  ].filter((r) => r.value);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-[var(--color-primary)] mb-2">
          성당 소개
        </h1>
        <p className="text-[var(--color-text-muted)]">세종성베드로성당에 오신 것을 환영합니다.</p>
      </div>

      <div className="bg-[var(--color-surface-warm)] border border-[var(--color-border)] rounded-xl h-64 flex items-center justify-center mb-8">
        <div className="text-center text-[var(--color-text-muted)]">
          <div className="text-5xl mb-2">⛪</div>
          <p className="text-sm">성당 사진</p>
        </div>
      </div>

      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-8 space-y-6">
        {parish?.description && (
          <>
            <section>
              <h2 className="font-serif text-xl font-bold text-[var(--color-primary)] mb-3">
                본당 소개
              </h2>
              <p className="leading-relaxed text-[var(--color-text)] whitespace-pre-line">
                {parish.description}
              </p>
            </section>
            <div className="border-t border-[var(--color-border)]" />
          </>
        )}

        {infoRows.length > 0 && (
          <>
            <section>
              <h2 className="font-serif text-xl font-bold text-[var(--color-primary)] mb-4">
                기본 정보
              </h2>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-[var(--color-border)]">
                  {infoRows.map((row) => (
                    <tr key={row.label}>
                      <td className="py-3 pr-6 text-[var(--color-text-muted)] w-32">{row.label}</td>
                      <td className="py-3 font-medium">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <div className="border-t border-[var(--color-border)]" />
          </>
        )}

        <section>
          <h2 className="font-serif text-xl font-bold text-[var(--color-primary)] mb-3">
            미사 시간
          </h2>
          {sortedEntries.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">미사 시간 정보가 없습니다.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-[var(--color-border)]">
                {groupedDays.map((day) => {
                  const dayEntries = sortedEntries.filter((e) => e.day === day);
                  const times = dayEntries.map((e) => e.note ? `${e.time} (${e.note})` : e.time).join(" / ");
                  return (
                    <tr key={day}>
                      <td className="py-3 pr-6 text-[var(--color-text-muted)] w-32">{day}</td>
                      <td className="py-3">{times}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {parish?.mass_schedule?.note && (
            <p className="mt-3 text-xs text-[var(--color-text-muted)]">{parish.mass_schedule.note}</p>
          )}
        </section>
      </div>
    </div>
  );
}
