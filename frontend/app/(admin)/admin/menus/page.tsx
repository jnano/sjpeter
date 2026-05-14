"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DataEvent, notify } from "@/components/dataEvents";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type LinkType = "page" | "board" | "external";

interface MenuItem {
  id: number;
  group_id: number;
  parent_id: number | null;
  label: string;
  label_override: boolean;
  sort_order: number;
  is_active: boolean;
  link_type: LinkType;
  static_page_slug: string | null;
  board_id: number | null;
  external_url: string | null;
  // 응답 전용
  href: string;
  is_external: boolean;
  children: MenuItem[];
}

interface MenuGroup {
  id: number;
  key: string;
  label: string;
  subtitle: string | null;
  icon: string | null;
  sidebar_image_url: string | null;
  sidebar_width_px: number;
  sort_order: number;
  is_active: boolean;
  show_in_header: boolean;
  items: MenuItem[];
}

interface StaticPage {
  slug: string;
  label: string;
  category: string;
}

interface BoardOption {
  id: number;
  slug: string;
  name: string;
  linked_item_id: number | null;
}

function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
}

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

export default function AdminMenusPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<MenuGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [staticPages, setStaticPages] = useState<StaticPage[]>([]);
  const [boards, setBoards] = useState<BoardOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState<{ item: MenuItem | null; groupId: number } | null>(null);

  const headers = (): HeadersInit => {
    const t = getToken();
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  const load = useCallback(async () => {
    const t = getToken();
    if (!t) { router.push("/admin"); return; }
    // 옵션 데이터(static-pages/boards-list)는 실패해도 페이지는 뜨도록 개별 처리
    const safeFetch = async (path: string) => {
      try {
        const r = await fetch(`${API}${path}`, { headers: headers(), cache: "no-store" });
        return r;
      } catch {
        return null;
      }
    };
    const [resGroups, resPages, resBoards] = await Promise.all([
      safeFetch("/api/menus/admin/all"),
      safeFetch("/api/menus/static-pages"),
      safeFetch("/api/menus/boards-list"),
    ]);
    if (!resGroups) {
      setLoading(false);
      flash("백엔드에 연결할 수 없습니다. 잠시 후 다시 시도하세요.");
      return;
    }
    if (resGroups.status === 401) { router.push("/admin"); return; }
    if (resGroups.ok) {
      const data: MenuGroup[] = await resGroups.json();
      setGroups(data);
      // 이미 선택된 그룹이 있으면 유지 — load는 useCallback 클로저라 selectedGroupId가 stale
      setSelectedGroupId((prev) => (prev !== null && data.some((g) => g.id === prev)) ? prev : data[0]?.id ?? null);
    }
    if (resPages?.ok) setStaticPages(await resPages.json());
    if (resBoards?.ok) setBoards(await resBoards.json());
    setLoading(false);
  }, [router]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(""), 2500); }

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null;

  function formatErr(err: { detail?: unknown }, status: number): string {
    const d = err.detail;
    if (Array.isArray(d)) {
      return d.map((x) => (x && typeof x === "object" ? (x as { msg?: string }).msg ?? JSON.stringify(x) : String(x))).join(", ");
    }
    if (typeof d === "string") return d;
    return `HTTP ${status}`;
  }

  // ─── Group CRUD ──────────────────────────────────────

  async function addGroup() {
    const key = prompt("새 그룹 key (영문, 예: outreach)");
    if (!key) return;
    const label = prompt("그룹 표시 이름 (예: 홍보)");
    if (!label) return;
    const res = await fetch(`${API}/api/menus/groups`, {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ key, label, sort_order: groups.length, is_active: true, show_in_header: true, sidebar_width_px: 220 }),
    });
    if (res.ok) { const g = await res.json(); setSelectedGroupId(g.id); await load(); notify(DataEvent.MENUS); flash("그룹이 추가되었습니다."); }
    else alert((await res.json()).detail || "추가 실패");
  }

  async function updateGroup(g: MenuGroup, patch: Partial<MenuGroup>) {
    const merged = { ...g, ...patch };
    const body = {
      key: merged.key, label: merged.label, subtitle: merged.subtitle,
      icon: merged.icon, sidebar_image_url: merged.sidebar_image_url,
      sidebar_width_px: merged.sidebar_width_px, sort_order: merged.sort_order,
      is_active: merged.is_active, show_in_header: merged.show_in_header,
    };
    const res = await fetch(`${API}/api/menus/groups/${g.id}`, {
      method: "PUT",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) { await load(); notify(DataEvent.MENUS); }
    else { const err = await res.json().catch(() => ({})); alert(`저장 실패: ${formatErr(err, res.status)}`); }
  }

  async function deleteGroup(g: MenuGroup) {
    if (!confirm(`'${g.label}' 그룹과 그 안의 항목 ${g.items.length}개를 모두 삭제하시겠습니까?`)) return;
    const res = await fetch(`${API}/api/menus/groups/${g.id}`, { method: "DELETE", headers: headers() });
    if (res.ok) {
      if (selectedGroupId === g.id) setSelectedGroupId(groups[0]?.id ?? null);
      await load(); notify(DataEvent.MENUS);
    }
  }

  async function moveGroup(g: MenuGroup, dir: -1 | 1) {
    const sorted = [...groups].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
    const i = sorted.findIndex((x) => x.id === g.id);
    const j = i + dir;
    if (j < 0 || j >= sorted.length) { flash(dir < 0 ? "이미 맨 위입니다" : "이미 맨 아래입니다"); return; }
    [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
    const res = await fetch(`${API}/api/menus/groups/reorder`, {
      method: "PUT",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ ids: sorted.map((x) => x.id) }),
    });
    if (res.ok) {
      await load();
      setSelectedGroupId(g.id);
      requestAnimationFrame(() => {
        document.querySelector(`[data-group-id="${g.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
      notify(DataEvent.MENUS);
    } else {
      const err = await res.json().catch(() => ({}));
      alert(`이동 실패: ${formatErr(err, res.status)}`);
    }
  }

  // ─── Item CRUD ───────────────────────────────────────

  async function saveItem(body: Partial<MenuItem>, item: MenuItem | null, groupId: number): Promise<boolean> {
    const payload = {
      label: body.label ?? "",
      label_override: body.label_override ?? true,
      sort_order: item?.sort_order ?? 0,
      is_active: body.is_active ?? true,
      parent_id: body.parent_id ?? item?.parent_id ?? null,
      link_type: body.link_type ?? "external",
      static_page_slug: body.static_page_slug ?? null,
      board_id: body.board_id ?? null,
      external_url: body.external_url ?? null,
    };
    const url = item ? `${API}/api/menus/items/${item.id}` : `${API}/api/menus/groups/${groupId}/items`;
    const res = await fetch(url, {
      method: item ? "PUT" : "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) { await load(); notify(DataEvent.MENUS); return true; }
    const err = await res.json().catch(() => ({}));
    alert(`저장 실패: ${formatErr(err, res.status)}`);
    return false;
  }

  async function quickToggleActive(item: MenuItem) {
    await saveItem({ ...item, is_active: !item.is_active }, item, item.group_id);
  }

  async function moveItemToGroup(item: MenuItem, targetGroupId: number) {
    const res = await fetch(`${API}/api/menus/items/${item.id}/move?group_id=${targetGroupId}`, {
      method: "PUT", headers: headers(),
    });
    if (res.ok) { await load(); notify(DataEvent.MENUS); flash("그룹으로 이동되었습니다."); }
  }

  async function deleteItem(item: MenuItem) {
    if (!confirm(`'${item.label}' 항목을 삭제하시겠습니까?`)) return;
    const res = await fetch(`${API}/api/menus/items/${item.id}`, { method: "DELETE", headers: headers() });
    if (res.ok) {
      setSelectedGroupId(item.group_id);
      await load(); notify(DataEvent.MENUS);
    } else {
      const err = await res.json().catch(() => ({}));
      alert(`삭제 실패: ${formatErr(err, res.status)}`);
    }
  }

  async function moveItem(item: MenuItem, dir: -1 | 1) {
    if (!selectedGroup) return;
    function flatten(items: MenuItem[]): MenuItem[] {
      const r: MenuItem[] = [];
      for (const x of items) { r.push(x); if (x.children?.length) r.push(...flatten(x.children)); }
      return r;
    }
    const siblings = flatten([...selectedGroup.items])
      .filter((x) => (x.parent_id ?? null) === (item.parent_id ?? null))
      .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
    const i = siblings.findIndex((x) => x.id === item.id);
    const j = i + dir;
    if (j < 0 || j >= siblings.length) { flash(dir < 0 ? "이미 맨 위입니다" : "이미 맨 아래입니다"); return; }
    [siblings[i], siblings[j]] = [siblings[j], siblings[i]];
    const res = await fetch(`${API}/api/menus/groups/${selectedGroup.id}/items/reorder`, {
      method: "PUT",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ ids: siblings.map((x) => x.id) }),
    });
    if (res.ok) { await load(); notify(DataEvent.MENUS); }
    else { const err = await res.json().catch(() => ({})); alert(`이동 실패: ${formatErr(err, res.status)}`); }
  }

  // ─── 사이드바 이미지 업로드 ─────────────────────────

  const fileRef = useRef<HTMLInputElement>(null);
  async function uploadSidebarImage(e: React.ChangeEvent<HTMLInputElement>) {
    if (!selectedGroup) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API}/api/menus/groups/${selectedGroup.id}/sidebar-image`, {
      method: "POST", headers: headers(), body: fd,
    });
    if (res.ok) { await load(); notify(DataEvent.MENUS); flash("이미지가 업로드되었습니다."); }
    else alert("업로드 실패");
    e.target.value = "";
  }

  async function deleteSidebarImage() {
    if (!selectedGroup || !selectedGroup.sidebar_image_url) return;
    if (!confirm("사이드바 이미지를 삭제하시겠습니까?")) return;
    const res = await fetch(`${API}/api/menus/groups/${selectedGroup.id}/sidebar-image`, { method: "DELETE", headers: headers() });
    if (res.ok) { await load(); notify(DataEvent.MENUS); }
  }

  if (loading) return <div className="p-8 text-sm text-gray-500">불러오는 중…</div>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-primary)]">메뉴 관리</h1>
        <p className="text-sm text-gray-500 mt-1">
          헤더 dropdown과 정보성 페이지 사이드바를 한 곳에서 관리합니다.
        </p>
      </header>

      {msg && (
        <p className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{msg}</p>
      )}

      <div className="grid md:grid-cols-[280px_1fr] gap-6">
        {/* 좌: 그룹 리스트 */}
        <aside className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">그룹 ({groups.length})</h2>
            <button onClick={addGroup} className="text-xs px-2 py-1 bg-[var(--color-primary)] text-white rounded">+ 그룹</button>
          </div>
          <ul className="space-y-1">
            {groups.map((g) => (
              <li key={g.id} data-group-id={g.id}>
                <button
                  onClick={() => setSelectedGroupId(g.id)}
                  className={`w-full text-left px-3 py-2 text-sm rounded transition-colors flex items-center justify-between ${
                    selectedGroupId === g.id ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-semibold" : "hover:bg-gray-50"
                  } ${!g.is_active ? "opacity-50" : ""}`}
                >
                  <span className="flex items-center gap-1.5">
                    {g.icon && <span>{g.icon}</span>}
                    <span>{g.label}</span>
                    <span className="text-xs text-gray-400">({g.items.length})</span>
                  </span>
                  {!g.is_active && <span className="text-[10px] text-gray-500">숨김</span>}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* 우: 선택된 그룹의 상세 */}
        {selectedGroup ? (
          <main className="space-y-5">
            {/* 그룹 설정 */}
            <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-sm font-semibold">그룹 설정</h2>
                <div className="flex gap-1">
                  <button onClick={() => moveGroup(selectedGroup, -1)} className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50">↑ 위로</button>
                  <button onClick={() => moveGroup(selectedGroup, 1)} className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50">↓ 아래로</button>
                  <button onClick={() => deleteGroup(selectedGroup)} className="text-xs px-2 py-1 border border-red-300 text-red-600 rounded hover:bg-red-50">그룹 삭제</button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">key (URL 식별자, 변경 신중)</label>
                  <input
                    key={`key-${selectedGroup.id}`}
                    defaultValue={selectedGroup.key}
                    onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== selectedGroup.key) updateGroup(selectedGroup, { key: v }); }}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    className={inputCls}
                    placeholder="예: outreach"
                  />
                  <p className="text-xs text-gray-400 mt-1">입력 후 Enter 또는 포커스 이동 시 저장됩니다.</p>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">표시 라벨</label>
                  <input
                    key={`label-${selectedGroup.id}`}
                    defaultValue={selectedGroup.label}
                    onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== selectedGroup.label) updateGroup(selectedGroup, { label: v }); }}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">부제 (dropdown 보조 텍스트)</label>
                  <input
                    key={`subtitle-${selectedGroup.id}`}
                    defaultValue={selectedGroup.subtitle ?? ""}
                    onBlur={(e) => { const v = e.target.value; if (v !== (selectedGroup.subtitle ?? "")) updateGroup(selectedGroup, { subtitle: v }); }}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">아이콘 (이모지)</label>
                  <input
                    key={`icon-${selectedGroup.id}`}
                    defaultValue={selectedGroup.icon ?? ""}
                    onBlur={(e) => { const v = e.target.value; if (v !== (selectedGroup.icon ?? "")) updateGroup(selectedGroup, { icon: v }); }}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    className={inputCls}
                    placeholder="예: ⛪"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">사이드바 폭 (px)</label>
                  <input
                    type="number"
                    value={selectedGroup.sidebar_width_px}
                    onChange={(e) => updateGroup(selectedGroup, { sidebar_width_px: parseInt(e.target.value) || 220 })}
                    className={inputCls}
                    min={160}
                    max={400}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">활성</label>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={selectedGroup.is_active} onChange={(e) => updateGroup(selectedGroup, { is_active: e.target.checked })} />
                    <span>{selectedGroup.is_active ? "노출 중" : "숨김"}</span>
                  </label>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-gray-600 mb-1">헤더 dropdown에 표시</label>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={selectedGroup.show_in_header} onChange={(e) => updateGroup(selectedGroup, { show_in_header: e.target.checked })} />
                    <span>{selectedGroup.show_in_header ? "헤더에 표시" : "사이드바 전용 (헤더 숨김)"}</span>
                  </label>
                  <p className="text-xs text-gray-400 mt-1">
                    체크 해제 시 헤더 dropdown에는 안 나오지만, 해당 경로 페이지에서 좌측 사이드바로 표시됩니다.
                  </p>
                </div>
              </div>

              {/* 사이드바 이미지 */}
              <div className="border-t border-gray-100 pt-3 mt-3">
                <label className="block text-xs text-gray-600 mb-2">사이드바 상단 이미지</label>
                {selectedGroup.sidebar_image_url ? (
                  <div className="flex items-start gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedGroup.sidebar_image_url.startsWith("/uploads/") ? `${API}${selectedGroup.sidebar_image_url}` : selectedGroup.sidebar_image_url}
                      alt=""
                      className="w-28 aspect-[5/4] object-cover rounded border border-gray-200"
                    />
                    <div className="flex flex-col gap-2">
                      <button onClick={() => fileRef.current?.click()} className="text-xs px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50">교체</button>
                      <button onClick={deleteSidebarImage} className="text-xs px-3 py-1.5 border border-red-300 text-red-600 rounded hover:bg-red-50">제거</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => fileRef.current?.click()} className="text-xs px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50">
                    + 이미지 업로드
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" onChange={uploadSidebarImage} className="hidden" />
              </div>
            </section>

            {/* 항목 리스트 */}
            <section className="bg-white border border-gray-200 rounded-xl">
              <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-sm font-semibold">항목 ({selectedGroup.items.length})</h2>
                <button
                  onClick={() => setEditing({ item: null, groupId: selectedGroup.id })}
                  className="text-xs px-3 py-1.5 bg-[var(--color-primary)] text-white rounded"
                >+ 항목 추가</button>
              </div>
              {selectedGroup.items.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-12">항목이 없습니다. 우상단 + 항목 추가 클릭.</p>
              ) : (
                <ItemTree
                  items={selectedGroup.items}
                  allGroups={groups}
                  onEdit={(item) => setEditing({ item, groupId: item.group_id })}
                  onToggleActive={quickToggleActive}
                  onDelete={deleteItem}
                  onMove={moveItem}
                  onMoveToGroup={moveItemToGroup}
                  depth={0}
                />
              )}
            </section>
          </main>
        ) : (
          <main className="text-sm text-gray-400 text-center py-20">왼쪽에서 그룹을 선택하세요.</main>
        )}
      </div>

      {editing && (
        <ItemEditor
          item={editing.item}
          groupId={editing.groupId}
          groups={groups}
          staticPages={staticPages}
          boards={boards}
          onClose={() => setEditing(null)}
          onSave={async (body) => {
            const ok = await saveItem(body, editing.item, editing.groupId);
            if (ok) setEditing(null);
          }}
        />
      )}
    </div>
  );
}

