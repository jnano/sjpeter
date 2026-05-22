"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Theme = "warm" | "modern" | "classic";

const THEMES: { value: Theme; label: string; description: string }[] = [
  { value: "warm",    label: "Warm (기본)",  description: "현재 따뜻한 톤 — 마리아 블루 + 금색 + 라운드 카드" },
  { value: "modern",  label: "Modern",       description: "여유 있는 흰 톤 — 섹션 간격 넓힘 + 부드러운 그림자" },
  { value: "classic", label: "Classic",      description: "컴팩트 네이비 — 섹션 간격 좁힘 + 샤프한 모서리" },
];

interface HomeBlock {
  id: number;
  kind: string;
  sort_order: number;
  is_active: boolean;
  payload: Record<string, unknown>;
}

const BLOCK_META: Record<string, { label: string; desc: string }> = {
  hero:         { label: "메인 3단",   desc: "사진 + 오늘의 복음 + 미사 시간 (+ 선택 배너)" },
  quick_links:  { label: "빠른 메뉴",  desc: "성당 안내 · 분과 · 주보 등 카드 버튼" },
  meditation:   { label: "묵상",       desc: "오늘의 묵상 엔딩 크레딧" },
  construction: { label: "성전 건축",  desc: "공사 진척 위젯" },
  board_tabs:   { label: "게시판 탭",  desc: "공지·행사 탭으로 본당 활동 안내" },
  gallery:      { label: "사진 갤러리", desc: "전례·행사 사진 슬라이드" },
  banner:       { label: "배너",       desc: "지정한 placement 의 배너 그룹 노출" },
  quote:        { label: "인용",       desc: "성경 구절 또는 사목 메시지" },
  two_column:   { label: "2열 컨테이너", desc: "좌·우 슬롯에 다른 블록 두 개를 가로로 배치 (모바일은 자동 1열)" },
  three_column: { label: "3열 컨테이너", desc: "좌·중·우 슬롯에 블록 세 개를 가로로 배치 (모바일은 자동 1열)" },
  tag_cloud:    { label: "분과 태그 클라우드", desc: "분과·단체 태그를 글 수에 따라 크기로 표현. 클릭 → 해당 분과 글 모아보기" },
};

const HERO_LAYOUTS = [
  { value: "wide",       label: "Wide (사진 크게 + 우측 [복음·배너·미사])" },
  { value: "wide-plain", label: "Wide Plain (사진 크게 + 우측 [복음·미사], 배너 없음)" },
  { value: "even",       label: "Even (3등분 + 중앙 배너)" },
  { value: "even-plain", label: "Even Plain (3등분, 배너 없음)" },
];

// quick_links 의 icon_key 선택지 — page.tsx 의 ICON_BY_KEY 와 동기 유지.
const QUICK_LINK_ICONS = [
  { key: "church",       label: "⛪ 성당" },
  { key: "groups",       label: "👥 분과·단체" },
  { key: "bulletin",     label: "📖 주보" },
  { key: "cross",        label: "✝ 십자가" },
  { key: "construction", label: "🏗 건축" },
];

interface QuickLinkItem {
  href: string;
  label: string;
  icon_key: string;
}

interface BoardCatalogItem { slug: string; name: string; is_active: boolean; }
interface BoardTabConfig { source?: "board" | "events"; board_slug?: string; label?: string; }

function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
}
function authHeaders(): HeadersInit {
  const t = getToken();
  return t ? { "Content-Type": "application/json", Authorization: `Bearer ${t}` } : { "Content-Type": "application/json" };
}

