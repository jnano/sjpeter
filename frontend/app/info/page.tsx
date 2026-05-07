import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import KakaoMap from "./KakaoMap";

export const metadata: Metadata = {
  title: "오시는 길",
  description: "세종성베드로성당 찾아오시는 길 — 주소, 연락처, 지도",
};

// 좌표가 바뀌면 바로 반영돼야 하므로 캐시하지 않는다
export const dynamic = "force-dynamic";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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
    const res = await fetch(`${API}/api/parish/`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function InfoPage() {
  const parish = await getParish();
  const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY ?? "";

  const name = parish?.name ?? "세종성베드로성당";
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
  const groupedDays = Object.keys(DAY_ORDER).filter((d) =>
    sortedEntries.some((e) => e.day === d)
  );

  const mapReady = appKey && appKey !== "여기에_JavaScript_키_입력" && lat !== null && lng !== null;

  return (
    <>
      <PageHeader group="우리 성당" title="찾아오시는 길" subtitle="세종성베드로성당을 찾아오시는 방법" />
      <div className="max-w-4xl mx-auto px-4 py-8">

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
                    ? ".env.local의 NEXT_PUBLIC_KAKAO_MAP_KEY를 설정하면 지도가 표시됩니다"
                    : "관리자 > 성당 정보에서 지도 좌표를 입력하면 지도가 표시됩니다"}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {groupedDays.length > 0 && (
        <div className="mb-5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6">
          <h2 className="font-serif font-bold text-[var(--color-primary)] mb-4">미사 시간</h2>
          <div className="space-y-3 text-sm">
            {groupedDays.map((day) => {
              const dayEntries = sortedEntries.filter((e) => e.day === day);
              return (
                <div key={day} className="flex gap-4">
                  <span className="text-[var(--color-text-muted)] w-24 shrink-0">{day}</span>
                  <span>
                    {dayEntries.map((e, i) => (
                      <span key={i}>
                        {i > 0 && " / "}
                        {e.time}{e.note ? ` (${e.note})` : ""}
                      </span>
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
          {parish?.mass_schedule?.note && (
            <p className="mt-3 text-xs text-[var(--color-text-muted)]">{parish.mass_schedule.note}</p>
          )}
        </div>
      )}

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

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6">
          <h2 className="font-serif font-bold text-[var(--color-primary)] mb-4">교통 안내</h2>
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-medium mb-1">🚌 버스</p>
              <p className="text-[var(--color-text-muted)] leading-relaxed">
                ○○번, ○○번 이용 → 세종성베드로성당 정류장 하차
              </p>
            </div>
            <div>
              <p className="font-medium mb-1">🚗 자가용</p>
              <p className="text-[var(--color-text-muted)] leading-relaxed">
                성당 주차장 이용 가능 (주일 미사 시 혼잡할 수 있습니다)
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
