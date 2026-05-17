const API_BASE = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

export interface Bulletin {
  id: number;
  issue_number: number | null;
  published_date: string;
  liturgical_season: string | null;
  gospel_reference: string | null;
  pdf_url: string | null;
  ai_summary: string | null;
}
