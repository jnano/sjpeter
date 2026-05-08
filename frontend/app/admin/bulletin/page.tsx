"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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

  async function handleDelete(id: number) {
    if (!confirm("이 주보를 삭제하시겠습니까? 함께 저장된 PDF 파일도 삭제됩니다.")) return;
    const token = localStorage.getItem("admin_token");
    setDeleting(id);
    try {
      const res = await fetch(`${API}/api/bulletins/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setBulletins((prev) => prev.filter((b) => b.id !== id));
      } else {
        alert("삭제에 실패했습니다.");
      }
    } finally {
      setDeleting(null);
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
        <Link
          href="/admin/bulletin/new"
          className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
        >
          + 새 주보 등록
        </Link>
      </div>

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
          <div className="divide-y divide-[var(--color-border)]">
            <div className="px-6 py-3 bg-[var(--color-surface-warm)] grid grid-cols-[1fr_auto_auto_auto] gap-4 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
              <span>주보</span>
              <span>발행일</span>
              <span>PDF</span>
              <span>관리</span>
            </div>
            {bulletins.map((b) => (
              <div
                key={b.id}
                className="px-6 py-4 grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center hover:bg-[var(--color-surface-warm)] transition-colors"
              >
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

                <button
                  onClick={() => handleDelete(b.id)}
                  disabled={deleting === b.id}
                  className="text-sm text-red-500 hover:text-red-700 disabled:opacity-40 whitespace-nowrap transition-colors"
                >
                  {deleting === b.id ? "삭제 중…" : "삭제"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
