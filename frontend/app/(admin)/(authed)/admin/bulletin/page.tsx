"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useBulkSelect } from "@/components/useBulkSelect";
import BulkActionBar from "@/components/BulkActionBar";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Bulletin {
  id: number;
  issue_number: number | null;
  published_date: string;
  liturgical_season: string | null;
  gospel_reference: string | null;
  pdf_url: string | null;
  ai_summary: string | null;
}

export default function BulletinListPage() {
  const router = useRouter();
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const select = useBulkSelect(bulletins.map((b) => b.id));

  const fetchBulletins = useCallback(async () => {
    const token = localStorage.getItem("admin_token");
    if (!token) { router.push("/admin"); return; }
    try {
      const res = await fetch(`${API}/api/bulletins/`);
      if (res.ok) setBulletins(await res.json());
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchBulletins(); }, [fetchBulletins]);

  async function buildDeleteWarning(id: number, token: string): Promise<string> {
    try {
      const res = await fetch(`${API}/api/bulletins/${id}/routed-counts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return "";
      const c = await res.json();
      const lines: string[] = [];
      if (c.extractions) lines.push(`  · AI 추출 메타 ${c.extractions}건`);
      if (c.events) lines.push(`  · 캘린더 행사 ${c.events}건`);
      if (c.meditations) lines.push(`  · 묵상 ${c.meditations}건`);
      if (c.visions) lines.push(`  · 사목지표 ${c.visions}건`);
      if (c.posts) lines.push(`  · 게시글(공지·임시저장 등) ${c.posts}건`);
      if (c.images) lines.push(`  · 추출 이미지 ${c.images}건`);
      return lines.length > 0 ? `\n\n이 주보로부터 만들어진 다음 결과물도 함께 삭제됩니다:\n${lines.join("\n")}` : "";
    } catch {
      return "";
    }
  }

  async function handleDelete(id: number) {
    const token = localStorage.getItem("admin_token");
    if (!token) { router.push("/admin"); return; }
    const warning = await buildDeleteWarning(id, token);
    if (!confirm(`이 주보를 삭제하시겠습니까? PDF 파일도 삭제됩니다.${warning}`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`${API}/api/bulletins/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setBulletins((prev) => prev.filter((b) => b.id !== id));
        select.remove(id);
      } else {
        alert("삭제에 실패했습니다.");
      }
    } finally {
      setDeleting(null);
    }
  }

  async function handleBulkDelete() {
    const ids = Array.from(select.selected);
    if (ids.length === 0) return;
    const token = localStorage.getItem("admin_token");
    if (!token) { router.push("/admin"); return; }
    // 다건 선택: batch endpoint 로 한 번에 집계 (N+1 회피)
    let sum: Record<string, number> = {};
    try {
      const r = await fetch(`${API}/api/bulletins/routed-counts/batch`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ bulletin_ids: ids }),
      });
      if (r.ok) {
        const data = await r.json();
        sum = data.sum || {};
      }
    } catch {
      // 집계 실패해도 삭제는 진행
    }
    const warnLines: string[] = [];
    if (sum.extractions) warnLines.push(`  · AI 추출 메타 ${sum.extractions}건`);
    if (sum.events) warnLines.push(`  · 캘린더 행사 ${sum.events}건`);
    if (sum.meditations) warnLines.push(`  · 묵상 ${sum.meditations}건`);
    if (sum.visions) warnLines.push(`  · 사목지표 ${sum.visions}건`);
    if (sum.posts) warnLines.push(`  · 게시글 ${sum.posts}건`);
    if (sum.images) warnLines.push(`  · 추출 이미지 ${sum.images}건`);
    const warning = warnLines.length > 0
      ? `\n\n이 주보들로부터 만들어진 다음 결과물도 함께 삭제됩니다:\n${warnLines.join("\n")}`
      : "";
    if (!confirm(`선택한 주보 ${ids.length}개를 삭제하시겠습니까?\nPDF 파일도 함께 삭제됩니다.${warning}`)) return;
    setBulkDeleting(true);
    try {
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            const res = await fetch(`${API}/api/bulletins/${id}`, {
              method: "DELETE", headers: { Authorization: `Bearer ${token}` },
            });
            return { id, ok: res.ok };
          } catch { return { id, ok: false }; }
        }),
      );
      const succeeded = new Set(results.filter((r) => r.ok).map((r) => r.id));
      const failedCount = results.filter((r) => !r.ok).length;
      if (succeeded.size > 0) {
        setBulletins((prev) => prev.filter((b) => !succeeded.has(b.id)));
        select.removeMany(succeeded);
      }
      if (failedCount > 0) alert(`${failedCount}건 삭제 실패`);
    } finally {
      setBulkDeleting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-bold text-[var(--color-primary)]">주보 관리</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            등록된 주보를 확인하고 삭제할 수 있습니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/bulletin/stats"
            className="border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] text-sm px-4 py-2 rounded-lg font-medium transition-colors"
          >
            📊 AI 분석 통계
          </Link>
          <Link
            href="/admin/bulletin/new"
            className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
          >
            + 새 주보 등록
          </Link>
        </div>
      </div>

      <BulkActionBar
        selectedCount={select.selectedCount}
        total={select.total}
        allSelected={select.allSelected}
        someSelected={select.someSelected}
        onToggleAll={select.toggleAll}
        onDelete={handleBulkDelete}
        deleting={bulkDeleting}
      />

      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-[var(--color-text-muted)]">불러오는 중…</div>
        ) : bulletins.length === 0 ? (
          <div className="p-16 text-center">
            <p className="text-4xl mb-4">📋</p>
            <p className="text-[var(--color-text-muted)] mb-4">등록된 주보가 없습니다.</p>
            <Link
              href="/admin/bulletin/new"
              className="inline-block bg-[var(--color-primary)] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[var(--color-primary-light)] transition-colors"
            >
              첫 번째 주보 등록하기
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <div className="min-w-[520px] divide-y divide-[var(--color-border)]">
            <div className="px-6 py-3 bg-[var(--color-surface-warm)] grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
              <span className="w-4"></span>
              <span>주보</span>
              <span>발행일</span>
              <span>PDF</span>
              <span>AI 결과</span>
              <span>관리</span>
            </div>
            {bulletins.map((b) => {
              const isChecked = select.isSelected(b.id);
              return (
              <div
                key={b.id}
                className={`px-6 py-4 grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 items-center transition-colors ${isChecked ? "bg-red-50/30" : "hover:bg-[var(--color-surface-warm)]"}`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => select.toggle(b.id)}
                  className="rounded"
                  aria-label={`${b.issue_number ? `제${b.issue_number}호` : `주보 ${b.id}`} 선택`}
                />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">
                      {b.issue_number ? `제${b.issue_number}호` : "주보"}
                    </span>
                    {b.liturgical_season && (
                      <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-warm)] border border-[var(--color-border)] px-2 py-0.5 rounded">
                        {b.liturgical_season}
                      </span>
                    )}
                  </div>
                  {b.gospel_reference && (
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{b.gospel_reference}</p>
                  )}
                </div>

                <span className="text-sm text-[var(--color-text-muted)] whitespace-nowrap">
                  {b.published_date}
                </span>

                <span>
                  {b.pdf_url ? (
                    <a
                      href={`${API}${b.pdf_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[var(--color-primary)] hover:underline whitespace-nowrap"
                    >
                      PDF 보기
                    </a>
                  ) : (
                    <span className="text-xs text-[var(--color-text-muted)]">없음</span>
                  )}
                </span>

                <Link
                  href={`/admin/bulletin/${b.id}/result`}
                  className="text-sm text-[var(--color-accent)] hover:underline whitespace-nowrap transition-colors"
                >
                  🤖 결과 보기
                </Link>

                <button
                  onClick={() => handleDelete(b.id)}
                  disabled={deleting === b.id}
                  className="text-sm text-red-500 hover:text-red-700 disabled:opacity-40 whitespace-nowrap transition-colors"
                >
                  {deleting === b.id ? "삭제 중…" : "삭제"}
                </button>
              </div>
              );
            })}
          </div>
          </div>
        )}
      </div>
    </div>
  );
}
