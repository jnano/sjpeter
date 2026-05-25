"use client";
import { useState, useEffect, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Application {
  id: number;
  member_id: number;
  class_id: number | null;
  name: string | null;
  phone: string | null;
  baptismal_name_wish: string | null;
  message: string | null;
  status: string;
  created_at: string;
  member_nickname: string | null;
  member_email: string | null;
  class_round_no: number | null;
}

const STATUSES = ["접수", "연락완료", "등록완료", "취소"];
const STATUS_TONE: Record<string, string> = {
  "접수": "bg-amber-100 text-amber-700",
  "연락완료": "bg-blue-100 text-blue-700",
  "등록완료": "bg-emerald-100 text-emerald-700",
  "취소": "bg-gray-100 text-gray-500",
};

function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
}

export default function ApplicationsSection({ onChanged }: { onChanged: () => void }) {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const authHeader = { Authorization: `Bearer ${getToken()}` };

  const load = useCallback(async () => {
    const res = await fetch(`${API}/api/catechumen/applications`, { headers: { Authorization: `Bearer ${getToken()}` } });
    if (res.ok) setApps(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function changeStatus(id: number, status: string) {
    await fetch(`${API}/api/catechumen/applications/${id}/status`, {
      method: "PUT", headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function toMember(app: Application) {
    if (!app.class_id) { alert("연결된 차수가 없습니다. 모집중 차수가 있을 때 신청하면 자동 연결됩니다."); return; }
    if (!confirm(`${app.name || app.member_nickname} 님을 제${app.class_round_no}차 참여자 명단에 추가하고 '등록완료' 처리할까요?`)) return;
    const res = await fetch(`${API}/api/catechumen/applications/${app.id}/to-member`, { method: "POST", headers: authHeader });
    if (res.ok) { load(); onChanged(); } else { alert("전환에 실패했습니다."); }
  }

  async function remove(id: number) {
    if (!confirm("이 신청을 삭제하시겠습니까?")) return;
    await fetch(`${API}/api/catechumen/applications/${id}`, { method: "DELETE", headers: authHeader });
    load();
  }

  if (loading) return null;

  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold text-[var(--color-primary)] mb-1">입교신청 ({apps.length})</h2>
      <p className="text-sm text-[var(--color-text-muted)] mb-4">회원이 제출한 입교신청입니다. 연락 후 상태를 바꾸고, 차수 참여자로 전환할 수 있습니다.</p>

      {apps.length === 0 ? (
        <p className="text-center py-10 text-sm text-[var(--color-text-muted)] bg-[var(--color-surface-warm)]/40 rounded-xl">접수된 입교신청이 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {apps.map((a) => (
            <div key={a.id} className="bg-white border border-[var(--color-border)] rounded-xl p-4">
              <div className="flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[var(--color-primary)] flex items-center gap-2 flex-wrap">
                    <span>{a.name || a.member_nickname || "(이름 없음)"}</span>
                    {a.baptismal_name_wish && <span className="text-xs font-normal text-[var(--color-text-muted)]">세례명 희망: {a.baptismal_name_wish}</span>}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${STATUS_TONE[a.status] ?? ""}`}>{a.status}</span>
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    {a.member_nickname && `회원 ${a.member_nickname} · `}
                    {a.phone && `${a.phone} · `}
                    {a.member_email && `${a.member_email} · `}
                    {a.class_round_no != null ? `제${a.class_round_no}차` : "차수 미연결"}
                    {` · ${a.created_at.slice(0, 10)}`}
                  </p>
                  {a.message && <p className="text-sm mt-2 bg-[var(--color-surface-warm)]/50 rounded-lg px-3 py-2 whitespace-pre-line">{a.message}</p>}
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <select value={a.status} onChange={(e) => changeStatus(a.id, e.target.value)}
                    className="border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-[var(--color-primary)]">
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={() => toMember(a)}
                    className="px-3 py-1.5 text-xs border border-[var(--color-primary)] text-[var(--color-primary)] rounded-lg hover:bg-[var(--color-surface-warm)]">
                    참여자로 전환
                  </button>
                  <button onClick={() => remove(a.id)} className="px-3 py-1.5 text-xs border border-red-200 text-red-500 rounded-lg hover:bg-red-50">삭제</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
