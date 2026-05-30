"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { DataEvent, notify } from "@/components/dataEvents";
import ExtractedImagesSection from "@/components/admin/ExtractedImagesSection";

interface VisionPayload {
  year: number;
  motto: string;
  body: string;
  is_current: boolean;
  notify: boolean;
}

interface MeditationPayload {
  title: string;
  body: string;
  author: string;
  scripture: string;
  practice: string;
  pull_quote: string;
  is_published: boolean;
  notify: boolean;
}

const API = process.env.NEXT_PUBLIC_API_URL;

interface Extraction {
  id: number;
  bulletin_id: number;
  title: string;
  content: string | null;
  group_name: string | null;
  group_candidates: string[] | null;
  event_date: string | null;
  location: string | null;
  event_type: string | null;
  scripture: string | null;
  practice: string | null;
  pull_quote: string | null;
  temporal_kind: "future" | "timeless" | "past" | "unknown";
  temporal_reason: string | null;
  importance: "high" | "normal" | "low";
  weekly_bundle: boolean;
  expires_at: string | null;
  status: "pending" | "approved" | "rejected";
  target_board_id: number | null;
  created_post_id: number | null;
}

interface Board {
  id: number;
  name: string;
  slug: string;
  is_active?: boolean;
}

interface CommunityGroup {
  id: number;
  name: string;
  parent_id?: number | null;
  slug?: string | null;
}

/** 항목별 검토 입력 (시점/분과/알림/묶음/만료) — approve 시 body 에 담아 보냄. */
interface ReviewState {
  temporal_kind: "future" | "timeless" | "past" | "unknown";
  group_ids: number[];
  notify: boolean;
  weekly_bundle: boolean;
  expires_at: string | null;  // YYYY-MM-DD
  is_pinned: boolean;         // 공지를 게시판 상단 고정으로 등록
}

const TEMPORAL_LABEL: Record<ReviewState["temporal_kind"], string> = {
  future:   "미래 행사",
  timeless: "상시",
  past:     "지난 이벤트",
  unknown:  "모호",
};

// 시점 옵션 — 아이콘·설명(hover 툴팁)·알림 발송 여부. 시인성 향상용 메타.
const TEMPORAL_OPTS: { value: ReviewState["temporal_kind"]; icon: string; label: string; hint: string; notifies: boolean }[] = [
  { value: "future",   icon: "📅", label: "미래 행사",   hint: "발행일 이후 예정된 일정 — 알림 발송",       notifies: true },
  { value: "timeless", icon: "🔁", label: "상시",        hint: "날짜 없는 모집·안내 — 알림 발송",          notifies: true },
  { value: "past",     icon: "📜", label: "지난 이벤트", hint: "이미 끝난 일·후기 — 기록용, 알림 차단",    notifies: false },
  { value: "unknown",  icon: "❓", label: "모호",        hint: "시점이 불분명 — 보류, 알림 차단",          notifies: false },
];


