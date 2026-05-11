"use client";
import { useCallback, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useBulkSelect } from "@/components/useBulkSelect";
import BulkActionBar from "@/components/BulkActionBar";

const API = process.env.NEXT_PUBLIC_API_URL;

type AccessMode = "public" | "write-restricted" | "moderator-only" | "members-only" | "selected-members";

interface Moderator {
  id: number;
  nickname: string;
  email: string;
  avatar_url: string | null;
}

interface AllowedMember {
  id: number;
  nickname: string;
  email: string;
  avatar_url: string | null;
}

interface Board {
  id: number;
  name: string;
  slug: string;
  description: string;
  is_active: boolean;
  members_only_write: boolean;
  members_only_read: boolean;
  members_selected: boolean;
  moderator_only_write: boolean;
  posts_per_page: number;
  exclude_from_search: boolean;
  post_count: number;
  moderator: Moderator | null;
  allowed_members: AllowedMember[];
}

function getAccessMode(b: Board): AccessMode {
  if (b.members_selected) return "selected-members";
  if (b.members_only_read) return "members-only";
  if (b.moderator_only_write) return "moderator-only";
  if (b.members_only_write) return "write-restricted";
  return "public";
}

function accessModeToFields(mode: AccessMode) {
  if (mode === "members-only")   return { members_only_read: true,  members_only_write: true,  members_selected: false, moderator_only_write: false };
  if (mode === "write-restricted") return { members_only_read: false, members_only_write: true,  members_selected: false, moderator_only_write: false };
  if (mode === "moderator-only") return { members_only_read: false, members_only_write: false, members_selected: false, moderator_only_write: true  };
  if (mode === "selected-members") return { members_only_read: false, members_only_write: false, members_selected: true,  moderator_only_write: false };
  return { members_only_read: false, members_only_write: false, members_selected: false, moderator_only_write: false };
}

const ACCESS_LABELS: Record<AccessMode, { label: string; badge: string; color: string }> = {
  "public":           { label: "공개",          badge: "누구나 보기·쓰기",              color: "bg-green-50 text-green-600" },
  "write-restricted": { label: "쓰기 제한",      badge: "누구나 보기, 회원만 쓰기",       color: "bg-blue-50 text-blue-600" },
  "moderator-only":   { label: "관리자만 쓰기",   badge: "누구나 보기, 게시판 관리자만 쓰기", color: "bg-orange-50 text-orange-600" },
  "members-only":     { label: "회원 전용",      badge: "회원만 보기·쓰기",               color: "bg-purple-50 text-purple-600" },
  "selected-members": { label: "지정 회원",      badge: "선택된 회원만 보기·쓰기",         color: "bg-amber-50 text-amber-600" },
};

function getAdminToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("admin_token");
}

