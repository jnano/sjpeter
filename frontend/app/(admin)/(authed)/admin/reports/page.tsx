"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL;

type Status = "pending" | "in_progress" | "done";

const STATUS_LABELS: Record<Status, string> = {
  pending: "접수",
  in_progress: "처리중",
  done: "완료",
};

const STATUS_COLORS: Record<Status, string> = {
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  in_progress: "bg-blue-100 text-blue-700 border-blue-200",
  done: "bg-green-100 text-green-700 border-green-200",
};

interface Reporter {
  id: number;
  nickname: string;
  email: string;
  avatar_url: string | null;
}

interface Report {
  id: number;
  content: string;
  page_url: string | null;
  status: Status;
  admin_note: string | null;
  reporter_member_id: number | null;
  reporter_name: string | null;
  reporter_email: string | null;
  reporter: Reporter | null;
  created_at: string;
  updated_at: string;
}

interface ListData {
  items: Report[];
  total: number;
  counts: Record<Status, number>;
}

export default function ReportsPage() {
  const router = useRouter();
  const [data, setData] = useState<ListData | null>(null);
  const [filter, setFilter] = useState<Status | "all">("all");
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [savingNote, setSavingNote] = useState<Record<number, boolean>>({});

  const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;

  const fetchReports = useCallback(async () => {
    if (!token) { router.push("/admin"); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("status", filter);
      const res = await fetch(`${API}/api/reports?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { router.push("/admin"); return; }
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [token, filter, router]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  async function changeStatus(id: number, status: Status) {
    if (!token) return;
    const res = await fetch(`${API}/api/reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    });
    if (res.ok) fetchReports();
  }

  async function saveNote(id: number, admin_note: string) {
    if (!token) return;
    setSavingNote((p) => ({ ...p, [id]: true }));
    try {
      const res = await fetch(`${API}/api/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ admin_note }),
      });
      if (res.ok) {
        const updated: Report = await res.json();
        setData((prev) => prev ? {
          ...prev,
          items: prev.items.map((r) => r.id === id ? updated : r),
        } : prev);
      }
    } finally {
      setSavingNote((p) => ({ ...p, [id]: false }));
    }
  }

  async function deleteReport(id: number) {
    if (!confirm("이 신고를 삭제하시겠습니까? 복구 불가합니다.")) return;
    if (!token) return;
    const res = await fetch(`${API}/api/reports/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) fetchReports();
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-end justify-between mb-6">
        <h1 className="text-xl font-bold">장애 신고 관리</h1>
        <p className="text-xs text-[var(--color-text-muted)]">
          공개 페이지 Footer → 장애 신고로 접수된 사용자 신고를 처리합니다.
        </p>
      </div>

      {/* 상태 필터 */}
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        {(["all", "pending", "in_progress", "done"] as const).map((s) => {
          const active = filter === s;
          const count = s === "all"
            ? data?.total ?? 0
            : data?.counts?.[s as Status] ?? 0;
          const label = s === "all" ? "전체" : STATUS_LABELS[s as Status];
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                active
                  ? "bg-blue-600 text-white border-blue-600"
                  : "border-gray-300 hover:bg-gray-50"
              }`}
            >
              {label} <span className="ml-1 opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="text-center py-12 text-sm text-gray-500">불러오는 중…</p>
      ) : !data || data.items.length === 0 ? (
        <p className="text-center py-12 text-sm text-gray-400">접수된 신고가 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {data.items.map((r) => {
            const isOpen = expandedId === r.id;
            const reporterLabel = r.reporter
              ? `${r.reporter.nickname} (${r.reporter.email})`
              : r.reporter_name || r.reporter_email
                ? `${r.reporter_name ?? "익명"}${r.reporter_email ? ` (${r.reporter_email})` : ""}`
                : "익명";
            return (
              <li
                key={r.id}
                className="bg-white border border-gray-200 rounded-lg overflow-hidden"
              >
                {/* 헤더 */}
                <button
                  type="button"
                  onClick={() => setExpandedId(isOpen ? null : r.id)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className={`shrink-0 inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded-full ${STATUS_COLORS[r.status]}`}>
                    {STATUS_LABELS[r.status]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.content}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      #{r.id} · {reporterLabel} · {new Date(r.created_at).toLocaleString("ko-KR")}
                    </p>
                  </div>
                </button>

                {/* 상세 + 액션 */}
                {isOpen && (
                  <div className="px-4 pb-4 border-t border-gray-100 space-y-3">
                    <div className="pt-3">
                      <p className="text-xs font-semibold text-gray-500 mb-1">신고 내용</p>
                      <p className="text-sm whitespace-pre-wrap bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{r.content}</p>
                    </div>

                    {r.page_url && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-1">발생 페이지</p>
                        <a
                          href={r.page_url.startsWith("http") ? r.page_url : r.page_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline break-all"
                        >
                          {r.page_url}
                        </a>
                      </div>
                    )}

                    <NoteEditor
                      initial={r.admin_note ?? ""}
                      saving={!!savingNote[r.id]}
                      onSave={(v) => saveNote(r.id, v)}
                    />

                    <div className="flex flex-wrap gap-2 pt-2">
                      {(["pending", "in_progress", "done"] as Status[]).map((s) => {
                        const active = r.status === s;
                        return (
                          <button
                            key={s}
                            onClick={() => changeStatus(r.id, s)}
                            disabled={active}
                            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                              active
                                ? `${STATUS_COLORS[s]} cursor-default`
                                : "border-gray-300 hover:bg-gray-50"
                            }`}
                          >
                            {STATUS_LABELS[s]}로 변경
                          </button>
                        );
                      })}
                      <button
                        onClick={() => deleteReport(r.id)}
                        className="ml-auto text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        삭제
                      </button>
                    </div>
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

function NoteEditor({ initial, saving, onSave }: {
  initial: string;
  saving: boolean;
  onSave: (v: string) => void;
}) {
  const [value, setValue] = useState(initial);
  useEffect(() => { setValue(initial); }, [initial]);
  const unchanged = value === initial;
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 mb-1">처리 메모 <span className="font-normal text-gray-400">(운영자 내부용)</span></p>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        placeholder="처리 진행 상황·재현 결과 등을 적어두세요"
      />
      <button
        type="button"
        onClick={() => onSave(value)}
        disabled={saving || unchanged}
        className="mt-1 text-xs px-3 py-1.5 bg-gray-700 text-white rounded-lg hover:bg-gray-800 disabled:opacity-40 transition-colors"
      >
        {saving ? "저장 중…" : "메모 저장"}
      </button>
    </div>
  );
}
