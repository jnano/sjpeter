"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface MyApp {
  id: number;
  status: string;
  class_round_no: number | null;
  baptismal_name_wish: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  "접수": "신청 접수됨",
  "연락완료": "본당에서 연락드렸습니다",
  "등록완료": "교리반 등록 완료",
  "취소": "취소됨",
};

export default function ApplyForm() {
  const { data: session, status } = useSession();
  const token = session?.accessToken as string | undefined;

  const [loading, setLoading] = useState(true);
  const [myApps, setMyApps] = useState<MyApp[]>([]);
  const [form, setForm] = useState({ name: "", phone: "", baptismal_name_wish: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (status === "loading") return;
    if (!token) { setLoading(false); return; }
    (async () => {
      const [meRes, appRes] = await Promise.all([
        fetch(`${API}/api/members/me`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/catechumen/applications/me`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (meRes.ok) {
        const me = await meRes.json();
        setForm((f) => ({ ...f, name: me.name ?? "", phone: me.phone ?? "" }));
      }
      if (appRes.ok) setMyApps(await appRes.json());
      setLoading(false);
    })();
  }, [status, token]);

  const activeApp = myApps.find((a) => a.status === "접수" || a.status === "연락완료");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setErr("이름을 입력해 주세요."); return; }
    setSubmitting(true); setErr("");
    const res = await fetch(`${API}/api/catechumen/applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        baptismal_name_wish: form.baptismal_name_wish.trim() || null,
        message: form.message.trim() || null,
      }),
    });
    setSubmitting(false);
    if (res.ok) { setDone(true); }
    else {
      const d = await res.json().catch(() => ({}));
      setErr(d.detail || "신청에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    }
  }

  // ── 로딩 ──
  if (status === "loading" || loading) {
    return <p className="text-center py-12 text-sm text-[var(--color-text-muted)]">불러오는 중…</p>;
  }

  // ── 비로그인 → 로그인 유도 ──
  if (!token) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-4">🔒</div>
        <h2 className="text-lg font-bold text-[var(--color-primary)] mb-2">회원 전용 기능입니다</h2>
        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-8">
          입교신청은 회원가입 후 이용하실 수 있습니다.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/members/login" className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-[var(--color-primary)] hover:opacity-90">회원 로그인</Link>
          <Link href="/members/register" className="px-5 py-2.5 rounded-lg text-sm font-medium border border-[var(--color-border)] hover:bg-[var(--color-surface-warm)]">회원가입</Link>
        </div>
      </div>
    );
  }

  // ── 신청 완료 / 진행 중 신청 있음 ──
  if (done || activeApp) {
    const app = activeApp ?? myApps[0];
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-4">🙏</div>
        <h2 className="text-lg font-bold text-[var(--color-primary)] mb-2">입교신청이 접수되었습니다</h2>
        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-6">
          본당에서 확인 후 연락드리겠습니다. 감사합니다.
        </p>
        {app && (
          <div className="inline-block text-left bg-[var(--color-surface-warm)] border border-[var(--color-border)] rounded-xl px-6 py-4 text-sm">
            <p className="mb-1"><span className="text-[var(--color-text-muted)]">상태</span> · <strong className="text-[var(--color-primary)]">{STATUS_LABEL[app.status] ?? app.status}</strong></p>
            {app.class_round_no != null && <p className="mb-1"><span className="text-[var(--color-text-muted)]">차수</span> · 제{app.class_round_no}차</p>}
            <p><span className="text-[var(--color-text-muted)]">신청일</span> · {app.created_at.slice(0, 10)}</p>
          </div>
        )}
      </div>
    );
  }

  // ── 신청 폼 ──
  return (
    <form onSubmit={submit} className="max-w-lg mx-auto space-y-4">
      <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-2">
        예비자교리 입교를 신청합니다. 아래 정보를 확인해 주세요. 본당에서 확인 후 연락드립니다.
      </p>
      {err && <p className="text-sm px-3 py-2 rounded-lg bg-red-50 text-red-700">{err}</p>}

      <div>
        <label className="block text-xs font-medium mb-1">이름 *</label>
        <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required
          className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--color-primary)]" />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">연락처</label>
        <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          placeholder="010-0000-0000" inputMode="tel"
          className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--color-primary)]" />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">세례명 희망 <span className="text-[var(--color-text-muted)] font-normal">(선택)</span></label>
        <input value={form.baptismal_name_wish} onChange={(e) => setForm((f) => ({ ...f, baptismal_name_wish: e.target.value }))}
          placeholder="원하시는 세례명이 있으면 적어 주세요"
          className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--color-primary)]" />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">신청 동기 · 문의 <span className="text-[var(--color-text-muted)] font-normal">(선택)</span></label>
        <textarea value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} rows={4}
          className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--color-primary)] resize-none" />
      </div>
      <button type="submit" disabled={submitting}
        className="w-full py-3 rounded-lg text-sm font-bold text-white bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-50">
        {submitting ? "신청 중…" : "입교신청"}
      </button>
    </form>
  );
}
