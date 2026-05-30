import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";
import CrossIcon from "@/components/icons/CrossIcon";
import { fetchParishMin } from "@/lib/parish";

export async function generateMetadata(): Promise<Metadata> {
  const p = await fetchParishMin();
  return { title: "사목평의회", description: `${p.name} 사목평의회 조직도 및 구성원 소개` };
}

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface CouncilMember {
  id: number;
  name: string;
  role: string;
  category: string;
  photo_url: string | null;
  sort_order: number;
}

async function getMembers(): Promise<CouncilMember[]> {
  try {
    const res = await fetch(`${API}/api/content/council`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

const CATEGORY_ORDER = ["회장단", "분과대표", "구역장대표"];
const CATEGORY_LABEL: Record<string, string> = {
  "회장단": "임원",
  "분과대표": "분과 대표",
  "구역장대표": "구역장 대표",
};

function lastChar(name: string) {
  return name.slice(-1);
}

/* ───────── 시안 council.html — Org chart ───────── */
function OrgChart({ members }: { members: CouncilMember[] }) {
  const chairs = members.filter((m) => m.role.includes("회장") && !m.role.includes("부회장"));
  const viceChairs = members.filter((m) => m.role.includes("부회장"));
  const treasurers = members.filter((m) => m.role.includes("총무") || m.role.includes("재무"));
  const heads = members.filter(
    (m) => m.role.includes("분과장") || m.role.includes("청년회장") || m.role.includes("부장"),
  );

  // v1.5.430 — deputy ink 단 제거. lead(와인) + regular(흰 outlined) 2단만.
  const Node = ({
    member,
    label,
    variant = "regular",
  }: {
    member?: CouncilMember;
    label?: string;
    variant?: "lead" | "regular";
  }) => {
    const bg =
      variant === "lead"
        ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
        : "bg-white border-[var(--color-border)] text-[var(--color-text)]";
    const avBg = "bg-[var(--color-accent)] text-[var(--color-text)]";
    const name = member?.name ?? "";
    const role = member?.role ?? label ?? "";
    return (
      <div className={`rounded-xl border px-4 py-3 text-center min-w-[140px] ${bg}`}>
        <div className={`w-9 h-9 rounded-full mx-auto mb-2 flex items-center justify-center text-sm font-bold ${avBg}`}>
          {name ? lastChar(name) : "✠"}
        </div>
        <div className="text-[10px] tracking-[0.08em] uppercase font-bold mb-1 opacity-80">{role}</div>
        <div className="text-[13px] font-bold tracking-tight">
          {name || "—"}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white border border-[var(--color-border)] rounded-2xl p-6 md:p-10 relative">
      {/* 상단: 의장 (주임신부 가정) */}
      <div className="flex justify-center mb-3">
        <Node label="✠ 의장" variant="lead" member={undefined as unknown as CouncilMember | undefined} />
      </div>
      <div className="w-px h-7 bg-[var(--color-border)] mx-auto mb-3" />

      {/* 2단: 회장(없으면 부회장) + 총무·재무 */}
      {(chairs.length > 0 || viceChairs.length > 0) && (
        <>
          <div className="grid gap-3 md:gap-4 justify-center mb-3" style={{ gridTemplateColumns: `repeat(${Math.min(2, Math.max(1, chairs.length + viceChairs.length))}, minmax(140px, 1fr))`, maxWidth: 520, margin: "0 auto 12px" }}>
            {chairs.slice(0, 2).map((m) => (
              <Node key={m.id} member={m} variant="regular" />
            ))}
            {viceChairs.slice(0, 2).map((m) => (
              <Node key={m.id} member={m} variant="regular" />
            ))}
          </div>
          {(heads.length > 0 || treasurers.length > 0) && (
            <div className="w-px h-7 bg-[var(--color-border)] mx-auto mb-3" />
          )}
        </>
      )}

      {/* 3단: 분과장들 (4열 그리드) */}
      {heads.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-3">
          {heads.map((m) => (
            <Node key={m.id} member={m} variant="regular" />
          ))}
        </div>
      )}

      {/* 임원 (총무/재무) */}
      {treasurers.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {treasurers.map((m) => (
            <Node key={m.id} member={m} variant="regular" />
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────── 시안 council.html — Members table ───────── */
function MembersTable({ members }: { members: CouncilMember[] }) {
  return (
    <div className="bg-white border border-[var(--color-border)] rounded-2xl overflow-hidden">
      {/* Header row */}
      <div className="grid grid-cols-[40px_1.4fr_1fr_1fr_90px] gap-3 md:gap-4 px-4 md:px-6 py-3 bg-[var(--color-surface-warm)] text-[11px] tracking-[0.08em] uppercase text-[var(--color-text-muted)] font-bold">
        <span>NO</span>
        <span>이름</span>
        <span>직책</span>
        <span>분과</span>
        <span className="text-right">임기</span>
      </div>
      {members.map((m, i) => {
        const isLead = m.role.includes("회장") && !m.role.includes("부회장");
        return (
          <div
            key={m.id}
            className="grid grid-cols-[40px_1.4fr_1fr_1fr_90px] gap-3 md:gap-4 px-4 md:px-6 py-3.5 border-t border-[var(--color-border)] items-center"
          >
            <span className="text-center font-bold text-[var(--color-text-muted)] text-[12px] tabular-nums">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0 ${
                  isLead
                    ? "bg-[var(--color-primary)] text-white"
                    : "bg-[var(--color-accent)] text-[var(--color-text)]"
                }`}
              >
                {lastChar(m.name)}
              </div>
              <div className="min-w-0">
                <div className="text-[13px] md:text-[14px] font-bold text-[var(--color-text)] truncate">{m.name}</div>
              </div>
            </div>
            <div className={`text-[12px] md:text-[13px] font-bold truncate ${isLead ? "text-[var(--color-primary)]" : "text-[var(--color-text)]"}`}>
              {m.role}
            </div>
            <div className="text-[12px] md:text-[13px] text-[var(--color-text-muted)] truncate">
              {CATEGORY_LABEL[m.category] ?? m.category}
            </div>
            <div className="text-[11px] md:text-[12px] text-[var(--color-text-muted)] tabular-nums text-right">
              {isLead ? "상임" : "—"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ───────── Main ───────── */
export default async function CouncilPage() {
  const [members, parish] = await Promise.all([getMembers(), fetchParishMin()]);
  const isEmpty = members.length === 0;

  // Intro 우측 stats — 시안에서 비어 있는 3칸. 현재 데이터에서 유추.
  const total = members.length;
  const leadCount = members.filter((m) => m.category === "회장단").length;
  const headCount = members.filter((m) => m.role.includes("분과장") || m.role.includes("청년회장")).length;

  // 카테고리별 정렬 — 표는 회장단 → 분과대표 → 구역장대표
  const ordered = [...members].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a.category);
    const ib = CATEGORY_ORDER.indexOf(b.category);
    if (ia !== ib) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return a.sort_order - b.sort_order;
  });

  return (
    <>
      <PageHeader group="본당 공동체" title="사목평의회" subtitle="본당 공동체의 사목 방향을 함께 의논하는 기구" />
      <SectionLayout group="community" tools>
        {isEmpty ? (
          <div className="bg-white border border-[var(--color-border)] rounded-2xl p-8 text-center py-20">
            <div className="text-5xl mb-4"><CrossIcon /></div>
            <p className="font-serif text-lg text-[var(--color-primary)] mb-2">준비 중입니다</p>
            <p className="text-sm text-[var(--color-text-muted)]">관리자 페이지에서 구성원을 등록해 주세요.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Intro — bg-2 surface, eyebrow + h2 + 3 stats */}
            <section className="bg-[var(--color-surface-warm)] rounded-2xl px-6 md:px-8 py-7 md:py-8 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-7 md:gap-8 items-center">
              <div>
                <div
                  className="text-[11px] tracking-[0.18em] uppercase font-bold inline-flex items-center gap-3 mb-3"
                  style={{ color: "var(--color-primary)" }}
                >
                  <span className="w-6 h-px" style={{ background: "var(--color-primary)" }} />
                  사목평의회 · Parish Council
                </div>
                <h2 className="text-[22px] md:text-[24px] font-bold tracking-[-0.025em] mb-2 text-[var(--color-text)]">
                  함께 의논하고, 함께 결정합니다.
                </h2>
                <p className="text-[13px] md:text-[14px] leading-[1.7] text-[var(--color-text-muted)] max-w-[580px]">
                  사목평의회는 주임신부님을 보좌하여 {parish.name} 의 모든 사목 활동을 자문하고
                  협력하는 신자 대표 협의체입니다. 정기 회의를 통해 본당의 운영 방향을 함께 살피고 결정합니다.
                </p>
              </div>
              <div className="flex gap-6 md:gap-8 justify-center md:justify-end">
                {[
                  { v: total, l: "구성원" },
                  { v: leadCount, l: "임원" },
                  { v: headCount, l: "분과장" },
                ].map((s) => (
                  <div key={s.l} className="text-center min-w-[68px]">
                    <b
                      className="block text-[26px] md:text-[30px] font-bold tabular-nums leading-none"
                      style={{ color: "var(--color-primary)" }}
                    >
                      {s.v}
                    </b>
                    <span className="block text-[10px] md:text-[11px] uppercase tracking-[0.05em] font-bold mt-1.5 text-[var(--color-text-muted)]">
                      {s.l}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Org chart */}
            <section>
              <div className="mb-5">
                <div
                  className="text-[11px] tracking-[0.18em] uppercase font-bold inline-flex items-center gap-3 mb-3"
                  style={{ color: "var(--color-primary)" }}
                >
                  <span className="w-6 h-px" style={{ background: "var(--color-primary)" }} />
                  조직도 · Organization
                </div>
                <h2 className="text-[22px] md:text-[24px] font-bold tracking-[-0.025em] text-[var(--color-text)]">
                  사목평의회 구성
                </h2>
              </div>
              <OrgChart members={members} />
            </section>

            {/* Members table */}
            <section>
              <div className="mb-5 flex items-end justify-between gap-3 flex-wrap">
                <div>
                  <div
                    className="text-[11px] tracking-[0.18em] uppercase font-bold inline-flex items-center gap-3 mb-3"
                    style={{ color: "var(--color-primary)" }}
                  >
                    <span className="w-6 h-px" style={{ background: "var(--color-primary)" }} />
                    위원 명단 · Members
                  </div>
                  <h2 className="text-[22px] md:text-[24px] font-bold tracking-[-0.025em] text-[var(--color-text)]">
                    {parish.name} 사목평의회 <span className="text-[var(--color-text-muted)] font-bold">({total}명)</span>
                  </h2>
                </div>
              </div>
              <MembersTable members={ordered} />
            </section>
          </div>
        )}

        {/* 하단 안내 */}
        <div className="mt-10 bg-[var(--color-surface-warm)] border border-[var(--color-border)] rounded-xl px-6 py-4 text-[13px] text-[var(--color-text-muted)] leading-relaxed">
          <p className="font-bold text-[var(--color-text)] mb-1">사목평의회 안내</p>
          <p>주임신부님을 중심으로 본당 운영의 주요 사항을 협의하고 공동체 발전을 위해 함께 기도하고 실천하는 본당 협의 기구입니다.</p>
          <p className="mt-1">회의: 분기별 정기회의 및 필요시 임시회의</p>
        </div>
      </SectionLayout>
    </>
  );
}
