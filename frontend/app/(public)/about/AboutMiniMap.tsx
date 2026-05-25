"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

// window.kakao 의 전역 타입은 info/KakaoMap.tsx 의 `declare global` 에서 정의됨(프로젝트 전역 적용).

interface Props {
  lat: number;
  lng: number;
  name: string;
  appKey: string;
}

// info/KakaoMap.tsx 와 같은 스크립트 ID — SDK 를 한 번만 로드해 페이지 간 재사용.
const SCRIPT_ID = "kakao-map-sdk";

/**
 * /about '찾아오시는 길' 미리보기용 정적 미니맵.
 * 드래그·줌을 모두 비활성한 카카오맵 위에 투명 Link 오버레이를 덮어,
 * 박스를 누르면 /info(상세 지도·길찾기)로 이동한다.
 */
export default function AboutMiniMap({ lat, lng, name, appKey }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const drawn = useRef(false);

  useEffect(() => {
    drawn.current = false;

    function draw() {
      if (!mapRef.current || drawn.current) return;
      drawn.current = true;
      try {
        const pos = new window.kakao.maps.LatLng(lat, lng);
        // 정적 미니맵 — 드래그·줌·더블클릭 줌 모두 비활성
        const map = new window.kakao.maps.Map(mapRef.current, {
          center: pos,
          level: 4,
          draggable: false,
          scrollwheel: false,
          disableDoubleClickZoom: true,
        }) as { setZoomable?: (v: boolean) => void };
        map.setZoomable?.(false);

        const marker = new window.kakao.maps.Marker({ position: pos, map });
        const info = new window.kakao.maps.InfoWindow({
          content: `<div style="padding:5px 10px;font-size:12px;font-weight:700;white-space:nowrap;">${name}</div>`,
        });
        info.open(map, marker);
      } catch {
        // SDK 오류 시 빈 박스 유지 (상위에서 좌표·키 가드를 이미 통과한 상태)
      }
    }

    function initAndDraw() {
      window.kakao.maps.load(draw);
    }

    // 케이스 1: SDK 완전 초기화 완료
    if (window.kakao?.maps?.LatLng) {
      draw();
      return;
    }

    // 케이스 2: 스크립트 태그는 있지만 아직 로드 중
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (window.kakao?.maps) {
        initAndDraw();
      } else {
        existing.addEventListener("load", initAndDraw);
        return () => existing.removeEventListener("load", initAndDraw);
      }
      return;
    }

    // 케이스 3: 스크립트 신규 생성
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`;
    script.async = true;
    script.addEventListener("load", initAndDraw);
    document.head.appendChild(script);

    return () => script.removeEventListener("load", initAndDraw);
  }, [appKey, lat, lng, name]);

  return (
    <div className="ab-map">
      <div ref={mapRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      {/* 지도 위 투명 오버레이 — 미리보기를 누르면 상세 페이지로 */}
      <Link
        href="/info"
        aria-label="오시는 길 자세히 보기"
        style={{ position: "absolute", inset: 0, zIndex: 2 }}
      />
    </div>
  );
}
