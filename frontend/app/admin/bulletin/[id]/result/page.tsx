"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface BulletinInfo {
  id: number;
  issue_number: number | null;
  published_date: string;
  liturgical_season: string | null;
}

interface Extraction {
  id: number;
  bulletin_id: number;
  title: string;
  content: string | null;
  group_name: string | null;
  event_date: string | null;
  location: string | null;
  event_type: string | null;
  status: string;
  created_at: string;
}

const TYPE_CONFIG: Record<string, { label: string; dest: string; color: string; icon: string }> = {
  공지: { label: "공지사항", dest: "notices 등록 완료", color: "blue", icon: "📢" },
  행사: { label: "행사 · 캘린더", dest: "캘린더 등록 완료", color: "green", icon: "📅" },
  모임: { label: "모임", dest: "AI 추출 게시판 임시저장", color: "amber", icon: "👥" },
  pending: { label: "미처리", dest: "검토 필요", color: "red", icon: "⚠️" },
};

function colorClass(color: string, part: "bg" | "text" | "border") {
  const map: Record<string, Record<string, string>> = {
    blue:  { bg: "bg-blue-50",  text: "text-blue-700",  border: "border-blue-200" },
    green: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
    amber: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
    red:   { bg: "bg-red-50",   text: "text-red-700",   border: "border-red-200" },
  };
  return map[color]?.[part] ?? "";
}

export default function BulletinResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [bulletin, setBulletin] = useState<BulletinInfo | null>(null);
  const [extractions, setExtractions] = useState<Extraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) { router.push("/admin"); return; }

    async function load() {
      try {
        const [bRes, eRes] = await Promise.all([
          fetch(`${API}/api/bulletins/single/${id}`),
          fetch(`${API}/api/bulletins/${id}/extractions`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        if (!bRes.ok) throw new Error("주보 정보를 불러올 수 없습니다.");
        if (!eRes.ok) throw new Error("추출 결과를 불러올 수 없습니다.");
        setBulletin(await bRes.json());
        setExtractions(await eRes.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, router]);

  if (loading) {
    return <div className="p-16 text-center text-[var(--color-text-muted)]">불러오는 중…</div>;
  }
  if (error) {
    return (
      <div className="p-16 text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <Link href="/admin/bulletin" className="text-[var(--color-primary)] hover:underline text-sm">← 주보 목록으로</Link>
      </div>
    );
  }

  const issueLabel = bulletin?.issue_number ? `제${bulletin.issue_number}호` : bulletin?.published_date ?? "";
  const grouped: Record<string, Extraction[]> = {};
  for (const ex of extractions) {
    const key = ex.event_type ?? "pending";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(ex);
  }

  // 표시 순서: 공지 → 행사 → 모임 → pending → 기타
  const ORDER = ["공지", "행사", "모임", "pending"];
  const sortedKeys = [
    ...ORDER.filter((k) => grouped[k]),
    ...Object.keys(grouped).filter((k) => !ORDER.includes(k)),
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="mb-6">
        <Link
          href="/admin/bulletin"
          className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
        >
          ← 주보 목록
        </Link>
        <h1 className="font-serif text-2xl font-bold text-[var(--color-primary)] mt-2">
          {issueLabel} AI 추출 결과
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          {bulletin?.published_date} 발행
          {bulletin?.liturgical_season && ` · ${bulletin.liturgical_season}`}
          &ensp;|&ensp;전체 {extractions.length}건 처리
        </p>
      </div>

      {extractions.length === 0 ? (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-12 text-center">
          <p className="text-4xl mb-3">🤖</p>
          <p className="text-[var(--color-text-muted)]">아직 AI 추출 결과가 없습니다.</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">주보 업로드 후 잠시 기다리면 자동으로 분석됩니다.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedKeys.map((typeKey) => {
            const items = grouped[typeKey];
            const cfg = TYPE_CONFIG[typeKey] ?? { label: typeKey, dest: "", color: "blue", icon: "📌" };
            return (
              <section key={typeKey}>
                {/* 섹션 헤더 */}
                <div className={`flex items-center justify-between px-4 py-2.5 rounded-t-xl border ${colorClass(cfg.color, "bg")} ${colorClass(cfg.color, "border")}`}>
                  <div className="flex items-center gap-2">
                    <span>{cfg.icon}</span>
                    <span className={`font-semibold ${colorClass(cfg.color, "text")}`}>
                      {cfg.label}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorClass(cfg.color, "bg")} ${colorClass(cfg.color, "text")} border ${colorClass(cfg.color, "border")}`}>
                      총 {items.length}건
                    </span>
                  </div>
                  <span className={`text-xs ${colorClass(cfg.color, "text")} opacity-80`}>
                    → {cfg.dest}
                  </span>
                </div>

                {/* 항목 목록 */}
                <div className="border border-t-0 border-[var(--color-border)] rounded-b-xl divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
                  {items.map((ex) => (
                    <div key={ex.id} className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <span className="text-[var(--color-text-muted)] mt-0.5 shrink-0">•</span>
                        <div className="min-w-0">
                          <p className="font-medium text-[var(--color-text)] text-sm leading-snug">
                            {ex.title}
                          </p>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                            {ex.event_date && (
                              <span className="text-xs text-[var(--color-text-muted)]">
                                📅 {ex.event_date}
                              </span>
                            )}
                            {ex.location && (
                              <span className="text-xs text-[var(--color-text-muted)]">
                                📍 {ex.location}
                              </span>
                            )}
                            {ex.group_name && (
                              <span className="text-xs text-[var(--color-text-muted)]">
                                👥 {ex.group_name}
                              </span>
                            )}
                          </div>
                          {ex.content && (
                            <p className="text-xs text-[var(--color-text-muted)] mt-1.5 line-clamp-2 whitespace-pre-wrap">
                              {ex.content.replace(/^>.*\n\n---\n\n/, "")}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
