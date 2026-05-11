"use client";

import { useEffect, useRef, useState } from "react";
import type { PagePhoto, PagePhotoSettings, TransitionMode } from "./PageHeroSlideshow";
import { DataEvent, notify } from "./dataEvents";

const API = process.env.NEXT_PUBLIC_API_URL;

interface Props {
  slug: string;
  title?: string;
  description?: string;
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("admin_token");
}

const TRANSITION_LABEL: Record<TransitionMode, string> = {
  none: "전환 없음 (첫 사진만)",
  fade: "페이드",
  slide: "슬라이드 (좌→우)",
  "slide-up": "슬라이드 (위로)",
  "slide-down": "슬라이드 (아래로)",
  "zoom-in": "줌 인 (확대되며 등장)",
  "zoom-out": "줌 아웃 (축소되며 등장)",
  "ken-burns": "켄 번즈 (천천히 확대·이동)",
  blur: "블러 페이드",
};

const TRANSITION_MODES: TransitionMode[] = [
  "fade",
  "ken-burns",
  "zoom-in",
  "zoom-out",
  "blur",
  "slide",
  "slide-up",
  "slide-down",
  "none",
];

export default function PageHeroPhotoEditor({ slug, title, description }: Props) {
  const [photos, setPhotos] = useState<PagePhoto[]>([]);
  const [settings, setSettings] = useState<PagePhotoSettings>({
    page_slug: slug,
    transition_mode: "fade",
    interval_seconds: 5,
    transition_duration_ms: 700,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    const res = await fetch(`${API}/api/page-photos/${slug}`);
    if (!res.ok) return;
    const data = await res.json();
    setPhotos(data.photos ?? []);
    setSettings(data.settings ?? settings);
  };

  useEffect(() => {
    fetchData();
  }, [slug]);

  function flash(msg: string) {
    setSaved(msg);
    setTimeout(() => setSaved(""), 2500);
  }

  async function uploadFiles(files: FileList) {
    setLoading(true);
    setError("");
    const token = getToken();
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`${API}/api/page-photos/${slug}/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setError(d.detail || "업로드에 실패했습니다.");
          break;
        }
      }
      await fetchData();
      notify(DataEvent.PAGE_PHOTOS);
      flash("사진이 등록되었습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function deletePhoto(id: number) {
    if (!confirm("사진을 삭제하시겠습니까?")) return;
    const token = getToken();
    const res = await fetch(`${API}/api/page-photos/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      await fetchData();
      notify(DataEvent.PAGE_PHOTOS);
      flash("삭제되었습니다.");
    }
  }

  async function move(id: number, dir: -1 | 1) {
    const ordered = [...photos];
    const i = ordered.findIndex((p) => p.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ordered.length) return;
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
    const token = getToken();
    const res = await fetch(`${API}/api/page-photos/${slug}/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ photo_ids: ordered.map((p) => p.id) }),
    });
    if (res.ok) {
      const data = await res.json();
      setPhotos(data);
      notify(DataEvent.PAGE_PHOTOS);
    }
  }

  async function saveSettings(next: PagePhotoSettings) {
    const token = getToken();
    setError("");
    const res = await fetch(`${API}/api/page-photos/${slug}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        transition_mode: next.transition_mode,
        interval_seconds: next.interval_seconds,
        transition_duration_ms: next.transition_duration_ms,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.detail || "설정 저장에 실패했습니다.");
      return;
    }
    const data = await res.json();
    setSettings(data);
    notify(DataEvent.PAGE_PHOTOS);
    flash("설정이 저장되었습니다.");
  }

  return (
    <section className="p-6 bg-white border border-gray-200 rounded-xl space-y-5">
      <div className="border-b border-gray-100 pb-3">
        <h2 className="font-semibold text-gray-800">{title ?? "히어로 사진 슬라이드쇼"}</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          {description ?? "여러 장 등록하면 자동 전환됩니다. 한 장이거나 '전환 없음'이면 첫 사진만 표시됩니다."}
        </p>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}
      {saved && <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{saved}</div>}

      {/* 슬라이드쇼 설정 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-3">
          <label className="block text-sm font-medium mb-1">전환 방식</label>
          <select
            value={settings.transition_mode}
            onChange={(e) => saveSettings({ ...settings, transition_mode: e.target.value as TransitionMode })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {TRANSITION_MODES.map((m) => (
              <option key={m} value={m}>{TRANSITION_LABEL[m]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">전환 간격 (초)</label>
          <input
            type="number"
            min={1}
            max={60}
            value={settings.interval_seconds}
            onChange={(e) => setSettings((p) => ({ ...p, interval_seconds: parseInt(e.target.value) || 1 }))}
            onBlur={() => saveSettings(settings)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">한 사진이 보이는 시간(1~60초)</p>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium mb-1">전환 애니메이션 시간 (ms)</label>
          <input
            type="number"
            min={100}
            max={5000}
            step={100}
            value={settings.transition_duration_ms}
            onChange={(e) => setSettings((p) => ({ ...p, transition_duration_ms: parseInt(e.target.value) || 100 }))}
            onBlur={() => saveSettings(settings)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">페이드·슬라이드·줌·블러 동작 자체의 길이(100~5000ms). 700ms가 부드러움.</p>
        </div>
      </div>

      {/* 사진 등록 */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          등록된 사진 <strong>{photos.length}</strong>장
        </p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {loading ? "업로드 중..." : "사진 추가"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* 사진 목록 */}
      {photos.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
          등록된 사진이 없습니다. 사진을 등록하면 페이지에 표시됩니다.
        </p>
      ) : (
        <ul className="space-y-2">
          {photos.map((p, i) => (
            <li key={p.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
              <div className="w-20 h-14 relative shrink-0 rounded overflow-hidden bg-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${API}${p.file_url}`}
                  alt={p.alt ?? "사진"}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 truncate">{p.file_url}</p>
                <p className="text-xs text-gray-400">순서 {i + 1}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => move(p.id, -1)}
                  disabled={i === 0}
                  className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-white disabled:opacity-30"
                  title="위로"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(p.id, 1)}
                  disabled={i === photos.length - 1}
                  className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-white disabled:opacity-30"
                  title="아래로"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => deletePhoto(p.id)}
                  className="px-2 py-1 text-xs text-red-500 border border-red-200 rounded hover:bg-red-50"
                >
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
