"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ko">
      <body style={{ margin: 0, fontFamily: "sans-serif", background: "#f9f6f0" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "2rem",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: "1rem", color: "#b7791f" }}>✝</div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#1a365d", marginBottom: "0.75rem" }}>
            서비스를 불러올 수 없습니다
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#718096", maxWidth: "20rem", marginBottom: "2rem", lineHeight: 1.6 }}>
            일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.
          </p>
          <button
            onClick={reset}
            style={{
              padding: "0.625rem 1.5rem",
              background: "#1a365d",
              color: "#fff",
              border: "none",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}
