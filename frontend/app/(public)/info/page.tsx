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
// v1.5.452 — force-dynamic → 5분 ISR + 태그 기반 무효화. admin 저장 시 revalidateTag 로 즉시 반영.
export const revalidate = 300;

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
    const res = await fetch(`${API}/api/parish/`, { next: { revalidate: 300, tags: ["parish"] } });
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
    const res = await fetch(`${API}/api/transport-routes`, { next: { revalidate: 300, tags: ["transport"] } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function InfoPage() {
  const [parish, transportRoutes] = await Promise.all([getParish(), getTransportRoutes()]);
  let appKey = "";
  try {
    const cfgRes = await fetch(`${API}/api/public/site-config`, { next: { revalidate: 300, tags: ["parish"] } });
    if (cfgRes.ok) {
      const cfg = await cfgRes.json();
      appKey = cfg.KAKAO_MAP_KEY ?? "";
    }
  } catch {}

  const name = parish?.name ?? "본당 홈페이지";
  const address = parish?.address ?? "";
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

  const naverMapUrl = lat !== null && lng !== null
    ? `https://map.naver.com/p/search/${encodeURIComponent(address)}`
    : null;
  const kakaoMapUrl = lat !== null && lng !== null
    ? `https://map.kakao.com/?q=${encodeURIComponent(address)}`
    : null;

  return (
    <>
      <PageHeader group="성당 소개" title="찾아오시는 길" subtitle={`${name}을 찾아오시는 방법`} />
      <SectionLayout group="about" tools>

        {/* ── map-hero (시안 .map-hero 톤) ─────────────────── */}
        <section className="relative rounded-3xl overflow-hidden border border-[var(--color-border)] mb-8">
          {mapReady ? (
            <div className="relative aspect-[16/9] md:aspect-[16/8]">
              <KakaoMap name={name} address={address} appKey={appKey} lat={lat!} lng={lng!} />

              {/* 좌하단 map-tip */}
              <div className="absolute left-3 sm:left-4 bottom-3 sm:bottom-4 bg-white/95 backdrop-blur px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg shadow-sm flex items-center gap-3 sm:gap-4 text-[11px] sm:text-[12px] text-[var(--color-text-muted)] z-[1] pointer-events-none">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-[var(--color-primary)]" />
                  <b className="text-[var(--color-text)] font-bold">{name}</b>
                </span>
                <span className="hidden sm:inline text-[var(--color-border)]">·</span>
                <span className="hidden sm:inline">정확한 위치는 핀을 확인하세요</span>
              </div>

              {/* 우하단 map-actions */}
              <div className="absolute right-3 sm:right-4 bottom-3 sm:bottom-4 flex gap-1.5 z-[1]">
                {kakaoMapUrl && (
                  <a
                    href={kakaoMapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 bg-white/95 backdrop-blur border border-[var(--color-border)] rounded-lg text-[11px] sm:text-[12px] font-semibold text-[var(--color-text)] hover:bg-white shadow-sm"
                  >
                    카카오 길찾기 →
                  </a>
                )}
                {naverMapUrl && (
                  <a
                    href={naverMapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hidden sm:inline-block px-3 py-2 bg-white/95 backdrop-blur border border-[var(--color-border)] rounded-lg text-[12px] font-semibold text-[var(--color-text)] hover:bg-white shadow-sm"
                  >
                    네이버 →
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-[var(--color-surface-warm)] aspect-[16/9] md:aspect-[16/8] flex items-center justify-center">
              <div className="text-center text-[var(--color-text-muted)] px-6">
                <div className="text-5xl mb-3">📍</div>
                <p className="font-semibold text-[var(--color-primary)]">{name}</p>
                <p className="text-sm mt-1">{address}</p>
                <p className="text-xs mt-3 text-[var(--color-border-dark)]">
                  {!appKey || appKey === "여기에_JavaScript_키_입력"
                    ? "관리자 > 사이트 설정 > OAuth 그룹에서 카카오맵 키를 입력하면 지도가 표시됩니다"
                    : "관리자 > 성당 정보에서 지도 좌표를 입력하면 지도가 표시됩니다"}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* ── info grid ────────────────────────────────────── */}
        <div className="grid md:grid-cols-2 gap-5">
          {/* 기본 정보 */}
          <section className="bg-white border border-[var(--color-border)] rounded-2xl p-6 sm:p-7">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-[13px] tracking-[0.12em] uppercase font-bold text-[var(--color-primary)]">기본 정보</h2>
              <span className="text-[11px] text-[var(--color-text-muted)]">Visit & Contact</span>
            </div>
            <dl className="space-y-3.5 text-[14px]">
              <div className="grid grid-cols-[64px_1fr] gap-3 items-start">
                <dt className="text-[var(--color-text-muted)] text-[12px] font-semibold pt-0.5">주소</dt>
                <dd className="text-[var(--color-text)] leading-relaxed">{address}</dd>
              </div>
              {phone && (
                <div className="grid grid-cols-[64px_1fr] gap-3 items-start">
                  <dt className="text-[var(--color-text-muted)] text-[12px] font-semibold pt-0.5">전화</dt>
                  <dd>
                    <a href={`tel:${phone}`} className="text-[var(--color-primary)] font-semibold hover:underline">
                      {phone}
                    </a>
                  </dd>
                </div>
              )}
              {fax && (
                <div className="grid grid-cols-[64px_1fr] gap-3 items-start">
                  <dt className="text-[var(--color-text-muted)] text-[12px] font-semibold pt-0.5">팩스</dt>
                  <dd>{fax}</dd>
                </div>
              )}
            </dl>
          </section>

          {/* 미사 시간 */}
          {sortedEntries.length > 0 && (() => {
            const sundayEntries   = sortedEntries.filter((e) => e.day === "주일");
            const saturdayEntries = sortedEntries.filter((e) => e.day === "토요일");
            const holidayEntries  = sortedEntries.filter((e) => e.day === "공휴일");
            const weekdayOrder = ["월요일", "화요일", "수요일", "목요일", "금요일"];
            const weekdayByDay = weekdayOrder
              .map((d) => ({ day: d, list: sortedEntries.filter((e) => e.day === d) }))
              .filter((g) => g.list.length > 0);

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
                  <span key={i} className="text-[14px] tabular-nums">
                    <span className="font-semibold text-[var(--color-text)]">{e.time}</span>
                    {e.note && (
                      <span className="text-[11px] text-[var(--color-text-muted)] ml-1">({e.note})</span>
                    )}
                  </span>
                ))}
              </div>
            );

            return (
              <section className="bg-white border border-[var(--color-border)] rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-warm)] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <CrossIcon className="text-[var(--color-accent)]" />
                    <h2 className="text-[13px] tracking-[0.12em] uppercase font-bold text-[var(--color-primary)]">미사 시간</h2>
                  </div>
                  <span className="text-[11px] text-[var(--color-text-muted)]">Mass Schedule</span>
                </div>

                <div className="divide-y divide-[var(--color-border)]/60">
                  {sundayEntries.length > 0 && (
                    <div className="px-6 py-3.5 flex items-baseline gap-4">
                      <div className="w-20 sm:w-24 shrink-0">
                        <span className="font-bold text-[14px] text-[var(--color-primary)]">주일</span>
                      </div>
                      {renderTimes(sundayEntries)}
                    </div>
                  )}

                  {saturdayEntries.length > 0 && (
                    <div className="px-6 py-3.5 flex items-baseline gap-4 bg-[var(--color-text)]/[0.02]">
                      <div className="w-20 sm:w-24 shrink-0">
                        <span className="font-bold text-[14px] text-[var(--color-primary)]">토요일</span>
                        <span className="block text-[10px] text-[var(--color-text-muted)] mt-0.5">주일 특전</span>
                      </div>
                      {renderTimes(saturdayEntries)}
                    </div>
                  )}

                  {weekdayGroups.map(({ label, times }) => (
                    <div key={label} className="px-6 py-3.5 flex items-baseline gap-4">
                      <div className="w-20 sm:w-24 shrink-0">
                        <span className="font-semibold text-[14px] text-[var(--color-text)]">{label}</span>
                      </div>
                      {renderTimes(times)}
                    </div>
                  ))}

                  {holidayEntries.length > 0 && (
                    <div className="px-6 py-3.5 flex items-baseline gap-4">
                      <div className="w-20 sm:w-24 shrink-0">
                        <span className="font-semibold text-[14px] text-[var(--color-text)]">공휴일</span>
                      </div>
                      {renderTimes(holidayEntries)}
                    </div>
                  )}
                </div>

                {parish?.mass_schedule?.note && (
                  <div className="px-6 py-2.5 bg-[var(--color-surface-warm)] border-t border-[var(--color-border)] flex items-start gap-2">
                    <span className="text-[10px] text-[var(--color-text-muted)] mt-0.5">ⓘ</span>
                    <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
                      {parish.mass_schedule.note}
                    </p>
                  </div>
                )}
              </section>
            );
          })()}

          {/* 교통 안내 — md:col-span-2 */}
          <section className="md:col-span-2 bg-white border border-[var(--color-border)] rounded-2xl p-6 sm:p-7">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-[13px] tracking-[0.12em] uppercase font-bold text-[var(--color-primary)]">교통 안내</h2>
              <span className="text-[11px] text-[var(--color-text-muted)]">How to get here</span>
            </div>

            {transportRoutes.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                {transportRoutes.map((route) => (
                  <div
                    key={route.id}
                    className="border border-[var(--color-border)] rounded-xl p-4 bg-[var(--color-surface-warm)]/50"
                  >
                    <p className="font-bold text-[14px] mb-1.5 flex items-center gap-1.5 text-[var(--color-text)]">
                      <span aria-hidden>🚌</span>
                      <span>{route.label}</span>
                    </p>
                    <p className="text-[12px] text-[var(--color-text-muted)] leading-relaxed whitespace-pre-wrap">
                      {route.description}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-[var(--color-border)] pt-4">
              <p className="font-bold mb-1.5 text-[14px] text-[var(--color-text)]">🚗 자가용</p>
              <p className="text-[12px] text-[var(--color-text-muted)] leading-relaxed">
                성당 주차장 이용 가능 (주일 미사 시 혼잡할 수 있습니다)
              </p>
            </div>
          </section>
        </div>
      </SectionLayout>
    </>
  );
}
