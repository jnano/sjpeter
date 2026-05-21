"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataEvent, notify } from "@/components/dataEvents";
import ExtractedImagesSection from "@/components/admin/ExtractedImagesSection";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface BulletinInfo {
  id: number;
  issue_number: number | null;
  published_date: string;
  liturgical_season: string | null;
  ai_status?: "pending" | "processing" | "done" | "failed" | null;
  ai_started_at?: string | null;
  ai_finished_at?: string | null;
  ai_error?: string | null;
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
  created_post_id?: number | null;
  created_notice_id?: number | null;
  created_event_id?: number | null;
  created_meditation_id?: number | null;
  target_board_id?: number | null;
}

/** 항목 타입과 라우팅된 대상 id로 관리자 수정 페이지 경로를 만든다.
 * 라우팅된 id가 없으면 null. */
function buildEditHref(ex: Extraction): string | null {
  if (ex.event_type === "공지" && ex.created_notice_id) {
    return `/admin/notices?focus=${ex.created_notice_id}`;
  }
  if ((ex.event_type === "행사" || ex.event_type === "모임") && ex.created_event_id) {
    return `/admin/calendar?focus=${ex.created_event_id}`;
  }
  if (ex.event_type === "묵상" && ex.created_meditation_id) {
    return `/admin/meditation?focus=${ex.created_meditation_id}`;
  }
  // 임시저장 (ai-extract 게시판) — 날짜 없는 행사·모임
  if (ex.created_post_id && ex.target_board_id) {
    return `/admin/drafts?focus=${ex.created_post_id}`;
  }
  return null;
}

const TYPE_CONFIG: Record<string, { label: string; dest: string; color: string; icon: string }> = {
  공지: { label: "공지사항", dest: "notices 등록 완료", color: "blue", icon: "📢" },
  행사: { label: "행사 · 캘린더", dest: "캘린더 등록 완료", color: "green", icon: "📅" },
  모임: { label: "모임", dest: "AI 추출 게시판 임시저장", color: "amber", icon: "👥" },
  묵상: { label: "묵상", dest: "묵상 등록 완료", color: "teal", icon: "🕊️" },
  지표: { label: "사목지표 후보", dest: "검토 후 등록 필요", color: "violet", icon: "📌" },
  pending: { label: "미처리", dest: "검토 필요", color: "red", icon: "⚠️" },
};