export default function AdminHomePage() {
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>("warm");
  const [blocks, setBlocks] = useState<HomeBlock[]>([]);
  const [boards, setBoards] = useState<BoardCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  // drag-and-drop state
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dropTargetId, setDropTargetId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!getToken()) { router.push("/admin"); return; }
    try {
      const [siteRes, blocksRes, boardsRes] = await Promise.all([
        fetch(`${API}/api/public/site-config`, { cache: "no-store" }),
        fetch(`${API}/api/home/blocks/admin/all`, { headers: authHeaders(), cache: "no-store" }),
        fetch(`${API}/api/boards`, { cache: "no-store" }),
      ]);
      if (siteRes.ok) {
        const d = (await siteRes.json()) as Record<string, string>;
        const t = (d.HOME_THEME ?? "warm") as Theme;
        setTheme(THEMES.some((x) => x.value === t) ? t : "warm");
      }
      if (blocksRes.ok) {
        const d = (await blocksRes.json()) as HomeBlock[];
        setBlocks(Array.isArray(d) ? d : []);
      }
      if (boardsRes.ok) {
        const d = (await boardsRes.json()) as BoardCatalogItem[];
        setBoards(Array.isArray(d) ? d.filter((b) => b.is_active) : []);
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  function flash(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(""), 3000);
  }

  async function saveTheme(next: Theme) {
    if (!getToken()) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/admin/settings/HOME_THEME`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ value: next }),
      });
      if (!res.ok) { alert("저장 실패"); return; }
      setTheme(next);
      flash(`테마를 '${THEMES.find((x) => x.value === next)?.label}' 로 변경했습니다. 홈 새로고침 시 반영.`);
    } finally { setSaving(false); }
  }

  async function patchBlock(id: number, patch: Partial<HomeBlock>) {
    const res = await fetch(`${API}/api/home/blocks/${id}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(patch),
    });
    if (!res.ok) { alert("저장 실패"); await load(); return; }
    const updated = (await res.json()) as HomeBlock;
    setBlocks((prev) => prev.map((b) => (b.id === id ? updated : b)));
  }

  async function deleteBlock(id: number, kind: string) {
    if (!confirm(`'${BLOCK_META[kind]?.label ?? kind}' 블록을 삭제하시겠습니까?`)) return;
    const res = await fetch(`${API}/api/home/blocks/${id}`, { method: "DELETE", headers: authHeaders() });
    if (!res.ok) { alert("삭제 실패"); return; }
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    flash("블록이 삭제되었습니다.");
  }

  async function addBlock(kind: string) {
    const res = await fetch(`${API}/api/home/blocks`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ kind, is_active: true, payload: {} }),
    });
    if (!res.ok) { alert("추가 실패"); return; }
    const created = (await res.json()) as HomeBlock;
    setBlocks((prev) => [...prev, created]);
    flash(`'${BLOCK_META[kind]?.label ?? kind}' 블록을 추가했습니다.`);
  }

  async function persistOrder(orderedIds: number[]) {
    const res = await fetch(`${API}/api/home/blocks/reorder`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ ids: orderedIds }),
    });
    if (!res.ok) { alert("순서 변경 실패"); await load(); }
  }

  async function move(id: number, dir: -1 | 1) {
    const idx = blocks.findIndex((b) => b.id === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[idx], next[j]] = [next[j], next[idx]];
    setBlocks(next);
    await persistOrder(next.map((b) => b.id));
  }

  /** drag end (drop or cancel) — 상태 초기화 */
  function endDrag() {
    setDraggedId(null);
    setDropTargetId(null);
  }

  async function handleDrop(targetId: number) {
    if (draggedId === null || draggedId === targetId) {
      endDrag();
      return;
    }
    const fromIdx = blocks.findIndex((b) => b.id === draggedId);
    const toIdx = blocks.findIndex((b) => b.id === targetId);
    if (fromIdx < 0 || toIdx < 0) { endDrag(); return; }
    const next = [...blocks];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setBlocks(next);
    endDrag();
    await persistOrder(next.map((b) => b.id));
  }

  if (loading) return <div className="p-8 text-sm text-gray-500">불러오는 중…</div>;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-primary)]">홈 페이지 관리</h1>
        <p className="text-sm text-gray-500 mt-1">
          테마와 섹션 블록을 자유롭게 구성합니다. 변경은 홈(`/`) 새로고침 시 즉시 반영됩니다.
        </p>
      </header>

      {msg && (
        <p className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{msg}</p>
      )}

      {/* 테마 */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="text-base font-semibold mb-1">테마</h2>
        <p className="text-xs text-gray-500 mb-4">
          홈 전체의 시각 톤. <a href="/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">미리보기 ↗</a>
        </p>
        <div className="grid sm:grid-cols-3 gap-3">
          {THEMES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => saveTheme(t.value)}
              disabled={saving}
              className={`text-left px-4 py-4 rounded-lg border transition-colors disabled:opacity-50 ${
                theme === t.value ? "bg-blue-50 border-blue-400 text-blue-900" : "bg-white border-gray-300 hover:bg-gray-50"
              }`}
            >
              <div className="font-semibold mb-1 flex items-center gap-2">
                {t.label}
                {theme === t.value && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">선택됨</span>}
              </div>
              <div className="text-[11px] text-gray-500 leading-snug">{t.description}</div>
            </button>
          ))}
        </div>
      </section>

      {/* 블록 빌더 */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold">블록 ({blocks.length}개)</h2>
            <p className="text-xs text-gray-500 mt-0.5">위에서 아래 순서로 홈에 렌더됩니다. ↑↓ 로 순서, 체크박스로 ON/OFF.</p>
          </div>
        </div>

        {blocks.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">블록이 없습니다. 아래에서 추가하세요.</p>
        ) : (
          <ul className="space-y-3">
            {blocks.map((b, i) => {
              const meta = BLOCK_META[b.kind] ?? { label: b.kind, desc: "미정의 블록" };
              const isDragging = draggedId === b.id;
              const isDropTarget = dropTargetId === b.id && draggedId !== b.id;
              return (
                <li
                  key={b.id}
                  onDragOver={(e) => {
                    if (draggedId === null) return;
                    e.preventDefault();
                    if (dropTargetId !== b.id) setDropTargetId(b.id);
                  }}
                  onDragLeave={() => {
                    if (dropTargetId === b.id) setDropTargetId(null);
                  }}
                  onDrop={(e) => { e.preventDefault(); handleDrop(b.id); }}
                  className={`border rounded-lg p-4 transition-shadow ${
                    isDropTarget ? "border-blue-500 border-2 shadow-md" :
                    b.is_active ? "border-gray-300 bg-white" : "border-gray-200 bg-gray-50 opacity-70"
                  } ${isDragging ? "opacity-40" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    {/* 순서 컨트롤 + 드래그 핸들 */}
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <div
                        draggable
                        onDragStart={(e) => { setDraggedId(b.id); e.dataTransfer.effectAllowed = "move"; }}
                        onDragEnd={endDrag}
                        title="드래그하여 순서 변경"
                        className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 cursor-grab active:cursor-grabbing select-none"
                        aria-label="드래그 핸들"
                      >⠿</div>
                      <button
                        onClick={() => move(b.id, -1)}
                        disabled={i === 0}
                        className="w-6 h-6 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="위로"
                      >↑</button>
                      <button
                        onClick={() => move(b.id, 1)}
                        disabled={i === blocks.length - 1}
                        className="w-6 h-6 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="아래로"
                      >↓</button>
                    </div>

                    {/* 본문 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-[11px] text-gray-400 shrink-0">#{i + 1}</span>
                          <span className="font-semibold text-sm text-[var(--color-primary)] shrink-0">{meta.label}</span>
                          <span className="text-[11px] text-gray-500 font-mono shrink-0">{b.kind}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={b.is_active}
                              onChange={(e) => patchBlock(b.id, { is_active: e.target.checked })}
                            />
                            <span>{b.is_active ? "활성" : "숨김"}</span>
                          </label>
                          <button
                            onClick={() => deleteBlock(b.id, b.kind)}
                            className="text-xs px-2 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50"
                          >삭제</button>
                        </div>
                      </div>
                      <p className="text-[11px] text-gray-500 leading-snug mb-2">{meta.desc}</p>

                      {/* 블록별 payload 편집 */}
                      <BlockPayloadEditor block={b} onChange={(p) => patchBlock(b.id, { payload: p })} boards={boards} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* 블록 추가 */}
        <div className="mt-5 pt-5 border-t border-gray-200">
          <h3 className="text-sm font-semibold mb-2">블록 추가</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.entries(BLOCK_META).map(([kind, meta]) => (
              <button
                key={kind}
                onClick={() => addBlock(kind)}
                className="text-left px-3 py-2 text-xs border border-gray-300 rounded bg-white hover:bg-blue-50 hover:border-blue-300"
              >
                <div className="font-semibold">{meta.label}</div>
                <div className="text-[10px] text-gray-500 leading-snug truncate">{meta.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/** 블록 종류별 payload 인라인 편집기 — 변경 시 onChange 호출. boards 는 board_tabs / 슬롯 안 nested editor 까지 전달. */
function BlockPayloadEditor({
  block,
  onChange,
  boards,
}: {
  block: HomeBlock;
  onChange: (payload: Record<string, unknown>) => void;
  boards: BoardCatalogItem[];
}) {
  const p = block.payload ?? {};

  if (block.kind === "hero") {
    const layout = (p.layout as string) ?? "wide";
    return (
      <div className="bg-gray-50 border border-gray-200 rounded p-3 mt-2">
        <label className="block text-[11px] font-semibold text-gray-700 mb-1.5">레이아웃</label>
        <select
          value={layout}
          onChange={(e) => onChange({ ...p, layout: e.target.value })}
          className="text-xs border border-gray-300 rounded px-2 py-1 bg-white w-full max-w-md"
        >
          {HERO_LAYOUTS.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
      </div>
    );
  }

  if (block.kind === "banner") {
    const placement = (p.placement as string) ?? "home_main";
    return (
      <div className="bg-gray-50 border border-gray-200 rounded p-3 mt-2">
        <label className="block text-[11px] font-semibold text-gray-700 mb-1.5">Placement</label>
        <input
          type="text"
          defaultValue={placement}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== placement) onChange({ ...p, placement: v });
          }}
          placeholder="home_main, home_middle, home_bottom 등"
          className="text-xs border border-gray-300 rounded px-2 py-1 bg-white w-full max-w-md font-mono"
        />
        <p className="text-[10px] text-gray-500 mt-1">
          /admin/banners 에서 같은 placement 키로 등록한 활성 배너 그룹의 사진들이 슬라이드로 노출됩니다.
        </p>
      </div>
    );
  }

  if (block.kind === "quick_links") {
    const items: QuickLinkItem[] = Array.isArray(p.items) ? (p.items as QuickLinkItem[]) : [];
    const updateItems = (next: QuickLinkItem[]) => onChange({ ...p, items: next });
    return (
      <div className="bg-gray-50 border border-gray-200 rounded p-3 mt-2 space-y-2 @container">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold text-gray-700">바로가기 항목 ({items.length}개)</label>
          <button
            onClick={() => updateItems([...items, { href: "/", label: "새 항목", icon_key: "church" }])}
            className="text-[11px] px-2 py-1 bg-[var(--color-primary)] text-white rounded"
          >+ 추가</button>
        </div>
        {items.length === 0 ? (
          <p className="text-[11px] text-gray-500 leading-snug">
            비어 있으면 페이지 코드의 default 3개 항목(성당 안내·분과와 단체·주보 보기) 이 사용됩니다.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {items.map((it, idx) => (
              <li key={idx} className="grid grid-cols-1 @md:grid-cols-[1fr_1fr_120px_auto] gap-1.5 items-center min-w-0">
                <input
                  type="text"
                  defaultValue={it.label}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== it.label) updateItems(items.map((x, i) => i === idx ? { ...x, label: v } : x));
                  }}
                  placeholder="라벨"
                  className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                />
                <input
                  type="text"
                  defaultValue={it.href}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== it.href) updateItems(items.map((x, i) => i === idx ? { ...x, href: v } : x));
                  }}
                  placeholder="/about"
                  className="text-xs border border-gray-300 rounded px-2 py-1 bg-white font-mono"
                />
                <select
                  value={it.icon_key ?? "church"}
                  onChange={(e) => updateItems(items.map((x, i) => i === idx ? { ...x, icon_key: e.target.value } : x))}
                  className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                >
                  {QUICK_LINK_ICONS.map((o) => (
                    <option key={o.key} value={o.key}>{o.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => updateItems(items.filter((_, i) => i !== idx))}
                  className="text-xs px-2 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50"
                  title="삭제"
                >×</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (block.kind === "quote") {
    const text = (p.text as string) ?? "";
    const source = (p.source as string) ?? "";
    return (
      <div className="bg-gray-50 border border-gray-200 rounded p-3 mt-2 space-y-2">
        <div>
          <label className="block text-[11px] font-semibold text-gray-700 mb-1">본문</label>
          <textarea
            defaultValue={text}
            onBlur={(e) => {
              const v = e.target.value;
              if (v !== text) onChange({ ...p, text: v });
            }}
            rows={2}
            className="text-xs border border-gray-300 rounded px-2 py-1 bg-white w-full"
            placeholder="너는 베드로이다. 나는 이 반석 위에 내 교회를 세우겠다."
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-gray-700 mb-1">출처</label>
          <input
            type="text"
            defaultValue={source}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== source) onChange({ ...p, source: v });
            }}
            className="text-xs border border-gray-300 rounded px-2 py-1 bg-white w-full max-w-md"
            placeholder="마태오 16,18"
          />
        </div>
      </div>
    );
  }

  if (block.kind === "board_tabs") {
    const tabs: BoardTabConfig[] = Array.isArray(p.tabs) ? (p.tabs as BoardTabConfig[]) : [];
    const updateTabs = (next: BoardTabConfig[]) => onChange({ ...p, tabs: next });
    const updateTab = (idx: number, patch: Partial<BoardTabConfig>) => {
      updateTabs(tabs.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
    };
    const moveTab = (idx: number, dir: -1 | 1) => {
      const j = idx + dir;
      if (j < 0 || j >= tabs.length) return;
      const next = [...tabs];
      [next[idx], next[j]] = [next[j], next[idx]];
      updateTabs(next);
    };
    return (
      <div className="bg-gray-50 border border-gray-200 rounded p-3 mt-2 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold text-gray-700">탭 ({tabs.length}개)</label>
          <div className="flex gap-1">
            <button
              onClick={() => updateTabs([...tabs, { source: "board", board_slug: boards[0]?.slug ?? "" }])}
              className="text-[11px] px-2 py-1 bg-[var(--color-primary)] text-white rounded"
            >+ 게시판 탭</button>
            <button
              onClick={() => updateTabs([...tabs, { source: "events" }])}
              className="text-[11px] px-2 py-1 bg-gray-700 text-white rounded"
            >+ 행사·모임 탭</button>
          </div>
        </div>
        {tabs.length === 0 ? (
          <p className="text-[11px] text-gray-500 leading-snug">
            비어 있으면 default 2개 탭(공지사항 + 행사·모임) 이 사용됩니다.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {tabs.map((t, idx) => (
              <li key={idx} className="flex items-center gap-1.5 min-w-0">
                <div className="flex flex-col shrink-0">
                  <button
                    onClick={() => moveTab(idx, -1)}
                    disabled={idx === 0}
                    className="w-5 h-4 text-[10px] border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-30"
                    aria-label="위로"
                  >↑</button>
                  <button
                    onClick={() => moveTab(idx, 1)}
                    disabled={idx === tabs.length - 1}
                    className="w-5 h-4 text-[10px] border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-30"
                    aria-label="아래로"
                  >↓</button>
                </div>
                <select
                  value={t.source ?? "board"}
                  onChange={(e) => updateTab(idx, { source: e.target.value as "board" | "events", board_slug: e.target.value === "board" ? (t.board_slug || boards[0]?.slug || "") : undefined })}
                  className="text-xs border border-gray-300 rounded px-1.5 py-1 bg-white shrink-0"
                >
                  <option value="board">게시판</option>
                  <option value="events">행사·모임</option>
                </select>
                {t.source === "events" ? (
                  <span className="text-[11px] text-gray-500 italic shrink-0">→ /calendar 의 다가오는 행사</span>
                ) : (
                  <select
                    value={t.board_slug ?? ""}
                    onChange={(e) => updateTab(idx, { board_slug: e.target.value })}
                    className="text-xs border border-gray-300 rounded px-1.5 py-1 bg-white flex-1 min-w-0"
                  >
                    <option value="">— 게시판 선택 —</option>
                    {boards.map((b) => (
                      <option key={b.slug} value={b.slug}>{b.name} ({b.slug})</option>
                    ))}
                  </select>
                )}
                <input
                  type="text"
                  defaultValue={t.label ?? ""}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== (t.label ?? "")) updateTab(idx, { label: v || undefined });
                  }}
                  placeholder="라벨 (비우면 자동)"
                  className="text-xs border border-gray-300 rounded px-2 py-1 bg-white flex-1 min-w-0"
                />
                <button
                  onClick={() => updateTabs(tabs.filter((_, i) => i !== idx))}
                  className="text-xs px-2 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50 shrink-0"
                  title="삭제"
                >×</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // 슬롯에 들어갈 수 없는 컨테이너 류 (무한 중첩 방지)
  const CONTAINER_KINDS = new Set(["two_column", "three_column"]);

  if (block.kind === "tag_cloud") {
    const title = (p.title as string) ?? "";
    return (
      <div className="bg-gray-50 border border-gray-200 rounded p-3 mt-2 space-y-2">
        <div>
          <label className="block text-[11px] font-semibold text-gray-700 mb-1">섹션 제목 (옵션)</label>
          <input
            type="text"
            defaultValue={title}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== title) onChange({ ...p, title: v || undefined });
            }}
            placeholder="예: 우리 분과·단체"
            className="text-xs border border-gray-300 rounded px-2 py-1 bg-white w-full max-w-md"
          />
          <p className="text-[10px] text-gray-500 mt-1">
            비우면 제목 없이 태그 클라우드만 노출됩니다. 태그가 0개면 안내 텍스트 표시.
          </p>
        </div>
      </div>
    );
  }

  if (block.kind === "two_column") {
    type Slot = { kind?: string; payload?: Record<string, unknown> };
    const left = ((p.left as Slot) ?? {}) as Slot;
    const right = ((p.right as Slot) ?? {}) as Slot;
    const slotKinds = Object.keys(BLOCK_META).filter((k) => !CONTAINER_KINDS.has(k));
    // 좌측 비율 0~100 (실제 적용은 10~90 clamp). default 50.
    const rawRatio = Number(p.left_ratio ?? 50);
    const leftRatio = Number.isFinite(rawRatio) ? Math.min(90, Math.max(10, rawRatio)) : 50;

    const updateSlotKind = (side: "left" | "right", kind: string) => {
      // 슬롯 kind 변경 시 payload 초기화 (이전 블록 종류의 payload 가 새 종류에 맞지 않을 수 있음)
      onChange({ ...p, [side]: kind ? { kind, payload: {} } : {} });
    };
    const updateSlotPayload = (side: "left" | "right", slot: Slot, np: Record<string, unknown>) => {
      onChange({ ...p, [side]: { kind: slot.kind, payload: np } });
    };
    const updateRatio = (value: number) => {
      const clamped = Math.min(90, Math.max(10, Math.round(value)));
      onChange({ ...p, left_ratio: clamped });
    };

    const renderSlot = (side: "left" | "right", slot: Slot) => {
      const slotKind = slot.kind ?? "";
      const slotPayload = slot.payload ?? {};
      return (
        <div className="border border-gray-200 rounded p-2 bg-white space-y-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <label className="text-[11px] font-semibold text-gray-700 shrink-0">
              {side === "left" ? "왼쪽" : "오른쪽"}
            </label>
            <select
              value={slotKind}
              onChange={(e) => updateSlotKind(side, e.target.value)}
              className="text-xs border border-gray-300 rounded px-2 py-1 bg-white flex-1"
            >
              <option value="">— 선택 —</option>
              {slotKinds.map((k) => (
                <option key={k} value={k}>{BLOCK_META[k].label} ({k})</option>
              ))}
            </select>
          </div>
          {slotKind && (
            <BlockPayloadEditor
              block={{ id: -1, kind: slotKind, sort_order: 0, is_active: true, payload: slotPayload }}
              onChange={(np) => updateSlotPayload(side, { kind: slotKind, payload: slotPayload }, np)}
              boards={boards}
            />
          )}
        </div>
      );
    };

    return (
      <div className="bg-gray-50 border border-gray-200 rounded p-3 mt-2 space-y-3">
        {/* 좌·우 폭 비율 — 모바일은 1열로 떨어지므로 무관, md+ 에서만 적용 */}
        <div className="flex items-center gap-3">
          <label className="text-[11px] font-semibold text-gray-700 shrink-0">좌·우 비율</label>
          <input
            type="range"
            min={10}
            max={90}
            step={5}
            value={leftRatio}
            onChange={(e) => updateRatio(Number(e.target.value))}
            className="flex-1 accent-[var(--color-primary)]"
            aria-label="좌측 컬럼 비율"
          />
          <div className="flex items-center gap-1 shrink-0 text-[11px] font-mono text-gray-700">
            <input
              type="number"
              min={10}
              max={90}
              step={5}
              value={leftRatio}
              onChange={(e) => updateRatio(Number(e.target.value))}
              className="w-14 border border-gray-300 rounded px-1.5 py-0.5 bg-white text-right"
            />
            <span>: {100 - leftRatio}</span>
          </div>
        </div>
        <div className="space-y-2">
          {renderSlot("left", left)}
          {renderSlot("right", right)}
        </div>
      </div>
    );
  }

  if (block.kind === "three_column") {
    type Slot = { kind?: string; payload?: Record<string, unknown> };
    const slotKinds = Object.keys(BLOCK_META).filter((k) => !CONTAINER_KINDS.has(k));
    const sides = ["left", "middle", "right"] as const;
    const sideLabels: Record<typeof sides[number], string> = { left: "왼쪽", middle: "가운데", right: "오른쪽" };
    const slots: Record<typeof sides[number], Slot> = {
      left: ((p.left as Slot) ?? {}) as Slot,
      middle: ((p.middle as Slot) ?? {}) as Slot,
      right: ((p.right as Slot) ?? {}) as Slot,
    };
    // ratios: fr 단위 3개. default [1,1,1]. 1~10 권장.
    const rawRatios = Array.isArray(p.ratios) ? (p.ratios as unknown[]) : [];
    const ratios = [0, 1, 2].map((i) => {
      const v = Number(rawRatios[i]);
      return Number.isFinite(v) && v > 0 ? v : 1;
    });

    const updateSlotKind = (side: typeof sides[number], kind: string) => {
      onChange({ ...p, [side]: kind ? { kind, payload: {} } : {} });
    };
    const updateSlotPayload = (side: typeof sides[number], slot: Slot, np: Record<string, unknown>) => {
      onChange({ ...p, [side]: { kind: slot.kind, payload: np } });
    };
    const updateRatio = (idx: 0 | 1 | 2, value: number) => {
      const clamped = Math.min(10, Math.max(1, Math.round(value || 1)));
      const next = [...ratios];
      next[idx] = clamped;
      onChange({ ...p, ratios: next });
    };

    const renderSlot = (side: typeof sides[number]) => {
      const slot = slots[side];
      const slotKind = slot.kind ?? "";
      const slotPayload = slot.payload ?? {};
      return (
        <div className="border border-gray-200 rounded p-2 bg-white space-y-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <label className="text-[11px] font-semibold text-gray-700 shrink-0">{sideLabels[side]}</label>
            <select
              value={slotKind}
              onChange={(e) => updateSlotKind(side, e.target.value)}
              className="text-xs border border-gray-300 rounded px-2 py-1 bg-white flex-1"
            >
              <option value="">— 선택 —</option>
              {slotKinds.map((k) => (
                <option key={k} value={k}>{BLOCK_META[k].label} ({k})</option>
              ))}
            </select>
          </div>
          {slotKind && (
            <BlockPayloadEditor
              block={{ id: -1, kind: slotKind, sort_order: 0, is_active: true, payload: slotPayload }}
              onChange={(np) => updateSlotPayload(side, { kind: slotKind, payload: slotPayload }, np)}
              boards={boards}
            />
          )}
        </div>
      );
    };

    return (
      <div className="bg-gray-50 border border-gray-200 rounded p-3 mt-2 space-y-3">
        {/* 좌·중·우 fr 비율 — 합 무관, grid 가 자동 비례 분배 */}
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-[11px] font-semibold text-gray-700 shrink-0">컬럼 비율</label>
          <div className="flex items-center gap-1 text-[11px] font-mono text-gray-700">
            {([0, 1, 2] as const).map((i) => (
              <span key={i} className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={10}
                  step={1}
                  value={ratios[i]}
                  onChange={(e) => updateRatio(i, Number(e.target.value))}
                  className="w-12 border border-gray-300 rounded px-1.5 py-0.5 bg-white text-right"
                  aria-label={`${sideLabels[sides[i]]} 비율`}
                />
                {i < 2 && <span>:</span>}
              </span>
            ))}
          </div>
          <span className="text-[10px] text-gray-500">fr 단위 · 1~10 · 합은 무관</span>
        </div>
        <div className="space-y-2">
          {sides.map((s) => <div key={s}>{renderSlot(s)}</div>)}
        </div>
      </div>
    );
  }

  // 그 외 블록은 payload 가 없음 — 편집 폼 없음
  return null;
}
