"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const STATUS_LABEL: Record<string, string> = {
  planned: "예정",
  in_progress: "진행 중",
  completed: "완료",
};

interface Phase {
  id: number;
  name: string;
  description: string | null;
  sort_order: number;
  status: string;
  progress_percent: number;
  started_at: string | null;
  completed_at: string | null;
  expected_completion_date: string | null;
  photo_url: string | null;
}

interface JournalEntry {
  id: number;
  entry_date: string;
  note: string;
  photo_url: string | null;
}

const EMPTY_PHASE: Omit<Phase, "id"> = {
  name: "",
  description: "",
  sort_order: 0,
  status: "planned",
  progress_percent: 0,
  started_at: null,
  completed_at: null,
  expected_completion_date: null,
  photo_url: null,
};

export default function AdminConstructionPage() {
  const router = useRouter();
  const [phases, setPhases] = useState<Phase[]>([]);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"phases" | "journal">("phases");

  const authHeader = useCallback((): HeadersInit => {
    const token = localStorage.getItem("admin_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const reload = useCallback(async () => {
    const headers = authHeader();
    const [p, j] = await Promise.all([
      fetch(`${API}/api/construction/phases`, { headers }).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API}/api/construction/journal`, { headers }).then((r) => (r.ok ? r.json() : [])),
    ]);
    setPhases(Array.isArray(p) ? p : []);
    setJournal(Array.isArray(j) ? j : []);
  }, [authHeader]);

  useEffect(() => {
    if (!localStorage.getItem("admin_token")) {
      router.push("/admin");
      return;
    }
    reload();
  }, [reload, router]);

  // ─── Phase 핸들러 ───
  async function savePhase(phase: Phase, isNew = false) {
    setError(null);
    const body = {
      name: phase.name,
      description: phase.description || null,
      sort_order: phase.sort_order,
      status: phase.status,
      progress_percent: phase.progress_percent,
      started_at: phase.started_at || null,
      completed_at: phase.completed_at || null,
      expected_completion_date: phase.expected_completion_date || null,
    };
    const url = isNew
      ? `${API}/api/construction/phases`
      : `${API}/api/construction/phases/${phase.id}`;
    const res = await fetch(url, {
      method: isNew ? "POST" : "PUT",
      headers: { ...authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.detail || "저장 실패");
      return;
    }
    await reload();
  }

  async function deletePhase(id: number) {
    if (!confirm("이 단계를 삭제하시겠습니까? 사진도 함께 삭제됩니다.")) return;
    const res = await fetch(`${API}/api/construction/phases/${id}`, {
      method: "DELETE",
      headers: authHeader(),
    });
    if (res.ok) await reload();
  }

  async function uploadPhasePhoto(id: number, file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API}/api/construction/phases/${id}/photo`, {
      method: "POST",
      headers: authHeader(),
      body: fd,
    });
    if (res.ok) await reload();
    else {
      const data = await res.json().catch(() => ({}));
      setError(data.detail || "사진 업로드 실패");
    }
  }

  // ─── Journal 핸들러 ───
  async function saveJournal(entry: JournalEntry, isNew = false) {
    const body = { entry_date: entry.entry_date, note: entry.note };
    const url = isNew
      ? `${API}/api/construction/journal`
      : `${API}/api/construction/journal/${entry.id}`;
    const res = await fetch(url, {
      method: isNew ? "POST" : "PUT",
      headers: { ...authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      await reload();
      return true;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.detail || "저장 실패");
    return false;
  }

  async function deleteJournal(id: number) {
    if (!confirm("이 일지를 삭제하시겠습니까?")) return;
    const res = await fetch(`${API}/api/construction/journal/${id}`, {
      method: "DELETE",
      headers: authHeader(),
    });
    if (res.ok) await reload();
  }

  async function uploadJournalPhoto(id: number, file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API}/api/construction/journal/${id}/photo`, {
      method: "POST",
      headers: authHeader(),
      body: fd,
    });
    if (res.ok) await reload();
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-primary)]">성전 건축 관리</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          새 성전 건축 단계와 한 줄 일지를 관리합니다. 정점 사진(슬라이드쇼)은 <code className="font-mono text-xs">/admin/page-photos</code>에서 <code className="font-mono text-xs">construction</code> slug로 별도 업로드하세요.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">{error}</div>
      )}

      <div className="flex gap-1 mb-6 border-b border-[var(--color-border)]">
        {[
          { id: "phases", label: `단계 마일스톤 (${phases.length})` },
          { id: "journal", label: `한 줄 일지 (${journal.length})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as "phases" | "journal")}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "phases" && (
        <PhasesSection
          phases={phases}
          onSave={savePhase}
          onDelete={deletePhase}
          onUploadPhoto={uploadPhasePhoto}
        />
      )}

      {tab === "journal" && (
        <JournalSection
          entries={journal}
          onSave={saveJournal}
          onDelete={deleteJournal}
          onUploadPhoto={uploadJournalPhoto}
        />
      )}
    </div>
  );
}

