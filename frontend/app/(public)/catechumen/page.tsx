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

export async function generateMetadata(): Promise<Metadata> {
  const p = await fetchParishMin();
  return {
    title: "예비신자 안내",
    description: `${p.name} 예비자교리 모집 — 9개월 동안 함께 신앙의 길을 걷습니다`,
  };
}

/* ── 시안 catechumen.html 데이터 — 본당마다 다른 부분(전화·본당명)은 parish 에서 동적,
   그 외 커리큘럼·FAQ·일정 등 일반 신앙교리 내용은 정적 텍스트로 시안 그대로. ── */

const PATH_STEPS = [
  { n: "01", when: "9월",          title: "신청과 환영",     body: "등록과 첫 만남. 본당 공동체의 환영을 받고, 동료 예비신자들과 인사합니다.", done: true },
  { n: "02", when: "10월 — 1월",   title: "예비교리",        body: "매주 한 번 교리 수업과 주일 미사 참례. 가톨릭 신앙의 기초를 배웁니다.", done: false },
  { n: "03", when: "2월 — 4월",    title: "사순 시기 준비",  body: "선택받은 예비신자(Elect)로 선포되어, 사순 시기를 함께 묵상하며 준비합니다.", done: false },
  { n: "04", when: "부활 성야",    title: "세례 · 첫영성체", body: "부활 성야 미사에서 세례·견진·첫영성체를 한 번에 받게 됩니다.", done: false },
];

const CURRICULUM = [
  {
    term: "1학기 · 9월—12월",
    title: "하느님과 그리스도",
    period: "총 14주 · 화요일 19:30",
    items: ["① 신앙이란 무엇인가", "② **삼위일체**: 성부·성자·성령", "③ 그리스도의 생애와 가르침", "④ 십자가의 의미", "⑤ 부활과 영원한 생명"],
  },
  {
    term: "2학기 · 1월—3월",
    title: "교회와 성사",
    period: "총 12주 · 화요일 19:30",
    items: ["① 교회의 의미와 사도성", "② **일곱 성사**: 세례·견진·성체", "③ 미사와 전례", "④ 고해와 화해", "⑤ 성모님과 성인들"],
  },
  {
    term: "3학기 · 3월—4월",
    title: "그리스도인의 삶",
    period: "총 6주 + 사순 피정",
    items: ["① 십계명과 양심", "② **기도의 삶**: 매일·매주", "③ 사랑과 정의", "④ 사순 시기 영성", "⑤ 부활 성야 준비"],
  },
];

const FAQ = [
  { q: "전혀 모르는데 괜찮을까요?", a: '네, 가장 환영합니다. 예비신자 과정은 "이미 알고 있는 분"이 아니라 "알아가고 싶은 분"을 위한 자리입니다.' },
  { q: "비용이 드나요?", a: "완전 무료입니다. 교재와 자료는 본당에서 제공합니다. 부담 없이 시작하세요." },
  { q: "몇 번 빠져도 되나요?", a: "2회 이상 결석 시 보충 수업을 안내드립니다. 다만 핵심 주제(부활·성사 등)는 가급적 참석을 권장합니다." },
  { q: "가족과 함께 참여할 수 있나요?", a: "네, 가족·친구가 함께 신청하시면 더 좋습니다. 부부 동반 예비신자 비율이 30% 정도입니다." },
  { q: "세례명은 어떻게 정하나요?", a: "과정 중 성인 사전과 함께 자신의 마음에 와 닿는 성인의 이름을 정하게 됩니다. 대부모도 함께 정합니다." },
  { q: "중도에 그만둬도 되나요?", a: "물론입니다. 신앙은 강요로 시작될 수 없습니다. 다만 한 학기는 끝까지 들어보시기를 권합니다." },
];

const STATS = [
  { v: "9개월", l: "전체 과정" },
  { v: "주 1회", l: "교리 수업" },
  { v: "무료", l: "교재 포함" },
  { v: "2026.09", l: "가을 학기 개강" },
];

function renderEm(text: string) {
  // "**word**" → <b>word</b>
  return text.split(/(\*\*[^*]+\*\*)/).map((seg, i) =>
    seg.startsWith("**") && seg.endsWith("**")
      ? <b key={i} className="font-bold text-[var(--color-primary)]">{seg.slice(2, -2)}</b>
      : <span key={i}>{seg}</span>
  );
}