function colorClass(color: string, part: "bg" | "text" | "border") {
  const map: Record<string, Record<string, string>> = {
    blue:   { bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200" },
    green:  { bg: "bg-green-50",  text: "text-green-700",  border: "border-green-200" },
    amber:  { bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200" },
    teal:   { bg: "bg-teal-50",   text: "text-teal-700",   border: "border-teal-200" },
    violet: { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
    red:    { bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200" },
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
  const [reanalyzing, setReanalyzing] = useState(false);
  // 폴링 timeout 도달 — 백엔드 ai_status 는 여전히 processing 일 수 있지만 UI 에서 "다시 분석" 버튼 강제 노출.
  const [pollingTimedOut, setPollingTimedOut] = useState(false);

  // 분석이 hang 됐을 때 무한 폴링 방지. ai_started_at + 5분 초과 시 폴링 중단.
  const POLL_TIMEOUT_MS = 5 * 60 * 1000;

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) { router.push("/admin"); return; }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pollingStartedAt = Date.now();

    async function load(initial: boolean) {
      try {
        const [bRes, eRes] = await Promise.all([
          fetch(`${API}/api/bulletins/single/${id}`),
          fetch(`${API}/api/bulletins/${id}/extractions`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        if (!bRes.ok) throw new Error("주보 정보를 불러올 수 없습니다.");
        if (!eRes.ok) throw new Error("추출 결과를 불러올 수 없습니다.");
        const b: BulletinInfo = await bRes.json();
        const e: Extraction[] = await eRes.json();
        if (cancelled) return;
        setBulletin(b);
        setExtractions(e);

        // AI 분석이 진행 중이면 3초 후 다시 폴링. 단, 서버 ai_started_at 또는 페이지 진입 후 5분 초과 시 중단.
        if (b.ai_status === "processing") {
          const serverStartedMs = b.ai_started_at ? Date.parse(b.ai_started_at) : pollingStartedAt;
          const elapsed = Math.max(Date.now() - pollingStartedAt, Date.now() - serverStartedMs);
          if (elapsed > POLL_TIMEOUT_MS) {
            setError("AI 분석이 5분 이상 걸리고 있습니다. ↻ 다시 분석 버튼을 눌러 재시도해 주세요.");
            setPollingTimedOut(true);  // "다시 분석" 버튼 강제 노출 (ai_status=processing 이어도)
            return;  // 폴링 중단
          }
          timer = setTimeout(() => load(false), 3000);
        } else if (!initial) {
          // 분석이 막 끝난 경우 사이드바 뱃지 갱신
          notify(DataEvent.EXTRACTIONS_COUNT);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
      } finally {
        if (initial && !cancelled) setLoading(false);
      }
    }
    load(true);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [id, router]);

  async function handleApproveAsVision(
    extId: number,
    payload: { year: number; motto: string; body: string; is_current: boolean },
  ) {
    const token = localStorage.getItem("admin_token");
    if (!token) return;
    const res = await fetch(`${API}/api/bulletins/extractions/${extId}/approve-as-vision`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      throw new Error(detail.detail ?? "사목지표 등록 실패");
    }
    const updated: Extraction = await res.json();
    setExtractions((prev) => prev.map((e) => (e.id === extId ? updated : e)));
    notify(DataEvent.EXTRACTIONS_COUNT);
  }

  async function handleRejectExtraction(extId: number) {
    const token = localStorage.getItem("admin_token");
    if (!token) return;
    const res = await fetch(`${API}/api/bulletins/extractions/${extId}/reject`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("거부 실패");
    // 백엔드가 행을 삭제하므로 목록에서도 제거
    setExtractions((prev) => prev.filter((e) => e.id !== extId));
    notify(DataEvent.EXTRACTIONS_COUNT);
  }


  async function handleReanalyze() {
    const token = localStorage.getItem("admin_token");
    if (!token) return;
    if (!confirm("이 주보를 다시 AI로 분석할까요? 기존에 등록된 항목은 그대로 두고 새 항목만 추가됩니다.")) return;
    setReanalyzing(true);
    try {
      const res = await fetch(`${API}/api/bulletins/${id}/reanalyze`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail ?? "재분석 요청 실패");
      }
      // 즉시 processing 상태로 갱신해 폴링 트리거
      setBulletin((prev) => prev ? { ...prev, ai_status: "processing", ai_started_at: new Date().toISOString() } : prev);
      setPollingTimedOut(false);  // timeout 플래그 리셋
      setError("");
      // 폴링 재시작 — useEffect 가 ai_status 변경을 감지하지 않으므로 location.reload 가 간단
      window.location.reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "재분석 요청 실패");
    } finally {
      setReanalyzing(false);
    }
  }

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
        <div className="flex items-start justify-between gap-4 mt-2">
          <div>
            <h1 className="font-serif text-2xl font-bold text-[var(--color-primary)]">
              {issueLabel} AI 추출 결과
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              {bulletin?.published_date} 발행
              {bulletin?.liturgical_season && ` · ${bulletin.liturgical_season}`}
              &ensp;|&ensp;전체 {extractions.length}건 처리
              {bulletin?.ai_status === "processing" && (
                <span className="ml-2 inline-flex items-center gap-1.5 text-amber-700 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  AI 분석 중…
                </span>
              )}
              {bulletin?.ai_status === "done" && (
                <span className="ml-2 inline-flex items-center gap-1.5 text-green-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  분석 완료
                </span>
              )}
              {bulletin?.ai_status === "failed" && (
                <span className="ml-2 inline-flex items-center gap-1.5 text-red-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  분석 실패
                </span>
              )}
            </p>
            {bulletin?.ai_status === "failed" && bulletin.ai_error && (
              <p className="text-xs text-red-600 mt-1">오류: {bulletin.ai_error}</p>
            )}
          </div>
          {(bulletin?.ai_status !== "processing" || pollingTimedOut) && (
            <button
              onClick={handleReanalyze}
              disabled={reanalyzing}
              className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-primary)] disabled:opacity-50"
              title="AI 분석을 다시 실행합니다"
            >
              {reanalyzing ? "요청 중…" : "↻ 다시 분석"}
            </button>
          )}
        </div>
      </div>

      {bulletin?.ai_status === "processing" ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-12 text-center">
          <p className="text-4xl mb-3">🤖</p>
          <p className="text-amber-800 font-medium">AI가 주보를 분석하고 있습니다…</p>
          <p className="text-xs text-amber-700 mt-2">
            보통 30초~1분이 걸립니다. 이 화면은 자동으로 새로고침됩니다.
          </p>
        </div>
      ) : extractions.length === 0 ? (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-12 text-center">
          <p className="text-4xl mb-3">🤖</p>
          <p className="text-[var(--color-text-muted)]">아직 AI 추출 결과가 없습니다.</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            위의 <strong>↻ 다시 분석</strong> 버튼을 눌러 재시도할 수 있습니다.
          </p>
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
                  {items.map((ex) => {
                    const editHref = buildEditHref(ex);
                    return (
                    <div key={ex.id} className="px-4 py-3 group">
                      <div className="flex items-start gap-2">
                        <span className="text-[var(--color-text-muted)] mt-0.5 shrink-0">•</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium text-[var(--color-text)] text-sm leading-snug">
                              {ex.title}
                            </p>
                            {editHref && (
                              <Link
                                href={editHref}
                                className="shrink-0 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] opacity-0 group-hover:opacity-100 transition-opacity"
                                title="이 항목을 등록된 곳에서 수정"
                              >
                                ✏️ 수정
                              </Link>
                            )}
                          </div>
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
                            {ex.event_type === "지표" && ex.status === "approved" && (
                              <span className="text-xs text-green-700 font-medium">
                                ✓ 사목지표 등록 완료
                              </span>
                            )}
                          </div>
                          {ex.content && (
                            <p className="text-xs text-[var(--color-text-muted)] mt-1.5 line-clamp-2 whitespace-pre-wrap">
                              {ex.content.replace(/^>.*\n\n---\n\n/, "")}
                            </p>
                          )}

                          {/* 사목지표 인라인 등록 폼 (지표 + pending 일 때만) */}
                          {ex.event_type === "지표" && ex.status === "pending" && (
                            <VisionInlineForm
                              ext={ex}
                              defaultYear={
                                bulletin?.published_date
                                  ? Number(bulletin.published_date.slice(0, 4))
                                  : new Date().getFullYear()
                              }
                              onApprove={(payload) => handleApproveAsVision(ex.id, payload)}
                              onReject={() => handleRejectExtraction(ex.id)}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* ── 추출된 사진 분류 섹션 (공통 컴포넌트) ── */}
      <ExtractedImagesSection bulletinId={id} />
    </div>
  );
}

function VisionInlineForm({
  ext,
  defaultYear,
  onApprove,
  onReject,
}: {
  ext: Extraction;
  defaultYear: number;
  onApprove: (payload: { year: number; motto: string; body: string; is_current: boolean }) => Promise<void>;
  onReject: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState<number>(defaultYear);
  const [motto, setMotto] = useState<string>(ext.title);
  const [body, setBody] = useState<string>(ext.content ?? "");
  const [isCurrent, setIsCurrent] = useState<boolean>(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (!open) {
    return (
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => setOpen(true)}
          className="text-xs px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-700 text-white font-medium"
        >
          📌 사목지표로 등록
        </button>
        <button
          onClick={async () => {
            if (!confirm("이 항목을 거부 처리할까요? (visions 에 등록되지 않습니다)")) return;
            setBusy(true);
            try { await onReject(); } finally { setBusy(false); }
          }}
          disabled={busy}
          className="text-xs px-3 py-1.5 rounded-md border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-warm)] disabled:opacity-50"
        >
          거부
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-violet-200 bg-violet-50/60 p-3 space-y-2">
      <p className="text-xs font-semibold text-violet-800">사목지표로 등록 — visions 테이블에 저장</p>

      <div className="grid grid-cols-[60px_1fr] gap-2 items-center text-xs">
        <label className="text-violet-900">연도</label>
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="border border-violet-200 rounded-md px-2 py-1 text-sm bg-white focus:outline-none focus:border-violet-500"
        />

        <label className="text-violet-900">슬로건</label>
        <input
          type="text"
          value={motto}
          onChange={(e) => setMotto(e.target.value)}
          maxLength={300}
          className="border border-violet-200 rounded-md px-2 py-1 text-sm bg-white focus:outline-none focus:border-violet-500"
        />

        <label className="text-violet-900 pt-1">본문</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          className="border border-violet-200 rounded-md px-2 py-1 text-sm bg-white focus:outline-none focus:border-violet-500 resize-y leading-relaxed"
        />
      </div>

      <label className="flex items-center gap-1.5 text-xs text-violet-900 cursor-pointer">
        <input
          type="checkbox"
          checked={isCurrent}
          onChange={(e) => setIsCurrent(e.target.checked)}
          className="accent-violet-600"
        />
        올해의 사목지표로 표시 (같은 해 기존 표시는 자동 해제)
      </label>

      {err && <p className="text-xs text-red-600">{err}</p>}

      <div className="flex gap-2 pt-1">
        <button
          onClick={async () => {
            setBusy(true);
            setErr("");
            try {
              await onApprove({ year, motto: motto.trim(), body: body.trim(), is_current: isCurrent });
            } catch (e) {
              setErr(e instanceof Error ? e.message : "등록 실패");
            } finally {
              setBusy(false);
            }
          }}
          disabled={busy || !motto.trim()}
          className="flex-1 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-md text-xs font-medium"
        >
          {busy ? "등록 중…" : "등록"}
        </button>
        <button
          onClick={() => setOpen(false)}
          disabled={busy}
          className="px-3 py-1.5 border border-violet-200 text-violet-700 hover:bg-violet-100 rounded-md text-xs disabled:opacity-50"
        >
          취소
        </button>
      </div>
    </div>
  );
}
