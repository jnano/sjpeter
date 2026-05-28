import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";
import { fetchParishMin } from "@/lib/parish";
import EraFilter, { type Era } from "./EraFilter";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const p = await fetchParishMin();
  return { title: "본당 연혁", description: `${p.name} 창립부터 현재까지의 연표` };
}

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL;

interface HistoryItem {
  id: number;
  year: number;
  event: string;
  detail: string | null;
  highlight: boolean;
  is_current: boolean;
  sort_order: number;
}

async function getHistory(): Promise<HistoryItem[]> {
  try {
    const res = await fetch(`${API}/api/content/history`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

function eraId(year: number): string {
  return `${Math.floor(year / 10) * 10}s`;
}
function eraLabel(year: number): string {
  return `${Math.floor(year / 10) * 10}년대`;
}

export default async function HistoryPage() {
  const [historyItems, p] = await Promise.all([getHistory(), fetchParishMin()]);

  // 시안 톤: 최신이 위로. 백엔드가 sort_order 로 주는 순서 유지하되 보장 위해 year 내림차순.
  const items = [...historyItems].sort((a, b) => b.year - a.year || b.sort_order - a.sort_order);

  // era 그룹화 (10년 단위)
  const eraMap = new Map<string, { id: string; label: string; items: HistoryItem[] }>();
  for (const it of items) {
    const id = eraId(it.year);
    if (!eraMap.has(id)) {
      eraMap.set(id, { id, label: eraLabel(it.year), items: [] });
    }
    eraMap.get(id)!.items.push(it);
  }
  const eras = Array.from(eraMap.values()); // 이미 year 내림차순
  const eraChips: Era[] = eras.map((e) => ({ id: e.id, label: e.label, count: e.items.length }));

  const foundedYear = items.length ? Math.min(...items.map((i) => i.year)) : null;
  const currentYear = new Date().getFullYear();
  const yearsSpan = foundedYear ? currentYear - foundedYear : 0;

  return (
    <>
      <PageHeader group="성당 소개" title="본당 연혁" subtitle={`현재부터 창립까지 — ${p.name}의 역사`} />
      <SectionLayout group="about" tools>
        {/* ── history-hero ─────────────────────────────────── */}
        <section className="grid lg:grid-cols-[1.4fr_1fr] gap-8 lg:gap-12 items-center bg-gradient-to-br from-[var(--color-surface-warm)] to-[var(--color-background)] border border-[var(--color-border)] rounded-3xl p-7 sm:p-10 mb-10">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-3 text-[11px] tracking-[0.2em] uppercase text-[var(--color-primary)] font-bold mb-4">
              <span className="w-6 h-px bg-[var(--color-primary)]" />
              {p.name}의 발자취
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight leading-snug text-balance">
              한 주 한 주가 모여 <em className="not-italic text-[var(--color-primary)]">우리 본당의 역사</em>가 되었습니다.
            </h2>
            <p className="mt-3.5 text-[14px] leading-relaxed text-[var(--color-text-muted)]">
              {foundedYear ? `${foundedYear}년 창립부터 오늘에 이르기까지 ` : ""}
              본당이 함께 지나온 시간을 한 자리에서 기록합니다.
            </p>
          </div>

          {/* hero-stats */}
          <div className="grid grid-cols-2 gap-px bg-[var(--color-border)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
            <div className="bg-white px-5 py-5">
              <div className="text-2xl sm:text-3xl font-bold text-[var(--color-primary)] tabular-nums leading-none">
                {yearsSpan}<sub className="text-[13px] font-semibold opacity-60 ml-0.5 text-[var(--color-text-muted)]">년</sub>
              </div>
              <div className="mt-1.5 text-[10px] tracking-widest uppercase font-bold text-[var(--color-text-muted)]">함께한 시간</div>
            </div>
            <div className="bg-white px-5 py-5">
              <div className="text-2xl sm:text-3xl font-bold text-[var(--color-primary)] tabular-nums leading-none">
                {items.length}<sub className="text-[13px] font-semibold opacity-60 ml-0.5 text-[var(--color-text-muted)]">건</sub>
              </div>
              <div className="mt-1.5 text-[10px] tracking-widest uppercase font-bold text-[var(--color-text-muted)]">기록된 자취</div>
            </div>
          </div>
        </section>

        {/* ── era-filter ──────────────────────────────────── */}
        {eraChips.length > 1 && <EraFilter eras={eraChips} total={items.length} />}

        {/* ── timeline ────────────────────────────────────── */}
        <div className="relative pl-14 sm:pl-16">
          <div className="absolute left-4 sm:left-5 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[var(--color-primary)] via-[var(--color-accent)] to-[var(--color-border)]" />

          {eras.map((era) => (
            <section key={era.id} id={`era-${era.id}`} className="scroll-mt-32">
              {/* era-divider */}
              <div className="relative -ml-14 sm:-ml-16 pl-14 sm:pl-16 mt-8 mb-6 first:mt-0">
                <span
                  className="absolute left-[10px] sm:left-3 top-1.5 w-4 h-4 rounded-full bg-[var(--color-primary)] border-[3px] border-[var(--color-background)]"
                  style={{ boxShadow: "0 0 0 2px var(--color-primary)" }}
                />
                <div>
                  <small className="block text-[11px] tracking-[0.12em] uppercase font-bold text-[var(--color-primary)] mb-1">
                    {era.id}
                  </small>
                  <h3 className="text-xl sm:text-2xl font-bold tracking-tight">{era.label}</h3>
                </div>
              </div>

              {/* events */}
              {era.items.map((item) => {
                const isFuture = item.year > currentYear;
                const dotClass = item.highlight || item.is_current
                  ? "bg-[var(--color-primary)] border-[var(--color-primary)]"
                  : isFuture
                  ? "bg-white border-[var(--color-border-dark)] border-dashed"
                  : "bg-white border-[var(--color-primary)]";
                const shadowStyle = item.highlight ? { boxShadow: "0 0 0 4px rgba(122,31,43,0.15)" } : undefined;
                return (
                  <article
                    key={item.id}
                    className="relative -ml-14 sm:-ml-16 pl-14 sm:pl-16 pr-6 py-5 bg-white border border-[var(--color-border)] rounded-2xl mb-3"
                  >
                    <span
                      className={`absolute left-[11px] sm:left-[13px] top-7 w-3.5 h-3.5 rounded-full border-2 ${dotClass}`}
                      style={shadowStyle}
                    />
                    <div className="grid grid-cols-[60px_1fr_auto] sm:grid-cols-[88px_1fr_auto] items-start sm:items-center gap-3 sm:gap-5">
                      <span className={`tabular-nums font-bold text-[15px] sm:text-base ${
                        item.is_current ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)]"
                      }`}>
                        {item.year}
                      </span>
                      <div className="min-w-0">
                        <h4 className={`font-bold tracking-tight ${
                          item.is_current ? "text-[var(--color-accent)] text-base sm:text-lg"
                            : item.highlight ? "text-[var(--color-primary)] text-base sm:text-lg"
                            : "text-[var(--color-text)] text-[15px] sm:text-base"
                        }`}>
                          {item.event}
                          {item.is_current && (
                            <span className="ml-2 align-middle text-[10px] bg-[var(--color-accent)] text-white px-2 py-0.5 rounded-full font-semibold tracking-wider">
                              현재
                            </span>
                          )}
                        </h4>
                        {item.detail && (
                          <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--color-text-muted)]">{item.detail}</p>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
          ))}
        </div>

        <p className="mt-10 text-center text-[13px] text-[var(--color-text-muted)]">
          오늘을 기록하면 역사가 됩니다 — 주보 아카이브에서 본당의 매 주를 확인하세요.
        </p>
      </SectionLayout>
    </>
  );
}
