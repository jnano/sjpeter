import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // v1.5.456 — Docker 이미지 최소 번들. node_modules 일부만 standalone 디렉토리에 복사됨.
  output: "standalone",
  // dev 모드에서 LAN IP로 접속한 브라우저(휴대폰 등)도 HMR/dev 리소스 사용 허용
  allowedDevOrigins: ["121.152.118.40"],
  async redirects() {
    return [
      { source: "/boards/photo", destination: "/gallery/events", permanent: true },
      { source: "/boards/photo/:postId(\\d+)", destination: "/gallery/events/:postId", permanent: true },
    ];
  },
  // backend uploads 를 same-origin 프록시 — fetch·canvas readback 시 CORS 회피용
  async rewrites() {
    const backend = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    return [
      { source: "/uploads/:path*", destination: `${backend}/uploads/:path*` },
    ];
  },
  images: {
    dangerouslyAllowLocalIP: true,
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "8000" },
      { protocol: "http", hostname: "127.0.0.1", port: "8000" },
      { protocol: "http", hostname: "121.152.118.40", port: "8000" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
      { protocol: "https", hostname: "k.kakaocdn.net" },
      { protocol: "http", hostname: "k.kakaocdn.net" },
      { protocol: "https", hostname: "t1.kakaocdn.net" },
    ],
  },
};

export default nextConfig;
