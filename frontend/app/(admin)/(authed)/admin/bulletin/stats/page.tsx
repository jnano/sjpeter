"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Stats {
  total_analyzed: number;
  by_status: Record<string, number>;
  success_rate: number;
  duration_seconds: { count: number; avg: number; p50: number; p95: number; max: number };
  retries: Record<string, number>;
  top_errors: { error: string; count: number }[];
  by_event_type: { event_type: string; count: number }[];
  recent: {
    id: number; issue_number: number | null; published_date: string | null;
    ai_status: string; ai_started_at: string | null; ai_finished_at: string | null;
    ai_retry_count: number; ai_error: string | null;
  }[];
}

export default function AiStatsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) { router.push("/admin"); return; }
    fetch(`${API}/api/bulletins/ai-stats`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        if (!r.ok) throw new Error("통계를 불러올 수 없습니다.");
        return r.json();
      })
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : "오류"))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return <div className="p-16 text-center text-[var(--color-text-muted)]">불러오는 중…</div>;
  if (error) return <div className="p-16 text-center text-red-600">{error}</div>;
  if (!stats) return null;

  function fmt(secs: number) {
    if (secs < 60) return `${secs}초`;
    return `${Math.floor(secs / 60)}분 ${secs % 60}초`;
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-[var(--color-primary)]">AI 분석 통계</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            주보 PDF 자동 분석의 관찰성 지표 — 성공률·소요시간·재시도·에러 패턴
          </p>
        </div>
        <Link href="/admin/bulletin" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)]">
          ← 주보 관리
        </Link>
      </div>

      {stats.total_analyzed === 0 && (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-12 text-center">
          <p className="text-4xl mb-3">📊</p>
          <p className="font-medium text-[var(--color-text)]">아직 분석된 주보가 없습니다</p>
          <p className="text-sm text-[var(--color-text-muted)] mt-2">
            주보 PDF 를 업로드하면 자동으로 AI 분석이 진행되고, 결과 지표가 이 페이지에 누적됩니다.
          </p>
          <Link
            href="/admin/bulletin/new"
            className="inline-block mt-4 bg-[var(--color-primary)] text-white text-sm px-4 py-2 rounded-lg hover:bg-[var(--color-primary-light)] transition-colors"
          >
            + 새 주보 등록
          </Link>
        </div>
      )}

      {stats.total_analyzed > 0 && <>
      {/* 핵심 지표 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4">
          <div className="text-xs text-[var(--color-text-muted)]">전체 분석</div>
          <div className="text-2xl font-bold mt-1">{stats.total_analyzed}건</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="text-xs text-green-700">성공률</div>
          <div className="text-2xl font-bold mt-1 text-green-800">{stats.success_rate}%</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="text-xs text-blue-700">평균 소요</div>
          <div className="text-2xl font-bold mt-1 text-blue-800">{fmt(stats.duration_seconds.avg)}</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="text-xs text-amber-700">p95 소요</div>
          <div className="text-2xl font-bold mt-1 text-amber-800">{fmt(stats.duration_seconds.p95)}</div>
        </div>
      </div>

      {/* 상태 분포 */}
      <section>
        <h2 className="font-serif font-bold text-[var(--color-primary)] mb-2">상태 분포</h2>
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl divide-y divide-[var(--color-border)]">
          {Object.entries(stats.by_status).map(([k, v]) => (
            <div key={k} className="flex justify-between px-4 py-2 text-sm">
              <span className={k === "done" ? "text-green-700" : k === "failed" ? "text-red-700" : "text-amber-700"}>
                {k}
              </span>
              <span className="font-mono">{v}건</span>
            </div>
          ))}
        </div>
      </section>

      {/* 재시도 발생 */}
      {Object.keys(stats.retries).length > 0 && (
        <section>
          <h2 className="font-serif font-bold text-[var(--color-primary)] mb-2">자동 재시도 발생</h2>
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl divide-y divide-[var(--color-border)]">
            {Object.entries(stats.retries).map(([k, v]) => (
              <div key={k} className="flex justify-between px-4 py-2 text-sm">
                <span>{k}회 재시도</span>
                <span className="font-mono">{v}건</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 자주 발생한 에러 */}
      {stats.top_errors.length > 0 && (
        <section>
          <h2 className="font-serif font-bold text-[var(--color-primary)] mb-2">자주 발생한 에러 (상위 10)</h2>
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl divide-y divide-[var(--color-border)]">
            {stats.top_errors.map((e, i) => (
              <div key={i} className="px-4 py-2 text-sm flex justify-between gap-3">
                <span className="text-red-700 truncate" title={e.error}>{e.error}</span>
                <span className="font-mono shrink-0">{e.count}회</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* event_type 분포 */}
      <section>
        <h2 className="font-serif font-bold text-[var(--color-primary)] mb-2">추출된 항목 분류</h2>
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl divide-y divide-[var(--color-border)]">
          {stats.by_event_type.map((t) => (
            <div key={t.event_type} className="flex justify-between px-4 py-2 text-sm">
              <span>{t.event_type}</span>
              <span className="font-mono">{t.count}건</span>
            </div>
          ))}
        </div>
      </section>

      {/* 최근 5건 */}
      <section>
        <h2 className="font-serif font-bold text-[var(--color-primary)] mb-2">최근 분석 5건</h2>
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-warm)] text-xs text-[var(--color-text-muted)]">
              <tr>
                <th className="text-left px-3 py-2">제호</th>
                <th className="text-left px-3 py-2">발행일</th>
                <th className="text-left px-3 py-2">상태</th>
                <th className="text-right px-3 py-2">소요</th>
                <th className="text-right px-3 py-2">재시도</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {stats.recent.map((r) => {
                const duration =
                  r.ai_started_at && r.ai_finished_at
                    ? Math.round((Date.parse(r.ai_finished_at) - Date.parse(r.ai_started_at)) / 1000)
                    : null;
                return (
                  <tr key={r.id}>
                    <td className="px-3 py-2">{r.issue_number ? `제${r.issue_number}호` : "-"}</td>
                    <td className="px-3 py-2">{r.published_date ?? "-"}</td>
                    <td className="px-3 py-2">
                      <span className={
                        r.ai_status === "done" ? "text-green-700" :
                        r.ai_status === "failed" ? "text-red-700" : "text-amber-700"
                      }>{r.ai_status}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{duration !== null ? fmt(duration) : "-"}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.ai_retry_count}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      </>}
    </div>
  );
}
