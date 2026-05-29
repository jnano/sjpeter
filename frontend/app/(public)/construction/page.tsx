import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "성전 건축 현황",
  description: "본당 새 성전 건축의 진행 상황과 공사 일지",
};

interface Phase {
  id: number;
  name: string;
  description: string | null;
  sort_order: number;
  status: "planned" | "in_progress" | "completed" | string;
  progress_percent: number;
  started_at: string | null;
  completed_at: string | null;
  expected_completion_date: string | null;
  photo_url: string | null;
}

interface JournalEntry {
  id: number;
  entry_date: string;
  note: string;
  photo_url: string | null;
}

async function fetchPhases(): Promise<Phase[]> {
  try {
    const res = await fetch(`${API}/api/construction/phases`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function fetchJournal(): Promise<JournalEntry[]> {
  try {
    const res = await fetch(`${API}/api/construction/journal?limit=20`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function ConstructionPage() {
  const [phases, journal] = await Promise.all([fetchPhases(), fetchJournal()]);

  const overall = phases.length
    ? Math.round(phases.reduce((sum, p) => sum + p.progress_percent, 0) / phases.length)
    : 0;
  const completedCount = phases.filter((p) => p.status === "completed").length;
  const currentPhase =
    phases.find((p) => p.status === "in_progress") ??
    phases.find((p) => p.status !== "completed") ??
    null;

  return (
    <>
      <PageHeader
        group="성전건축"
        title="성전 건축 현황"
        subtitle="본당의 새 성전이 자라나는 과정을 함께 보아주세요."
      />
      <SectionLayout autoHero>
        <article className="space-y-10">

          {/* 시안 .progress-hero — 다크 잉크 배경 + 골드 큰 PCT */}
          <section className="relative overflow-hidden bg-[var(--ink)] text-white rounded-3xl p-7 sm:p-12">
            <div
              aria-hidden
              className="absolute -right-24 -top-24 w-[380px] h-[380px] rounded-full"
              style={{ background: "rgba(201,169,97,0.06)" }}
            />
            <div className="relative">
              <span className="inline-flex items-center gap-3 text-[11px] tracking-[0.2em] uppercase font-bold mb-4" style={{ color: "var(--color-accent, #C9A961)" }}>
                <span className="w-6 h-px" style={{ background: "var(--color-accent, #C9A961)" }} />
                함께 짓는 성전 · Live Progress
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight leading-snug text-balance">
                한 단계씩, <em className="not-italic" style={{ color: "var(--color-accent, #C9A961)" }}>함께 짓는</em> 성전.
              </h2>

              <div className="mt-7 pt-6 border-t border-white/10 flex items-end justify-between gap-6 flex-wrap">
                <div className="flex items-end gap-1 leading-none" style={{ color: "var(--color-accent, #C9A961)" }}>
                  <span className="text-6xl sm:text-[84px] font-bold tracking-tighter tabular-nums">
                    {overall}
                  </span>
                  <span className="text-2xl sm:text-3xl font-bold opacity-80 mb-2">%</span>
                </div>
                <div className="text-right">
                  <p className="text-[10px] tracking-[0.18em] uppercase font-bold text-white/50 mb-1.5">완료 단계</p>
                  <p className="text-xl font-bold tabular-nums">
                    {completedCount} <span className="text-white/40 font-semibold">/ {phases.length}</span>
                  </p>
                  {currentPhase && (
                    <p className="text-[11px] text-white/50 mt-1.5">
                      현재 · <span className="text-white font-semibold">{currentPhase.name}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-5 h-1 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${overall}%`, background: "linear-gradient(90deg, var(--color-accent, #C9A961), #B5934A)" }}
                />
              </div>
            </div>
          </section>

          {/* 단계별 타임라인 */}
          {phases.length === 0 ? (
            <section className="text-center py-12 text-sm text-[var(--color-text-muted)] border border-dashed border-[var(--color-border)] rounded-xl">
              아직 등록된 공사 단계가 없습니다.
            </section>
          ) : (
            <section>
              <h2 className="font-serif text-lg font-bold text-[var(--color-primary)] mb-4">단계별 진행 현황</h2>
              <ol className="space-y-4">
                {phases.map((p, i) => (
                  <PhaseCard key={p.id} phase={p} index={i + 1} />
                ))}
              </ol>
            </section>
          )}

          {/* 한 줄 일지 */}
          {journal.length > 0 && (
            <section>
              <h2 className="font-serif text-lg font-bold text-[var(--color-primary)] mb-4">최근 일지</h2>
              <ul className="space-y-3">
                {journal.map((e) => (
                  <li key={e.id} className="bg-white border border-[var(--color-border)] rounded-xl p-4 flex gap-3">
                    {e.photo_url && (
                      <img
                        src={e.photo_url.startsWith("http") ? e.photo_url : `${API}${e.photo_url}`}
                        alt=""
                        className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-lg flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[var(--color-text-muted)] mb-1">
                        {new Date(e.entry_date).toLocaleDateString("ko-KR", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                      <p className="text-sm text-[var(--color-text)] leading-relaxed whitespace-pre-line">
                        {e.note}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

        </article>
      </SectionLayout>
    </>
  );
}

function PhaseCard({ phase, index }: { phase: Phase; index: number }) {
  const statusClass =
    phase.status === "completed"
      ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
      : phase.status === "in_progress"
      ? "bg-white text-[var(--color-primary)] border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20"
      : "bg-white text-[var(--color-text-muted)] border-[var(--color-border)]";

  const statusLabel =
    phase.status === "completed"
      ? "완료"
      : phase.status === "in_progress"
      ? "진행 중"
      : "예정";

  const statusBadgeClass =
    phase.status === "completed"
      ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
      : phase.status === "in_progress"
      ? "bg-amber-100 text-amber-700"
      : "bg-gray-100 text-gray-500";

  return (
    <li className="bg-white border border-[var(--color-border)] rounded-xl p-4 sm:p-5">
      <div className="grid sm:grid-cols-[auto_1fr_auto] gap-4 items-start">
        {/* 좌: step 번호 */}
        <div
          className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 flex items-center justify-center font-bold text-sm sm:text-base flex-shrink-0 ${statusClass}`}
        >
          {phase.status === "completed" ? "✓" : index}
        </div>

        {/* 중: 정보 */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <h3 className="font-serif text-base sm:text-lg font-bold text-[var(--color-primary)]">{phase.name}</h3>
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusBadgeClass}`}>
              {statusLabel}
            </span>
          </div>
          {phase.description && (
            <p className="text-sm text-[var(--color-text-muted)] whitespace-pre-line mb-2 leading-relaxed">
              {phase.description}
            </p>
          )}
          <div className="text-xs text-[var(--color-text-muted)] flex flex-wrap gap-x-3 gap-y-1 mb-2">
            {phase.started_at && <span>착수 {phase.started_at}</span>}
            {phase.completed_at && <span>완료 {phase.completed_at}</span>}
            {!phase.completed_at && phase.expected_completion_date && (
              <span>예상 완료 {phase.expected_completion_date}</span>
            )}
          </div>
          <div className="h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
            <div
              className="h-full bg-[var(--color-primary)] transition-all"
              style={{ width: `${phase.progress_percent}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{phase.progress_percent}%</p>
        </div>

        {/* 우: 사진 */}
        {phase.photo_url && (
          <img
            src={phase.photo_url.startsWith("http") ? phase.photo_url : `${API}${phase.photo_url}`}
            alt={phase.name}
            className="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded-lg border border-[var(--color-border)] flex-shrink-0"
          />
        )}
      </div>
    </li>
  );
}