// ─── 단계 섹션 ─────────────────────────────────────────

function PhasesSection({
  phases,
  onSave,
  onDelete,
  onUploadPhoto,
}: {
  phases: Phase[];
  onSave: (p: Phase, isNew?: boolean) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onUploadPhoto: (id: number, f: File) => Promise<void>;
}) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-xs text-[var(--color-text-muted)]">
          순서(sort_order) 작은 값이 먼저 표시됩니다. 진행률(0~100)은 단계별로 직접 입력합니다.
        </p>
        <button
          onClick={() => setAddOpen(true)}
          className="px-3 py-1.5 text-sm bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          + 단계 추가
        </button>
      </div>

      {addOpen && (
        <PhaseRow
          phase={{ ...EMPTY_PHASE, id: 0, sort_order: (phases[phases.length - 1]?.sort_order ?? 0) + 1 } as Phase}
          isNew
          onSave={async (p) => {
            await onSave(p, true);
            setAddOpen(false);
          }}
          onCancel={() => setAddOpen(false)}
        />
      )}

      {phases.length === 0 && !addOpen && (
        <p className="text-center py-12 text-[var(--color-text-muted)] text-sm">
          등록된 단계가 없습니다. "+ 단계 추가"로 시작하세요.
        </p>
      )}

      <div className="space-y-3">
        {phases.map((p) => (
          <PhaseRow
            key={p.id}
            phase={p}
            onSave={(np) => onSave(np)}
            onDelete={() => onDelete(p.id)}
            onUploadPhoto={(f) => onUploadPhoto(p.id, f)}
          />
        ))}
      </div>
    </div>
  );
}

