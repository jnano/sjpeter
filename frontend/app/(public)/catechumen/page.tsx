import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";
import { fetchParishMin } from "@/lib/parish";

export const dynamic = "force-dynamic";

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Parish {
  name: string;
  phone: string | null;
  address: string | null;
}

async function getParish(): Promise<Parish | null> {
  try {
    const res = await fetch(`${API}/api/parish/`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

/* ── 안내 페이지 콘텐츠 — admin/catechumen 에서 편집, DB(catechumen_page) 저장.
   본당명·전화 등 본당별로 다른 부분은 parish 에서 동적. ── */

interface Stat { v: string; l: string; }
interface PathStep { n: string; when: string; title: string; body: string; done: boolean; }
interface Curriculum { term: string; title: string; period: string; items: string[]; }
interface ScheduleRow { label: string; value: string; sub: string; }
interface Faq { q: string; a: string; }
interface PageContent {
  hero: { eyebrow: string; title_normal: string; title_em: string; body: string; stats: Stat[] };
  path_steps: PathStep[];
  curriculum: Curriculum[];
  schedule: ScheduleRow[];
  faq: Faq[];
  cta: { eyebrow: string; title_normal: string; title_em: string };
}

async function getPageContent(): Promise<PageContent | null> {
  try {
    const res = await fetch(`${API}/api/catechumen/page-content`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

export async function generateMetadata(): Promise<Metadata> {
  const p = await fetchParishMin();
  return {
    title: "예비신자 안내",
    description: `${p.name} 예비자교리 모집 — 9개월 동안 함께 신앙의 길을 걷습니다`,
  };
}

function renderEm(text: string) {
  // "**word**" → <b>word</b>
  return text.split(/(\*\*[^*]+\*\*)/).map((seg, i) =>
    seg.startsWith("**") && seg.endsWith("**")
      ? <b key={i} className="font-bold text-[var(--color-primary)]">{seg.slice(2, -2)}</b>
      : <span key={i}>{seg}</span>
  );
}

export default async function CatechumenPage() {
  const [parish, content] = await Promise.all([getParish(), getPageContent()]);
  const parishName = parish?.name ?? "본당";
  const phone = parish?.phone ?? "";

  const hero = content?.hero;
  const stats = hero?.stats ?? [];
  const pathSteps = content?.path_steps ?? [];
  const curriculum = content?.curriculum ?? [];
  const schedule = content?.schedule ?? [];
  const faq = content?.faq ?? [];
  const cta = content?.cta;

  return (
    <>
      <PageHeader group="성당 소개" title="예비신자 안내" subtitle={`${parishName} 예비자교리 모집 — 한 걸음만 다가오시면 함께 걷겠습니다`} />
      <SectionLayout strictMatch autoHero={false}>

        {/* ── HERO ─────────────────────────────────────────── */}
        <section className="grid lg:grid-cols-[1.4fr_1fr] gap-8 lg:gap-12 items-center bg-gradient-to-br from-[var(--color-surface-warm)] to-[var(--color-background)] border border-[var(--color-border)] rounded-3xl p-8 sm:p-10 lg:p-12 mb-12">
          <div>
            <span className="inline-flex items-center gap-3 text-[11px] tracking-[0.2em] uppercase text-[var(--color-primary)] font-bold mb-4">
              <span className="w-6 h-px bg-[var(--color-primary)]" />
              {hero?.eyebrow}
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight leading-snug text-balance mb-4">
              {hero?.title_normal}<br />
              <em className="not-italic text-[var(--color-primary)]">{hero?.title_em}</em>
            </h2>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-[var(--color-text-muted)] mb-6">
              {hero?.body}
            </p>
            <div className="flex flex-wrap gap-2.5">
              <Link href="/catechumen/apply"
                className="inline-flex items-center gap-2 px-5 py-3 bg-[var(--color-primary)] text-white rounded-full text-[13px] font-bold hover:opacity-90">
                예비신자 신청
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <line x1="2" y1="6.5" x2="11" y2="6.5" />
                  <polyline points="7 3 11 6.5 7 10" />
                </svg>
              </Link>
              {phone && (
                <a href={`tel:${phone}`}
                  className="inline-flex items-center gap-2 px-5 py-3 bg-white border border-[var(--color-border)] text-[var(--color-text)] rounded-full text-[13px] font-bold hover:border-[var(--color-text-muted)]">
                  먼저 상담하기
                </a>
              )}
            </div>
          </div>

          {/* hero-stats */}
          <div className="grid grid-cols-2 gap-px bg-[var(--color-border)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
            {stats.map((s, i) => (
              <div key={i} className="bg-white px-5 py-5 text-center">
                <div className="text-xl sm:text-2xl font-bold text-[var(--color-primary)] tracking-tight leading-none mb-1.5">{s.v}</div>
                <div className="text-[10px] tracking-widest uppercase font-bold text-[var(--color-text-muted)]">{s.l}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── PATH ─────────────────────────────────────────── */}
        <section className="mb-12">
          <header className="mb-6">
            <span className="inline-flex items-center gap-3 text-[11px] tracking-[0.18em] uppercase text-[var(--color-primary)] font-bold mb-2">
              <span className="w-6 h-px bg-[var(--color-primary)]" />
              과정 안내 · Path
            </span>
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight">예비신자에서 세례까지, 4단계의 길</h3>
            <p className="text-[13px] text-[var(--color-text-muted)] mt-1.5">9개월의 시간 동안 천천히 신앙을 알아가고, 부활 시기에 세례를 받게 됩니다.</p>
          </header>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {pathSteps.map((s) => (
              <article key={s.n} className={`bg-white border rounded-2xl p-5 ${s.done ? "border-[var(--color-primary)]" : "border-[var(--color-border)]"}`}>
                <div className="text-3xl font-bold tracking-tighter tabular-nums" style={{ color: s.done ? "var(--color-primary)" : "var(--color-text-muted)" }}>
                  {s.n}
                </div>
                <span className="block text-[11px] tracking-wider font-bold uppercase text-[var(--color-text-muted)] mt-1 mb-2">{s.when}</span>
                <h4 className="text-base font-bold tracking-tight mb-1.5">{s.title}</h4>
                <p className="text-[13px] leading-relaxed text-[var(--color-text-muted)]">{s.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── CURRICULUM ────────────────────────────────────── */}
        <section className="mb-12">
          <header className="mb-6">
            <span className="inline-flex items-center gap-3 text-[11px] tracking-[0.18em] uppercase text-[var(--color-primary)] font-bold mb-2">
              <span className="w-6 h-px bg-[var(--color-primary)]" />
              교리 과정 · Curriculum
            </span>
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight">무엇을 배우나요?</h3>
            <p className="text-[13px] text-[var(--color-text-muted)] mt-1.5">가톨릭 교회의 핵심 교리를 한 학기씩 깊이 배웁니다.</p>
          </header>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {curriculum.map((c, i) => (
              <article key={i} className="bg-white border border-[var(--color-border)] rounded-2xl p-6 flex flex-col">
                <span className="text-[10px] tracking-widest uppercase font-bold text-[var(--color-text-muted)] mb-2">{c.term}</span>
                <h4 className="text-lg font-bold tracking-tight mb-1">{c.title}</h4>
                <p className="text-[11px] text-[var(--color-text-muted)] mb-4 pb-3 border-b border-dashed border-[var(--color-border)]">{c.period}</p>
                <ul className="space-y-2 text-[13px] leading-relaxed text-[var(--color-text)]">
                  {c.items.map((it, j) => <li key={j}>{renderEm(it)}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </section>

        {/* ── SPLIT: Schedule + How to Apply ─────────────────── */}
        <section className="grid md:grid-cols-2 gap-4 mb-12">
          <article className="bg-white border border-[var(--color-border)] rounded-2xl p-6 sm:p-7">
            <h3 className="mb-4">
              <small className="block text-[11px] tracking-[0.14em] uppercase font-bold text-[var(--color-text-muted)] mb-1">Schedule</small>
              <span className="text-lg font-bold tracking-tight text-[var(--color-primary)]">일정과 장소</span>
            </h3>
            {schedule.map((row, i) => (
              <div key={i} className="grid grid-cols-[64px_1fr] gap-3 py-2.5 border-b border-dashed border-[var(--color-border)] last:border-b-0">
                <span className="text-[11px] tracking-wider uppercase font-bold text-[var(--color-text-muted)] pt-1">{row.label}</span>
                <span className="text-[14px] font-semibold text-[var(--color-text)]">
                  {row.value}
                  {row.sub && <small className="block text-[11px] font-normal text-[var(--color-text-muted)] mt-0.5">{row.sub}</small>}
                </span>
              </div>
            ))}
          </article>

          <article className="bg-white border border-[var(--color-border)] rounded-2xl p-6 sm:p-7">
            <h3 className="mb-4">
              <small className="block text-[11px] tracking-[0.14em] uppercase font-bold text-[var(--color-text-muted)] mb-1">How to Apply</small>
              <span className="text-lg font-bold tracking-tight text-[var(--color-primary)]">신청 방법</span>
            </h3>
            <div className="grid grid-cols-[64px_1fr] gap-3 py-2.5 border-b border-dashed border-[var(--color-border)]">
              <span className="text-[11px] tracking-wider uppercase font-bold text-[var(--color-text-muted)] pt-1">온라인</span>
              <span>
                <Link href="/catechumen/apply" className="text-[var(--color-primary)] font-bold text-[14px]">홈페이지 신청 →</Link>
                <small className="block text-[11px] text-[var(--color-text-muted)] mt-0.5">5분이면 끝나요</small>
              </span>
            </div>
            <div className="grid grid-cols-[64px_1fr] gap-3 py-2.5 border-b border-dashed border-[var(--color-border)]">
              <span className="text-[11px] tracking-wider uppercase font-bold text-[var(--color-text-muted)] pt-1">방문</span>
              <span className="text-[14px] font-semibold text-[var(--color-text)]">
                {parishName} 사무실
                <small className="block text-[11px] font-normal text-[var(--color-text-muted)] mt-0.5">평일 09:00 — 18:00 · 토 09:00 — 13:00</small>
              </span>
            </div>
            {phone && (
              <div className="grid grid-cols-[64px_1fr] gap-3 py-2.5 border-b border-dashed border-[var(--color-border)]">
                <span className="text-[11px] tracking-wider uppercase font-bold text-[var(--color-text-muted)] pt-1">전화</span>
                <span className="text-[14px] font-semibold text-[var(--color-text)]">
                  <a href={`tel:${phone}`} className="hover:text-[var(--color-primary)]">{phone}</a>
                  <small className="block text-[11px] font-normal text-[var(--color-text-muted)] mt-0.5">교육 분과 담당 선생님</small>
                </span>
              </div>
            )}
            <div className="grid grid-cols-[64px_1fr] gap-3 py-2.5">
              <span className="text-[11px] tracking-wider uppercase font-bold text-[var(--color-text-muted)] pt-1">상담</span>
              <span className="text-[14px] font-semibold text-[var(--color-text)]">
                상담 먼저 가능
                <small className="block text-[11px] font-normal text-[var(--color-text-muted)] mt-0.5">부담 없이 한 번 만나보세요</small>
              </span>
            </div>
          </article>
        </section>

        {/* ── FAQ ───────────────────────────────────────────── */}
        <section className="mb-12">
          <header className="mb-6">
            <span className="inline-flex items-center gap-3 text-[11px] tracking-[0.18em] uppercase text-[var(--color-primary)] font-bold mb-2">
              <span className="w-6 h-px bg-[var(--color-primary)]" />
              자주 묻는 질문 · FAQ
            </span>
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight">궁금하실 것들</h3>
          </header>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {faq.map((f, i) => (
              <article key={i} className="bg-white border border-[var(--color-border)] rounded-2xl p-5 sm:p-6">
                <h4 className="text-[15px] font-bold tracking-tight leading-snug mb-2 flex gap-2">
                  <span className="text-[var(--color-primary)] font-bold shrink-0">Q.</span>
                  <span>{f.q}</span>
                </h4>
                <p className="text-[13px] leading-relaxed text-[var(--color-text-muted)]">{f.a}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── CTA BAND ──────────────────────────────────────── */}
        <section
          className="rounded-3xl p-8 sm:p-10 lg:p-12 text-white flex items-center justify-between gap-6 flex-wrap"
          style={{ background: "linear-gradient(135deg, var(--color-primary), var(--color-primary-dark, #5C1820))" }}
        >
          <div className="min-w-0">
            <div className="text-[11px] tracking-[0.18em] uppercase font-bold mb-2.5" style={{ color: "var(--color-accent, #C9A961)" }}>
              {cta?.eyebrow}
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight leading-snug text-balance">
              {cta?.title_normal}<br />
              <em className="not-italic" style={{ color: "var(--color-accent, #C9A961)" }}>{cta?.title_em}</em>
            </h2>
          </div>
          <div className="flex flex-wrap gap-2.5 shrink-0">
            <Link href="/catechumen/apply"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-[13px] font-bold"
              style={{ background: "var(--color-accent, #C9A961)", color: "var(--color-text)" }}>
              예비신자 신청
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8">
                <line x1="2" y1="6.5" x2="11" y2="6.5" />
                <polyline points="7 3 11 6.5 7 10" />
              </svg>
            </Link>
            {phone && (
              <a href={`tel:${phone}`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-[13px] font-bold border border-white/20 text-white hover:bg-white/10">
                {phone}
              </a>
            )}
          </div>
        </section>
      </SectionLayout>
    </>
  );
}
