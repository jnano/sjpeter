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
  show_in_menu: boolean;
  post_count: number;
  kind: string;  // 'default' | 'line'
  list_show_number: boolean;
  list_show_author: boolean;
  list_show_date: boolean;
  list_show_views: boolean;
  list_show_likes: boolean;
  list_show_comments: boolean;
  moderator: Moderator | null;
  admin_group_id: number | null;
  allowed_members: AllowedMember[];
}

interface BoardAdminGroup {
  id: number;
  name: string;
  sort_order: number;
}

const LIST_COLUMN_LABELS: { key: keyof Board; label: string }[] = [
  { key: "list_show_number",   label: "번호" },
  { key: "list_show_author",   label: "작성자" },
  { key: "list_show_date",     label: "작성일" },
  { key: "list_show_views",    label: "조회수" },
  { key: "list_show_likes",    label: "좋아요수" },
  { key: "list_show_comments", label: "댓글수" },
];

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

function kindLabel(k: string): string {
  if (k === "line") return "한 줄";
  if (k === "gallery") return "갤러리";
  return "일반";
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
  const [adminGroups, setAdminGroups] = useState<BoardAdminGroup[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  // 열린 그룹 키 집합. 비어있음 = 모두 접힘 (디폴트).
  // 헤더 클릭 = 아코디언 (다른 그룹 닫고 이 그룹만 열기), 같은 그룹 다시 클릭 = 닫기.
  // "모두 펼치기" 액션은 이를 무시하고 모든 visible section 을 동시에 펼침.
  const [openGroupKeys, setOpenGroupKeys] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    access_mode: "write-restricted" as AccessMode,
    posts_per_page: 12,
    exclude_from_search: false,
    moderator_id: null as number | null,
    kind: "default",
  });
  const [formModerator, setFormModerator] = useState<Moderator | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [postsExpandedId, setPostsExpandedId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => { fetchBoards(); fetchAdminGroups(); }, []);

  function toggleGroupOpen(key: string) {
    // 헤더 클릭: 열려있으면 닫기, 닫혀있으면 다른 그룹 모두 닫고 이 그룹만 열기 (아코디언).
    setOpenGroupKeys((prev) => (prev.has(key) ? new Set() : new Set([key])));
  }

  // 현재 표시되는 섹션의 키 목록을 계산. "모두 펼치기" 가 visibleSections 와 동일한 필터링을 사용해야 일관됨.
  function computeVisibleSectionKeys(): string[] {
    const sortedGroups = [...adminGroups].sort(
      (a, b) => a.sort_order - b.sort_order || a.id - b.id,
    );
    const uncategorizedCount = boards.filter((b) => !b.admin_group_id).length;
    const keys: string[] = [];
    // 미분류는 보드가 있을 때만 표시
    if (uncategorizedCount > 0) keys.push("uncategorized");
    // 그룹은 보드가 없어도 항상 표시 (이동 대상 슬롯 노출)
    for (const g of sortedGroups) keys.push(`g-${g.id}`);
    return keys;
  }

  function toggleAllGroupsOpen() {
    const allKeys = computeVisibleSectionKeys();
    setOpenGroupKeys((prev) => (prev.size > 0 ? new Set() : new Set(allKeys)));
  }

  async function fetchAdminGroups() {
    const token = getAdminToken();
    const res = await fetch(`${API}/api/board-admin-groups`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setAdminGroups(await res.json());
  }

  async function createGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    const token = getAdminToken();
    const res = await fetch(`${API}/api/board-admin-groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      setNewGroupName("");
      fetchAdminGroups();
    }
  }

  async function renameGroup(g: BoardAdminGroup) {
    const name = prompt("그룹 이름 변경", g.name);
    if (!name || name.trim() === g.name) return;
    const token = getAdminToken();
    const res = await fetch(`${API}/api/board-admin-groups/${g.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (res.ok) fetchAdminGroups();
  }

  async function deleteGroup(g: BoardAdminGroup) {
    const inside = boards.filter((b) => b.admin_group_id === g.id);
    if (!confirm(
      `'${g.name}' 그룹을 삭제합니다.\n` +
        (inside.length > 0
          ? `안의 게시판 ${inside.length}개는 '미분류' 로 이동됩니다.\n`
          : "") +
        `계속하시겠습니까?`,
    )) return;
    const token = getAdminToken();
    const res = await fetch(`${API}/api/board-admin-groups/${g.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      // 안에 있던 게시판은 ON DELETE SET NULL 로 자동 미분류 처리됨 → 보드 목록 새로고침
      fetchAdminGroups();
      fetchBoards();
    }
  }

  async function moveGroup(g: BoardAdminGroup, dir: -1 | 1) {
    const sorted = [...adminGroups].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
    const i = sorted.findIndex((x) => x.id === g.id);
    const j = i + dir;
    if (j < 0 || j >= sorted.length) return;
    [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
    const token = getAdminToken();
    const res = await fetch(`${API}/api/board-admin-groups/reorder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ids: sorted.map((x) => x.id) }),
    });
    if (res.ok) fetchAdminGroups();
  }

  async function moveBoardToGroup(board: Board, groupId: number | null) {
    const token = getAdminToken();
    const res = await fetch(`${API}/api/boards/${board.slug}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ admin_group_id: groupId }),
    });
    if (res.ok) {
      const updated: Board = await res.json();
      setBoards((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    }
  }

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
      setForm({ name: "", slug: "", description: "", access_mode: "write-restricted", posts_per_page: 12, exclude_from_search: false, moderator_id: null, kind: "default" });
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
            <label className="flex items-center gap-2 text-sm">
              형식
              <select
                value={form.kind}
                onChange={(e) => setForm((p) => ({ ...p, kind: e.target.value }))}
                className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="default">일반 (제목+본문)</option>
                <option value="line">한 줄 (메시지 + 추천)</option>
                <option value="gallery">갤러리 (사진 그리드)</option>
              </select>
            </label>
          </div>
          {form.kind === "line" && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 -mt-1">
              ⓘ 한 줄 게시판: 회원이 짧은 메시지(예: 봉헌, 기도 청원)와 종류·대상을 남기며, 다른 회원이 "함께 기도합니다" 버튼으로 공감할 수 있습니다.
            </p>
          )}

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

      {/* 그룹 관리 (admin 정리용. 공개 페이지엔 영향 없음) */}
      <section className="mb-5 bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-700">
            그룹 <span className="text-gray-400 font-normal">({adminGroups.length}개)</span>
          </h2>
          <p className="text-xs text-gray-400">admin/boards 화면 정리용 · 공개 페이지엔 영향 없음</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {[...adminGroups]
            .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
            .map((g, i, arr) => (
              <div
                key={g.id}
                className="flex items-center gap-1 px-2 py-1 bg-indigo-50 border border-indigo-200 rounded-md text-sm"
              >
                <span className="font-medium text-indigo-800">{g.name}</span>
                <span className="text-indigo-400 text-xs">
                  ({boards.filter((b) => b.admin_group_id === g.id).length})
                </span>
                <button
                  onClick={() => moveGroup(g, -1)}
                  disabled={i === 0}
                  className="ml-1 text-indigo-400 hover:text-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed text-xs"
                  title="위로"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveGroup(g, 1)}
                  disabled={i === arr.length - 1}
                  className="text-indigo-400 hover:text-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed text-xs"
                  title="아래로"
                >
                  ↓
                </button>
                <button
                  onClick={() => renameGroup(g)}
                  className="text-indigo-400 hover:text-indigo-700 text-xs ml-1"
                  title="이름 변경"
                >
                  ✎
                </button>
                <button
                  onClick={() => deleteGroup(g)}
                  className="text-indigo-400 hover:text-red-500 text-xs"
                  title="그룹 삭제"
                >
                  ✕
                </button>
              </div>
            ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                createGroup();
              }
            }}
            placeholder="새 그룹 이름 (예: 분과, 단체)"
            className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-400"
          />
          <button
            type="button"
            onClick={createGroup}
            disabled={!newGroupName.trim()}
            className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            + 그룹 추가
          </button>
        </div>
      </section>

      {/* 다중 선택 액션 바 */}
      {boards.length > 0 && (
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-3">
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
            <button
              type="button"
              onClick={toggleAllGroupsOpen}
              className="px-2.5 py-1 text-xs rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
              title={openGroupKeys.size > 0 ? "그룹 모두 접기" : "그룹 모두 펼치기"}
            >
              {openGroupKeys.size > 0 ? "▾ 모두 접기" : "▸ 모두 펼치기"}
            </button>
          </div>
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

      <div className="space-y-6">
        {boards.length === 0 && <p className="text-center py-12 text-gray-500">게시판이 없습니다.</p>}
        {(() => {
          const sortedGroups = [...adminGroups].sort(
            (a, b) => a.sort_order - b.sort_order || a.id - b.id,
          );
          const sections: { key: string; label: string; groupId: number | null; boards: Board[] }[] = [
            { key: "uncategorized", label: "미분류", groupId: null, boards: boards.filter((b) => !b.admin_group_id) },
            ...sortedGroups.map((g) => ({
              key: `g-${g.id}`,
              label: g.name,
              groupId: g.id,
              boards: boards.filter((b) => b.admin_group_id === g.id),
            })),
          ];
          // 미분류가 비어 있고 그룹이 하나라도 있으면 미분류 섹션은 숨김 (시각 노이즈 감소)
          const visibleSections = sections.filter(
            (s) => s.boards.length > 0 || (s.groupId !== null),
          );
          return visibleSections.map((section) => {
            const isOpen = openGroupKeys.has(section.key);
            return (
            <div key={section.key}>
              <button
                type="button"
                onClick={() => toggleGroupOpen(section.key)}
                aria-expanded={isOpen}
                className="w-full text-left mb-2 px-1 flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-800 transition-colors"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className={`transition-transform ${isOpen ? "" : "-rotate-90"}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                <span>{section.label}</span>
                <span className="text-gray-300 font-normal">({section.boards.length})</span>
                {section.boards.length === 0 && (
                  <span className="text-gray-300 font-normal normal-case tracking-normal">— 비어 있음. 아래 게시판에서 이 그룹으로 이동하세요.</span>
                )}
              </button>
              {isOpen && (
              <div className="space-y-2">
                {section.boards.map((board) => {
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
                  <select
                    value={board.admin_group_id ?? ""}
                    onChange={(e) =>
                      moveBoardToGroup(board, e.target.value ? parseInt(e.target.value) : null)
                    }
                    className="px-2 py-1.5 text-xs rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-800 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    title="그룹 이동"
                  >
                    <option value="">— 미분류 —</option>
                    {[...adminGroups]
                      .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                  </select>
                  <Link
                    href={board.kind === "gallery" ? `/gallery/${board.slug}` : `/boards/${board.slug}`}
                    target="_blank"
                    className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    보기 ↗
                  </Link>
                  <Link
                    href={board.kind === "gallery" ? `/gallery/${board.slug}/write` : `/boards/${board.slug}/write`}
                    target="_blank"
                    className="px-3 py-1.5 text-xs rounded-lg border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-surface-warm)] transition-colors"
                  >
                    + 글쓰기
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
                  allBoards={boards}
                  onPostCountChange={(delta, targetSlug) =>
                    setBoards((prev) =>
                      prev.map((b) => {
                        if (b.id === board.id) {
                          return { ...b, post_count: Math.max(0, b.post_count + delta) };
                        }
                        if (targetSlug && b.slug === targetSlug) {
                          return { ...b, post_count: b.post_count + 1 };
                        }
                        return b;
                      }),
                    )
                  }
                />
              )}
            </div>
          );
                })}
              </div>
              )}
            </div>
            );
          });
        })()}
      </div>
    </div>
  );
}