export default async function CatechumenPage() {
  const parish = await getParish();
  const parishName = parish?.name ?? "본당";
  const phone = parish?.phone ?? "044-000-0000";

  return (
    <>
      <PageHeader group="성당 소개" title="예비신자 안내" subtitle={`${parishName} 예비자교리 모집 — 한 걸음만 다가오시면 함께 걷겠습니다`} />
      <SectionLayout strictMatch autoHero={false}>

        {/* ── HERO ─────────────────────────────────────────── */}
        <section className="grid lg:grid-cols-[1.4fr_1fr] gap-8 lg:gap-12 items-center bg-gradient-to-br from-[var(--color-surface-warm)] to-[var(--color-background)] border border-[var(--color-border)] rounded-3xl p-8 sm:p-10 lg:p-12 mb-12">
          <div>
            <span className="inline-flex items-center gap-3 text-[11px] tracking-[0.2em] uppercase text-[var(--color-primary)] font-bold mb-4">
              <span className="w-6 h-px bg-[var(--color-primary)]" />
              예비신자 모집 · 2026 가을학기
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight leading-snug text-balance mb-4">
              한 걸음만 다가오시면,<br />
              <em className="not-italic text-[var(--color-primary)]">나머지는 함께 걷겠습니다.</em>
            </h2>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-[var(--color-text-muted)] mb-6">
              가톨릭에 처음이신 분, 다시 돌아오고 싶으신 분 모두 환영합니다. 매주 한 번의 수업과 미사로 9개월간 함께 신앙의 길을 걷습니다.
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
              <a href={`tel:${phone}`}
                className="inline-flex items-center gap-2 px-5 py-3 bg-white border border-[var(--color-border)] text-[var(--color-text)] rounded-full text-[13px] font-bold hover:border-[var(--color-text-muted)]">
                먼저 상담하기
              </a>
            </div>
          </div>

          {/* hero-stats */}
          <div className="grid grid-cols-2 gap-px bg-[var(--color-border)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
            {STATS.map((s, i) => (
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
            {PATH_STEPS.map((s) => (
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
            {CURRICULUM.map((c, i) => (
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
            {[
              ["개강", "2026년 9월 1일 (화)", "입학 미사 19:00 · 본당 성전"],
              ["수업", "매주 화요일 19:30 — 21:00", "본당 회합실"],
              ["미사", "주일 10:30 교중 미사 참례", "예비신자도 함께 참여 가능"],
              ["종강", "2027년 부활 성야 (4월 3일)", "세례·견진·첫영성체"],
              ["교재", "『가톨릭 교회 입문』 (무료 배부)", "한국천주교중앙협의회"],
            ].map(([l, v, s], i) => (
              <div key={i} className="grid grid-cols-[64px_1fr] gap-3 py-2.5 border-b border-dashed border-[var(--color-border)] last:border-b-0">
                <span className="text-[11px] tracking-wider uppercase font-bold text-[var(--color-text-muted)] pt-1">{l}</span>
                <span className="text-[14px] font-semibold text-[var(--color-text)]">
                  {v}
                  {s && <small className="block text-[11px] font-normal text-[var(--color-text-muted)] mt-0.5">{s}</small>}
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
            <div className="grid grid-cols-[64px_1fr] gap-3 py-2.5 border-b border-dashed border-[var(--color-border)]">
              <span className="text-[11px] tracking-wider uppercase font-bold text-[var(--color-text-muted)] pt-1">전화</span>
              <span className="text-[14px] font-semibold text-[var(--color-text)]">
                <a href={`tel:${phone}`} className="hover:text-[var(--color-primary)]">{phone}</a>
                <small className="block text-[11px] font-normal text-[var(--color-text-muted)] mt-0.5">교육 분과 담당 선생님</small>
              </span>
            </div>
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
            {FAQ.map((f, i) => (
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
              함께 걸어요
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight leading-snug text-balance">
              한 줄의 신청서가<br />
              <em className="not-italic" style={{ color: "var(--color-accent, #C9A961)" }}>한 생의 신앙</em>으로 자라납니다.
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
            <a href={`tel:${phone}`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-[13px] font-bold border border-white/20 text-white hover:bg-white/10">
              {phone}
            </a>
          </div>
        </section>
      </SectionLayout>
    </>
  );
}
