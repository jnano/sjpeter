"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { DataEvent, notify } from "@/components/dataEvents";

interface VisionPayload {
  year: number;
  motto: string;
  body: string;
  is_current: boolean;
}

const API = "http://localhost:8000";

interface Extraction {
  id: number;
  bulletin_id: number;
  title: string;
  content: string | null;
  group_name: string | null;
  event_date: string | null;
  location: string | null;
  event_type: string | null;
  status: "pending" | "approved" | "rejected";
  target_board_id: number | null;
  created_post_id: number | null;
}

interface Board {
  id: number;
  name: string;
  slug: string;
}

export default function ExtractionsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const bulletinId = params.get("bulletin_id");

  const [extractions, setExtractions] = useState<Extraction[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<Record<number, boolean>>({});
  const [error, setError] = useState("");

  const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;

  useEffect(() => {
    if (!token) { router.push("/admin"); return; }
    Promise.all([loadExtractions(), loadBoards()]).finally(() => setLoading(false));
  }, [bulletinId]);

  async function loadExtractions() {
    const url = bulletinId
      ? `${API}/api/bulletins/${bulletinId}/extractions`
      : `${API}/api/bulletins/extractions/pending`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setExtractions(await res.json());
  }

  async function loadBoards() {
    const res = await fetch(`${API}/api/boards/`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const data = await res.json();
      setBoards(data);
    }
  }

  async function approve(ext: Extraction) {
    const boardId = selectedBoard[ext.id];
    if (!boardId) { setError(`"${ext.title}" 항목의 게시판을 선택해 주세요.`); return; }
    setError("");
    setProcessing((p) => ({ ...p, [ext.id]: true }));
    try {
      const res = await fetch(`${API}/api/bulletins/extractions/${ext.id}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ board_id: boardId }),
      });
      if (!res.ok) throw new Error((await res.json()).detail ?? "승인 실패");
      const updated: Extraction = await res.json();
      setExtractions((prev) => prev.map((e) => (e.id === ext.id ? updated : e)));
      notify(DataEvent.EXTRACTIONS_COUNT);
    } catch (err) {
      setError(err instanceof Error ? err.message : "승인에 실패했습니다.");
    } finally {
      setProcessing((p) => ({ ...p, [ext.id]: false }));
    }
  }

  async function approveAsEvent(ext: Extraction) {
    if (!ext.event_date) {
      setError(`"${ext.title}" 항목에 날짜가 없습니다. 캘린더 등록이 불가합니다.`);
      return;
    }
    setError("");
    setProcessing((p) => ({ ...p, [ext.id]: true }));
    try {
      const res = await fetch(`${API}/api/bulletins/extractions/${ext.id}/approve-as-event`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error((await res.json()).detail ?? "캘린더 등록 실패");
      const updated: Extraction = await res.json();
      setExtractions((prev) => prev.map((e) => (e.id === ext.id ? updated : e)));
      notify(DataEvent.EXTRACTIONS_COUNT);
    } catch (err) {
      setError(err instanceof Error ? err.message : "캘린더 등록에 실패했습니다.");
    } finally {
      setProcessing((p) => ({ ...p, [ext.id]: false }));
    }
  }

  async function approveAsVision(ext: Extraction, payload: VisionPayload) {
    setError("");
    setProcessing((p) => ({ ...p, [ext.id]: true }));
    try {
      const res = await fetch(`${API}/api/bulletins/extractions/${ext.id}/approve-as-vision`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).detail ?? "사목지표 등록 실패");
      const updated: Extraction = await res.json();
      setExtractions((prev) => prev.map((e) => (e.id === ext.id ? updated : e)));
      notify(DataEvent.EXTRACTIONS_COUNT);
    } catch (err) {
      setError(err instanceof Error ? err.message : "사목지표 등록에 실패했습니다.");
    } finally {
      setProcessing((p) => ({ ...p, [ext.id]: false }));
    }
  }

  async function reject(extId: number) {
    setProcessing((p) => ({ ...p, [extId]: true }));
    try {
      const res = await fetch(`${API}/api/bulletins/extractions/${extId}/reject`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("거부 실패");
      const updated: Extraction = await res.json();
      setExtractions((prev) => prev.map((e) => (e.id === extId ? updated : e)));
      notify(DataEvent.EXTRACTIONS_COUNT);
    } catch (err) {
      setError(err instanceof Error ? err.message : "거부에 실패했습니다.");
    } finally {
      setProcessing((p) => ({ ...p, [extId]: false }));
    }
  }

  const pending = extractions.filter((e) => e.status === "pending");
  const done = extractions.filter((e) => e.status !== "pending");

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-surface-warm)] flex items-center justify-center">
        <p className="text-[var(--color-text-muted)]">불러오는 중…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface-warm)]">
      <div className="bg-[var(--color-primary)] text-white px-6 py-4 flex items-center gap-4">
        <Link href="/admin/dashboard" className="text-white/70 hover:text-white text-sm transition-colors">
          ← 대시보드
        </Link>
        <span className="text-white/30">|</span>
        <span className="font-serif font-bold">AI 추출 결과 검토</span>
        {bulletinId && (
          <span className="text-white/60 text-sm">주보 #{bulletinId}</span>
        )}
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {extractions.length === 0 && (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-12 text-center text-[var(--color-text-muted)]">
            추출된 행사 공지가 없습니다.
          </div>
        )}

        {/* 승인 대기 */}
        {pending.length > 0 && (
          <section>
            <h2 className="font-serif font-bold text-[var(--color-primary)] mb-3">
              검토 대기 ({pending.length}건)
            </h2>
            <div className="space-y-4">
              {pending.map((ext) => (
                <ExtractionCard
                  key={ext.id}
                  ext={ext}
                  boards={boards}
                  selectedBoardId={selectedBoard[ext.id]}
                  onSelectBoard={(bid) => setSelectedBoard((p) => ({ ...p, [ext.id]: bid }))}
                  onApprove={() => approve(ext)}
                  onApproveAsEvent={() => approveAsEvent(ext)}
                  onApproveAsVision={(payload) => approveAsVision(ext, payload)}
                  onReject={() => reject(ext.id)}
                  processing={!!processing[ext.id]}
                />
              ))}
            </div>
          </section>
        )}

        {/* 처리 완료 */}
        {done.length > 0 && (
          <section>
            <h2 className="font-serif font-bold text-[var(--color-text-muted)] mb-3 text-sm">
              처리 완료 ({done.length}건)
            </h2>
            <div className="space-y-3">
              {done.map((ext) => (
                <div
                  key={ext.id}
                  className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-5 py-4 flex items-center gap-3"
                >
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      ext.status === "approved"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {ext.status === "approved" ? "승인" : "거부"}
                  </span>
                  <span className="text-sm font-medium">{ext.title}</span>
                  {ext.group_name && (
                    <span className="text-xs text-[var(--color-text-muted)]">{ext.group_name}</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {pending.length === 0 && done.length > 0 && (
          <div className="text-center">
            <Link
              href="/admin/dashboard"
              className="inline-block bg-[var(--color-primary)] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[var(--color-primary-light)] transition-colors"
            >
              대시보드로 돌아가기
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function ExtractionCard({
  ext,
  boards,
  selectedBoardId,
  onSelectBoard,
  onApprove,
  onApproveAsEvent,
  onApproveAsVision,
  onReject,
  processing,
}: {
  ext: Extraction;
  boards: Board[];
  selectedBoardId?: number;
  onSelectBoard: (id: number) => void;
  onApprove: () => void;
  onApproveAsEvent: () => void;
  onApproveAsVision: (payload: VisionPayload) => void;
  onReject: () => void;
  processing: boolean;
}) {
  const isVision = ext.event_type === "지표";

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 space-y-3">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <span
            className={`text-xs px-2 py-0.5 rounded-full mr-2 border ${
              isVision
                ? "bg-violet-50 border-violet-200 text-violet-700 font-semibold"
                : "bg-[var(--color-surface-warm)] border-[var(--color-border)] text-[var(--color-text-muted)]"
            }`}
          >
            {ext.event_type ?? "기타"}
          </span>
          <span className="font-medium">{ext.title}</span>
        </div>
        {ext.event_date && (
          <span className="text-xs text-[var(--color-text-muted)] shrink-0">{ext.event_date}</span>
        )}
      </div>

      {/* 상세 */}
      <div className="flex gap-4 text-xs text-[var(--color-text-muted)]">
        {ext.group_name && <span>모임: {ext.group_name}</span>}
        {ext.location && <span>장소: {ext.location}</span>}
      </div>

      {ext.content && (
        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed whitespace-pre-line line-clamp-3">
          {ext.content}
        </p>
      )}

      {/* 사목지표 등록 인라인 폼 (event_type='지표' 전용) */}
      {isVision && (
        <VisionApproveForm
          ext={ext}
          processing={processing}
          onApprove={onApproveAsVision}
          onReject={onReject}
        />
      )}

      {/* 액션 영역 — 지표가 아닐 때만 게시판/캘린더 등록 표시 */}
      {!isVision && (
        <div className="pt-1 space-y-2">
          {/* 게시판 승인 행 */}
          <div className="flex gap-2">
            <select
              value={selectedBoardId ?? ""}
              onChange={(e) => onSelectBoard(Number(e.target.value))}
              className="flex-1 border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)] bg-white"
            >
              <option value="">게시판 선택…</option>
              {boards.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <button
              onClick={onApprove}
              disabled={processing || !selectedBoardId}
              className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
            >
              {processing ? "처리 중…" : "게시판 등록"}
            </button>
          </div>
          {/* 캘린더 등록 + 거부 행 */}
          <div className="flex gap-2">
            <button
              onClick={onApproveAsEvent}
              disabled={processing || !ext.event_date}
              title={!ext.event_date ? "날짜 정보가 없어 캘린더 등록 불가" : ""}
              className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors"
            >
              📅 캘린더 등록{!ext.event_date && " (날짜 없음)"}
            </button>
            <button
              onClick={onReject}
              disabled={processing}
              className="px-4 py-2 border border-[var(--color-border)] hover:bg-[var(--color-surface-warm)] rounded-lg text-sm disabled:opacity-50 transition-colors"
            >
              거부
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function VisionApproveForm({
  ext,
  processing,
  onApprove,
  onReject,
}: {
  ext: Extraction;
  processing: boolean;
  onApprove: (payload: VisionPayload) => void;
  onReject: () => void;
}) {
  const defaultYear =
    (ext.event_date && Number(ext.event_date.slice(0, 4))) || new Date().getFullYear();
  const [year, setYear] = useState<number>(defaultYear);
  const [motto, setMotto] = useState<string>(ext.title);
  const [body, setBody] = useState<string>(ext.content ?? "");
  const [isCurrent, setIsCurrent] = useState<boolean>(true);

  return (
    <div className="mt-1 rounded-lg border border-violet-200 bg-violet-50/60 p-4 space-y-3">
      <p className="text-xs font-semibold text-violet-800">
        사목지표로 등록 — visions 테이블에 저장됩니다
      </p>

      <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
        <label className="text-xs text-violet-900">연도</label>
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="border border-violet-200 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-violet-500"
        />

        <label className="text-xs text-violet-900">슬로건</label>
        <input
          type="text"
          value={motto}
          onChange={(e) => setMotto(e.target.value)}
          maxLength={300}
          className="border border-violet-200 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-violet-500"
        />

        <label className="text-xs text-violet-900 pt-1.5">본문</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          className="border border-violet-200 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-violet-500 leading-relaxed resize-y"
        />
      </div>

      <label className="flex items-center gap-2 text-xs text-violet-900 cursor-pointer">
        <input
          type="checkbox"
          checked={isCurrent}
          onChange={(e) => setIsCurrent(e.target.checked)}
          className="accent-violet-600"
        />
        올해의 사목지표로 표시 (같은 해 기존 표시는 자동 해제)
      </label>

      <div className="flex gap-2 pt-1">
        <button
          onClick={() =>
            onApprove({
              year,
              motto: motto.trim(),
              body: body.trim(),
              is_current: isCurrent,
            })
          }
          disabled={processing || !motto.trim()}
          className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {processing ? "등록 중…" : "사목지표로 등록"}
        </button>
        <button
          onClick={onReject}
          disabled={processing}
          className="px-4 py-2 border border-violet-200 text-violet-700 hover:bg-violet-100 rounded-lg text-sm disabled:opacity-50 transition-colors"
        >
          거부
        </button>
      </div>
    </div>
  );
}
