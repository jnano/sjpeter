"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const EVENT_TYPE_LABELS: Record<string, string> = {
  행사: "행사",
  모임: "모임",
  봉사: "봉사",
  순례: "순례",
  피정: "피정",
  강의: "강의",
  기타: "기타",
};

interface Mapping {
  event_type: string;
  board_id: number | null;
  board_name: string | null;
  board_slug: string | null;
  use_calendar: boolean;
}

interface Board {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
}

export default function EventMappingPage() {
  const router = useRouter();
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  const authHeaders = () => {
    const token = localStorage.getItem("admin_token");
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  };

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) { router.push("/admin"); return; }

    Promise.all([
      fetch(`${API}/api/boards/event-mapping`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API}/api/boards`),
    ]).then(async ([mRes, bRes]) => {
      if (!mRes.ok) { router.push("/admin"); return; }
      const [mData, bData] = await Promise.all([mRes.json(), bRes.ok ? bRes.json() : []]);
      setMappings(mData);
      setBoards(bData.filter((b: Board) => b.is_active));
    }).finally(() => setLoading(false));
  }, [router]);

  async function handleChange(event_type: string, value: string) {
    const use_calendar = value === "calendar";
    const board_id = use_calendar || value === "" ? null : Number(value);

    setMappings((prev) =>
      prev.map((m) =>
        m.event_type === event_type
          ? {
              ...m,
              board_id,
              use_calendar,
              board_name: use_calendar ? null : (boards.find((b) => b.id === board_id)?.name ?? null),
            }
          : m
      )
    );
    setSaving((s) => ({ ...s, [event_type]: true }));
    setSaved((s) => ({ ...s, [event_type]: false }));
    try {
      const res = await fetch(`${API}/api/boards/event-mapping/${encodeURIComponent(event_type)}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ board_id, use_calendar }),
      });
      if (res.ok) {
        setSaved((s) => ({ ...s, [event_type]: true }));
        setTimeout(() => setSaved((s) => ({ ...s, [event_type]: false })), 2000);
      } else {
        alert("저장에 실패했습니다.");
      }
    } finally {
      setSaving((s) => ({ ...s, [event_type]: false }));
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="text-center py-16 text-[var(--color-text-muted)]">불러오는 중…</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-[var(--color-primary)]">분류 설정</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          주보 AI 분석 결과를 어느 게시판에 임시저장할지 지정합니다.
          변경 즉시 자동 저장됩니다.
        </p>
      </div>

      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden">
        <div className="px-6 py-3 bg-[var(--color-surface-warm)] grid grid-cols-[1fr_2fr_auto] gap-4 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
          <span>행사 유형</span>
          <span>대상 게시판</span>
          <span>상태</span>
        </div>

        <div className="divide-y divide-[var(--color-border)]">
          {mappings.map((m) => (
            <div
              key={m.event_type}
              className="px-6 py-4 grid grid-cols-[1fr_2fr_auto] gap-4 items-center"
            >
              <span className="font-medium text-sm">
                {EVENT_TYPE_LABELS[m.event_type] ?? m.event_type}
              </span>

              <select
                value={m.use_calendar ? "calendar" : (m.board_id ?? "")}
                onChange={(e) => handleChange(m.event_type, e.target.value)}
                disabled={saving[m.event_type]}
                className="border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)] disabled:opacity-50 bg-white"
              >
                <option value="">미지정 (임시저장 보류)</option>
                <option value="calendar">📅 행사일정</option>
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>

              <span className="text-xs w-14 text-right">
                {saving[m.event_type] ? (
                  <span className="text-[var(--color-text-muted)]">저장 중…</span>
                ) : saved[m.event_type] ? (
                  <span className="text-green-600 font-medium">저장됨</span>
                ) : (
                  <span className="text-[var(--color-text-muted)]">—</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-[var(--color-text-muted)] mt-4">
        "미지정"으로 설정된 유형은 게시판에 바로 임시저장되지 않고,
        임시저장 목록에서 수동으로 게시판을 지정해야 합니다.
      </p>
    </div>
  );
}
