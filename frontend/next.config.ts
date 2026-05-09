import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/boards/photo", destination: "/gallery/events", permanent: true },
      { source: "/boards/photo/:postId(\\d+)", destination: "/gallery/events/:postId", permanent: true },
    ];
  },
  images: {
    dangerouslyAllowLocalIP: true,
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "8000" },
      { protocol: "http", hostname: "127.0.0.1", port: "8000" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
      { protocol: "https", hostname: "k.kakaocdn.net" },
      { protocol: "http", hostname: "k.kakaocdn.net" },
      { protocol: "https", hostname: "t1.kakaocdn.net" },
    ],
  },
};

export default nextConfig;
