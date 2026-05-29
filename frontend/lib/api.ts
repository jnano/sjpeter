const API_BASE = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/**
 * Client component 에서 백엔드 API base 를 안전하게 해석.
 *
 * `process.env.NEXT_PUBLIC_API_URL ?? "fallback"` 패턴은 빈 문자열을 못 잡아
 * `${API}/api/...` 가 상대 경로 `/api/...` 로 평가되어 같은 origin(Next.js)으로
 * 가버리는 함정이 있다. 이 helper 는:
 *   1) env 값이 있고 trim 후에도 비어있지 않으면 그대로 사용
 *   2) window 가 있으면 `${protocol}//${hostname}:8000` (LAN/공인 IP 대응)
 *   3) 최후 fallback: http://localhost:8000
 *
 * 새 client 코드에서는 inline `process.env.NEXT_PUBLIC_API_URL` 대신 이 함수 사용 권장.
 */
export function resolveClientApi(): string {
  const env = process.env.NEXT_PUBLIC_API_URL;
  if (env && env.trim()) return env;
  if (typeof window !== "undefined" && window.location.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return "http://localhost:8000";
}

export async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "요청에 실패했습니다.");
  }
  return res.json();
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

/**
 * FastAPI 응답의 `detail` 필드(string | ValidationError[] | object) 를 사람이 읽을 수 있는
 * 문자열로 변환. setError·alert·throw 등에서 객체가 그대로 들어가 React 가 크래시
 * (`Objects are not valid as a React child`) 되는 함정 방지.
 *
 * 사용 예:
 *   setError(formatErrorDetail(data.detail, "저장 실패"));
 *   throw new Error(formatErrorDetail(data.detail, "업로드 실패"));
 */
export function formatErrorDetail(detail: unknown, fallback = "요청에 실패했습니다."): string {
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const lines = detail
      .map((e: { loc?: unknown[]; msg?: string }) => {
        const field = Array.isArray(e.loc) ? e.loc.slice(1).join(".") : "";
        const msg = e.msg ?? "";
        return field ? `${field}: ${msg}` : msg;
      })
      .filter(Boolean);
    if (lines.length) return lines.join("\n");
  }
  if (detail && typeof detail === "object") {
    try { return JSON.stringify(detail); } catch { /* noop */ }
  }
  return fallback;
}

export interface Bulletin {
  id: number;
  issue_number: number | null;
  published_date: string;
  liturgical_season: string | null;
  gospel_reference: string | null;
  pdf_url: string | null;
  thumbnail_url: string | null; // PDF 1쪽 추출 썸네일 (v1.5.414)
  ai_summary: string | null;
}