// ─── 트리 표시 (편집은 모달에서) ──────────────────────────

function ItemTree({
  items, allGroups, onEdit, onToggleActive, onDelete, onMove, onMoveToGroup, depth,
}: {
  items: MenuItem[];
  allGroups: MenuGroup[];
  onEdit: (item: MenuItem) => void;
  onToggleActive: (item: MenuItem) => void;
  onDelete: (item: MenuItem) => Promise<void>;
  onMove: (item: MenuItem, dir: -1 | 1) => Promise<void>;
  onMoveToGroup: (item: MenuItem, groupId: number) => Promise<void>;
  depth: number;
}) {
  return (
    <ul className={depth === 0 ? "divide-y divide-gray-100" : "border-l-2 border-amber-200 ml-3"}>
      {[...items].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id).map((item) => (
        <li key={item.id}>
          <div className={`px-5 py-3 ${!item.is_active ? "bg-gray-50/60 opacity-60" : ""}`} style={{ paddingLeft: `${20 + depth * 16}px` }}>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-center">
              <div className="flex items-center gap-2 min-w-0">
                {depth > 0 && <span className="text-xs text-amber-500">└</span>}
                <LinkTypeBadge t={item.link_type} />
                <span className="font-medium text-sm truncate">{item.label}</span>
                <code className="text-xs text-gray-500 font-mono truncate">{item.href}</code>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => onMove(item, -1)} className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50" title="위로">↑</button>
                <button onClick={() => onMove(item, 1)} className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50" title="아래로">↓</button>
                <button onClick={() => onEdit(item)} className="text-xs px-2 py-1 border border-blue-300 text-blue-600 rounded hover:bg-blue-50">수정</button>
                <button onClick={() => onDelete(item)} className="text-xs px-2 py-1 border border-red-200 text-red-500 rounded hover:bg-red-50">삭제</button>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs flex-wrap">
              <label className="inline-flex items-center gap-1.5">
                <input type="checkbox" checked={item.is_active} onChange={() => onToggleActive(item)} />
                활성
              </label>
              {depth === 0 && (
                <div className="ml-auto flex items-center gap-1.5">
                  <span className="text-gray-400">그룹 이동:</span>
                  <select
                    value={item.group_id}
                    onChange={(e) => onMoveToGroup(item, +e.target.value)}
                    className="text-xs border border-gray-300 rounded px-2 py-0.5"
                  >
                    {allGroups.map((g) => (
                      <option key={g.id} value={g.id}>{g.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
          {(item.children?.length ?? 0) > 0 && (
            <ItemTree
              items={item.children!}
              allGroups={allGroups}
              onEdit={onEdit}
              onToggleActive={onToggleActive}
              onDelete={onDelete}
              onMove={onMove}
              onMoveToGroup={onMoveToGroup}
              depth={depth + 1}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

function LinkTypeBadge({ t }: { t: LinkType }) {
  const cfg = {
    page:     { label: "페이지", cls: "bg-blue-50 text-blue-700 border-blue-200" },
    board:    { label: "게시판", cls: "bg-green-50 text-green-700 border-green-200" },
    external: { label: "외부",   cls: "bg-gray-100 text-gray-600 border-gray-200" },
  }[t];
  return <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold shrink-0 ${cfg.cls}`}>{cfg.label}</span>;
}

// ─── 항목 편집 모달 ───────────────────────────────────────

function ItemEditor({
  item, groupId, groups, staticPages, boards, onClose, onSave,
}: {
  item: MenuItem | null;
  groupId: number;
  groups: MenuGroup[];
  staticPages: StaticPage[];
  boards: BoardOption[];
  onClose: () => void;
  onSave: (body: Partial<MenuItem>) => Promise<void>;
}) {
  const [linkType, setLinkType] = useState<LinkType>(item?.link_type ?? "page");
  const [label, setLabel] = useState(item?.label ?? "");
  const [labelOverride, setLabelOverride] = useState(item?.label_override ?? true);
  const [isActive, setIsActive] = useState(item?.is_active ?? true);
  const [parentId, setParentId] = useState<number | null>(item?.parent_id ?? null);
  const [staticSlug, setStaticSlug] = useState(item?.static_page_slug ?? "");
  const [boardId, setBoardId] = useState<number | null>(item?.board_id ?? null);
  const [externalUrl, setExternalUrl] = useState(item?.external_url ?? "");

  // 같은 그룹의 1단계 항목들 (parent 선택지)
  const parentChoices = (groups.find((g) => g.id === groupId)?.items ?? []).filter((x) => x.id !== item?.id);

  // 페이지 검색 — STATIC_PAGES 화이트리스트 + 자유 입력
  const pagesByCat: Record<string, StaticPage[]> = {};
  for (const p of staticPages) (pagesByCat[p.category] ??= []).push(p);

  function autoLabel(): string {
    if (linkType === "page") {
      const p = staticPages.find((x) => x.slug === staticSlug);
      return p?.label ?? "";
    }
    if (linkType === "board") {
      const b = boards.find((x) => x.id === boardId);
      return b?.name ?? "";
    }
    return "";
  }

  function handleLinkTypeChange(newType: LinkType) {
    setLinkType(newType);
    // 라벨이 비어있거나 auto면 새 타입의 auto-label로 갱신
    if (!labelOverride || !label.trim()) {
      // 다음 렌더 후 autoLabel을 다시 계산
    }
  }

  async function submit() {
    const finalLabel = labelOverride ? label.trim() : (autoLabel() || label.trim());
    if (!finalLabel) { alert("라벨을 입력하거나, 자동 라벨을 위해 페이지/게시판을 먼저 선택하세요."); return; }
    const body: Partial<MenuItem> = {
      label: finalLabel,
      label_override: labelOverride,
      is_active: isActive,
      parent_id: parentId,
      link_type: linkType,
      static_page_slug: linkType === "page" ? staticSlug.trim() : null,
      board_id: linkType === "board" ? boardId : null,
      external_url: linkType === "external" ? externalUrl.trim() : null,
    };
    if (linkType === "page" && !body.static_page_slug) { alert("페이지 경로를 입력하세요 (예: /about)"); return; }
    if (linkType === "board" && !body.board_id) { alert("게시판을 선택하세요."); return; }
    if (linkType === "external" && !body.external_url) { alert("외부 URL을 입력하세요."); return; }
    await onSave(body);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <header className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold">{item ? "항목 수정" : "새 항목 추가"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </header>

        <div className="px-5 py-4 space-y-4">
          {/* 연결 종류 */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">연결 종류</label>
            <div className="grid grid-cols-3 gap-2">
              {(["page", "board", "external"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleLinkTypeChange(t)}
                  className={`px-3 py-2 text-sm rounded border transition-colors ${
                    linkType === t
                      ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {t === "page" ? "페이지" : t === "board" ? "게시판" : "외부 URL"}
                </button>
              ))}
            </div>
          </div>

          {/* 종류별 입력 */}
          {linkType === "page" && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">내부 페이지 경로</label>
              <input
                value={staticSlug}
                onChange={(e) => setStaticSlug(e.target.value)}
                placeholder="/about"
                className={inputCls + " font-mono text-xs"}
                list="static-pages-list"
              />
              <datalist id="static-pages-list">
                {staticPages.map((p) => (
                  <option key={p.slug} value={p.slug}>{p.label} — {p.category}</option>
                ))}
              </datalist>
              <p className="text-xs text-gray-400 mt-1">
                목록에서 선택하거나 직접 입력하세요. /groups/{`{slug}`} 등 동적 경로도 가능.
              </p>
              {/* 화이트리스트 카테고리별 빠른 선택 */}
              <div className="mt-3 space-y-2">
                {Object.entries(pagesByCat).map(([cat, list]) => (
                  <div key={cat}>
                    <p className="text-[10px] text-gray-500 uppercase mb-1">{cat}</p>
                    <div className="flex flex-wrap gap-1">
                      {list.map((p) => (
                        <button
                          key={p.slug}
                          type="button"
                          onClick={() => setStaticSlug(p.slug)}
                          className={`text-xs px-2 py-1 rounded border ${
                            staticSlug === p.slug
                              ? "bg-blue-50 border-blue-300 text-blue-700"
                              : "bg-white border-gray-200 hover:bg-gray-50"
                          }`}
                        >{p.label}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {linkType === "board" && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">게시판 선택</label>
              <select
                value={boardId ?? ""}
                onChange={(e) => setBoardId(e.target.value ? +e.target.value : null)}
                className={inputCls}
              >
                <option value="">— 선택 —</option>
                {boards.map((b) => {
                  const linkedToOther = b.linked_item_id && b.linked_item_id !== item?.id;
                  return (
                    <option key={b.id} value={b.id} disabled={!!linkedToOther}>
                      {b.name} ({b.slug}){linkedToOther ? " — 이미 다른 메뉴에 연결됨" : ""}
                    </option>
                  );
                })}
              </select>
              <p className="text-xs text-gray-400 mt-1">한 게시판은 한 메뉴 항목에만 연결할 수 있습니다.</p>
            </div>
          )}

          {linkType === "external" && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">외부 URL</label>
              <input
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://example.com"
                className={inputCls + " font-mono text-xs"}
              />
              <p className="text-xs text-gray-400 mt-1">새 탭으로 열립니다.</p>
            </div>
          )}

          {/* 라벨 */}
          <div className="border-t border-gray-100 pt-4">
            <label className="block text-xs font-semibold text-gray-700 mb-2">메뉴 라벨</label>
            <div className="flex items-center gap-2 mb-2">
              <label className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={labelOverride}
                  onChange={(e) => setLabelOverride(e.target.checked)}
                />
                직접 입력 (체크 해제 시 {linkType === "page" ? "페이지" : linkType === "board" ? "게시판" : "URL"} 이름 자동 사용)
              </label>
            </div>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={labelOverride ? "메뉴에 표시할 이름" : autoLabel() || "자동: 참조 항목 이름"}
              disabled={!labelOverride}
              className={inputCls}
            />
            {!labelOverride && autoLabel() && (
              <p className="text-xs text-gray-500 mt-1">자동 라벨: {autoLabel()}</p>
            )}
          </div>

          {/* 상위 항목 (서브메뉴 만들기) */}
          {parentChoices.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">상위 항목 (서브메뉴로 만들기)</label>
              <select
                value={parentId ?? ""}
                onChange={(e) => setParentId(e.target.value ? +e.target.value : null)}
                className={inputCls}
              >
                <option value="">없음 (최상위)</option>
                {parentChoices.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* 활성 */}
          <div>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              활성 (체크 해제 시 사이트에서 숨김)
            </label>
          </div>
        </div>

        <footer className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
          <button onClick={onClose} className="text-sm px-4 py-2 border border-gray-300 rounded hover:bg-gray-50">취소</button>
          <button onClick={submit} className="text-sm px-4 py-2 bg-[var(--color-primary)] text-white rounded hover:opacity-90">
            {item ? "저장" : "추가"}
          </button>
        </footer>
      </div>
    </div>
  );
}
