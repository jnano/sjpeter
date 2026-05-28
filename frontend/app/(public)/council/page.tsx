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
  "회장단": "회장단",
  "분과대표": "분과 대표",
  "구역장대표": "구역장 대표",
};

function MemberCard({ member }: { member: CouncilMember }) {
  const initial = member.name.slice(-1);
  return (
    <div className="flex flex-col items-center text-center">
      <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[var(--color-border)] bg-[var(--color-surface-warm)] mb-2 shrink-0">
        {member.photo_url?.trim() ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={member.photo_url.startsWith("http") ? member.photo_url : `${API}${member.photo_url}`}
            alt={member.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[var(--color-primary)]/10">
            <span className="text-2xl font-bold text-[var(--color-primary)]/50">{initial}</span>
          </div>
        )}
      </div>
      <p className="font-semibold text-[var(--color-text)] text-sm leading-tight">{member.name}</p>
      <p className="text-xs text-[var(--color-text-muted)] mt-0.5 leading-tight">{member.role}</p>
    </div>
  );
}

/* ─── 조직도 (정적 트리) ──────────────────────────────── */
function OrgChart({ members }: { members: CouncilMember[] }) {
  const findByRole = (roles: string[]) =>
    members.filter((m) => roles.some((r) => m.role.includes(r)));

  const chairs = findByRole(["회장"]).filter((m) => !m.role.includes("부회장"));
  const viceChairs = findByRole(["부회장"]);
  const hasChairs = chairs.length > 0 || viceChairs.length > 0;

  return (
    <div className="mb-8 bg-white border border-[var(--color-border)] rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-warm)] flex items-baseline justify-between">
        <h2 className="text-[13px] tracking-[0.12em] uppercase font-bold text-[var(--color-primary)]">조직도</h2>
        <span className="text-[11px] text-[var(--color-text-muted)]">Organization</span>
      </div>
      <div className="px-6 py-6 overflow-x-auto">
        <div className="min-w-[480px]">

          {/* 최상위: 주임신부 */}
          <div className="flex justify-center mb-2">
            <OrgNode label="주임신부" primary />
          </div>

          {/* 연결선 */}
          <div className="flex justify-center mb-2">
            <div className="w-px h-6 bg-[var(--color-border-dark)]" />
          </div>

          {/* 2단계: 보좌신부 / 사목회장 / 수녀원 */}
          <div className="flex justify-center items-start gap-8 mb-2">
            <div className="flex flex-col items-center gap-2">
              <OrgNode label="보좌신부" />
              <OrgConnectorLine />
              <OrgNode label="수녀원" small />
            </div>

            <div className="flex flex-col items-center">
              <div className="w-px h-6 bg-[var(--color-border-dark)]" />
              <OrgNode label={hasChairs && chairs[0] ? `사목회장\n${chairs[0].name}` : "사목회장"} primary />
            </div>
          </div>

          {/* 사목회장 아래 연결선 */}
          {hasChairs && viceChairs.length > 0 && (
            <>
              <div className="flex justify-center mb-2">
                <div className="w-px h-6 bg-[var(--color-border-dark)]" />
              </div>

              {/* 3단계: 부회장들 */}
              <div className="flex justify-center gap-4 mb-2">
                {viceChairs.map((m) => (
                  <OrgNode key={m.id} label={`${m.role}\n${m.name}`} />
                ))}
              </div>
            </>
          )}

          {/* 하단 설명 */}
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            {[
              { label: "분과대표", count: members.filter((m) => m.category === "분과대표").length },
              { label: "구역장대표", count: members.filter((m) => m.category === "구역장대표").length },
            ].map(({ label, count }) =>
              count > 0 ? (
                <div key={label} className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-warm)] border border-[var(--color-border)] rounded-full px-3 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-border-dark)] inline-block" />
                  {label} {count}명
                </div>
              ) : null
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function OrgNode({ label, primary, small }: { label: string; primary?: boolean; small?: boolean }) {
  const lines = label.split("\n");
  return (
    <div className={`rounded-lg border text-center px-3 py-2 min-w-[80px] ${
      primary
        ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
        : "bg-white border-[var(--color-border-dark)] text-[var(--color-text)]"
    } ${small ? "opacity-70" : ""}`}>
      {lines.map((l, i) => (
        <p key={i} className={i === 0 ? "text-xs font-semibold leading-tight" : "text-[11px] leading-tight opacity-80"}>
          {l}
        </p>
      ))}
    </div>
  );
}

function OrgConnectorLine() {
  return <div className="w-px h-4 bg-[var(--color-border-dark)]" />;
}

/* ─── 메인 페이지 ────────────────────────────────────── */
export default async function CouncilPage() {
  const members = await getMembers();

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: CATEGORY_LABEL[cat] ?? cat,
    members: members.filter((m) => m.category === cat),
  })).filter((g) => g.members.length > 0);

  const isEmpty = members.length === 0;

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
          <>
            <OrgChart members={members} />

            <div className="space-y-8">
              {grouped.map(({ category, label, members: cats }) => (
                <section key={category} className="bg-white border border-[var(--color-border)] rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-warm)] flex items-center gap-3">
                    <span className="inline-block w-1 h-5 rounded-full bg-[var(--color-accent)]" />
                    <h2 className="text-[13px] tracking-[0.12em] uppercase font-bold text-[var(--color-primary)]">{label}</h2>
                    <span className="text-[11px] tabular-nums text-[var(--color-text-muted)] ml-auto font-bold">{cats.length}명</span>
                  </div>
                  <div className={`p-6 grid gap-6 ${
                    cats.length <= 4
                      ? "grid-cols-2 sm:grid-cols-4"
                      : "grid-cols-3 sm:grid-cols-4 md:grid-cols-5"
                  }`}>
                    {cats.map((m) => (
                      <MemberCard key={m.id} member={m} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}

        {/* 하단 안내 */}
        <div className="mt-8 bg-[var(--color-surface-warm)] border border-[var(--color-border)] rounded-xl px-6 py-4 text-sm text-[var(--color-text-muted)] leading-relaxed">
          <p className="font-medium text-[var(--color-text)] mb-1">사목평의회 안내</p>
          <p>사목평의회는 주임신부님을 중심으로 본당 운영의 주요 사항을 협의하고 공동체 발전을 위해 함께 기도하고 실천하는 본당 최고 의결 기구입니다.</p>
          <p className="mt-1">회의: 분기별 정기회의 및 필요시 임시회의</p>
        </div>

      </SectionLayout>
    </>
  );
}
