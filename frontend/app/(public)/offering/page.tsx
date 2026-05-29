import type { Metadata } from "next";
import { auth } from "@/auth";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";
import LineBoard from "../boards/[slug]/LineBoard";
import { fetchParishMin } from "@/lib/parish";

export const dynamic = "force-dynamic";

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const OFFERING_SLUG = "build_offering";

export async function generateMetadata(): Promise<Metadata> {
  const p = await fetchParishMin();
  return {
    title: "한 줄 봉헌",
    description: `${p.name} 새 성전 건축을 향한 한 줄 봉헌. 누구나 한 줄로 마음을 남길 수 있습니다.`,
  };
}

interface Board {
  id: number;
  name: string;
  slug: string;
  description: string;
  members_only_write: boolean;
  members_only_read: boolean;
  kind: string;
}

async function getBoard(): Promise<Board | null> {
  try {
    const res = await fetch(`${API}/api/boards/${OFFERING_SLUG}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getCount(): Promise<number> {
  try {
    const res = await fetch(`${API}/api/boards/${OFFERING_SLUG}/posts?page=1`, { cache: "no-store" });
    if (!res.ok) return 0;
    const d = await res.json();
    // 응답 모양: { posts:[], total, posts_per_page } — 라인 게시판도 동일 구조 가정
    return typeof d?.total === "number" ? d.total : (Array.isArray(d?.posts) ? d.posts.length : 0);
  } catch {
    return 0;
  }
}

async function getGoal(): Promise<number | null> {
  try {
    const res = await fetch(`${API}/api/public/site-config`, { cache: "no-store" });
    if (!res.ok) return null;
    const d = await res.json();
    const raw = String(d.OFFERING_GOAL ?? "").trim();
    if (!raw) return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export default async function OfferingPage() {
  const [board, count, goal, session, parish] = await Promise.all([
    getBoard(),
    getCount(),
    getGoal(),
    auth(),
    fetchParishMin(),
  ]);

  const pct = goal ? Math.min(100, Math.round((count / goal) * 100)) : null;
  const isLoggedIn = !!session?.user;

  return (
    <>
      <PageHeader
        group="성전건축"
        title="한 줄 봉헌"
        subtitle="새 성전을 위한 한 줄. 누구나 마음을 남길 수 있습니다."
      />
      <SectionLayout group="construction" autoHero={false}>

        {/* ── status-hero (다크 잉크 + 골드 큰 누계) ─────────── */}
        <section className="relative overflow-hidden bg-[var(--ink)] text-white rounded-3xl p-7 sm:p-10 mb-9">
          <div
            aria-hidden
            className="absolute -right-24 -top-24 w-[380px] h-[380px] rounded-full"
            style={{ background: "rgba(201,169,97,0.06)" }}
          />
          <div className="relative">
            <span className="inline-flex items-center gap-3 text-[11px] tracking-[0.2em] uppercase font-bold mb-4" style={{ color: "var(--color-accent, #C9A961)" }}>
              <span className="w-6 h-px" style={{ background: "var(--color-accent, #C9A961)" }} />
              함께 짓는 마음 · Live Counter
            </span>
            <div className="flex items-end gap-1.5 leading-none" style={{ color: "var(--color-accent, #C9A961)" }}>
              <span className="text-5xl sm:text-7xl font-bold tracking-tighter tabular-nums">
                {count.toLocaleString()}
              </span>
              <span className="text-xl sm:text-2xl font-bold opacity-80 mb-1.5">줄</span>
            </div>
            <p className="mt-3 text-[13px] sm:text-[14px] leading-relaxed text-white/70">
              지금까지 모인 한 줄 봉헌의 마음
              {goal && pct !== null && (
                <>
                  {" "}·{" "}
                  <span className="text-white font-semibold">목표 {goal.toLocaleString()}줄 중 {pct}%</span>
                </>
              )}
            </p>

            {/* progress bar */}
            {goal && pct !== null && (
              <div className="mt-5">
                <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: "linear-gradient(90deg, var(--color-accent, #C9A961), #B5934A)" }}
                  />
                </div>
                <div className="mt-2.5 flex justify-between text-[11px] text-white/60 tabular-nums">
                  <span>0줄</span>
                  <span>목표 {goal.toLocaleString()}줄</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── 안내 ─────────────────────────────────────── */}
        <section className="bg-[var(--color-surface-warm)] border border-[var(--color-border)] rounded-2xl p-6 mb-8">
          <h2 className="text-[13px] tracking-[0.12em] uppercase font-bold text-[var(--color-primary)] mb-2.5">
            안내
          </h2>
          <p className="text-[13px] leading-relaxed text-[var(--color-text)]">
            <b>{parish.name}</b>의 새 성전 건축을 위한 한 줄 봉헌입니다. 짧은 한 줄로 기도·다짐·감사를 남기실 수 있습니다.
            모든 한 줄은 본당 가족에게 격려가 됩니다. 금전 봉헌은 본당 사무실로 별도 문의해 주세요.
          </p>
        </section>

        {/* ── LineBoard 임베드 (기존 컴포넌트 재사용) ────────── */}
        {board ? (
          <div className="bg-white border border-[var(--color-border)] rounded-2xl p-5 sm:p-7">
            <LineBoard
              slug={OFFERING_SLUG}
              canWrite={!board.members_only_write || isLoggedIn}
              membersOnlyWrite={board.members_only_write}
              description={board.description ?? ""}
            />
          </div>
        ) : (
          <div className="bg-white border border-[var(--color-border)] rounded-2xl p-12 text-center text-[var(--color-text-muted)]">
            한 줄 봉헌 게시판이 아직 준비되지 않았습니다.
          </div>
        )}
      </SectionLayout>
    </>
  );
}
