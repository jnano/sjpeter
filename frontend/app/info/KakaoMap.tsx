"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    kakao: {
      maps: {
        load: (cb: () => void) => void;
        Map: new (el: HTMLElement, opts: object) => object;
        LatLng: new (lat: number, lng: number) => object;
        Marker: new (opts: object) => object;
        InfoWindow: new (opts: object) => { open: (map: object, marker: object) => void };
      };
    };
  }
}

interface Props {
  lat: number;
  lng: number;
  name: string;
  address: string;
  appKey: string;
}

const SCRIPT_ID = "kakao-map-sdk";

export default function KakaoMap({ lat, lng, name, address, appKey }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const drawn = useRef(false);

  useEffect(() => {
    drawn.current = false;
    console.log("[KakaoMap] useEffect 실행, lat:", lat, "lng:", lng);

    function draw() {
      console.log("[KakaoMap] draw() 호출, mapRef:", !!mapRef.current, "drawn:", drawn.current);
      if (!mapRef.current || drawn.current) return;
      drawn.current = true;
      try {
        const pos = new window.kakao.maps.LatLng(lat, lng);
        const map = new window.kakao.maps.Map(mapRef.current, { center: pos, level: 4 });
        const marker = new window.kakao.maps.Marker({ position: pos, map });
        const info = new window.kakao.maps.InfoWindow({
          content: `<div style="padding:6px 10px;font-size:13px;font-weight:bold;white-space:nowrap;">${name}</div>`,
        });
        info.open(map, marker);
        console.log("[KakaoMap] 지도 그리기 완료");
      } catch (e) {
        console.error("[KakaoMap] draw 오류:", e);
      }
    }

    function initAndDraw() {
      console.log("[KakaoMap] initAndDraw() 호출, window.kakao:", !!window.kakao);
      window.kakao.maps.load(draw);
    }

    // 케이스 1: SDK 완전 초기화 완료
    if (window.kakao?.maps?.LatLng) {
      console.log("[KakaoMap] 케이스1 - SDK 이미 준비됨");
      draw();
      return;
    }

    // 케이스 2: 스크립트 태그는 있지만 아직 로드 중
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      console.log("[KakaoMap] 케이스2 - 스크립트 태그 존재, window.kakao:", !!window.kakao);
      if (window.kakao?.maps) {
        initAndDraw();
      } else {
        existing.addEventListener("load", initAndDraw);
        return () => existing.removeEventListener("load", initAndDraw);
      }
      return;
    }

    // 케이스 3: 스크립트 신규 생성
    console.log("[KakaoMap] 케이스3 - 스크립트 신규 생성");
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`;
    script.async = true;
    script.addEventListener("load", () => {
      console.log("[KakaoMap] 스크립트 로드 완료, window.kakao:", !!window.kakao);
      initAndDraw();
    });
    script.addEventListener("error", (e) => {
      console.error("[KakaoMap] 스크립트 로드 실패:", e);
    });
    document.head.appendChild(script);
    console.log("[KakaoMap] 스크립트 head에 추가됨");

    return () => script.removeEventListener("load", initAndDraw);
  }, [appKey, lat, lng, name]);

  function handleNavi() {
    const deepLink = `kakaonavi://navigate?ep=${lat},${lng}&by=CAR`;
    const webUrl = `https://map.kakao.com/link/to/${encodeURIComponent(name)},${lat},${lng}`;
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = deepLink;
    document.body.appendChild(iframe);
    const timer = setTimeout(() => {
      document.body.removeChild(iframe);
      window.open(webUrl, "_blank", "noopener");
    }, 1500);
    window.addEventListener("blur", () => {
      clearTimeout(timer);
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
    }, { once: true });
  }

  return (
    <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">
      <div ref={mapRef} style={{ width: "100%", height: "288px" }} />
      <div className="p-4 bg-[var(--color-surface)] border-t border-[var(--color-border)]">
        <p className="text-xs text-[var(--color-text-muted)] mb-3 text-center">{address}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleNavi}
            className="flex-1 bg-[#FEE500] hover:bg-[#FDD835] active:bg-[#FCC800] text-[#3C1E1E] py-2.5 rounded-lg text-sm font-bold transition-colors"
          >
            카카오내비로 길찾기
          </button>
          <a
            href={`https://map.kakao.com/link/to/${encodeURIComponent(name)},${lat},${lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center border border-[var(--color-border)] hover:bg-[var(--color-surface-warm)] py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            카카오맵에서 보기
          </a>
        </div>
      </div>
    </div>
  );
}
