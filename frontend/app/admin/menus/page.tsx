"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DataEvent, notify } from "@/components/dataEvents";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface MenuItem {
  id: number;
  group_id: number;
  parent_id: number | null;
  label: string;
  href: string;
  is_external: boolean;
  sort_order: number;
  is_active: boolean;
  source_type: string;
  source_id: string | null;
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

function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
}

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

export default function AdminMenusPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<MenuGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const headers = (): HeadersInit => {
    const t = getToken();
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  const load = useCallback(async () => {
    const t = getToken();
    if (!t) { router.push("/admin"); return; }
    const res = await fetch(`${API}/api/menus/admin/all`, { headers: headers() });
    if (res.status === 401) { router.push("/admin"); return; }
    if (res.ok) {
      const data: MenuGroup[] = await res.json();
      setGroups(data);
      if (data.length > 0 && selectedGroupId === null) setSelectedGroupId(data[0].id);
    }
    setLoading(false);
  }, [router]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(""), 2500); }

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null;

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
    const body = { ...g, ...patch };
    const res = await fetch(`${API}/api/menus/groups/${g.id}`, {
      method: "PUT",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) { await load(); notify(DataEvent.MENUS); }
    else {
      const err = await res.json().catch(() => ({}));
      alert(err.detail || `저장 실패 (HTTP ${res.status})`);
    }
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
    if (j < 0 || j >= sorted.length) return;
    [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
    const res = await fetch(`${API}/api/menus/groups/reorder`, {
      method: "PUT",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify(sorted.map((x) => x.id)),
    });
    if (res.ok) { await load(); notify(DataEvent.MENUS); }
  }

  // ─── Item CRUD ───────────────────────────────────────

  async function addItem() {
    if (!selectedGroup) return;
    const label = prompt("항목 라벨");
    if (!label) return;
    const href = prompt("URL (내부: /about, 외부: https://...)");
    if (!href) return;
    const is_external = href.startsWith("http://") || href.startsWith("https://");
    const res = await fetch(`${API}/api/menus/groups/${selectedGroup.id}/items`, {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ label, href, is_external, sort_order: selectedGroup.items.length, is_active: true, source_type: "manual" }),
    });
    if (res.ok) { await load(); notify(DataEvent.MENUS); flash("항목이 추가되었습니다."); }
  }

  async function updateItem(item: MenuItem, patch: Partial<MenuItem>) {
    const body = { ...item, ...patch };
    const res = await fetch(`${API}/api/menus/items/${item.id}`, {
      method: "PUT",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) { await load(); notify(DataEvent.MENUS); }
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
    if (res.ok) { await load(); notify(DataEvent.MENUS); }
  }

  async function moveItem(item: MenuItem, dir: -1 | 1) {
    if (!selectedGroup) return;
    const sorted = [...selectedGroup.items].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
    const i = sorted.findIndex((x) => x.id === item.id);
    const j = i + dir;
    if (j < 0 || j >= sorted.length) return;
    [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
    const res = await fetch(`${API}/api/menus/groups/${selectedGroup.id}/items/reorder`, {
      method: "PUT",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify(sorted.map((x) => x.id)),
    });
    if (res.ok) { await load(); notify(DataEvent.MENUS); }
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
    const res = await fetch(`${API}/api/menus/groups/${selectedGroup.id}/sidebar-image`, {
      method: "DELETE", headers: headers(),
    });
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
              <li key={g.id}>
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
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== selectedGroup.key) updateGroup(selectedGroup, { key: v });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                    className={inputCls}
                    placeholder="예: outreach"
                  />
                  <p className="text-xs text-gray-400 mt-1">입력 후 Enter 또는 포커스 이동 시 저장됩니다.</p>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">표시 라벨</label>
                  <input value={selectedGroup.label} onChange={(e) => updateGroup(selectedGroup, { label: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">부제 (dropdown 보조 텍스트)</label>
                  <input value={selectedGroup.subtitle ?? ""} onChange={(e) => updateGroup(selectedGroup, { subtitle: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">아이콘 (이모지)</label>
                  <input value={selectedGroup.icon ?? ""} onChange={(e) => updateGroup(selectedGroup, { icon: e.target.value })} className={inputCls} placeholder="예: ⛪" />
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
                <button onClick={addItem} className="text-xs px-3 py-1.5 bg-[var(--color-primary)] text-white rounded">+ 항목 추가</button>
              </div>
              {selectedGroup.items.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-12">항목이 없습니다. 우상단 + 항목 추가 클릭.</p>
              ) : (
                <ItemTree
                  items={selectedGroup.items}
                  allGroups={groups}
                  inputCls={inputCls}
                  onUpdate={updateItem}
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
    </div>
  );
}

// ─── 트리 편집 컴포넌트 ──────────────────────────────────

function ItemTree({
  items,
  allGroups,
  inputCls,
  onUpdate,
  onDelete,
  onMove,
  onMoveToGroup,
  depth,
}: {
  items: MenuItem[];
  allGroups: MenuGroup[];
  inputCls: string;
  onUpdate: (item: MenuItem, patch: Partial<MenuItem>) => Promise<void>;
  onDelete: (item: MenuItem) => Promise<void>;
  onMove: (item: MenuItem, dir: -1 | 1) => Promise<void>;
  onMoveToGroup: (item: MenuItem, groupId: number) => Promise<void>;
  depth: number;
}) {
  return (
    <ul className={depth === 0 ? "divide-y divide-gray-100" : "border-l-2 border-amber-200 ml-3"}>
      {[...items].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id).map((item) => {
        const isAuto = item.source_type === "auto:groups";
        return (
          <li key={item.id}>
            <div className={`px-5 py-3 ${!item.is_active ? "bg-gray-50/60 opacity-60" : ""}`} style={{ paddingLeft: `${20 + depth * 16}px` }}>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_auto] gap-2 items-center">
                <div className="flex items-center gap-1.5">
                  {depth > 0 && <span className="text-xs text-amber-500">└</span>}
                  <input value={item.label} onChange={(e) => onUpdate(item, { label: e.target.value })} className={inputCls} placeholder="라벨" />
                </div>
                <input value={item.href} onChange={(e) => onUpdate(item, { href: e.target.value })} className={inputCls + " font-mono text-xs"} placeholder="/about 또는 https://..." />
                <div className="flex items-center gap-1">
                  <button onClick={() => onMove(item, -1)} className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50" title="위로">↑</button>
                  <button onClick={() => onMove(item, 1)} className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50" title="아래로">↓</button>
                  <button onClick={() => onDelete(item)} className="text-xs px-2 py-1 border border-red-200 text-red-500 rounded hover:bg-red-50">삭제</button>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs flex-wrap">
                {isAuto && <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">auto:groups</span>}
                <label className="inline-flex items-center gap-1.5">
                  <input type="checkbox" checked={item.is_external} onChange={(e) => onUpdate(item, { is_external: e.target.checked })} />
                  외부 링크 (새 탭)
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input type="checkbox" checked={item.is_active} onChange={(e) => onUpdate(item, { is_active: e.target.checked })} />
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
                inputCls={inputCls}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onMove={onMove}
                onMoveToGroup={onMoveToGroup}
                depth={depth + 1}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
