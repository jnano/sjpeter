import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface SummaryPhase {
  id: number;
  name: string;
  status: string;
  progress_percent: number;
  photo_url: string | null;
  description: string | null;
}

interface Summary {
  current_phase: SummaryPhase | null;
  overall_percent: number;
  total_phases: number;
  completed_phases: number;
  latest_journal: { entry_date: string; note: string } | null;
}

export async function fetchConstructionSummary(): Promise<Summary | null> {
  try {
    const r = await fetch(`${API}/api/construction/summary`, { next: { revalidate: 300 } });
    return r.ok ? r.json() : null;
  } catch {
    return null;
  }
}

interface Props {
  summary: Summary | null;
  containerClassName?: string;
}

export default function HomeConstructionWidget({ summary, containerClassName }: Props) {
  // 등록된 단계가 없으면 위젯 자체를 숨김 — 빈 카드보다 비노출이 깔끔
  if (!summary || summary.total_phases === 0 || !summary.current_phase) return null;

  const { current_phase, overall_percent, completed_phases, total_phases, latest_journal } = summary;

  const photo = current_phase.photo_url
    ? current_phase.photo_url.startsWith("http")
      ? current_phase.photo_url
      : `${API}${current_phase.photo_url}`
    : null;

  return (
    <section>
      <div className={containerClassName}>
        <div className="border-t border-[var(--color-border)] py-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif font-bold text-[var(--color-primary)] text-[13px] flex items-center gap-1.5">
              <span className="text-[var(--color-accent)]">🏗️</span>
              새 성전 건축
            </h2>
            <Link
              href="/construction"
              className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
            >
              건축 현황 →
            </Link>
          </div>

          <Link
            href="/construction"
            className="block rounded-xl border border-[var(--color-border)] bg-white p-4 hover:border-[var(--color-primary)] hover:shadow-sm transition-all"
          >
            <div className="flex gap-4">
              {photo && (
                <img
                  src={photo}
                  alt={current_phase.name}
                  className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-lg flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2 mb-1">
                  <span className="text-[11px] text-[var(--color-text-muted)]">현재 단계</span>
                  <span className="font-serif font-bold text-[var(--color-primary)] text-base">
                    {current_phase.name}
                  </span>
                  <span className="text-[11px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
                    {current_phase.progress_percent}%
                  </span>
                </div>
                {current_phase.description && (
                  <p className="text-xs text-[var(--color-text-muted)] line-clamp-2 mb-2 leading-relaxed">
                    {current_phase.description}
                  </p>
                )}

                {/* 전체 진행률 바 */}
                <div className="h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden mb-1">
                  <div
                    className="h-full bg-[var(--color-primary)] transition-all"
                    style={{ width: `${overall_percent}%` }}
                  />
                </div>
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  전체 <span className="font-semibold text-[var(--color-primary)]">{overall_percent}%</span>
                  <span className="mx-1.5 text-[var(--color-border-dark)]">·</span>
                  {completed_phases} / {total_phases} 단계 완료
                </p>
              </div>
            </div>

            {latest_journal && (
              <div className="mt-3 pt-3 border-t border-[var(--color-border)] flex gap-2 items-start">
                <span className="text-[11px] text-[var(--color-text-muted)] whitespace-nowrap mt-0.5">
                  {latest_journal.entry_date}
                </span>
                <p className="text-xs text-[var(--color-text)] line-clamp-1 flex-1 min-w-0">
                  {latest_journal.note}
                </p>
              </div>
            )}
          </Link>
        </div>
      </div>
    </section>
  );
}
