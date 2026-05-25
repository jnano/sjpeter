import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";
import CrossIcon from "@/components/icons/CrossIcon";
import KakaoMap from "./KakaoMap";
import { fetchParishMin } from "@/lib/parish";

export async function generateMetadata(): Promise<Metadata> {
  const p = await fetchParishMin();
  return { title: "찾아오시는 길", description: `${p.name} 찾아오시는 길 — 주소, 연락처, 지도` };
}

// 좌표가 바뀌면 바로 반영돼야 하므로 캐시하지 않는다
export const dynamic = "force-dynamic";

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface MassEntry { day: string; time: string; note: string; }
interface MassSchedule { entries: MassEntry[]; note: string; }
interface Parish {
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  fax: string | null;
  mass_schedule: MassSchedule | null;
}

const DAY_ORDER: Record<string, number> = {
  "주일": 0, "월요일": 1, "화요일": 2, "수요일": 3,
  "목요일": 4, "금요일": 5, "토요일": 6, "공휴일": 7,
};

async function getParish(): Promise<Parish | null> {
  try {
    const res = await fetch(`${API}/api/parish/`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

interface TransportRoute {
  id: number;
  label: string;
  description: string;
}

async function getTransportRoutes(): Promise<TransportRoute[]> {
  try {
    const res = await fetch(`${API}/api/transport-routes`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function InfoPage() {
  const [parish, transportRoutes] = await Promise.all([getParish(), getTransportRoutes()]);
  // KAKAO_MAP_KEY 는 site_settings DB 단일 source — process.env fallback 사용 안 함.
  // admin /admin/settings 의 OAuth 그룹에서 입력. 비어 있으면 지도 영역만 안내 메시지로 대체.
  let appKey = "";
  try {
    const cfgRes = await fetch(`${API}/api/public/site-config`);
    if (cfgRes.ok) {
      const cfg = await cfgRes.json();
      appKey = cfg.KAKAO_MAP_KEY ?? "";
    }
  } catch {}

  const name = parish?.name ?? "본당 홈페이지";
  const address = parish?.address ?? "세종특별자치시 도움5로 00";
  const phone = parish?.phone ?? "";
  const fax = parish?.fax ?? "";
  const lat = parish?.lat ?? null;
  const lng = parish?.lng ?? null;

  const entries = parish?.mass_schedule?.entries ?? [];
  const sortedEntries = [...entries].sort((a, b) => {
    const dayDiff = (DAY_ORDER[a.day] ?? 99) - (DAY_ORDER[b.day] ?? 99);
    return dayDiff !== 0 ? dayDiff : a.time.localeCompare(b.time);
  });
  const mapReady = appKey && appKey !== "여기에_JavaScript_키_입력" && lat !== null && lng !== null;

  return (
    <>
      <PageHeader group="성당 소개" title="찾아오시는 길" subtitle={`${name}을 찾아오시는 방법`} />
      <SectionLayout group="about" tools>

      <div className="mb-6">
        {mapReady ? (
          <KakaoMap name={name} address={address} appKey={appKey} lat={lat!} lng={lng!} />
        ) : (
          <div className="bg-[var(--color-surface-warm)] border border-[var(--color-border)] rounded-xl overflow-hidden">
            <div className="h-72 flex items-center justify-center">
              <div className="text-center text-[var(--color-text-muted)]">
                <div className="text-5xl mb-3">📍</div>
                <p className="font-medium text-[var(--color-primary)]">{name}</p>
                <p className="text-sm mt-1">{address}</p>
                <p className="text-xs mt-3 text-[var(--color-border-dark)]">
                  {!appKey || appKey === "여기에_JavaScript_키_입력"
                    ? "관리자 > 사이트 설정 > OAuth 그룹에서 카카오맵 JavaScript 키를 입력하면 지도가 표시됩니다"
                    : "관리자 > 성당 정보에서 지도 좌표를 입력하면 지도가 표시됩니다"}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6">
          <h2 className="font-serif font-bold text-[var(--color-primary)] mb-4">기본 정보</h2>
          <div className="space-y-3 text-sm">
            <div className="flex gap-3">
              <span className="text-[var(--color-text-muted)] w-12 shrink-0">주소</span>
              <span>{address}</span>
            </div>
            {phone && (
              <div className="flex gap-3">
                <span className="text-[var(--color-text-muted)] w-12 shrink-0">전화</span>
                <a href={`tel:${phone}`} className="text-[var(--color-primary)] hover:underline">
                  {phone}
                </a>
              </div>
            )}
            {fax && (
              <div className="flex gap-3">
                <span className="text-[var(--color-text-muted)] w-12 shrink-0">팩스</span>
                <span>{fax}</span>
              </div>
            )}
          </div>
        </div>

        {/* 미사 시간 — grid 우측 셀. 일정 없으면 빈 자리 차지 안 함 */}
        {sortedEntries.length > 0 && (() => {
          const sundayEntries   = sortedEntries.filter((e) => e.day === "주일");
          const saturdayEntries = sortedEntries.filter((e) => e.day === "토요일");
          const holidayEntries  = sortedEntries.filter((e) => e.day === "공휴일");
          const weekdayOrder = ["월요일", "화요일", "수요일", "목요일", "금요일"];
          const weekdayByDay = weekdayOrder
            .map((d) => ({ day: d, list: sortedEntries.filter((e) => e.day === d) }))
            .filter((g) => g.list.length > 0);

          // 평일을 같은 시간 패턴끼리 묶기 (예: 월·화·수·목 → 06:00, 금 → 06:00·19:30)
          const weekdayGroups: { label: string; times: MassEntry[] }[] = [];
          const seenPatterns = new Set<string>();
          for (const { day, list } of weekdayByDay) {
            const key = list.map((e) => `${e.time}|${e.note ?? ""}`).join(";");
            if (seenPatterns.has(key)) continue;
            seenPatterns.add(key);
            const sameDays = weekdayByDay
              .filter((g) => g.list.map((e) => `${e.time}|${e.note ?? ""}`).join(";") === key)
              .map((g) => g.day.replace("요일", ""));
            weekdayGroups.push({ label: sameDays.join("·"), times: list });
          }

          const renderTimes = (times: MassEntry[]) => (
            <div className="flex-1 flex flex-wrap gap-x-3.5 gap-y-1">
              {times.map((e, i) => (
                <span key={i} className="text-sm">
                  <span className="font-semibold text-[var(--color-text)]">{e.time}</span>
                  {e.note && (
                    <span className="text-[11px] text-[var(--color-text-muted)] ml-1">({e.note})</span>
                  )}
                </span>
              ))}
            </div>
          );

          return (
            <div className="bg-white border border-[var(--color-border)] rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-warm)] flex items-center gap-2.5">
                <CrossIcon className="text-[var(--color-accent)]" />
                <h2 className="font-serif font-bold text-[var(--color-primary)] text-base tracking-wide">미사 시간</h2>
              </div>

              <div className="divide-y divide-[var(--color-border)]/60">
                {sundayEntries.length > 0 && (
                  <div className="px-5 py-3 flex items-baseline gap-4">
                    <div className="w-20 sm:w-24 shrink-0">
                      <span className="font-semibold text-sm text-[var(--color-primary)]">주일</span>
                    </div>
                    {renderTimes(sundayEntries)}
                  </div>
                )}

                {saturdayEntries.length > 0 && (
                  <div className="px-5 py-3 flex items-baseline gap-4">
                    <div className="w-20 sm:w-24 shrink-0">
                      <span className="font-semibold text-sm text-[var(--color-primary)]">토요일</span>
                      <span className="block text-[10px] text-[var(--color-text-muted)] mt-0.5">주일 특전</span>
                    </div>
                    {renderTimes(saturdayEntries)}
                  </div>
                )}

                {weekdayGroups.map(({ label, times }) => (
                  <div key={label} className="px-5 py-3 flex items-baseline gap-4">
                    <div className="w-20 sm:w-24 shrink-0">
                      <span className="font-medium text-sm text-[var(--color-text)]">{label}</span>
                    </div>
                    {renderTimes(times)}
                  </div>
                ))}

                {holidayEntries.length > 0 && (
                  <div className="px-5 py-3 flex items-baseline gap-4">
                    <div className="w-20 sm:w-24 shrink-0">
                      <span className="font-medium text-sm text-[var(--color-text)]">공휴일</span>
                    </div>
                    {renderTimes(holidayEntries)}
                  </div>
                )}
              </div>

              {parish?.mass_schedule?.note && (
                <div className="px-5 py-2.5 bg-[var(--color-surface-warm)] border-t border-[var(--color-border)] flex items-start gap-2">
                  <span className="text-[10px] text-[var(--color-text-muted)] mt-0.5">ⓘ</span>
                  <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                    {parish.mass_schedule.note}
                  </p>
                </div>
              )}
            </div>
          );
        })()}

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 md:col-span-2">
          <h2 className="font-serif font-bold text-[var(--color-primary)] mb-4">교통 안내</h2>

          {/* 출발지별 대중교통 카드 — admin/parish/info 에서 관리. 빈 상태면 카드 영역 숨김 */}
          {transportRoutes.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {transportRoutes.map((route) => (
                <div
                  key={route.id}
                  className="border border-[var(--color-border)] rounded-lg p-4 bg-[var(--color-surface-warm)]/40"
                >
                  <p className="font-medium text-sm mb-1.5 flex items-center gap-1.5">
                    <span aria-hidden>🚌</span>
                    <span>{route.label}</span>
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] leading-relaxed whitespace-pre-wrap">
                    {route.description}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* 자가용은 모든 경우 공통 안내 */}
          <div className="border-t border-[var(--color-border)] pt-3">
            <p className="font-medium mb-1 text-sm">🚗 자가용</p>
            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
              성당 주차장 이용 가능 (주일 미사 시 혼잡할 수 있습니다)
            </p>
          </div>
        </div>
      </div>
      </SectionLayout>
    </>
  );
}
