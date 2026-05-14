"use client";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL;

const ACTION_LABEL: Record<string, string> = {
  admin_login: "관리자 로그인",
  activate_member: "회원 활성화",
  deactivate_member: "회원 비활성화",
  delete_member: "회원 삭제",
  create_event: "행사 등록",
  delete_event: "행사 삭제",
  update_event: "행사 수정",
};

const ACTION_COLOR: Record<string, string> = {
  admin_login: "bg-blue-50 text-blue-700",
  activate_member: "bg-green-50 text-green-700",
  deactivate_member: "bg-amber-50 text-amber-700",
  delete_member: "bg-red-50 text-red-700",
  create_event: "bg-purple-50 text-purple-700",
  delete_event: "bg-red-50 text-red-700",
  update_event: "bg-purple-50 text-purple-700",
};

interface LogEntry {
  id: number;
  admin: string;
  action: string;
  target_type: string | null;
  target_id: number | null;
  detail: string | null;
  created_at: string;
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const PAGE_SIZE = 50;

  const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;

  async function loadLogs(p: number) {
    setLoading(true);
    try {
      const res = await fetch(
        `${API}/api/members/admin/logs?page=${p}&size=${PAGE_SIZE}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setLogs(data.items ?? []);
        setTotal(data.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadLogs(page); }, [page]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-primary)]">관리 활동 로그</h1>
        <span className="text-sm text-[var(--color-text-muted)]">전체 {total.toLocaleString()}건</span>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--color-text-muted)]">불러오는 중...</p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-12">로그가 없습니다.</p>
      ) : (
        <>
          <div className="bg-white border border-[var(--color-border)] rounded-xl overflow-hidden">
            <div className="divide-y divide-[var(--color-border)]">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50">
                  <div className="text-xs text-[var(--color-text-muted)] shrink-0 w-36">
                    {new Date(log.created_at).toLocaleString("ko-KR", {
                      month: "2-digit", day: "2-digit",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </div>
                  <div className="shrink-0 w-20">
                    <span className="text-xs font-medium text-[var(--color-primary)]">{log.admin}</span>
                  </div>
                  <div className="shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${ACTION_COLOR[log.action] ?? "bg-gray-100 text-gray-600"}`}>
                      {ACTION_LABEL[log.action] ?? log.action}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 text-xs text-[var(--color-text-muted)] truncate">
                    {log.detail ?? (log.target_type ? `${log.target_type} #${log.target_id}` : "")}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-lg hover:bg-gray-50 disabled:opacity-40"
              >
                이전
              </button>
              <span className="px-3 py-1.5 text-sm text-[var(--color-text-muted)]">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-lg hover:bg-gray-50 disabled:opacity-40"
              >
                다음
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