/** 세그먼트 버튼 그룹 — 라디오를 클릭형 pill 로. 선택 시 채워진 배경으로 상태가 한눈에 보임. */
function Segmented<T extends string>({
  options, value, onChange, name,
}: {
  options: { value: T; icon?: string; label: string; hint?: string; tone?: "danger" | "normal" | "muted" }[];
  value: T;
  onChange: (v: T) => void;
  name: string;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="inline-flex flex-wrap rounded-lg border border-[var(--color-border)] overflow-hidden bg-white">
      {options.map((o, i) => {
        const active = value === o.value;
        const dangerActive = active && o.tone === "danger";
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.hint}
            onClick={() => onChange(o.value)}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${
              i > 0 ? "border-l border-[var(--color-border)]" : ""
            } ${
              dangerActive
                ? "bg-red-600 text-white"
                : active
                  ? "bg-[var(--color-primary)] text-white"
                  : `bg-white hover:bg-[var(--color-surface-warm)] ${o.tone === "muted" ? "text-gray-400" : o.tone === "danger" ? "text-red-600" : "text-[var(--color-text)]"}`
            }`}
          >
            {o.icon && <span aria-hidden="true">{o.icon}</span>}
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

const ALL_KINDS = ["묵상", "지표", "공지", "행사", "모임", "봉사", "순례", "피정", "강의", "기타"] as const;

// 본문에 등장하는 'M/D' 또는 'M/D(요일)' 패턴 — 백엔드 _DATE_PATTERN 과 동일.
// (월, 일) 쌍으로 dedupe 후 유효 범위(1~12, 1~31) 안인 것만 카운트.
const DATE_PATTERN = /(\b\d{1,2})\/(\d{1,2})(?:\s*\(([월화수목금토일])요?일?\))?/g;

function countDistinctDatesInText(text: string | null | undefined): number {
  if (!text) return 0;
  const seen = new Set<string>();
  for (const m of text.matchAll(DATE_PATTERN)) {
    const mo = parseInt(m[1], 10);
    const dy = parseInt(m[2], 10);
    if (mo < 1 || mo > 12 || dy < 1 || dy > 31) continue;
    seen.add(`${mo}-${dy}`);
  }
  return seen.size;
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
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  // 다중 선택·필터
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [filterKind, setFilterKind] = useState<string>("all");
  // 인라인 편집 — extraction id → 편집 중인 필드들
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{ title: string; content: string; event_date: string; location: string; group_name: string; event_type: string }>({
    title: "", content: "", event_date: "", location: "", group_name: "", event_type: "",
  });

  // 분과·단체 카탈로그 + 항목별 검토 입력 (시점·분과·알림)
  const [communityGroups, setCommunityGroups] = useState<CommunityGroup[]>([]);
  const [reviewByExt, setReviewByExt] = useState<Record<number, ReviewState>>({});

  const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;

  useEffect(() => {
    if (!token) { router.push("/admin"); return; }
    Promise.all([loadExtractions(), loadBoards(), loadCommunityGroups()]).finally(() => setLoading(false));
  }, [bulletinId]);

  async function loadExtractions() {
    const url = bulletinId
      ? `${API}/api/bulletins/${bulletinId}/extractions`
      : `${API}/api/bulletins/extractions/pending`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const data: Extraction[] = await res.json();
      setExtractions(data);
      const today = new Date().toISOString().slice(0, 10);
      // AI 추출 후보로 reviewByExt prefill (관리자가 수정 가능)
      // 옛 주보를 늦게 등록한 경우 — AI 는 future 라도 오늘 이전 날짜면 past 로 보정
      setReviewByExt((prev) => {
        const next = { ...prev };
        for (const e of data) {
          if (!next[e.id]) {
            let tk = e.temporal_kind ?? "unknown";
            if (tk === "future" && e.event_date && e.event_date < today) {
              tk = "past";
            }
            // 디폴트 알림 정책 — AI 가 high 로 판단한 것만 디폴트 true.
            //   normal/low 는 admin 이 명시적으로 켜야 발송 (자잘한 안내가 회원 알림함 묻는 것 회피).
            next[e.id] = {
              temporal_kind: tk,
              group_ids: [],  // 카탈로그 도착 후 후보 매칭 (별도 effect)
              notify: (e.importance ?? "normal") === "high",
              weekly_bundle: !!e.weekly_bundle,
              expires_at: e.expires_at ? e.expires_at.slice(0, 10) : null,
              is_pinned: false,
            };
          }
        }
        return next;
      });
    }
  }

  async function loadBoards() {
    const res = await fetch(`${API}/api/boards/`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const data: Board[] = await res.json();
      // 비활성 게시판은 라우팅 대상에서 제외 (선택 시 백엔드 404 회피)
      setBoards(data.filter((b) => b.is_active !== false));
    }
  }

  async function loadCommunityGroups() {
    const res = await fetch(`${API}/api/content/community`);
    if (res.ok) setCommunityGroups(await res.json());
  }

  // 카탈로그 + 추출 후보 동시 준비되면 group_ids 자동 prefill (이름 fuzzy 일치)
  useEffect(() => {
    if (communityGroups.length === 0 || extractions.length === 0) return;
    const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();
    const byName = new Map<string, number>();
    for (const g of communityGroups) byName.set(norm(g.name), g.id);
    setReviewByExt((prev) => {
      const next = { ...prev };
      for (const e of extractions) {
        const cur = next[e.id];
        if (!cur || cur.group_ids.length > 0) continue;
        const candidates = e.group_candidates ?? (e.group_name ? [e.group_name] : []);
        const matched: number[] = [];
        for (const c of candidates) {
          const id = byName.get(norm(c));
          if (id && !matched.includes(id)) matched.push(id);
        }
        if (matched.length > 0) next[e.id] = { ...cur, group_ids: matched };
      }
      return next;
    });
  }, [communityGroups, extractions]);

  function setReview(extId: number, patch: Partial<ReviewState>) {
    setReviewByExt((prev) => ({
      ...prev,
      [extId]: {
        temporal_kind: "unknown", group_ids: [], notify: true,
        weekly_bundle: false, expires_at: null, is_pinned: false,
        ...(prev[extId] ?? {}), ...patch,
      },
    }));
  }

  async function approve(ext: Extraction, options?: { notifyOverride?: boolean }) {
    // 공지는 board_id 없이 자동 라우팅 — notice/this-week 분기('이번주만 유효')·is_pinned 를
    // 백엔드 _apply_extraction_routing 가 처리. board_id 를 강제하면 weekly_bundle 분기가 무시됨.
    const autoRoute = ext.event_type === "공지";
    const boardId = selectedBoard[ext.id];
    if (!autoRoute && !boardId) { setError(`"${ext.title}" 항목의 게시판을 선택해 주세요.`); return; }
    setError("");
    const review = reviewByExt[ext.id] ?? { temporal_kind: "unknown", group_ids: [], notify: true };
    const notify_flag = options?.notifyOverride ?? review.notify;
    // 분과 미선택 + 알림 발송 의도 시 가드 — 발송 대상이 0명이 되어 조용히 누락되는 실수 방지
    if (notify_flag && review.group_ids.length === 0) {
      const proceed = confirm(
        `"${ext.title}"\n\n알림 발송이 켜져 있는데 대상 분과가 선택되지 않았습니다.\n이대로 등록하면 알림이 발송되지 않습니다.\n\n그래도 계속하시겠습니까?\n\n(취소를 누르면 분과를 먼저 선택할 수 있습니다)`
      );
      if (!proceed) return;
    }
    setProcessing((p) => ({ ...p, [ext.id]: true }));
    try {
      const res = await fetch(`${API}/api/bulletins/extractions/${ext.id}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          board_id: autoRoute ? null : boardId,
          community_group_ids: review.group_ids,
          weekly_bundle: (review as ReviewState).weekly_bundle,
          expires_at: (review as ReviewState).expires_at
            ? new Date((review as ReviewState).expires_at + "T00:00:00").toISOString()
            : null,
          temporal_kind: review.temporal_kind,
          notify: notify_flag,
          is_pinned: (review as ReviewState).is_pinned ?? false,
        }),
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

  async function approveAsEvent(ext: Extraction, mirrorBoardSlug?: string) {
    if (!ext.event_date) {
      setError(`"${ext.title}" 항목에 날짜가 없습니다. 캘린더 등록이 불가합니다.`);
      return;
    }
    setError("");
    setProcessing((p) => ({ ...p, [ext.id]: true }));
    const review = reviewByExt[ext.id] ?? { temporal_kind: "unknown", group_ids: [], notify: true };
    try {
      const res = await fetch(`${API}/api/bulletins/extractions/${ext.id}/approve-as-event`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          board_slug: mirrorBoardSlug ?? null,
          community_group_ids: review.group_ids,
          temporal_kind: review.temporal_kind,
          notify: review.notify,
        }),
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
      const { notify: notifyFlag, ...bodyPayload } = payload;
      const url = `${API}/api/bulletins/extractions/${ext.id}/approve-as-vision${notifyFlag ? "?notify=true" : ""}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });
      if (!res.ok) throw new Error((await res.json()).detail ?? "본당 사목지표 등록 실패");
      const updated: Extraction = await res.json();
      setExtractions((prev) => prev.map((e) => (e.id === ext.id ? updated : e)));
      notify(DataEvent.EXTRACTIONS_COUNT);
    } catch (err) {
      setError(err instanceof Error ? err.message : "본당 사목지표 등록에 실패했습니다.");
    } finally {
      setProcessing((p) => ({ ...p, [ext.id]: false }));
    }
  }

  async function approveAsMeditation(ext: Extraction, payload: MeditationPayload) {
    setError("");
    setProcessing((p) => ({ ...p, [ext.id]: true }));
    try {
      const { notify: notifyFlag, ...bodyPayload } = payload;
      const url = `${API}/api/bulletins/extractions/${ext.id}/approve-as-meditation${notifyFlag ? "?notify=true" : ""}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });
      if (!res.ok) throw new Error((await res.json()).detail ?? "묵상 등록 실패");
      const updated: Extraction = await res.json();
      setExtractions((prev) => prev.map((e) => (e.id === ext.id ? updated : e)));
      notify(DataEvent.EXTRACTIONS_COUNT);
    } catch (err) {
      setError(err instanceof Error ? err.message : "묵상 등록에 실패했습니다.");
    } finally {
      setProcessing((p) => ({ ...p, [ext.id]: false }));
    }
  }

  async function bulkApprove() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setError(""); setInfo("");
    // 선택된 각 ext 의 현재 review state 동봉 — 사용자가 수동으로 고친 분과·시점·알림 우선
    const reviews: Record<number, { community_group_ids: number[]; temporal_kind: string; notify: boolean; is_pinned: boolean }> = {};
    for (const id of ids) {
      const r = reviewByExt[id];
      if (r) reviews[id] = { community_group_ids: r.group_ids, temporal_kind: r.temporal_kind, notify: r.notify, is_pinned: r.is_pinned };
    }
    // 분과 미선택 + notify=true 인 항목 추출 — 사용자에게 한 번에 안내
    const noGroupNotify = ids.filter((id) => {
      const r = reviews[id];
      return r && r.notify && r.community_group_ids.length === 0;
    });
    if (noGroupNotify.length > 0) {
      const sample = noGroupNotify.slice(0, 3).map((id) => {
        const e = extractions.find((x) => x.id === id);
        return `• ${e?.title ?? id}`;
      }).join("\n");
      const more = noGroupNotify.length > 3 ? `\n• 외 ${noGroupNotify.length - 3}건` : "";
      const proceed = confirm(
        `다음 ${noGroupNotify.length}건은 알림 발송이 켜져 있는데 대상 분과가 선택되지 않았습니다.\n이대로 진행하면 해당 항목은 알림이 발송되지 않습니다.\n\n${sample}${more}\n\n그래도 일괄 승인하시겠습니까?`
      );
      if (!proceed) return;
    }
    setBulkProcessing(true);
    try {
      const res = await fetch(`${API}/api/bulletins/extractions/bulk-approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ extraction_ids: ids, reviews }),
      });
      if (!res.ok) throw new Error((await res.json()).detail ?? "일괄 승인 실패");
      const result: { approved: number[]; skipped: { id: number; reason: string }[]; failed: { id: number; reason: string }[] } = await res.json();
      // 승인된 항목은 다시 로드 (status·created_*_id 갱신)
      await loadExtractions();
      setSelectedIds(new Set());
      notify(DataEvent.EXTRACTIONS_COUNT);
      const parts = [`승인 ${result.approved.length}`];
      if (result.skipped.length) parts.push(`건너뜀 ${result.skipped.length} (지표 또는 처리됨)`);
      if (result.failed.length) parts.push(`실패 ${result.failed.length}`);
      setInfo(parts.join(" · "));
    } catch (err) {
      setError(err instanceof Error ? err.message : "일괄 승인에 실패했습니다.");
    } finally {
      setBulkProcessing(false);
    }
  }

  async function startEdit(ext: Extraction) {
    setEditingId(ext.id);
    setEditForm({
      title: ext.title ?? "",
      content: ext.content ?? "",
      event_date: ext.event_date ?? "",
      location: ext.location ?? "",
      group_name: ext.group_name ?? "",
      event_type: ext.event_type ?? "",
    });
  }

  async function saveEdit(extId: number) {
    setError("");
    try {
      const body: Record<string, string | null> = {};
      body.title = editForm.title;
      body.content = editForm.content;
      body.event_date = editForm.event_date || null;
      body.location = editForm.location;
      body.group_name = editForm.group_name || null;
      if (editForm.event_type) body.event_type = editForm.event_type;
      const res = await fetch(`${API}/api/bulletins/extractions/${extId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).detail ?? "편집 저장 실패");
      const updated: Extraction = await res.json();
      setExtractions((prev) => prev.map((e) => (e.id === extId ? updated : e)));
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "편집 저장에 실패했습니다.");
    }
  }

  // 공지로 오분류됐지만 날짜성인 항목을 '행사'로 전환 → 카드가 캘린더 분기로 바뀜.
  // (그 자리에서 캘린더 등록·날짜별 분리 가능. 모임이어야 하면 편집에서 다시 조정)
  async function convertToCalendar(extId: number) {
    setError("");
    try {
      const res = await fetch(`${API}/api/bulletins/extractions/${extId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: "행사" }),
      });
      if (!res.ok) throw new Error((await res.json()).detail ?? "유형 변경 실패");
      const updated: Extraction = await res.json();
      setExtractions((prev) => prev.map((e) => (e.id === extId ? updated : e)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "캘린더 유형 변경에 실패했습니다.");
    }
  }

  async function splitByDates(extId: number) {
    setError("");
    // 1단계: 미리보기 — 본문에서 발견된 날짜 수 확인
    try {
      const previewRes = await fetch(`${API}/api/bulletins/extractions/${extId}/split-by-dates`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ dry_run: true }),
      });
      if (!previewRes.ok) {
        const detail = await previewRes.json().catch(() => ({}));
        throw new Error(detail.detail ?? "분리 미리보기 실패");
      }
      const preview = await previewRes.json();
      const dates: string[] = preview.dates ?? [];
      if (dates.length < 2) {
        alert("분리할 날짜 패턴이 부족합니다.");
        return;
      }
      const confirmed = confirm(
        `본문에서 ${dates.length}개의 날짜를 발견했습니다:\n` +
        dates.join(", ") + "\n\n같은 제목·내용으로 각 날짜에 별도 항목으로 분리하시겠습니까?"
      );
      if (!confirmed) return;
      // 2단계: 실제 분리
      const res = await fetch(`${API}/api/bulletins/extractions/${extId}/split-by-dates`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ dry_run: false }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail ?? "분리 실패");
      }
      await loadExtractions();
      notify(DataEvent.EXTRACTIONS_COUNT);
      setInfo(`${dates.length}개 항목으로 분리 완료`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "분리에 실패했습니다.");
    }
  }

  async function reject(extId: number) {
    if (!confirm("이 항목을 거부(삭제)할까요? 복구할 수 없습니다.")) return;
    setProcessing((p) => ({ ...p, [extId]: true }));
    try {
      const res = await fetch(`${API}/api/bulletins/extractions/${extId}/reject`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("거부 실패");
      // 백엔드가 행을 삭제하므로 목록에서도 제거
      setExtractions((prev) => prev.filter((e) => e.id !== extId));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(extId);
        return next;
      });
      notify(DataEvent.EXTRACTIONS_COUNT);
    } catch (err) {
      setError(err instanceof Error ? err.message : "거부에 실패했습니다.");
    } finally {
      setProcessing((p) => ({ ...p, [extId]: false }));
    }
  }

  async function bulkReject() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`선택한 ${ids.length}건을 거부(삭제)할까요? 복구할 수 없습니다.`)) return;
    setError(""); setInfo("");
    setBulkProcessing(true);
    try {
      const res = await fetch(`${API}/api/bulletins/extractions/bulk-reject`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ extraction_ids: ids }),
      });
      if (!res.ok) throw new Error((await res.json()).detail ?? "일괄 거부 실패");
      const result: { deleted: number[]; not_found: number[] } = await res.json();
      const deletedSet = new Set(result.deleted);
      setExtractions((prev) => prev.filter((e) => !deletedSet.has(e.id)));
      setSelectedIds(new Set());
      notify(DataEvent.EXTRACTIONS_COUNT);
      const parts = [`거부(삭제) ${result.deleted.length}`];
      if (result.not_found.length) parts.push(`없음 ${result.not_found.length}`);
      setInfo(parts.join(" · "));
    } catch (err) {
      setError(err instanceof Error ? err.message : "일괄 거부에 실패했습니다.");
    } finally {
      setBulkProcessing(false);
    }
  }

  // 검토 대기 항목 — 지표·묵상은 별도 처리 흐름이라 상단 고정 (검토자가 우선 인지하도록)
  const TYPE_PRIORITY: Record<string, number> = { 지표: 0, 묵상: 1 };
  function priorityOf(t: string | null): number { return TYPE_PRIORITY[t ?? ""] ?? 99; }
  const allPending = extractions
    .filter((e) => e.status === "pending")
    .sort((a, b) => priorityOf(a.event_type) - priorityOf(b.event_type));
  const pending = filterKind === "all"
    ? allPending
    : allPending.filter((e) => (e.event_type ?? "기타") === filterKind);
  const done = extractions.filter((e) => e.status !== "pending");

  // 카테고리별 카운트 (검토 대기 중)
  const kindCounts: Record<string, number> = { all: allPending.length };
  for (const k of ALL_KINDS) kindCounts[k] = allPending.filter((e) => (e.event_type ?? "기타") === k).length;

  const allSelected = pending.length > 0 && pending.every((e) => selectedIds.has(e.id));
  function toggleAll() {
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const e of pending) next.delete(e.id);
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const e of pending) next.add(e.id);
        return next;
      });
    }
  }
  function toggleOne(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
        {info && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 text-sm px-4 py-3 rounded-lg">
            {info}
          </div>
        )}

        {extractions.length === 0 && (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-12 text-center text-[var(--color-text-muted)]">
            추출된 행사 공지가 없습니다.
          </div>
        )}

        {/* 카테고리 필터 칩 */}
        {allPending.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilterKind("all")}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filterKind === "all"
                  ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                  : "bg-white border-[var(--color-border)] hover:bg-[var(--color-surface-warm)]"
              }`}
            >
              전체 ({kindCounts.all})
            </button>
            {ALL_KINDS.map((k) => kindCounts[k] > 0 && (
              <button
                key={k}
                onClick={() => setFilterKind(k)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  filterKind === k
                    ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                    : "bg-white border-[var(--color-border)] hover:bg-[var(--color-surface-warm)]"
                }`}
              >
                {k} ({kindCounts[k]})
              </button>
            ))}
          </div>
        )}

        {/* 일괄 액션 바 */}
        {pending.length > 0 && (
          <div className="bg-white border border-[var(--color-border)] rounded-lg px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="accent-[var(--color-primary)]"
              />
              <span className="text-[var(--color-text)]">
                전체 선택 ({selectedIds.size > 0 ? `${selectedIds.size}개 선택됨` : `${pending.length}개`})
              </span>
            </label>
            <div className="flex gap-2">
              <button
                onClick={bulkApprove}
                disabled={selectedIds.size === 0 || bulkProcessing}
                className="px-4 py-1.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {bulkProcessing ? "처리 중…" : "선택 항목 일괄 승인 (자동 라우팅)"}
              </button>
              <button
                onClick={bulkReject}
                disabled={selectedIds.size === 0 || bulkProcessing}
                className="px-4 py-1.5 border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-40 text-sm font-medium rounded-lg transition-colors"
              >
                선택 항목 일괄 거부(삭제)
              </button>
            </div>
          </div>
        )}

        {/* 승인 대기 */}
        {pending.length > 0 && (
          <section>
            <h2 className="font-serif font-bold text-[var(--color-primary)] mb-3">
              검토 대기 ({pending.length}건{filterKind !== "all" ? ` / 전체 ${allPending.length}건` : ""})
            </h2>
            <div className="space-y-4">
              {pending.map((ext) => (
                <div key={ext.id} className="relative">
                  {/* 체크박스 */}
                  <label className="absolute left-3 top-5 z-10 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(ext.id)}
                      onChange={() => toggleOne(ext.id)}
                      className="accent-[var(--color-primary)] w-4 h-4"
                    />
                  </label>
                  <div className="pl-10">
                    {editingId === ext.id ? (
                      <div className="bg-white border border-[var(--color-primary)] rounded-xl p-5 space-y-2">
                        <p className="text-xs font-semibold text-[var(--color-primary)]">편집 중</p>
                        <input
                          value={editForm.title}
                          onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                          placeholder="제목"
                          className="w-full border border-[var(--color-border)] rounded-md px-2 py-1.5 text-sm bg-white"
                        />
                        <textarea
                          value={editForm.content}
                          onChange={(e) => setEditForm((p) => ({ ...p, content: e.target.value }))}
                          rows={3}
                          placeholder="본문"
                          className="w-full border border-[var(--color-border)] rounded-md px-2 py-1.5 text-sm bg-white resize-y"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="date"
                            value={editForm.event_date}
                            onChange={(e) => setEditForm((p) => ({ ...p, event_date: e.target.value }))}
                            className="border border-[var(--color-border)] rounded-md px-2 py-1.5 text-sm bg-white"
                          />
                          <input
                            value={editForm.location}
                            onChange={(e) => setEditForm((p) => ({ ...p, location: e.target.value }))}
                            placeholder="장소"
                            className="border border-[var(--color-border)] rounded-md px-2 py-1.5 text-sm bg-white"
                          />
                          <select
                            value={editForm.event_type}
                            onChange={(e) => setEditForm((p) => ({ ...p, event_type: e.target.value }))}
                            className="border border-[var(--color-border)] rounded-md px-2 py-1.5 text-sm bg-white"
                          >
                            <option value="">분류 선택…</option>
                            {ALL_KINDS.map((k) => (
                              <option key={k} value={k}>{k}</option>
                            ))}
                          </select>
                          <input
                            value={editForm.group_name}
                            onChange={(e) => setEditForm((p) => ({ ...p, group_name: e.target.value }))}
                            placeholder="모임·단체 (선택)"
                            className="border border-[var(--color-border)] rounded-md px-2 py-1.5 text-sm bg-white"
                          />
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => saveEdit(ext.id)}
                            className="flex-1 px-3 py-1.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white text-sm rounded-md font-medium"
                          >
                            저장
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-3 py-1.5 border border-[var(--color-border)] rounded-md text-sm"
                          >
                            취소
                          </button>
                        </div>
                      </div>
                    ) : (
                      <ExtractionCard
                        ext={ext}
                        boards={boards}
                        selectedBoardId={selectedBoard[ext.id]}
                        onSelectBoard={(bid) => setSelectedBoard((p) => ({ ...p, [ext.id]: bid }))}
                        onApprove={() => approve(ext)}
                        onApproveAsEvent={(mirrorBoardSlug) => approveAsEvent(ext, mirrorBoardSlug)}
                        onApproveAsVision={(payload) => approveAsVision(ext, payload)}
                        onApproveAsMeditation={(payload) => approveAsMeditation(ext, payload)}
                        onReject={() => reject(ext.id)}
                        onEdit={() => startEdit(ext)}
                        onSplitByDates={() => splitByDates(ext.id)}
                        onConvertToCalendar={() => convertToCalendar(ext.id)}
                        processing={!!processing[ext.id]}
                        communityGroups={communityGroups}
                        review={reviewByExt[ext.id] ?? { temporal_kind: ext.temporal_kind ?? "unknown", group_ids: [], notify: true }}
                        onReviewChange={(patch) => setReview(ext.id, patch)}
                        token={token}
                      />
                    )}
                  </div>
                </div>
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
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                    승인
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

        {/* PDF에서 추출한 사진 — 특정 주보 컨텍스트일 때만 (?bulletin_id=N) */}
        {bulletinId && <ExtractedImagesSection bulletinId={bulletinId} />}
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
  onApproveAsMeditation,
  onReject,
  onEdit,
  onSplitByDates,
  onConvertToCalendar,
  processing,
  communityGroups,
  review,
  onReviewChange,
  token,
}: {
  ext: Extraction;
  boards: Board[];
  selectedBoardId?: number;
  onSelectBoard: (id: number) => void;
  onApprove: () => void;
  onApproveAsEvent: (mirrorBoardSlug?: string) => void;
  onApproveAsVision: (payload: VisionPayload) => void;
  onApproveAsMeditation: (payload: MeditationPayload) => void;
  onReject: () => void;
  onEdit?: () => void;
  onSplitByDates?: () => void;
  onConvertToCalendar?: () => void;
  processing: boolean;
  communityGroups: CommunityGroup[];
  review: ReviewState;
  onReviewChange: (patch: Partial<ReviewState>) => void;
  token: string;
}) {
  const isVision = ext.event_type === "지표";
  const isMeditation = ext.event_type === "묵상";
  // 지표·묵상은 일반 게시판/캘린더 라우팅과 분리 — 검토 영역(시점·분과·알림)도 노출 안 함.
  const isSpecial = isVision || isMeditation;
  // 주 액션 분기: 공지=공지사항 등록 / 행사·모임=캘린더 등록 / 그 외=게시판 등록
  const isNotice = ext.event_type === "공지";
  const isCalendarKind = ext.event_type === "행사" || ext.event_type === "모임";
  const hasDate = !!ext.event_date;

  // 중복 알림 사전 경고 — review.group_ids·notify 변경 시 fetch (debounce 400ms)
  const [preview, setPreview] = useState<{ matches: Array<{ batch_id: number; title: string; created_at: string; target_count: number }>; estimated_target_count: number } | null>(null);
  useEffect(() => {
    if (isSpecial || !review.notify || review.group_ids.length === 0 || !token) {
      setPreview(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API}/api/bulletins/extractions/${ext.id}/notify-preview?group_ids=${review.group_ids.join(",")}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) setPreview(await res.json());
      } catch { /* silent */ }
    }, 400);
    return () => clearTimeout(t);
  }, [ext.id, review.group_ids.join(","), review.notify, isSpecial, token]);
  // 캘린더 등록 시 같은 행사 카드를 게시판에 미러할지 옵션 (시나리오 A)
  const [mirrorEnabled, setMirrorEnabled] = useState(false);
  const [mirrorBoardSlug, setMirrorBoardSlug] = useState<string>("");
  // 본문에 서로 다른 날짜가 2개 이상 있을 때만 '날짜별 분리' 버튼 노출.
  // 백엔드 _DATE_PATTERN(bulletins.py)·_extract_dates_from_text 와 동일한 정규식·dedupe.
  const distinctDateCount = countDistinctDatesInText(ext.content);

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 space-y-3">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <span
            className={`text-xs px-2 py-0.5 rounded-full mr-2 border ${
              isVision
                ? "bg-violet-50 border-violet-200 text-violet-700 font-semibold"
                : isMeditation
                ? "bg-teal-50 border-teal-200 text-teal-700 font-semibold"
                : "bg-[var(--color-surface-warm)] border-[var(--color-border)] text-[var(--color-text-muted)]"
            }`}
          >
            {ext.event_type ?? "기타"}
          </span>
          <span className="font-medium">{ext.title}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {ext.event_date && (
            <span className="text-xs text-[var(--color-text-muted)]">{ext.event_date}</span>
          )}
          {onEdit && (
            <button
              onClick={onEdit}
              className="text-xs text-[var(--color-primary)] hover:underline"
            >
              편집
            </button>
          )}
          {onSplitByDates && !isSpecial && distinctDateCount >= 2 && (
            <button
              onClick={onSplitByDates}
              className="text-xs text-emerald-700 hover:underline"
              title={`본문에서 ${distinctDateCount}개의 M/D 날짜 패턴이 발견됨 — 같은 제목으로 여러 항목으로 분리`}
            >
              📅 날짜별 분리
            </button>
          )}
        </div>
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

      {/* 검토 영역 — 시점·대상 분과·알림 (지표·묵상 제외) */}
      {!isSpecial && (
        <div className="bg-[var(--color-surface-warm)]/60 border border-[var(--color-border)] rounded-lg p-3 space-y-2 text-xs">
          {/* 시점 분류 — 세그먼트 버튼 + 기능 설명 */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 font-semibold text-[var(--color-text)] shrink-0">
                <span aria-hidden="true">⏱</span> 시점
              </span>
              <span className="text-[11px] text-[var(--color-text-muted)]">— 알림 발송 여부를 결정합니다</span>
            </div>
            <Segmented
              name="시점"
              value={review.temporal_kind}
              onChange={(v) => onReviewChange({ temporal_kind: v })}
              options={TEMPORAL_OPTS.map((o) => ({ value: o.value, icon: o.icon, label: o.label, hint: o.hint }))}
            />
            <p className="text-[11px]">
              <span className="text-green-700">상시·미래 = 알림 발송</span>
              <span className="text-[var(--color-text-muted)]"> · </span>
              <span className="text-amber-700">지난 이벤트·모호 = 알림 차단</span>
            </p>
            {ext.temporal_reason && (
              <p className="text-[11px] text-[var(--color-text-muted)] italic">AI 판단: {ext.temporal_reason}</p>
            )}
          </div>
          {/* 대상 분과 — chip 으로 표시 + 추가 드롭다운 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 font-semibold text-[var(--color-text)] shrink-0">
              <span aria-hidden="true">👥</span> 대상 분과
            </span>
            {review.group_ids.length === 0 && (
              <span className="text-[var(--color-text-muted)]">없음 — 알림 받을 단체</span>
            )}
            {review.group_ids.map((gid) => {
              const g = communityGroups.find((x) => x.id === gid);
              return (
                <span key={gid} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 border border-violet-200 text-violet-700">
                  {g?.name ?? `#${gid}`}
                  <button
                    onClick={() => onReviewChange({ group_ids: review.group_ids.filter((id) => id !== gid) })}
                    className="text-violet-500 hover:text-violet-800"
                    aria-label="제거"
                  >×</button>
                </span>
              );
            })}
            <select
              value=""
              onChange={(e) => {
                const id = Number(e.target.value);
                if (id && !review.group_ids.includes(id)) {
                  onReviewChange({ group_ids: [...review.group_ids, id] });
                }
              }}
              className="border border-[var(--color-border)] rounded px-1.5 py-0.5 bg-white text-[11px]"
            >
              <option value="">+ 분과 선택</option>
              {communityGroups
                .filter((g) => !review.group_ids.includes(g.id))
                .map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
            </select>
          </div>
          {/* 이번주 묶음·만료일 (공지 묻힘 회피) */}
          {ext.event_type === "공지" && (
            <div className="flex items-center gap-4 flex-wrap pt-2 border-t border-[var(--color-border)]/60">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!review.weekly_bundle}
                  onChange={(e) => onReviewChange({ weekly_bundle: e.target.checked })}
                  className="accent-[var(--color-primary)]"
                />
                <span>📋 이번 주만 유효 (this-week 게시판으로)</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!review.is_pinned}
                  onChange={(e) => onReviewChange({ is_pinned: e.target.checked })}
                  className="accent-[var(--color-primary)]"
                />
                <span>📌 상단 고정 (목록 맨 위에 항상 노출)</span>
              </label>
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-[var(--color-border)]/60">
            <span className="inline-flex items-center gap-1 font-semibold text-[var(--color-text)] shrink-0">
              <span aria-hidden="true">📆</span> 만료일
            </span>
            <input
              type="date"
              value={review.expires_at ?? ""}
              onChange={(e) => onReviewChange({ expires_at: e.target.value || null })}
              className="border border-[var(--color-border)] rounded px-2 py-0.5 text-[11px] bg-white"
            />
            <span className="text-[11px] text-[var(--color-text-muted)]">지나면 목록에서 자동 숨김. AI 추정: event_date+1일 또는 발행일+7일</span>
          </div>
          {/* 알림 발송 토글 */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={review.notify}
                onChange={(e) => onReviewChange({ notify: e.target.checked })}
                className="accent-[var(--color-primary)]"
              />
              <span className="inline-flex items-center gap-1"><span aria-hidden="true">🔔</span> 승인 시 관심 회원에게 알림 발송</span>
            </label>
            {(() => {
              // 백엔드 _notify_gate_passes 와 동일 로직 시뮬
              const tk = review.temporal_kind;
              const today = new Date().toISOString().slice(0, 10);
              let blockReason: string | null = null;
              if (tk === "past") blockReason = "지난 이벤트로 분류 — 차단";
              else if (tk === "unknown") blockReason = "시점 모호 — 차단";
              else if (tk === "future" && ext.event_date && ext.event_date < today) {
                blockReason = `event_date ${ext.event_date} 가 오늘 이전 — 차단`;
              }
              if (blockReason) {
                return <span className="text-[11px] text-amber-700">※ {blockReason}</span>;
              }
              if (review.group_ids.length === 0) {
                return <span className="text-[11px] text-[var(--color-text-muted)]">분과 미지정 시 발송 안 됨</span>;
              }
              return null;
            })()}
          </div>
          {/* 중복 알림 사전 경고 — 같은 분과·동일 제목 batch 최근 14일 매칭 시 */}
          {preview && preview.matches.length > 0 && (
            <div className="mt-1 flex items-start gap-2 rounded-md bg-amber-50 border border-amber-300 px-2.5 py-1.5 text-[11px] text-amber-900">
              <span className="shrink-0">⚠️</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold">중복 알림 주의 — 최근 14일 내 같은 제목·분과로 {preview.matches.length}건 발송됨</p>
                {preview.matches.slice(0, 2).map((m) => (
                  <p key={m.batch_id} className="text-amber-800">
                    · {new Date(m.created_at).toLocaleDateString("ko-KR")} 대상 {m.target_count}명
                  </p>
                ))}
              </div>
            </div>
          )}
          {preview && preview.matches.length === 0 && review.group_ids.length > 0 && (
            <p className="text-[11px] text-[var(--color-text-muted)]">
              예상 발송 대상: 약 {preview.estimated_target_count}명 (분과 회원 중 카톡 알림 동의)
            </p>
          )}
        </div>
      )}

      {/* 본당 사목지표 등록 인라인 폼 (event_type='지표' 전용) */}
      {isVision && (
        <VisionApproveForm
          ext={ext}
          processing={processing}
          onApprove={onApproveAsVision}
          onReject={onReject}
        />
      )}

      {/* 묵상 등록 인라인 폼 (event_type='묵상' 전용) */}
      {isMeditation && (
        <MeditationApproveForm
          ext={ext}
          processing={processing}
          onApprove={onApproveAsMeditation}
          onReject={onReject}
        />
      )}

      {/* 액션 영역 — 지표·묵상 제외 (별도 폼이 그 자리 차지) */}
      {!isSpecial && (
        <div className="pt-1 space-y-2">
          {isNotice ? (
            /* 공지 → 공지사항 등록 (notice/this-week 자동 라우팅, 게시판 선택 불필요) */
            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={onApprove}
                  disabled={processing}
                  className="flex-1 px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {processing ? "처리 중…" : "공지사항 등록"}
                </button>
                <button
                  onClick={onReject}
                  disabled={processing}
                  className="px-4 py-2 border border-[var(--color-border)] hover:bg-[var(--color-surface-warm)] rounded-lg text-sm disabled:opacity-50 transition-colors"
                >
                  거부
                </button>
              </div>
              {/* AI 오분류 교정 — 날짜 신호(event_date 또는 본문 날짜 2개+)가 있으면 캘린더 전환 제안 */}
              {onConvertToCalendar && (hasDate || distinctDateCount >= 2) && (
                <button
                  onClick={onConvertToCalendar}
                  disabled={processing}
                  title="공지로 분류됐지만 날짜가 감지됨 — 행사로 바꿔 캘린더에 등록할 수 있습니다"
                  className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-800 hover:underline disabled:opacity-50"
                >
                  📅 날짜가 있는 일정인가요? 캘린더로 보내기 (행사로 전환)
                </button>
              )}
            </div>
          ) : isCalendarKind && hasDate ? (
            /* 행사·모임 + 날짜 → 캘린더 등록 (주 액션) + 게시판 미러 옵션 */
            <>
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={mirrorEnabled}
                    onChange={(e) => setMirrorEnabled(e.target.checked)}
                    className="accent-emerald-600"
                  />
                  <span>게시판에도 카드 노출</span>
                </label>
                {mirrorEnabled && (
                  <select
                    value={mirrorBoardSlug}
                    onChange={(e) => setMirrorBoardSlug(e.target.value)}
                    className="flex-1 border border-emerald-300 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">게시판 선택…</option>
                    {boards.map((b) => (
                      <option key={b.id} value={b.slug}>{b.name}</option>
                    ))}
                  </select>
                )}
                <span className="text-emerald-700/70 text-[10px] shrink-0">본문 중복 없음 (캘린더가 권위)</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onApproveAsEvent(mirrorEnabled ? mirrorBoardSlug : undefined)}
                  disabled={processing || (mirrorEnabled && !mirrorBoardSlug)}
                  title={(mirrorEnabled && !mirrorBoardSlug) ? "미러 게시판을 선택하세요" : ""}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  📅 캘린더 등록{mirrorEnabled && mirrorBoardSlug && " + 게시판 카드"}
                </button>
                <button
                  onClick={onReject}
                  disabled={processing}
                  className="px-4 py-2 border border-[var(--color-border)] hover:bg-[var(--color-surface-warm)] rounded-lg text-sm disabled:opacity-50 transition-colors"
                >
                  거부
                </button>
              </div>
            </>
          ) : (
            /* 그 외(봉사·순례 등·미분류) + 날짜 없는 행사·모임 → 게시판 선택 후 등록 */
            <>
              {isCalendarKind && !hasDate && (
                <p className="text-[11px] text-amber-700 px-1">
                  ⓘ 날짜가 없어 캘린더 등록 불가 — 날짜를 입력(편집)하면 캘린더 등록, 아니면 게시판에 등록하세요.
                </p>
              )}
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
                <button
                  onClick={onReject}
                  disabled={processing}
                  className="px-4 py-2 border border-[var(--color-border)] hover:bg-[var(--color-surface-warm)] rounded-lg text-sm disabled:opacity-50 transition-colors"
                >
                  거부
                </button>
              </div>
            </>
          )}
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
  const [notifyOnApprove, setNotifyOnApprove] = useState<boolean>(false);

  return (
    <div className="mt-1 rounded-lg border border-violet-200 bg-violet-50/60 p-4 space-y-3">
      <p className="text-xs font-semibold text-violet-800">
        본당 사목지표로 등록 — visions 테이블에 저장됩니다
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
        올해의 본당 사목지표로 표시 (같은 해 기존 표시는 자동 해제)
      </label>

      <label className="flex items-start gap-2 text-xs cursor-pointer p-2 bg-amber-50 border border-amber-200 rounded-md">
        <input
          type="checkbox"
          checked={notifyOnApprove}
          onChange={(e) => setNotifyOnApprove(e.target.checked)}
          className="accent-amber-600 mt-0.5"
        />
        <span>
          <span className="font-medium text-amber-900">등록 시 알림 발송</span>
          <span className="block text-[11px] text-amber-700 mt-0.5">사목지표 알림 수신에 동의한 회원에게 이메일·사이트 알림을 보냅니다.</span>
        </span>
      </label>

      <div className="flex gap-2 pt-1">
        <button
          onClick={() =>
            onApprove({
              year,
              motto: motto.trim(),
              body: body.trim(),
              is_current: isCurrent,
              notify: notifyOnApprove,
            })
          }
          disabled={processing || !motto.trim()}
          className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {processing ? "등록 중…" : "본당 사목지표로 등록"}
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

function MeditationApproveForm({
  ext,
  processing,
  onApprove,
  onReject,
}: {
  ext: Extraction;
  processing: boolean;
  onApprove: (payload: MeditationPayload) => void;
  onReject: () => void;
}) {
  // AI 가 content 끝에 '글 | 작성자' 식으로 author 를 함께 넣어 보내는 경우가 있어,
  // 그 패턴을 단순 정규식으로 한 번 분리 시도. 백엔드 _extract_meditation_author 와 비슷한 분할.
  function splitAuthor(content: string | null): { body: string; author: string } {
    if (!content) return { body: "", author: "" };
    const m = content.match(/^([\s\S]*?)\n?\s*글\s*[\|｜]\s*([^\n]+?)\s*$/);
    if (m) return { body: m[1].trim(), author: m[2].trim() };
    return { body: content, author: "" };
  }
  const initial = splitAuthor(ext.content);
  const [title, setTitle] = useState<string>(ext.title);
  const [body, setBody] = useState<string>(initial.body);
  const [author, setAuthor] = useState<string>(initial.author);
  // AI 가 분리 추출한 묵상 필드를 초기값으로 — 관리자가 검토·보완 후 등록.
  const [scripture, setScripture] = useState<string>(ext.scripture ?? "");
  const [practice, setPractice] = useState<string>(ext.practice ?? "");
  const [pullQuote, setPullQuote] = useState<string>(ext.pull_quote ?? "");
  const [isPublished, setIsPublished] = useState<boolean>(true);
  const [notifyOnApprove, setNotifyOnApprove] = useState<boolean>(false);

  return (
    <div className="mt-1 rounded-lg border border-teal-200 bg-teal-50/60 p-4 space-y-3">
      <p className="text-xs font-semibold text-teal-800">
        묵상으로 등록 — meditations 테이블에 저장됩니다
      </p>

      <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
        <label className="text-xs text-teal-900">제목</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="border border-teal-200 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-teal-500"
        />

        <label className="text-xs text-teal-900">작성자</label>
        <input
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="예: 김아무개 신부 (선택)"
          className="border border-teal-200 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-teal-500"
        />

        <label className="text-xs text-teal-900 pt-1.5">성경 구절</label>
        <input
          type="text"
          value={scripture}
          onChange={(e) => setScripture(e.target.value)}
          placeholder="오늘의 복음 — 예: 요한 20,19-23 (선택)"
          className="border border-teal-200 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-teal-500"
        />

        <label className="text-xs text-teal-900 pt-1.5">본문</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          className="border border-teal-200 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-teal-500 leading-relaxed resize-y"
        />

        <label className="text-xs text-teal-900 pt-1.5">강조 인용</label>
        <textarea
          value={pullQuote}
          onChange={(e) => setPullQuote(e.target.value)}
          rows={2}
          placeholder="핵심 한 문장. 마지막 줄 '— 출처' 로 출처 표기 (선택)"
          className="border border-teal-200 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-teal-500 leading-relaxed resize-y"
        />

        <label className="text-xs text-teal-900 pt-1.5">이번 주 실천</label>
        <textarea
          value={practice}
          onChange={(e) => setPractice(e.target.value)}
          rows={3}
          placeholder="한 줄에 하나씩. 번호는 자동 부여 (선택)"
          className="border border-teal-200 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-teal-500 leading-relaxed resize-y"
        />
      </div>

      <label className="flex items-center gap-2 text-xs text-teal-900 cursor-pointer">
        <input
          type="checkbox"
          checked={isPublished}
          onChange={(e) => setIsPublished(e.target.checked)}
          className="accent-teal-600"
        />
        공개 (홈 묵상 위젯·/word 페이지에 노출, 최신 묵상으로 자동 핀)
      </label>

      <label className="flex items-start gap-2 text-xs cursor-pointer p-2 bg-amber-50 border border-amber-200 rounded-md">
        <input
          type="checkbox"
          checked={notifyOnApprove}
          onChange={(e) => setNotifyOnApprove(e.target.checked)}
          className="accent-amber-600 mt-0.5"
        />
        <span>
          <span className="font-medium text-amber-900">등록 시 알림 발송</span>
          <span className="block text-[11px] text-amber-700 mt-0.5">주일말씀 알림 수신에 동의한 회원에게 이메일·사이트 알림을 보냅니다.</span>
        </span>
      </label>

      <div className="flex gap-2 pt-1">
        <button
          onClick={() =>
            onApprove({
              title: title.trim(),
              body: body.trim(),
              author: author.trim(),
              scripture: scripture.trim(),
              practice: practice.trim(),
              pull_quote: pullQuote.trim(),
              is_published: isPublished,
              notify: notifyOnApprove,
            })
          }
          disabled={processing || !title.trim() || !body.trim()}
          className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {processing ? "등록 중…" : "묵상으로 등록"}
        </button>
        <button
          onClick={onReject}
          disabled={processing}
          className="px-4 py-2 border border-teal-200 text-teal-700 hover:bg-teal-100 rounded-lg text-sm disabled:opacity-50 transition-colors"
        >
          거부
        </button>
      </div>
    </div>
  );
}
