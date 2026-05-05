import type { Metadata } from "next";
import KakaoMap from "./KakaoMap";

export const metadata: Metadata = {
  title: "오시는 길",
  description: "세종성베드로성당 찾아오시는 길 — 주소, 연락처, 지도",
};

// 좌표가 바뀌면 바로 반영돼야 하므로 캐시하지 않는다
export const dynamic = "force-dynamic";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Parish {
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
}

async function getParish(): Promise<Parish | null> {
  try {
    const res = await fetch(`${API}/api/parish/`, { cache: "no-store" });
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
  const lat = parish?.lat ?? null;
  const lng = parish?.lng ?? null;

  const mapReady = appKey && appKey !== "여기에_JavaScript_키_입력" && lat !== null && lng !== null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-[var(--color-primary)] mb-2">
          오시는 길
        </h1>
        <p className="text-[var(--color-text-muted)]">세종성베드로성당을 찾아오시는 방법</p>
      </div>

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
            <div className="flex gap-3">
              <span className="text-[var(--color-text-muted)] w-12 shrink-0">사무실</span>
              <span>평일 오전 9:00 – 오후 5:00</span>
            </div>
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
  );
}
