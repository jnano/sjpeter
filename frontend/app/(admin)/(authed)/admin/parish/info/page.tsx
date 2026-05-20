"use client";
import { useState, useEffect, useRef } from "react";
import LogoFallback from "@/components/icons/LogoFallback";
import { formatErrorDetail } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL;

interface MassEntry {
  day: string;
  time: string;
  note: string;
}

interface MassSchedule {
  entries: MassEntry[];
  note: string;
}

interface ParishInfo {
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  fax: string | null;
  cafe_url: string | null;
  band_url: string | null;
  about_photo_url: string | null;
  logo_url: string | null;
  mass_schedule: MassSchedule | null;
}

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("admin_token");
}

export default function AdminParishInfoPage() {
  const [info, setInfo] = useState<ParishInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [logoLoading, setLogoLoading] = useState(false);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${API}/api/parish/`).then((r) => r.json()).then((data: ParishInfo) => {
      setInfo(data);
    });
  }, []);

  async function uploadLogo(file: File) {
    setLogoLoading(true);
    setError("");
    const token = getToken();
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`${API}/api/parish/logo/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(formatErrorDetail(data.detail, "업로드에 실패했습니다."));
        return;
      }
      setInfo(data);
      await fetch("/api/revalidate?tag=parish", { method: "POST" });
    } finally {
      setLogoLoading(false);
    }
  }

  async function deleteLogo() {
    if (!confirm("성당 로고를 삭제하시겠습니까? 헤더에는 기본 ✝ 아이콘이 표시됩니다.")) return;
    setLogoLoading(true);
    setError("");
    const token = getToken();
    try {
      const res = await fetch(`${API}/api/parish/logo`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(formatErrorDetail(data.detail, "삭제에 실패했습니다."));
        return;
      }
      setInfo(data);
      await fetch("/api/revalidate?tag=parish", { method: "POST" });
    } finally {
      setLogoLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!info) return;
    setError(""); setLoading(true); setSaved(false);
    const token = getToken();
    try {
      const res = await fetch(`${API}/api/parish/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(info),
      });
      const data = await res.json();
      if (!res.ok) { setError(formatErrorDetail(data.detail, "저장에 실패했습니다.")); return; }
      setInfo(data);
      await fetch("/api/revalidate?tag=parish", { method: "POST" });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setLoading(false);
    }
  }

  if (!info) return (
    <div className="p-8 flex items-center justify-center min-h-[60vh]">
      <p className="text-gray-500">불러오는 중...</p>
    </div>
  );

  const inputCls = "px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">기본 정보</h1>
        <p className="text-sm text-gray-500 mt-1">성당명, 로고, 주소, 연락처 등 기본 정보를 관리합니다.</p>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}
      {saved && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">저장되었습니다.</div>}

      <form onSubmit={handleSubmit} className="space-y-8">
        <section className="p-6 bg-white border border-gray-200 rounded-xl space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">성당명</label>
            <input
              value={info.name ?? ""}
              onChange={(e) => setInfo((p) => p && ({ ...p, name: e.target.value }))}
              className={`w-full ${inputCls}`}
              placeholder="본당 홈페이지"
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              헤더 로고 옆 이름, 푸터, 페이지 제목·메타데이터에 표시됩니다.
            </p>
          </div>

          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/40">
            <label className="block text-sm font-medium mb-2">성당 로고</label>
            <div className="flex items-start gap-4">
              <div className="w-20 h-20 rounded-xl border border-gray-200 bg-white flex items-center justify-center overflow-hidden shrink-0">
                {info.logo_url ? (
                  <img
                    src={info.logo_url.startsWith("http") ? info.logo_url : `${API}${info.logo_url}`}
                    alt="로고"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <LogoFallback className="w-14 h-14" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <input
                  ref={logoFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadLogo(f);
                    if (logoFileInputRef.current) logoFileInputRef.current.value = "";
                  }}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => logoFileInputRef.current?.click()}
                    disabled={logoLoading}
                    className="px-3 py-1.5 text-sm border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-50"
                  >
                    {logoLoading ? "처리 중..." : info.logo_url ? "로고 변경" : "로고 등록"}
                  </button>
                  {info.logo_url && (
                    <button
                      type="button"
                      onClick={deleteLogo}
                      disabled={logoLoading}
                      className="px-3 py-1.5 text-sm border border-red-300 text-red-500 rounded-lg hover:bg-red-50 disabled:opacity-50"
                    >
                      삭제
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-400">
                  권장: 정사각형 PNG/SVG, 1MB 이하. 헤더와 푸터에 자동으로 표시됩니다.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">주소</label>
            <input
              value={info.address ?? ""}
              onChange={(e) => setInfo((p) => p && ({ ...p, address: e.target.value }))}
              className={`w-full ${inputCls}`}
              placeholder="세종특별자치시 도움5로 00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              지도 좌표
              <a
                href="https://map.kakao.com"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-xs text-blue-500 font-normal hover:underline"
              >
                카카오맵에서 확인 →
              </a>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <input
                  type="number"
                  step="0.000001"
                  value={info.lat ?? ""}
                  onChange={(e) => setInfo((p) => p && ({ ...p, lat: e.target.value ? parseFloat(e.target.value) : null }))}
                  className={`w-full ${inputCls}`}
                  placeholder="위도 (예: 36.504012)"
                />
              </div>
              <div>
                <input
                  type="number"
                  step="0.000001"
                  value={info.lng ?? ""}
                  onChange={(e) => setInfo((p) => p && ({ ...p, lng: e.target.value ? parseFloat(e.target.value) : null }))}
                  className={`w-full ${inputCls}`}
                  placeholder="경도 (예: 127.249412)"
                />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              카카오맵에서 성당 위치 우클릭 → &quot;이 위치로 길 찾기&quot; 옆 좌표 복사
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">전화번호</label>
              <input value={info.phone ?? ""} onChange={(e) => setInfo((p) => p && ({ ...p, phone: e.target.value }))} className={`w-full ${inputCls}`} placeholder="044-000-0000" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">팩스</label>
              <input value={info.fax ?? ""} onChange={(e) => setInfo((p) => p && ({ ...p, fax: e.target.value }))} className={`w-full ${inputCls}`} placeholder="044-000-0001" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">카페 주소</label>
              <input value={info.cafe_url ?? ""} onChange={(e) => setInfo((p) => p && ({ ...p, cafe_url: e.target.value }))} className={`w-full ${inputCls}`} placeholder="https://cafe.naver.com/..." />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">밴드 주소</label>
              <input value={info.band_url ?? ""} onChange={(e) => setInfo((p) => p && ({ ...p, band_url: e.target.value }))} className={`w-full ${inputCls}`} placeholder="https://band.us/..." />
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <button type="submit" disabled={loading} className="px-8 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
            {loading ? "저장 중..." : "저장"}
          </button>
        </div>
      </form>

      {/* 교통 안내 — /info 페이지의 출발지별 카드 관리 */}
      <TransportRoutesSection />
    </div>
  );
}

// ───────────────────────────────────────────────
// 교통 안내 섹션 (출발지별 카드 CRUD)
// ───────────────────────────────────────────────

interface TransportRoute {
  id: number;
  label: string;
  description: string;
  sort_order: number;
}

function TransportRoutesSection() {
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;

  function fetchRoutes() {
    setLoading(true);
    fetch(`${API}/api/transport-routes`)
      .then((r) => r.json())
      .then((data: TransportRoute[]) => setRoutes(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchRoutes(); }, []);

  async function addRoute(e: React.FormEvent) {
    e.preventDefault();
    if (!draftLabel.trim() || !draftDesc.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/transport-routes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ label: draftLabel.trim(), description: draftDesc.trim() }),
      });
      if (res.ok) {
        setDraftLabel(""); setDraftDesc("");
        fetchRoutes();
      }
    } finally {
      setSaving(false);
    }
  }

  async function startEdit(r: TransportRoute) {
    setEditingId(r.id);
    setEditLabel(r.label);
    setEditDesc(r.description);
  }

  async function saveEdit(id: number) {
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/transport-routes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ label: editLabel.trim(), description: editDesc.trim() }),
      });
      if (res.ok) {
        setEditingId(null);
        fetchRoutes();
      }
    } finally {
      setSaving(false);
    }
  }

  async function removeRoute(id: number) {
    if (!confirm("이 출발지 노선을 삭제하시겠습니까?")) return;
    const res = await fetch(`${API}/api/transport-routes/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token ?? ""}` },
    });
    if (res.ok) fetchRoutes();
  }

  async function move(id: number, direction: -1 | 1) {
    const idx = routes.findIndex((r) => r.id === id);
    const target = idx + direction;
    if (idx < 0 || target < 0 || target >= routes.length) return;
    const newOrder = [...routes];
    [newOrder[idx], newOrder[target]] = [newOrder[target], newOrder[idx]];
    const res = await fetch(`${API}/api/transport-routes/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
      body: JSON.stringify({ ids: newOrder.map((r) => r.id) }),
    });
    if (res.ok) fetchRoutes();
  }

  return (
    <section className="mt-10 p-6 bg-white border border-gray-200 rounded-xl">
      <div className="mb-4">
        <h2 className="text-lg font-bold">교통 안내</h2>
        <p className="text-xs text-gray-500 mt-1">
          공개 /info 페이지에 출발지별 카드로 표시됩니다. 추가·수정·삭제 즉시 반영.
        </p>
      </div>

      {/* 신규 등록 폼 */}
      <form onSubmit={addRoute} className="space-y-2 mb-6 p-4 border border-dashed border-gray-300 rounded-lg">
        <input
          type="text"
          value={draftLabel}
          onChange={(e) => setDraftLabel(e.target.value)}
          placeholder="출발지 라벨 (예: 도담동에서 오실 때)"
          maxLength={80}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <textarea
          value={draftDesc}
          onChange={(e) => setDraftDesc(e.target.value)}
          placeholder="노선 설명 (예: BRT B2 이용 → 정부세종청사북측 정류장 하차, 도보 약 5분)"
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || !draftLabel.trim() || !draftDesc.trim()}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            추가
          </button>
        </div>
      </form>

      {/* 목록 */}
      {loading ? (
        <p className="text-center py-6 text-sm text-gray-500">불러오는 중…</p>
      ) : routes.length === 0 ? (
        <p className="text-center py-6 text-sm text-gray-400">등록된 교통 안내가 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {routes.map((r, idx) => (
            <li key={r.id} className="p-3 border border-gray-200 rounded-lg">
              {editingId === r.id ? (
                <div className="space-y-2">
                  <input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    maxLength={80}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <textarea
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setEditingId(null)} className="px-3 py-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">취소</button>
                    <button type="button" onClick={() => saveEdit(r.id)} disabled={saving} className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">저장</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="flex flex-col gap-1 shrink-0">
                    <button type="button" onClick={() => move(r.id, -1)} disabled={idx === 0} className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30">▲</button>
                    <button type="button" onClick={() => move(r.id, 1)} disabled={idx === routes.length - 1} className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30">▼</button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{r.label}</p>
                    <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{r.description}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button type="button" onClick={() => startEdit(r)} className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50">수정</button>
                    <button type="button" onClick={() => removeRoute(r.id)} className="text-xs px-2 py-1 border border-red-200 text-red-500 rounded hover:bg-red-50">삭제</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
