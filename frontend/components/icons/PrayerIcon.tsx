/** "기도문" 카드 아이콘 (묵주 형상). 사용자 제공 SVG 원본 그대로. */
export default function PrayerIcon({ className = "w-14 h-14" }: { className?: string }) {
  return (
    <svg
      version="1.1"
      id="Capa_1"
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      viewBox="3 0 51 56"
      xmlSpace="preserve"
      fill="#000000"
      className={className}
      aria-hidden
    >
      <g id="SVGRepo_bgCarrier" strokeWidth={0} />
      <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round" />
      <g id="SVGRepo_iconCarrier">
        {/* v1.5.344: 묵주 위 십자가 제거 + viewBox 를 콘텐츠 bbox 에 맞춰 좁힘
            (다른 quick_link 아이콘과 시각 크기 균형) */}
        <path
          style={{ fill: "#805333" }}
          d="M33.317,39.442l-4.222,2.422l-2.436-4.292L22.337,40l 2.436,4.292l-4.272,2.425l2.425,4.272 l4.272-2.425l4.774,8.41c0.377,0.664,1.221,0.897,1.885,0.52l1.901-1.079c0.666-0.378,0.898-1.226,0.517-1.89l-4.805-8.385 l4.272-2.425L33.317,39.442z"
        />
        <circle style={{ fill: "#805333" }} cx="24.337" cy="3" r="3" />
        <circle style={{ fill: "#805333" }} cx="33.337" cy="4" r="3" />
        <circle style={{ fill: "#805333" }} cx="42.337" cy="6" r="3" />
        <circle style={{ fill: "#805333" }} cx="47.337" cy="13" r="3" />
        <circle style={{ fill: "#805333" }} cx="44.337" cy="21" r="3" />
        <circle style={{ fill: "#805333" }} cx="37.337" cy="27" r="3" />
        <circle style={{ fill: "#805333" }} cx="30.337" cy="33" r="3" />
        <circle style={{ fill: "#805333" }} cx="16.337" cy="6" r="3" />
        <circle style={{ fill: "#805333" }} cx="11.337" cy="13" r="3" />
        <circle style={{ fill: "#805333" }} cx="10.337" cy="22" r="3" />
        <circle style={{ fill: "#805333" }} cx="12.337" cy="31" r="3" />
        <circle style={{ fill: "#805333" }} cx="16.337" cy="39" r="3" />
      </g>
    </svg>
  );
}
