"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Staff {
  id: number;
  role: string;
  name: string;
  title: string | null;
  feast_day: string | null;
  photo_url: string | null;
  introduction: string | null;
  career_items: string | null;
  scripture_quote: string | null;
  scripture_reference: string | null;
  sort_order: number;
  is_active: boolean;
}

const ROLE_OPTIONS = ["주임신부", "보좌신부", "수녀", "사무장"];

// role 값(백엔드용) → 화면 표시 라벨.
// role 자체는 정렬·매핑·필터 등에 쓰이므로 변경 금지(주임신부/보좌신부/수녀/사무장).
const ROLE_LABEL: Record<string, string> = {
  "주임신부": "주임신부님",
  "보좌신부": "보좌신부님",
  "수녀": "수녀님",
  "사무장": "사무장님",
};

// role → 기본 직함 매핑. 등록 폼에서 역할 선택 시 직함이 자동 채워진다.
const ROLE_DEFAULT_TITLE: Record<string, string> = {
  "주임신부": "주임신부님",
  "보좌신부": "보좌신부님",
  "수녀": "수녀님",
  "사무장": "사무장님",
};

// 사용자가 따로 입력하지 않은 경우(=기본 매핑 그대로일 때)에만 자동 갱신할지 판단할 때 사용
const DEFAULT_TITLES = new Set(Object.values(ROLE_DEFAULT_TITLE));

const EMPTY_FORM = {
  id: 0,
  role: "주임신부",
  name: "",
  title: "주임신부님",
  feast_day: "",
  introduction: "",
  career_items: "",
  scripture_quote: "",
  scripture_reference: "",
  sort_order: 0,
  is_active: true,
};