function PhaseRow({
  phase,
  isNew,
  onSave,
  onDelete,
  onCancel,
  onUploadPhoto,
}: {
  phase: Phase;
  isNew?: boolean;
  onSave: (p: Phase) => Promise<void>;
  onDelete?: () => Promise<void>;
  onCancel?: () => void;
  onUploadPhoto?: (f: File) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Phase>(phase);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(phase), [phase]);

  const dirty =
    draft.name !== phase.name ||
    draft.description !== phase.description ||
    draft.sort_order !== phase.sort_order ||
    draft.status !== phase.status ||
    draft.progress_percent !== phase.progress_percent ||
    draft.started_at !== phase.started_at ||
    draft.completed_at !== phase.completed_at ||
    draft.expected_completion_date !== phase.expected_completion_date;

  async function handleSave() {
    if (!draft.name.trim()) return;
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-white p-4">
      <div className="grid sm:grid-cols-[1fr_auto] gap-4">
        {/* 좌: 입력 */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="number"
              value={draft.sort_order}
              onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
              className="w-16 px-2 py-1.5 text-sm border border-[var(--color-border)] rounded-lg"
              title="순서"
            />
            <input
              type="text"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="단계 이름 (예: 골조공사)"
              className="flex-1 px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-lg"
            />
            <select
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value })}
              className="px-2 py-1.5 text-sm border border-[var(--color-border)] rounded-lg bg-white"
            >
              <option value="planned">예정</option>
              <option value="in_progress">진행 중</option>
              <option value="completed">완료</option>
            </select>
          </div>

          <textarea
            value={draft.description ?? ""}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="설명 (선택)"
            rows={2}
            className="w-full px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-lg resize-none"
          />

          <div className="flex flex-wrap gap-2 items-center">
            <label className="text-xs text-[var(--color-text-muted)]">
              진행률{" "}
              <input
                type="number"
                min={0}
                max={100}
                value={draft.progress_percent}
                onChange={(e) => setDraft({ ...draft, progress_percent: Math.max(0, Math.min(100, Number(e.target.value))) })}
                className="w-16 px-2 py-1 text-sm border border-[var(--color-border)] rounded ml-1"
              />
              %
            </label>
            <label className="text-xs text-[var(--color-text-muted)]">
              착수{" "}
              <input
                type="date"
                value={draft.started_at ?? ""}
                onChange={(e) => setDraft({ ...draft, started_at: e.target.value || null })}
                className="px-2 py-1 text-sm border border-[var(--color-border)] rounded ml-1"
              />
            </label>
            <label className="text-xs text-[var(--color-text-muted)]">
              완료{" "}
              <input
                type="date"
                value={draft.completed_at ?? ""}
                onChange={(e) => setDraft({ ...draft, completed_at: e.target.value || null })}
                className="px-2 py-1 text-sm border border-[var(--color-border)] rounded ml-1"
              />
            </label>
            <label className="text-xs text-[var(--color-text-muted)]">
              예상 완료{" "}
              <input
                type="date"
                value={draft.expected_completion_date ?? ""}
                onChange={(e) => setDraft({ ...draft, expected_completion_date: e.target.value || null })}
                className="px-2 py-1 text-sm border border-[var(--color-border)] rounded ml-1"
              />
            </label>
          </div>

          {/* 진행률 시각화 */}
          <div className="h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--color-primary)] transition-all"
              style={{ width: `${draft.progress_percent}%` }}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving || !dirty || !draft.name.trim()}
              className="px-3 py-1.5 text-sm bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-40"
            >
              {saving ? "저장 중…" : isNew ? "추가" : "저장"}
            </button>
            {isNew ? (
              <button
                onClick={onCancel}
                className="px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
            ) : (
              <button
                onClick={onDelete}
                className="px-3 py-1.5 text-sm text-red-500 border border-red-200 rounded-lg hover:bg-red-50"
              >
                삭제
              </button>
            )}
          </div>
        </div>

        {/* 우: 사진 */}
        {!isNew && (
          <div className="flex flex-col items-center gap-2">
            {draft.photo_url ? (
              <img
                src={draft.photo_url.startsWith("http") ? draft.photo_url : `${API}${draft.photo_url}`}
                alt={draft.name}
                className="w-32 h-32 object-cover rounded-lg border border-[var(--color-border)]"
              />
            ) : (
              <div className="w-32 h-32 rounded-lg border border-dashed border-[var(--color-border)] flex items-center justify-center text-xs text-[var(--color-text-muted)]">
                사진 없음
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f && onUploadPhoto) onUploadPhoto(f);
                if (fileRef.current) fileRef.current.value = "";
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="text-xs text-[var(--color-primary)] hover:underline"
            >
              {draft.photo_url ? "사진 교체" : "사진 업로드"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 일지 섹션 ─────────────────────────────────────────

function JournalSection({
  entries,
  onSave,
  onDelete,
  onUploadPhoto,
}: {
  entries: JournalEntry[];
  onSave: (e: JournalEntry, isNew?: boolean) => Promise<boolean>;
  onDelete: (id: number) => Promise<void>;
  onUploadPhoto: (id: number, f: File) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [newEntry, setNewEntry] = useState({
    entry_date: new Date().toISOString().slice(0, 10),
    note: "",
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-xs text-[var(--color-text-muted)]">
          주 1회 정도 짧은 진행 기록을 남기세요. 사진은 일지 등록 후 업로드합니다.
        </p>
        <button
          onClick={() => setAdding((v) => !v)}
          className="px-3 py-1.5 text-sm bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          {adding ? "닫기" : "+ 일지 추가"}
        </button>
      </div>

      {adding && (
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-4 space-y-2">
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={newEntry.entry_date}
              onChange={(e) => setNewEntry({ ...newEntry, entry_date: e.target.value })}
              className="px-2 py-1.5 text-sm border border-[var(--color-border)] rounded-lg"
            />
          </div>
          <textarea
            value={newEntry.note}
            onChange={(e) => setNewEntry({ ...newEntry, note: e.target.value })}
            placeholder="예: 골조 2층 콘크리트 타설 완료. 다음 주 3층 거푸집 예정."
            rows={2}
            className="w-full px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-lg resize-none"
          />
          <button
            onClick={async () => {
              const ok = await onSave({ id: 0, ...newEntry, photo_url: null }, true);
              if (ok) {
                setNewEntry({ entry_date: new Date().toISOString().slice(0, 10), note: "" });
                setAdding(false);
              }
            }}
            disabled={!newEntry.note.trim()}
            className="px-3 py-1.5 text-sm bg-[var(--color-primary)] text-white rounded-lg disabled:opacity-40"
          >
            등록
          </button>
        </div>
      )}

      {entries.length === 0 && !adding && (
        <p className="text-center py-12 text-[var(--color-text-muted)] text-sm">등록된 일지가 없습니다.</p>
      )}

      <div className="space-y-2">
        {entries.map((e) => (
          <JournalRow
            key={e.id}
            entry={e}
            onSave={(ne) => onSave(ne)}
            onDelete={() => onDelete(e.id)}
            onUploadPhoto={(f) => onUploadPhoto(e.id, f)}
          />
        ))}
      </div>
    </div>
  );
}

function JournalRow({
  entry,
  onSave,
  onDelete,
  onUploadPhoto,
}: {
  entry: JournalEntry;
  onSave: (e: JournalEntry) => Promise<boolean>;
  onDelete: () => Promise<void>;
  onUploadPhoto: (f: File) => Promise<void>;
}) {
  const [draft, setDraft] = useState(entry);
  const [editing, setEditing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(entry), [entry]);

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-white p-3">
      <div className="flex gap-3">
        {entry.photo_url && (
          <img
            src={entry.photo_url.startsWith("http") ? entry.photo_url : `${API}${entry.photo_url}`}
            alt=""
            className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2">
              <input
                type="date"
                value={draft.entry_date}
                onChange={(e) => setDraft({ ...draft, entry_date: e.target.value })}
                className="px-2 py-1 text-sm border border-[var(--color-border)] rounded"
              />
              <textarea
                value={draft.note}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                rows={2}
                className="w-full px-2 py-1 text-sm border border-[var(--color-border)] rounded resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    const ok = await onSave(draft);
                    if (ok) setEditing(false);
                  }}
                  className="px-3 py-1 text-xs bg-[var(--color-primary)] text-white rounded"
                >
                  저장
                </button>
                <button
                  onClick={() => {
                    setDraft(entry);
                    setEditing(false);
                  }}
                  className="px-3 py-1 text-xs border border-[var(--color-border)] rounded"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs text-[var(--color-text-muted)] mb-1">{entry.entry_date}</p>
              <p className="text-sm text-[var(--color-text)] whitespace-pre-line">{entry.note}</p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setEditing(true)}
                  className="text-xs text-[var(--color-primary)] hover:underline"
                >
                  수정
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onUploadPhoto(f);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="text-xs text-[var(--color-primary)] hover:underline"
                >
                  {entry.photo_url ? "사진 교체" : "사진 추가"}
                </button>
                <button onClick={onDelete} className="text-xs text-red-400 hover:underline">
                  삭제
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
