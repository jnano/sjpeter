"use client";

import { useId } from "react";

interface Props {
  className?: string;
  title?: string;
}

/**
 * 본당 로고가 업로드되지 않은 상태의 임시 자리 컴포넌트.
 * Header · Footer 의 로고 위치에 사용. 본당 상징(✝)을 의미하는 [[CrossIcon]] 과 구분.
 *
 * 8개 다이아몬드(별) 패턴 — 그라데이션 id 는 useId() 로 인스턴스마다 unique 화하여
 * 한 페이지에 여러 번 렌더링되어도 id 충돌이 없도록 함.
 */
export default function LogoFallback({ className, title }: Props) {
  const base = useId().replace(/:/g, "_");
  const g = (n: number) => `${base}-g${n}`;

  return (
    <svg
      viewBox="0 0 504.123 504.123"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={title ?? "본당 로고 (미등록)"}
    >
      <defs>
        {/* 분홍·보라 그라데이션 (4개 모서리 별) */}
        <linearGradient
          id={g(1)}
          gradientUnits="userSpaceOnUse"
          x1="-33.0158" y1="653.084" x2="-33.0158" y2="569.4991"
          gradientTransform="matrix(7.8769 0 0 -7.8769 364.0537 4969.6694)"
        >
          <stop offset="0.012" stopColor="#E0B386" />
          <stop offset="0.519" stopColor="#DA498C" />
          <stop offset="1" stopColor="#961484" />
        </linearGradient>
        <linearGradient
          id={g(5)}
          gradientUnits="userSpaceOnUse"
          x1="-22.7003" y1="653.084" x2="-22.7003" y2="569.4991"
          gradientTransform="matrix(7.8769 0 0 -7.8769 364.0537 4969.6694)"
        >
          <stop offset="0.012" stopColor="#E0B386" />
          <stop offset="0.519" stopColor="#DA498C" />
          <stop offset="1" stopColor="#961484" />
        </linearGradient>
        <linearGradient
          id={g(6)}
          gradientUnits="userSpaceOnUse"
          x1="-5.7343" y1="653.084" x2="-5.7343" y2="569.4991"
          gradientTransform="matrix(7.8769 0 0 -7.8769 364.0537 4969.6694)"
        >
          <stop offset="0.012" stopColor="#E0B386" />
          <stop offset="0.519" stopColor="#DA498C" />
          <stop offset="1" stopColor="#961484" />
        </linearGradient>
        <linearGradient
          id={g(8)}
          gradientUnits="userSpaceOnUse"
          x1="4.5812" y1="653.084" x2="4.5812" y2="569.4991"
          gradientTransform="matrix(7.8769 0 0 -7.8769 364.0537 4969.6694)"
        >
          <stop offset="0.012" stopColor="#E0B386" />
          <stop offset="0.519" stopColor="#DA498C" />
          <stop offset="1" stopColor="#961484" />
        </linearGradient>

        {/* 파랑 그라데이션 (4개 모서리 별) */}
        <linearGradient
          id={g(2)}
          gradientUnits="userSpaceOnUse"
          x1="-7.8551" y1="559.6448" x2="-53.5181" y2="633.6368"
          gradientTransform="matrix(7.8769 0 0 -7.8769 364.0537 4969.6694)"
        >
          <stop offset="0" stopColor="#29D3DA" />
          <stop offset="0.519" stopColor="#0077FF" />
          <stop offset="0.999" stopColor="#064093" />
          <stop offset="1" stopColor="#084698" />
        </linearGradient>
        <linearGradient
          id={g(3)}
          gradientUnits="userSpaceOnUse"
          x1="18.0351" y1="575.613" x2="-27.6279" y2="649.613"
          gradientTransform="matrix(7.8769 0 0 -7.8769 364.0537 4969.6694)"
        >
          <stop offset="0" stopColor="#29D3DA" />
          <stop offset="0.519" stopColor="#0077FF" />
          <stop offset="0.999" stopColor="#064093" />
          <stop offset="1" stopColor="#084698" />
        </linearGradient>
        <linearGradient
          id={g(4)}
          gradientUnits="userSpaceOnUse"
          x1="-8.9602" y1="558.9554" x2="-54.6251" y2="632.9544"
          gradientTransform="matrix(7.8769 0 0 -7.8769 364.0537 4969.6694)"
        >
          <stop offset="0" stopColor="#29D3DA" />
          <stop offset="0.519" stopColor="#0077FF" />
          <stop offset="0.999" stopColor="#064093" />
          <stop offset="1" stopColor="#084698" />
        </linearGradient>
        <linearGradient
          id={g(7)}
          gradientUnits="userSpaceOnUse"
          x1="19.142" y1="576.2961" x2="-26.526" y2="650.3011"
          gradientTransform="matrix(7.8769 0 0 -7.8769 364.0537 4969.6694)"
        >
          <stop offset="0" stopColor="#29D3DA" />
          <stop offset="0.519" stopColor="#0077FF" />
          <stop offset="0.999" stopColor="#064093" />
          <stop offset="1" stopColor="#084698" />
        </linearGradient>
      </defs>

      <polygon fill={`url(#${g(1)})`} points="0,263.877 0,356.47 17.432,373.894 207.982,263.877" />
      <polygon fill={`url(#${g(2)})`} points="207.982,240.246 17.432,130.229 0,147.661 0,240.246" />
      <polygon fill={`url(#${g(3)})`} points="296.164,263.877 486.707,373.886 504.123,356.462 504.123,263.877" />
      <polygon fill={`url(#${g(4)})`} points="240.246,296.149 130.229,486.699 147.661,504.123 240.246,504.123" />
      <polygon fill={`url(#${g(5)})`} points="240.246,207.967 240.246,0 147.661,0 130.245,17.416" />
      <polygon fill={`url(#${g(6)})`} points="263.877,296.149 263.877,504.123 356.478,504.123 373.894,486.699" />
      <polygon fill={`url(#${g(7)})`} points="263.877,207.99 373.91,17.424 356.478,0 263.877,0" />
      <polygon fill={`url(#${g(8)})`} points="486.707,130.245 296.157,240.246 504.123,240.246 504.123,147.661" />
    </svg>
  );
}