// 관리자 검색 드롭다운 컴포넌트
function ModeratorPicker({
  current,
  onChange,
}: {
  current: Moderator | null;
  onChange: (m: Moderator | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Moderator[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function search(q: string) {
    setQuery(q);
    const token = getAdminToken();
    const res = await fetch(`${API}/api/members/admin/search?q=${encodeURIComponent(q)}&limit=8`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setResults(await res.json());
  }

  return (
    <div ref={ref} className="relative">
      {current ? (
        <div className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white">
          {current.avatar_url && (
            <img
              src={current.avatar_url.startsWith("http") ? current.avatar_url : `${API}${current.avatar_url}`}
              alt=""
              className="w-5 h-5 rounded-full object-cover"
            />
          )}
          <span className="font-medium">{current.nickname}</span>
          <span className="text-gray-400 text-xs">{current.email}</span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="ml-1 text-gray-400 hover:text-red-400 text-xs"
          >
            ✕
          </button>
        </div>
      ) : (
        <div>
          <input
            value={query}
            onChange={(e) => { search(e.target.value); setOpen(true); }}
            onFocus={() => { search(query); setOpen(true); }}
            placeholder="닉네임·이메일 검색..."
            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {open && results.length > 0 && (
            <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {results.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => { onChange(m); setQuery(""); setOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left text-sm"
                  >
                    {m.avatar_url ? (
                      <img
                        src={m.avatar_url.startsWith("http") ? m.avatar_url : `${API}${m.avatar_url}`}
                        alt=""
                        className="w-6 h-6 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <span className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold shrink-0">
                        {m.nickname[0]}
                      </span>
                    )}
                    <span className="font-medium">{m.nickname}</span>
                    <span className="text-gray-400 text-xs truncate">{m.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminBoardsPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    access_mode: "write-restricted" as AccessMode,
    posts_per_page: 12,
    exclude_from_search: false,
    moderator_id: null as number | null,
  });
  const [formModerator, setFormModerator] = useState<Moderator | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [postsExpandedId, setPostsExpandedId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => { fetchBoards(); }, []);

  useEffect(() => {
    if (searchParams.get("create") === "true") {
      setShowForm(true);
      setTimeout(() => {
        document.getElementById("board-create-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [searchParams]);

  useEffect(() => {
    const expandSlug = searchParams.get("expand");
    if (!expandSlug || boards.length === 0) return;
    const target = boards.find((b) => b.slug === expandSlug);
    if (target) {
      setExpandedId(target.id);
      setTimeout(() => {
        document.getElementById(`board-${target.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
  }, [boards, searchParams]);

  async function fetchBoards() {
    const token = getAdminToken();
    const res = await fetch(`${API}/api/boards?include_inactive=true`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setBoards(await res.json());
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const token = getAdminToken();
    const { access_mode, moderator_id: _, ...rest } = form;
    const body = {
      ...rest,
      ...accessModeToFields(access_mode),
      moderator_id: formModerator?.id ?? null,
    };
    try {
      const res = await fetch(`${API}/api/boards`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || "게시판 생성에 실패했습니다."); return; }
      setBoards((prev) => [...prev, data]);
      setForm({ name: "", slug: "", description: "", access_mode: "write-restricted", posts_per_page: 12, exclude_from_search: false, moderator_id: null });
      setFormModerator(null);
      setShowForm(false);
    } finally {
      setLoading(false);
    }
  }

  async function patchBoard(board: Board, patch: Record<string, unknown>) {
    const token = getAdminToken();
    const res = await fetch(`${API}/api/boards/${board.slug}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const updated = await res.json();
      setBoards((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    }
  }

  async function deleteBoard(board: Board) {
    if (!confirm(`"${board.name}" 게시판을 삭제하시겠습니까? 모든 게시글도 삭제됩니다.`)) return;
    const token = getAdminToken();
    const res = await fetch(`${API}/api/boards/${board.slug}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setBoards((prev) => prev.filter((b) => b.id !== board.id));
      setSelected((s) => { const n = new Set(s); n.delete(board.id); return n; });
    }
  }

  function toggleSelect(id: number) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function toggleSelectAll() {
    setSelected((s) => (s.size === boards.length ? new Set() : new Set(boards.map((b) => b.id))));
  }

  async function handleBulkDelete() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const targets = boards.filter((b) => ids.includes(b.id));
    const names = targets.map((b) => `"${b.name}"`).join(", ");
    if (!confirm(`선택한 게시판 ${ids.length}개(${names})를 삭제하시겠습니까?\n각 게시판의 모든 게시글도 함께 삭제됩니다.`)) return;

    setBulkDeleting(true);
    const token = getAdminToken();
    try {
      const results = await Promise.all(
        targets.map(async (board) => {
          try {
            const res = await fetch(`${API}/api/boards/${board.slug}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
            return { board, ok: res.ok };
          } catch {
            return { board, ok: false };
          }
        }),
      );
      const succeeded = new Set(results.filter((r) => r.ok).map((r) => r.board.id));
      const failed = results.filter((r) => !r.ok).map((r) => r.board.name);
      if (succeeded.size > 0) {
        setBoards((prev) => prev.filter((b) => !succeeded.has(b.id)));
        setSelected((s) => { const n = new Set(s); succeeded.forEach((id) => n.delete(id)); return n; });
      }
      if (failed.length > 0) {
        alert(`${failed.length}개 삭제 실패: ${failed.join(", ")}`);
      }
    } finally {
      setBulkDeleting(false);
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">게시판 관리</h1>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + 게시판 추가
        </button>
      </div>

      {showForm && (
        <form id="board-create-form" onSubmit={handleCreate} className="mb-8 p-6 bg-gray-50 border border-gray-200 rounded-xl space-y-4">
          <h2 className="font-semibold">새 게시판</h2>
          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">게시판 이름</label>
              <input
                autoFocus
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="자유게시판"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">슬러그 (URL)</label>
              <input
                value={form.slug}
                onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
                required
                pattern="[a-z0-9-]+"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="free"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">설명</label>
            <input
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="게시판 설명 (선택)"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">접근 설정</label>
              <div className="space-y-1.5">
                {(["public", "write-restricted", "members-only"] as AccessMode[]).map((mode) => (
                  <label key={mode} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="access_mode"
                      checked={form.access_mode === mode}
                      onChange={() => setForm((p) => ({ ...p, access_mode: mode }))}
                    />
                    <span className="font-medium">{ACCESS_LABELS[mode].label}</span>
                    <span className="text-gray-400 text-xs">{ACCESS_LABELS[mode].badge}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">게시판 관리자</label>
              <ModeratorPicker current={formModerator} onChange={setFormModerator} />
              <p className="text-xs text-gray-400 mt-1">지정 시 해당 회원이 모든 게시글 수정·삭제 가능</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.exclude_from_search}
                onChange={(e) => setForm((p) => ({ ...p, exclude_from_search: e.target.checked }))}
                className="rounded"
              />
              통합검색 제외
            </label>
            <label className="flex items-center gap-2 text-sm">
              페이지당 게시글
              <input
                type="number" min={1} max={100}
                value={form.posts_per_page}
                onChange={(e) => setForm((p) => ({ ...p, posts_per_page: parseInt(e.target.value) || 12 }))}
                className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              개
            </label>
          </div>

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100 transition-colors">
              취소
            </button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
              {loading ? "생성 중..." : "생성"}
            </button>
          </div>
        </form>
      )}

      {/* 다중 선택 액션 바 */}
      {boards.length > 0 && (
        <div className="flex items-center justify-between mb-3 px-1">
          <label className="inline-flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={selected.size > 0 && selected.size === boards.length}
              ref={(el) => {
                if (el) el.indeterminate = selected.size > 0 && selected.size < boards.length;
              }}
              onChange={toggleSelectAll}
              className="rounded"
            />
            전체 선택 ({selected.size}/{boards.length})
          </label>
          {selected.size > 0 && (
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="px-3 py-1.5 text-xs rounded-lg border border-red-300 bg-red-50 text-red-700 font-medium hover:bg-red-100 disabled:opacity-50 transition-colors"
            >
              {bulkDeleting ? `삭제 중…` : `선택 ${selected.size}개 삭제`}
            </button>
          )}
        </div>
      )}

      <div className="space-y-2">
        {boards.length === 0 && <p className="text-center py-12 text-gray-500">게시판이 없습니다.</p>}
        {boards.map((board) => {
          const mode = getAccessMode(board);
          const modeInfo = ACCESS_LABELS[mode];
          const isExpanded = expandedId === board.id;
          const isPostsExpanded = postsExpandedId === board.id;

          return (
            <div key={board.id} id={`board-${board.id}`} className={`bg-white border rounded-xl overflow-hidden ${selected.has(board.id) ? "border-red-300 bg-red-50/30" : "border-gray-200"}`}>
              {/* 기본 행 */}
              <div className="flex items-center justify-between p-4 gap-3">
                <input
                  type="checkbox"
                  checked={selected.has(board.id)}
                  onChange={() => toggleSelect(board.id)}
                  className="rounded shrink-0"
                  aria-label={`${board.name} 선택`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{board.name}</span>
                    <span className="text-xs text-gray-400">/{board.slug}</span>
                    {!board.is_active && (
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">비활성</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${modeInfo.color}`}>
                      {modeInfo.label}
                    </span>
                    {board.exclude_from_search && (
                      <span className="text-xs px-2 py-0.5 bg-orange-50 text-orange-500 rounded-full">검색 제외</span>
                    )}
                    {board.moderator && (
                      <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full">
                        관리자: {board.moderator.nickname}
                      </span>
                    )}
                    <span className="text-xs px-2 py-0.5 bg-gray-50 text-gray-500 border border-gray-200 rounded-full">
                      {board.post_count.toLocaleString()}건
                    </span>
                  </div>
                  {board.description && (
                    <p className="text-sm text-gray-500 mt-0.5 truncate">{board.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <Link
                    href={`/boards/${board.slug}`}
                    target="_blank"
                    className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    보기 ↗
                  </Link>
                  <button
                    onClick={() => {
                      setPostsExpandedId(isPostsExpanded ? null : board.id);
                      if (!isPostsExpanded) setExpandedId(null);
                    }}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                      isPostsExpanded
                        ? "bg-amber-100 border-amber-400 text-amber-800"
                        : "border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {isPostsExpanded ? "글 관리 닫기" : `글 관리 (${board.post_count})`}
                  </button>
                  <button
                    onClick={() => {
                      setExpandedId(isExpanded ? null : board.id);
                      if (!isExpanded) setPostsExpandedId(null);
                    }}
                    className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    {isExpanded ? "접기" : "설정"}
                  </button>
                  <button
                    onClick={() => patchBoard(board, { is_active: !board.is_active })}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                      board.is_active ? "border-gray-300 hover:bg-gray-50" : "border-green-300 text-green-600 hover:bg-green-50"
                    }`}
                  >
                    {board.is_active ? "비활성화" : "활성화"}
                  </button>
                  <button
                    onClick={() => deleteBoard(board)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                  >
                    삭제
                  </button>
                </div>
              </div>

              {/* 확장 설정 패널 */}
              {isExpanded && (
                <BoardSettingsPanel board={board} onUpdate={(updated) =>
                  setBoards((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
                } />
              )}

              {/* 게시글 관리 패널 */}
              {isPostsExpanded && (
                <BoardPostsPanel
                  board={board}
                  onPostCountChange={(delta) =>
                    setBoards((prev) =>
                      prev.map((b) => (b.id === board.id ? { ...b, post_count: Math.max(0, b.post_count + delta) } : b)),
                    )
                  }
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BoardSettingsPanel({ board, onUpdate }: { board: Board; onUpdate: (b: Board) => void }) {
  const [name, setName] = useState(board.name);
  const [description, setDescription] = useState(board.description ?? "");
  const [accessMode, setAccessMode] = useState<AccessMode>(getAccessMode(board));
  const [moderator, setModerator] = useState<Moderator | null>(board.moderator);
  const [excludeSearch, setExcludeSearch] = useState(board.exclude_from_search);
  const [postsPerPage, setPostsPerPage] = useState(board.posts_per_page);
  const [allowedMembers, setAllowedMembers] = useState<AllowedMember[]>(board.allowed_members ?? []);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    setName(board.name);
    setDescription(board.description ?? "");
    setAccessMode(getAccessMode(board));
    setModerator(board.moderator);
    setExcludeSearch(board.exclude_from_search);
    setPostsPerPage(board.posts_per_page);
    setAllowedMembers(board.allowed_members ?? []);
  }, [board.name, board.description, board.members_only_read, board.members_only_write, board.members_selected, board.moderator_only_write, board.moderator, board.exclude_from_search, board.posts_per_page, board.allowed_members]);

  async function save() {
    setSaving(true);
    setSaveError("");
    const token = getAdminToken();
    try {
      const res = await fetch(`${API}/api/boards/${board.slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          ...accessModeToFields(accessMode),
          moderator_id: moderator?.id ?? null,
          exclude_from_search: excludeSearch,
          posts_per_page: postsPerPage,
        }),
      });
      if (res.ok) {
        onUpdate(await res.json());
      } else {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.detail || `저장 실패 (${res.status})`);
      }
    } catch {
      setSaveError("네트워크 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function addAllowedMember(member: Moderator) {
    if (allowedMembers.some((m) => m.id === member.id)) return;
    const token = getAdminToken();
    const res = await fetch(`${API}/api/boards/${board.slug}/allowed-members`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ member_id: member.id }),
    });
    if (res.ok) setAllowedMembers((prev) => [...prev, { id: member.id, nickname: member.nickname, email: member.email, avatar_url: member.avatar_url }]);
  }

  async function removeAllowedMember(memberId: number) {
    const token = getAdminToken();
    const res = await fetch(`${API}/api/boards/${board.slug}/allowed-members/${memberId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setAllowedMembers((prev) => prev.filter((m) => m.id !== memberId));
  }

  return (
    <div className="border-t border-gray-100 bg-gray-50 p-4 grid grid-cols-1 sm:grid-cols-2 gap-6">
      {/* 이름·설명 */}
      <div className="col-span-1 sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">게시판 이름</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-400"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">설명</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="게시판 설명 (선택)"
            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-400"
          />
        </div>
      </div>

      {/* 접근 설정 */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">접근 설정</p>
        <div className="space-y-1.5">
          {(["public", "write-restricted", "moderator-only", "members-only", "selected-members"] as AccessMode[]).map((mode) => (
            <label key={mode} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name={`access-${board.id}`}
                checked={accessMode === mode}
                onChange={() => setAccessMode(mode)}
              />
              <span className="font-medium">{ACCESS_LABELS[mode].label}</span>
              <span className="text-gray-400 text-xs">{ACCESS_LABELS[mode].badge}</span>
            </label>
          ))}
        </div>
      </div>

      {/* 게시판 관리자 */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">게시판 관리자</p>
        <ModeratorPicker current={moderator} onChange={setModerator} />
        <p className="text-xs text-gray-400 mt-1">모든 게시글 수정·삭제 권한 부여</p>
      </div>

      {/* 지정 회원 목록 */}
      {accessMode === "selected-members" && (
        <div className="col-span-2">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">접근 허용 회원</p>
          <div className="mb-2">
            <ModeratorPicker current={null} onChange={(m) => m && addAllowedMember(m)} />
          </div>
          {allowedMembers.length === 0 ? (
            <p className="text-xs text-gray-400">허용된 회원이 없습니다. 위에서 회원을 검색해 추가하세요.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {allowedMembers.map((m) => (
                <div key={m.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-full text-xs">
                  <span className="font-medium text-amber-800">{m.nickname}</span>
                  <span className="text-amber-500">{m.email}</span>
                  <button
                    onClick={() => removeAllowedMember(m.id)}
                    className="text-amber-400 hover:text-red-500 ml-0.5"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 기타 */}
      <div className="col-span-2 flex items-center gap-6">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={excludeSearch}
            onChange={(e) => setExcludeSearch(e.target.checked)}
            className="rounded"
          />
          통합검색 제외
        </label>
        <label className="flex items-center gap-2 text-sm">
          페이지당 게시글
          <input
            type="number" min={1} max={100}
            value={postsPerPage}
            onChange={(e) => setPostsPerPage(parseInt(e.target.value) || 12)}
            className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none"
          />
          개
        </label>
        <div className="ml-auto flex items-center gap-3">
          {saveError && <span className="text-xs text-red-500">{saveError}</span>}
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// BoardPostsPanel: 게시판 별 게시글 다중 선택 + 일괄 삭제
// ───────────────────────────────────────────────────────────

interface PostListItem {
  id: number;
  title: string;
  view_count: number;
  created_at: string;
  comment_count: number;
  thumbnail_url: string | null;
  member: { id: number; nickname: string } | null;
}

function BoardPostsPanel({
  board,
  onPostCountChange,
}: {
  board: Board;
  onPostCountChange: (delta: number) => void;
}) {
  const [posts, setPosts] = useState<PostListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [perPage, setPerPage] = useState(board.posts_per_page || 12);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const select = useBulkSelect(posts.map((p) => p.id));

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    const token = getAdminToken();
    try {
      const res = await fetch(`${API}/api/boards/${board.slug}/posts?page=${page}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts ?? []);
        setTotal(data.total ?? 0);
        if (data.posts_per_page) setPerPage(data.posts_per_page);
      }
    } finally {
      setLoading(false);
    }
  }, [board.slug, page]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  async function deletePost(id: number) {
    if (!confirm("이 글을 삭제하시겠습니까? 댓글·첨부도 함께 삭제됩니다.")) return;
    const token = getAdminToken();
    const res = await fetch(`${API}/api/boards/${board.slug}/posts/${id}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setPosts((prev) => prev.filter((p) => p.id !== id));
      select.remove(id);
      setTotal((t) => Math.max(0, t - 1));
      onPostCountChange(-1);
    } else {
      alert("삭제에 실패했습니다.");
    }
  }

  async function handleBulkDelete() {
    const ids = Array.from(select.selected);
    if (ids.length === 0) return;
    if (!confirm(`선택한 글 ${ids.length}개를 삭제하시겠습니까?\n댓글·첨부도 함께 삭제됩니다.`)) return;
    setBulkDeleting(true);
    const token = getAdminToken();
    try {
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            const res = await fetch(`${API}/api/boards/${board.slug}/posts/${id}`, {
              method: "DELETE", headers: { Authorization: `Bearer ${token}` },
            });
            return { id, ok: res.ok };
          } catch { return { id, ok: false }; }
        }),
      );
      const succeeded = new Set(results.filter((r) => r.ok).map((r) => r.id));
      const failedCount = results.filter((r) => !r.ok).length;
      if (succeeded.size > 0) {
        setPosts((prev) => prev.filter((p) => !succeeded.has(p.id)));
        select.removeMany(succeeded);
        setTotal((t) => Math.max(0, t - succeeded.size));
        onPostCountChange(-succeeded.size);
      }
      if (failedCount > 0) alert(`${failedCount}건 삭제 실패`);
    } finally {
      setBulkDeleting(false);
    }
  }

  return (
    <div className="border-t border-gray-200 bg-gray-50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">
          &lsquo;{board.name}&rsquo; 게시글{" "}
          <span className="text-xs text-gray-500 font-normal">({total}건)</span>
        </h3>
        {totalPages > 1 && (
          <span className="text-xs text-gray-500">
            페이지 {page} / {totalPages}
          </span>
        )}
      </div>

      <BulkActionBar
        selectedCount={select.selectedCount}
        total={select.total}
        allSelected={select.allSelected}
        someSelected={select.someSelected}
        onToggleAll={select.toggleAll}
        onDelete={handleBulkDelete}
        deleting={bulkDeleting}
      />

      {loading ? (
        <p className="text-sm text-gray-500 text-center py-8">불러오는 중…</p>
      ) : posts.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">게시글이 없습니다.</p>
      ) : (
        <ul className="space-y-1.5">
          {posts.map((p) => {
            const isChecked = select.isSelected(p.id);
            return (
              <li
                key={p.id}
                className={`flex items-center gap-3 bg-white border rounded-lg px-3 py-2 ${
                  isChecked ? "border-red-300 bg-red-50/30" : "border-gray-200"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => select.toggle(p.id)}
                  className="rounded shrink-0"
                  aria-label={`${p.title} 선택`}
                />
                {p.thumbnail_url && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={`${API}${p.thumbnail_url}`} alt="" className="w-10 h-10 object-cover rounded shrink-0" />
                )}
                <Link
                  href={`/boards/${board.slug}/${p.id}`}
                  target="_blank"
                  className="flex-1 min-w-0 hover:text-blue-600"
                >
                  <p className="text-sm font-medium truncate">{p.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {p.member?.nickname ?? "익명"} · {new Date(p.created_at).toLocaleDateString("ko-KR")}
                    {p.comment_count > 0 && ` · 댓글 ${p.comment_count}`}
                    {" · 조회 "}{p.view_count}
                  </p>
                </Link>
                <button
                  onClick={() => deletePost(p.id)}
                  className="text-xs px-2 py-1 border border-red-200 text-red-500 rounded hover:bg-red-50 shrink-0"
                >
                  삭제
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-1 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 text-xs border border-gray-300 rounded disabled:opacity-40 hover:bg-white"
          >
            이전
          </button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            const p = totalPages <= 7 ? i + 1 : Math.max(1, Math.min(page - 3, totalPages - 6)) + i;
            return (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-8 h-7 text-xs rounded ${
                  p === page ? "bg-gray-800 text-white" : "border border-gray-300 hover:bg-white"
                }`}
              >
                {p}
              </button>
            );
          })}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 text-xs border border-gray-300 rounded disabled:opacity-40 hover:bg-white"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