function BoardSettingsPanel({ board, onUpdate }: { board: Board; onUpdate: (b: Board) => void }) {
  const [name, setName] = useState(board.name);
  const [description, setDescription] = useState(board.description ?? "");
  const [kind, setKind] = useState(board.kind ?? "default");
  const [accessMode, setAccessMode] = useState<AccessMode>(getAccessMode(board));
  const [moderator, setModerator] = useState<Moderator | null>(board.moderator);
  const [excludeSearch, setExcludeSearch] = useState(board.exclude_from_search);
  const [showInMenu, setShowInMenu] = useState(board.show_in_menu ?? true);
  const [postsPerPage, setPostsPerPage] = useState(board.posts_per_page);
  const [listShow, setListShow] = useState<Set<string>>(
    () => new Set(LIST_COLUMN_LABELS.filter((c) => board[c.key]).map((c) => c.key as string)),
  );
  const [allowedMembers, setAllowedMembers] = useState<AllowedMember[]>(board.allowed_members ?? []);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    setName(board.name);
    setDescription(board.description ?? "");
    setKind(board.kind ?? "default");
    setAccessMode(getAccessMode(board));
    setModerator(board.moderator);
    setExcludeSearch(board.exclude_from_search);
    setShowInMenu(board.show_in_menu ?? true);
    setPostsPerPage(board.posts_per_page);
    setListShow(new Set(LIST_COLUMN_LABELS.filter((c) => board[c.key]).map((c) => c.key as string)));
    setAllowedMembers(board.allowed_members ?? []);
  }, [board.name, board.description, board.kind, board.members_only_read, board.members_only_write, board.members_selected, board.moderator_only_write, board.moderator, board.exclude_from_search, board.show_in_menu, board.posts_per_page, board.allowed_members, board.list_show_number, board.list_show_author, board.list_show_date, board.list_show_views, board.list_show_likes, board.list_show_comments]);

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
          kind,
          ...accessModeToFields(accessMode),
          moderator_id: moderator?.id ?? null,
          exclude_from_search: excludeSearch,
          show_in_menu: showInMenu,
          posts_per_page: postsPerPage,
          list_show_number: listShow.has("list_show_number"),
          list_show_author: listShow.has("list_show_author"),
          list_show_date: listShow.has("list_show_date"),
          list_show_views: listShow.has("list_show_views"),
          list_show_likes: listShow.has("list_show_likes"),
          list_show_comments: listShow.has("list_show_comments"),
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
      <div className="col-span-2 flex items-center gap-6 flex-wrap">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={excludeSearch}
            onChange={(e) => setExcludeSearch(e.target.checked)}
            className="rounded"
          />
          통합검색 제외
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer" title="체크 시 '알림과 게시판' 그룹에 자동으로 메뉴 항목 생성. 라벨·위치는 /admin/menus에서 자유롭게 수정 가능.">
          <input
            type="checkbox"
            checked={showInMenu}
            onChange={(e) => setShowInMenu(e.target.checked)}
            className="rounded"
          />
          헤더 메뉴에 노출
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
        <label className="flex items-center gap-2 text-sm">
          형식
          <select
            value={kind}
            onChange={(e) => {
              const next = e.target.value;
              if (next !== kind) {
                const ok = confirm(
                  `게시판 형식을 '${kindLabel(kind)}' → '${kindLabel(next)}' 로 변경합니다.\n저장 시 라우팅이 ${
                    next === "gallery" ? "/gallery" : "/boards"
                  }/${board.slug} 로 바뀝니다.\n기존 게시글은 유지되지만 표시 방식이 달라집니다.\n계속하시겠습니까?`,
                );
                if (!ok) return;
              }
              setKind(next);
            }}
            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="default">일반 (제목+본문)</option>
            <option value="line">한 줄 (메시지 + 추천)</option>
            <option value="gallery">갤러리 (사진 그리드)</option>
          </select>
        </label>
        {kind === "line" && (
          <p className="w-full text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 -mt-1">
            ⓘ 한 줄 게시판: 회원이 짧은 메시지(예: 봉헌, 기도 청원)와 종류·대상을 남기며, 다른 회원이 &quot;함께 기도합니다&quot; 버튼으로 공감할 수 있습니다.
          </p>
        )}
        {kind === "gallery" && (
          <p className="w-full text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2 -mt-1">
            ⓘ 갤러리 게시판: 사진 그리드 형태로 표시됩니다. 첫 첨부 사진이 카드 썸네일로 사용되며, URL 은 <code className="bg-white border border-emerald-200 px-1 rounded">/gallery/{board.slug}</code> 입니다.
          </p>
        )}

        {/* 목록 표시 컬럼 토글 — 제목·고정 뱃지·카테고리·첨부는 항상 표시 */}
        <div className="w-full flex flex-wrap items-center gap-x-4 gap-y-1 text-sm border-t border-gray-200 pt-3 mt-1">
          <span className="text-xs font-semibold text-gray-600">목록 표시 컬럼:</span>
          {LIST_COLUMN_LABELS.map((c) => (
            <label key={c.key as string} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={listShow.has(c.key as string)}
                onChange={(e) => {
                  setListShow((prev) => {
                    const next = new Set(prev);
                    if (e.target.checked) next.add(c.key as string);
                    else next.delete(c.key as string);
                    return next;
                  });
                }}
                className="rounded"
              />
              {c.label}
            </label>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3 w-full justify-end">
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
  is_pinned: boolean;
  member: { id: number; nickname: string } | null;
}

function BoardPostsPanel({
  board,
  allBoards,
  onPostCountChange,
}: {
  board: Board;
  allBoards: Board[];
  onPostCountChange: (delta: number, targetSlug?: string) => void;
}) {
  const [posts, setPosts] = useState<PostListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [perPage, setPerPage] = useState(board.posts_per_page || 12);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  // 글 검색
  const [searchInput, setSearchInput] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const select = useBulkSelect(posts.map((p) => p.id));

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const fetchPosts = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    const token = getAdminToken();
    try {
      const qp = new URLSearchParams({ page: String(page) });
      if (appliedQ) qp.set("q", appliedQ);
      const res = await fetch(`${API}/api/boards/${board.slug}/posts?${qp}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts ?? []);
        setTotal(data.total ?? 0);
        if (data.posts_per_page) setPerPage(data.posts_per_page);
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [board.slug, page, appliedQ]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setAppliedQ(searchInput.trim());
  }

  function clearSearch() {
    setSearchInput("");
    setAppliedQ("");
    setPage(1);
  }

  async function togglePin(id: number, current: boolean) {
    const token = getAdminToken();
    const res = await fetch(`${API}/api/boards/${board.slug}/posts/${id}/pin`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ is_pinned: !current }),
    });
    if (res.ok) {
      // 핀 토글로 정렬 순서가 바뀌므로 목록만 silent 갱신 — loading 표시 없이 in-place 교체.
      // 페이지 전체 새로고침 안 함 → 열린 그룹·글 관리 패널 상태 유지 + 깜빡임 없음.
      fetchPosts({ silent: true });
    } else {
      alert("고정 변경에 실패했습니다.");
    }
  }

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

  async function copyPost(id: number, title: string) {
    // 자기 자신 제외한 활성 게시판 목록
    const candidates = allBoards.filter((b) => b.slug !== board.slug && b.is_active);
    if (candidates.length === 0) {
      alert("복사 가능한 다른 게시판이 없습니다.");
      return;
    }
    const lines = candidates.map((b, i) => `${i + 1}. ${b.name} (${b.slug})`).join("\n");
    const answer = window.prompt(
      `「${title}」을(를) 어느 게시판들로 복사할까요?\n번호 또는 slug 를 콤마로 구분해 입력하세요.\n예: 1,3,5 또는 notice,community\n\n${lines}`,
    );
    if (!answer) return;
    const tokens = answer.split(",").map((s) => s.trim()).filter(Boolean);
    const targets: { slug: string; name: string }[] = [];
    for (const tok of tokens) {
      const num = parseInt(tok);
      let target: Board | undefined;
      if (Number.isFinite(num) && num >= 1 && num <= candidates.length) {
        target = candidates[num - 1];
      } else {
        target = candidates.find((b) => b.slug === tok);
      }
      if (target && !targets.some((t) => t.slug === target!.slug)) {
        targets.push({ slug: target.slug, name: target.name });
      }
    }
    if (targets.length === 0) {
      alert("선택된 게시판이 없습니다.");
      return;
    }
    if (!confirm(`「${title}」을(를) ${targets.length}개 게시판으로 복사하시겠습니까?\n\n${targets.map((t) => "· " + t.name).join("\n")}`)) return;
    const token = getAdminToken();
    const res = await fetch(`${API}/api/boards/${board.slug}/posts/${id}/copy`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ target_slugs: targets.map((t) => t.slug) }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ detail: "" }));
      alert(data.detail || "복사에 실패했습니다.");
      return;
    }
    const result: { created: { slug: string; post_id: number }[]; failed: { slug: string; reason: string }[] } = await res.json();
    // 대상 게시판들의 카운트 갱신
    for (const c of result.created) onPostCountChange(1, c.slug);
    const lines2 = [`복사 ${result.created.length}건`];
    if (result.failed.length) lines2.push(`실패 ${result.failed.length}건: ${result.failed.map((f) => f.slug).join(", ")}`);
    alert(lines2.join("\n"));
  }

  async function movePost(id: number, title: string) {
    // 자기 자신을 제외한 활성 게시판 목록
    const candidates = allBoards.filter((b) => b.slug !== board.slug && b.is_active);
    if (candidates.length === 0) {
      alert("이동 가능한 다른 게시판이 없습니다.");
      return;
    }
    const lines = candidates.map((b, i) => `${i + 1}. ${b.name} (${b.slug})`).join("\n");
    const answer = window.prompt(
      `「${title}」을(를) 어디로 이동할까요?\n번호 또는 slug 를 입력하세요.\n\n${lines}`,
    );
    if (!answer) return;
    let target: Board | undefined;
    const num = parseInt(answer);
    if (Number.isFinite(num) && num >= 1 && num <= candidates.length) {
      target = candidates[num - 1];
    } else {
      target = candidates.find((b) => b.slug === answer.trim());
    }
    if (!target) {
      alert("게시판을 찾을 수 없습니다.");
      return;
    }
    if (!confirm(`「${title}」을(를) 「${target.name}」(으)로 이동하시겠습니까?`)) return;
    const token = getAdminToken();
    const res = await fetch(`${API}/api/boards/${board.slug}/posts/${id}/move`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ target_slug: target.slug }),
    });
    if (res.ok) {
      setPosts((prev) => prev.filter((p) => p.id !== id));
      select.remove(id);
      setTotal((t) => Math.max(0, t - 1));
      onPostCountChange(-1, target.slug);
    } else {
      const data = await res.json().catch(() => ({ detail: "" }));
      alert(data.detail || "이동에 실패했습니다.");
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
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-gray-700">
          &lsquo;{board.name}&rsquo; 게시글{" "}
          <span className="text-xs text-gray-500 font-normal">
            ({appliedQ ? `검색 ${total}` : `전체 ${total}`}건)
          </span>
        </h3>
        <div className="flex items-center gap-2">
          <form onSubmit={applySearch} className="flex items-center gap-1.5">
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="제목·본문 검색"
              className="text-xs border border-gray-300 rounded px-2 py-1 w-40 focus:outline-none focus:border-[var(--color-primary)]"
            />
            {appliedQ && (
              <button
                type="button"
                onClick={clearSearch}
                className="text-xs text-gray-500 hover:text-gray-800"
              >
                지우기
              </button>
            )}
            <button
              type="submit"
              className="text-xs px-2.5 py-1 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white rounded"
            >
              검색
            </button>
          </form>
          {totalPages > 1 && (
            <span className="text-xs text-gray-500">페이지 {page} / {totalPages}</span>
          )}
        </div>
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
                  href={board.kind === "gallery" ? `/gallery/${board.slug}/${p.id}` : `/boards/${board.slug}/${p.id}`}
                  target="_blank"
                  className="flex-1 min-w-0 hover:text-blue-600"
                >
                  <p className="text-sm font-medium truncate flex items-center gap-1.5">
                    {p.is_pinned && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 border border-amber-300 rounded shrink-0">
                        📌 고정
                      </span>
                    )}
                    <span className="truncate">{p.title}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {p.member?.nickname ?? "익명"} · {new Date(p.created_at).toLocaleDateString("ko-KR")}
                    {p.comment_count > 0 && ` · 댓글 ${p.comment_count}`}
                    {" · 조회 "}{p.view_count}
                  </p>
                </Link>
                <button
                  onClick={() => togglePin(p.id, p.is_pinned)}
                  className={`text-xs px-2 py-1 border rounded shrink-0 transition-colors ${
                    p.is_pinned
                      ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                      : "border-gray-300 text-gray-600 hover:bg-gray-50"
                  }`}
                  title={p.is_pinned ? "고정 해제" : "상단 고정"}
                >
                  {p.is_pinned ? "📌 고정 해제" : "📌 고정"}
                </button>
                <button
                  onClick={() => copyPost(p.id, p.title)}
                  className="text-xs px-2 py-1 border border-blue-200 text-blue-600 rounded hover:bg-blue-50 shrink-0"
                  title="다중 게시판으로 복사"
                >
                  복사
                </button>
                <button
                  onClick={() => movePost(p.id, p.title)}
                  className="text-xs px-2 py-1 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 shrink-0"
                  title="다른 게시판으로 이동"
                >
                  이동
                </button>
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