export default function AdminParishStaffPage() {
  const router = useRouter();
  const [list, setList] = useState<Staff[]>([]);
  const [editing, setEditing] = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [currentPhoto, setCurrentPhoto] = useState<string | null>(null);

  const authHeader = useCallback((): HeadersInit => {
    const t = localStorage.getItem("admin_token");
    return t ? { Authorization: `Bearer ${t}` } : {};
  }, []);

  const reload = useCallback(async () => {
    const r = await fetch(`${API}/api/parish-staff/all`, { headers: authHeader() });
    if (r.status === 401) {
      router.push("/admin");
      return;
    }
    if (r.ok) setList(await r.json());
  }, [authHeader, router]);

  useEffect(() => {
    if (!localStorage.getItem("admin_token")) {
      router.push("/admin");
      return;
    }
    reload();
  }, [reload, router]);

  const startNew = () => {
    setEditing(EMPTY_FORM);
    setPhotoFile(null);
    setCurrentPhoto(null);
    setError(null);
  };

  const startEdit = (s: Staff) => {
    setEditing({
      id: s.id,
      role: s.role,
      name: s.name,
      title: s.title ?? "",
      feast_day: s.feast_day ?? "",
      introduction: s.introduction ?? "",
      career_items: s.career_items ?? "",
      scripture_quote: s.scripture_quote ?? "",
      scripture_reference: s.scripture_reference ?? "",
      sort_order: s.sort_order,
      is_active: s.is_active,
    });
    setPhotoFile(null);
    setCurrentPhoto(s.photo_url);
    setError(null);
  };

  const save = async () => {
    setError(null);
    if (!editing.name.trim()) {
      setError("이름을 입력해 주세요.");
      return;
    }
    const body = {
      role: editing.role,
      name: editing.name.trim(),
      title: editing.title.trim() || null,
      feast_day: editing.feast_day.trim() || null,
      introduction: editing.introduction.trim() || null,
      career_items: editing.career_items.trim() || null,
      scripture_quote: editing.scripture_quote.trim() || null,
      scripture_reference: editing.scripture_reference.trim() || null,
      sort_order: editing.sort_order,
      is_active: editing.is_active,
    };
    let savedId = editing.id;
    try {
      if (editing.id === 0) {
        const r = await fetch(`${API}/api/parish-staff/`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader() },
          body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error((await r.json()).detail || "저장 실패");
        const created = await r.json();
        savedId = created.id;
      } else {
        const r = await fetch(`${API}/api/parish-staff/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...authHeader() },
          body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error((await r.json()).detail || "수정 실패");
      }
      // 사진 업로드 (있을 때)
      if (photoFile) {
        const fd = new FormData();
        fd.append("file", photoFile);
        const r2 = await fetch(`${API}/api/parish-staff/${savedId}/photo`, {
          method: "POST",
          headers: authHeader(),
          body: fd,
        });
        if (!r2.ok) throw new Error("사진 업로드 실패");
      }
      await reload();
      setEditing(EMPTY_FORM);
      setPhotoFile(null);
      setCurrentPhoto(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    }
  };

  const remove = async (id: number) => {
    if (!confirm("이 항목을 삭제하시겠습니까?")) return;
    const r = await fetch(`${API}/api/parish-staff/${id}`, {
      method: "DELETE",
      headers: authHeader(),
    });
    if (r.ok) reload();
  };

  const removePhoto = async () => {
    if (editing.id === 0) return;
    if (!confirm("등록된 사진을 삭제하시겠습니까?")) return;
    const r = await fetch(`${API}/api/parish-staff/${editing.id}/photo`, {
      method: "DELETE",
      headers: authHeader(),
    });
    if (r.ok) {
      setCurrentPhoto(null);
      await reload();
    } else {
      setError("사진 삭제 실패");
    }
  };

  // 역대 사목자로 이전 모달 상태
  const today = new Date().toISOString().slice(0, 10);
  const [archiveModal, setArchiveModal] = useState<{
    appointed_at: string;
    resigned_at: string;
    bio: string;
  } | null>(null);
  const [archiving, setArchiving] = useState(false);

  const onActiveToggle = (next: boolean) => {
    if (next) {
      // 다시 활성화는 단순 토글
      setEditing({ ...editing, is_active: true });
      return;
    }
    // 비활성화 시도: 사무장이 아니면 역대 사목자 이전 모달
    if (editing.role === "사무장") {
      setEditing({ ...editing, is_active: false });
      return;
    }
    if (editing.id === 0) {
      setError("등록 후 현역 해제가 가능합니다.");
      return;
    }
    setArchiveModal({
      appointed_at: "",
      resigned_at: today,
      bio: editing.career_items.trim(),
    });
  };

  const submitArchive = async () => {
    if (!archiveModal) return;
    setArchiving(true);
    setError(null);
    try {
      const r = await fetch(`${API}/api/parish-staff/${editing.id}/move-to-archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          appointed_at: archiveModal.appointed_at || null,
          resigned_at: archiveModal.resigned_at || null,
          bio: archiveModal.bio.trim() || null,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.detail || "이전에 실패했습니다.");
      }
      setArchiveModal(null);
      setEditing(EMPTY_FORM);
      setPhotoFile(null);
      setCurrentPhoto(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    } finally {
      setArchiving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <header className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">본당 가족 관리</h1>
        <p className="text-sm text-gray-500 mt-1">
          주임·보좌신부, 수녀, 사무장 등 현재 재임 중인 분들을 관리합니다. (`/pastor` 페이지에 노출)
        </p>
      </header>

      {/* 폼 */}
      <section className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">
            {editing.id === 0 ? "새 등록" : `수정 #${editing.id}`}
          </h2>
          {editing.id !== 0 && (
            <button onClick={startNew} className="text-xs text-gray-600 underline">
              새로 등록 폼으로
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="역할">
            <select
              value={editing.role}
              onChange={(e) => {
                const newRole = e.target.value;
                // 직함이 비어 있거나 기본 매핑값일 때만 새 role의 기본값으로 자동 채움
                const shouldUpdateTitle = !editing.title.trim() || DEFAULT_TITLES.has(editing.title);
                setEditing({
                  ...editing,
                  role: newRole,
                  title: shouldUpdateTitle ? (ROLE_DEFAULT_TITLE[newRole] ?? "") : editing.title,
                });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>
              ))}
            </select>
          </Field>
          <Field label="정렬 순서">
            <input
              type="number"
              value={editing.sort_order}
              onChange={(e) => setEditing({ ...editing, sort_order: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </Field>
          <Field label="이름 *">
            <input
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              placeholder="예: 김찬용 베드로 신부님"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </Field>
          <Field label="직함">
            <input
              value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              placeholder="예: 주임신부님 / 보좌신부님 / 수녀님"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">역할 선택 시 자동 채워집니다. 필요하면 수정하세요.</p>
          </Field>
          <Field label="축일 (예: 6.29)">
            <input
              value={editing.feast_day}
              onChange={(e) => setEditing({ ...editing, feast_day: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </Field>
          <Field label="사진">
            {currentPhoto && (
              <div className="flex items-center gap-3 mb-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${API}${currentPhoto}`}
                  alt="현재 사진"
                  className="w-14 h-14 rounded object-cover border border-gray-200"
                />
                <button
                  type="button"
                  onClick={removePhoto}
                  className="text-xs px-2 py-1 border border-red-300 text-red-600 rounded hover:bg-red-50"
                >
                  사진 삭제
                </button>
                <span className="text-xs text-gray-500">새 파일 선택 시 교체됩니다.</span>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm"
            />
          </Field>
          <Field label="소개 (한 문단)" wide>
            <textarea
              rows={2}
              value={editing.introduction}
              onChange={(e) => setEditing({ ...editing, introduction: e.target.value })}
              placeholder="예: 해미성당 주임으로 계시다가 2021년 12월 16일 본당 8대 주임신부님으로 부임하셨습니다."
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </Field>
          <Field label="약력 (한 줄에 하나씩)" wide>
            <textarea
              rows={6}
              value={editing.career_items}
              onChange={(e) => setEditing({ ...editing, career_items: e.target.value })}
              placeholder="1997.01.21 사제서품&#10;1997.01.30 삼성동 보좌&#10;..."
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono"
            />
          </Field>
          <Field label="말씀 인용">
            <textarea
              rows={2}
              value={editing.scripture_quote}
              onChange={(e) => setEditing({ ...editing, scripture_quote: e.target.value })}
              placeholder="예: 너도 가서 그렇게 하여라."
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </Field>
          <Field label="말씀 출처">
            <input
              value={editing.scripture_reference}
              onChange={(e) => setEditing({ ...editing, scripture_reference: e.target.value })}
              placeholder="예: (루카 10, 37)"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </Field>
          {editing.role !== "사무장" && (
            <Field label="현역 여부">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.is_active}
                  onChange={(e) => onActiveToggle(e.target.checked)}
                />
                현역
              </label>
              <p className="text-xs text-gray-400 mt-1">
                체크 해제 시 역대 사목자로 이전합니다. (이임일·부임일 입력 모달 표시)
              </p>
            </Field>
          )}
          {editing.role === "사무장" && (
            <Field label="공개 여부">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.is_active}
                  onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                />
                공개
              </label>
            </Field>
          )}
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        )}
        <div className="mt-4">
          <button
            onClick={save}
            className="px-5 py-2 bg-gray-900 text-white text-sm rounded hover:bg-black"
          >
            {editing.id === 0 ? "등록" : "수정 저장"}
          </button>
        </div>
      </section>

      {/* 역대 사목자 이전 모달 */}
      {archiveModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">역대 사목자로 이전</h3>
              <p className="text-sm text-gray-500 mt-1">
                <strong>{editing.name}</strong> ({editing.role})을(를) 역대 사목자 목록으로 이전합니다.
                이전 후 본당 가족 목록에서는 사라지고 /pastors 페이지에 표시됩니다.
              </p>
            </div>
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="block text-xs font-medium text-gray-700 mb-1">부임일</span>
                <input
                  type="date"
                  value={archiveModal.appointed_at}
                  onChange={(e) => setArchiveModal({ ...archiveModal, appointed_at: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="block text-xs font-medium text-gray-700 mb-1">이임일</span>
                <input
                  type="date"
                  value={archiveModal.resigned_at}
                  onChange={(e) => setArchiveModal({ ...archiveModal, resigned_at: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
                <span className="text-xs text-gray-400 mt-1 block">기본값은 오늘. 비워 두면 표시되지 않음.</span>
              </label>
              <label className="block text-sm">
                <span className="block text-xs font-medium text-gray-700 mb-1">약력 (이전 후 표시)</span>
                <textarea
                  rows={6}
                  value={archiveModal.bio}
                  onChange={(e) => setArchiveModal({ ...archiveModal, bio: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono"
                />
                <span className="text-xs text-gray-400 mt-1 block">현재 카드의 약력이 자동으로 채워집니다. 필요시 수정하세요.</span>
              </label>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setArchiveModal(null); setError(null); }}
                disabled={archiving}
                className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={submitArchive}
                disabled={archiving}
                className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-black disabled:opacity-50"
              >
                {archiving ? "이전 중..." : "이전하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 목록 */}
      <section>
        <h2 className="font-semibold text-gray-900 mb-3">등록된 본당 가족 ({list.length})</h2>
        {list.length === 0 ? (
          <p className="text-sm text-gray-500">아직 등록된 항목이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {list.map((s) => (
              <li
                key={s.id}
                className={`flex items-center gap-4 bg-white border rounded-lg p-3 ${
                  s.is_active ? "border-gray-200" : "border-gray-200 opacity-60"
                }`}
              >
                <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center">
                  {s.photo_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={`${API}${s.photo_url}`} alt={s.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl text-gray-400">✝</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {s.name}
                    {s.title && <span className="ml-1.5 text-gray-700">{s.title}</span>}
                    <span className="ml-2 text-xs text-gray-400 font-normal">[{s.role}]</span>
                    {!s.is_active && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-gray-700 text-white rounded">비공개</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => startEdit(s)}
                    className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => remove(s.id)}
                    className="text-xs px-2 py-1 border border-red-300 text-red-600 rounded hover:bg-red-50"
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`block text-sm ${wide ? "sm:col-span-2" : ""}`}>
      <span className="block text-xs font-medium text-gray-700 mb-1">{label}</span>
      {children}
    </label>
  );
}
