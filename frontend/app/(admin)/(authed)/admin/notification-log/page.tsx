"use client";
import { useCallback, useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL;

interface Batch {
  id: number;
  kind: string;
  title: string;
  source_post_id: number | null;
  source_event_id: number | null;
  source_vision_id: number | null;
  source_meditation_id: number | null;
  source_extraction_id: number | null;
  community_group_ids: number[];
  community_group_names: string[];
  admin_username: string | null;
  target_count: number;
  site_sent: number;
  email_sent: number;
  kakao_sent: number;
  kakao_skipped_no_phone: number;
  failed_reason: string | null;
  created_at: string;
  read_count: number;
}

interface Recipient {
  member_id: number;
  nickname: string;
  email: string | null;
  read_at: string | null;
  notification_id: number;
}

const KIND_LABEL: Record<string, { label: string; className: string }> = {
  community: { label: "분과·게시판", className: "bg-violet-50 text-violet-700 border-violet-200" },
  vision: { label: "사목지표", className: "bg-amber-50 text-amber-700 border-amber-200" },
  meditation: { label: "주일말씀", className: "bg-teal-50 text-teal-700 border-teal-200" },
};

const FAIL_REASON_LABEL: Record<string, string> = {
  no_group: "분과 미선택",
  no_subscribers: "수신 동의 회원 없음",
  gate_blocked: "시점 게이트 차단",
};

export default function NotificationLogPage() {
  const [items, setItems] = useState<Batch[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<string>("");
  const [failedOnly, setFailedOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  const headers = useCallback((): HeadersInit => {
    const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (kind) params.set("kind", kind);
      if (failedOnly) params.set("failed_only", "true");
      const res = await fetch(`${API}/api/admin/notification-batches?${params}`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [headers, kind, failedOnly]);

  useEffect(() => { load(); }, [load]);

  async function loadRecipients(batchId: number) {
    if (expandedId === batchId) { setExpandedId(null); return; }
    setExpandedId(batchId);
    setLoadingRecipients(true);
    try {
      const res = await fetch(`${API}/api/admin/notification-batches/${batchId}/recipients`, { headers: headers() });
      if (res.ok) setRecipients(await res.json());
    } finally {
      setLoadingRecipients(false);
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">알림 발송 로그</h1>
        <p className="text-sm text-gray-500 mt-1">
          분과·사목지표·주일말씀 알림 발송 이력 (batch 단위). 누구에게 몇 번 보냈는지·실패 사유 추적.
        </p>
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
        <span className="text-xs font-semibold text-gray-600">필터:</span>
        <select value={kind} onChange={(e) => setKind(e.target.value)}
          className="text-sm border border-gray-300 rounded px-2 py-1 bg-white">
          <option value="">전체 종류</option>
          <option value="community">분과·게시판</option>
          <option value="vision">사목지표</option>
          <option value="meditation">주일말씀</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm cursor-pointer">
          <input type="checkbox" checked={failedOnly} onChange={(e) => setFailedOnly(e.target.checked)}
            className="accent-[var(--color-primary)]" />
          실패만
        </label>
        <span className="ml-auto text-xs text-gray-500">총 {total}건</span>
      </div>

      {loading ? (
        <p className="text-center py-12 text-gray-500">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="text-center py-12 text-gray-500">발송 이력이 없습니다.</p>
      ) : (
        <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg bg-white">
          {items.map((b) => {
            const meta = KIND_LABEL[b.kind] ?? { label: b.kind, className: "bg-gray-100 text-gray-700 border-gray-200" };
            const isExpanded = expandedId === b.id;
            return (
              <li key={b.id}>
                <div
                  className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
                  onClick={() => loadRecipients(b.id)}
                >
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold shrink-0 mt-0.5 ${meta.className}`}>
                    {meta.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-800 truncate">{b.title}</span>
                      {b.community_group_names.length > 0 && (
                        <span className="text-[11px] text-violet-700">
                          {b.community_group_names.join(", ")}
                        </span>
                      )}
                      {b.failed_reason && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 font-semibold">
                          ⚠ {FAIL_REASON_LABEL[b.failed_reason] ?? b.failed_reason}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 flex-wrap">
                      <span>{new Date(b.created_at).toLocaleString("ko-KR")}</span>
                      {b.admin_username && <span>by {b.admin_username}</span>}
                      <span>대상 {b.target_count}명</span>
                      <span>사이트 {b.site_sent} / 이메일 {b.email_sent}{b.kakao_sent > 0 ? ` / 카톡 ${b.kakao_sent}` : ""}</span>
                      {b.kakao_skipped_no_phone > 0 && (
                        <span className="text-amber-700" title="카톡 알림 ON 상태인데 전화번호가 없어 발송 못 함">
                          카톡 skip {b.kakao_skipped_no_phone} (전화번호 없음)
                        </span>
                      )}
                      <span className="text-emerald-600">읽음 {b.read_count}/{b.site_sent}</span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">{isExpanded ? "▲" : "▼"}</span>
                </div>
                {isExpanded && (
                  <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                    {loadingRecipients ? (
                      <p className="text-xs text-gray-500">대상 회원 불러오는 중…</p>
                    ) : recipients.length === 0 ? (
                      <p className="text-xs text-gray-500">발송 대상 회원이 없습니다.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                        {recipients.map((r) => (
                          <div key={r.notification_id} className="flex items-center gap-2 px-2 py-1 bg-white rounded border border-gray-200">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.read_at ? "bg-emerald-400" : "bg-amber-400"}`} />
                            <span className="font-medium">{r.nickname}</span>
                            <span className="text-gray-400 truncate">{r.email}</span>
                            {r.read_at && (
                              <span className="ml-auto text-[10px] text-emerald-600 shrink-0">
                                {new Date(r.read_at).toLocaleDateString("ko-KR")} 읽음
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
