"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Banner {
  id: number;
  file_url: string;
  original_name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

export default function AdminHomeBannerPage() {
  const router = useRouter();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const authHeader = useCallback((): HeadersInit => {
    const token = localStorage.getItem("admin_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const reload = useCallback(async () => {
    const res = await fetch(`${API}/api/home-banners/all`, { headers: authHeader() });
    if (res.status === 401) {
      router.push("/admin");
      return;
    }
    if (res.ok) setBanners(await res.json());
  }, [authHeader, router]);

  useEffect(() => {
    if (!localStorage.getItem("admin_token")) {
      router.push("/admin");
      return;
    }
    reload();
  }, [reload, router]);

  const upload = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (arr.length === 0) {
        setError("이미지 파일만 업로드할 수 있습니다.");
        return;
      }
      setError(null);
      setUploading(true);
      try {
        const fd = new FormData();
        arr.forEach((f) => fd.append("files", f));
        const res = await fetch(`${API}/api/home-banners/`, {
          method: "POST",
          headers: authHeader(),
          body: fd,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail || `업로드 실패 (${res.status})`);
        }
        await reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : "업로드 실패");
      } finally {
        setUploading(false);
      }
    },
    [authHeader, reload],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) upload(e.dataTransfer.files);
  };

  const remove = async (id: number) => {
    if (!confirm("이 배너를 삭제하시겠습니까? 파일도 함께 삭제됩니다.")) return;
    const res = await fetch(`${API}/api/home-banners/${id}`, {
      method: "DELETE",
      headers: authHeader(),
    });
    if (res.ok) reload();
    else setError("삭제 실패");
  };

  const toggleActive = async (id: number) => {
    const res = await fetch(`${API}/api/home-banners/${id}/toggle`, {
      method: "PATCH",
      headers: authHeader(),
    });
    if (res.ok) reload();
  };

  const reorder = async (newOrder: number[]) => {
    setBanners((cur) => newOrder.map((id, i) => ({ ...cur.find((b) => b.id === id)!, sort_order: i })));
    await fetch(`${API}/api/home-banners/reorder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ ids: newOrder }),
    });
  };

  const onItemDragStart = (id: number) => setDraggingId(id);
  const onItemDragEnd = () => setDraggingId(null);
  const onItemDragOver = (e: React.DragEvent, overId: number) => {
    e.preventDefault();
    if (draggingId === null || draggingId === overId) return;
    const ids = banners.map((b) => b.id);
    const from = ids.indexOf(draggingId);
    const to = ids.indexOf(overId);
    if (from < 0 || to < 0) return;
    const next = [...ids];
    next.splice(to, 0, next.splice(from, 1)[0]);
    setBanners(next.map((id) => banners.find((b) => b.id === id)!));
  };
  const onItemDrop = () => {
    if (draggingId !== null) reorder(banners.map((b) => b.id));
    setDraggingId(null);
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <header className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">홈 메인 배너 관리</h1>
        <p className="text-sm text-gray-500 mt-1">
          홈 페이지 상단 큰 사진을 관리합니다. 여러 장 등록 시 부드럽게 전환됩니다.
        </p>
      </header>

      {/* 드래그앤드롭 업로드 */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`mb-6 rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-all ${
          dragOver
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100"
        } ${uploading ? "opacity-50 pointer-events-none" : ""}`}
      >
        <div className="text-4xl mb-3">{uploading ? "⏳" : "📤"}</div>
        <p className="font-medium text-gray-700 mb-1">
          {uploading ? "업로드 중..." : dragOver ? "여기에 놓으세요" : "사진을 드래그하거나 클릭해서 선택"}
        </p>
        <p className="text-xs text-gray-500">JPG, PNG, WEBP, GIF · 한 장당 최대 10MB · 여러 장 동시 가능</p>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) upload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 배너 목록 */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-semibold text-gray-900">등록된 배너 ({banners.length})</h2>
          {banners.length > 1 && (
            <p className="text-xs text-gray-500">드래그해서 표시 순서 변경</p>
          )}
        </div>

        {banners.length === 0 ? (
          <div className="text-center py-16 text-gray-400 border border-gray-200 rounded-xl bg-white">
            <p className="text-3xl mb-2">🖼️</p>
            <p className="text-sm">등록된 배너가 없습니다. 위 영역에서 업로드해 주세요.</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {banners.map((b) => (
              <li
                key={b.id}
                draggable
                onDragStart={() => onItemDragStart(b.id)}
                onDragEnd={onItemDragEnd}
                onDragOver={(e) => onItemDragOver(e, b.id)}
                onDrop={onItemDrop}
                className={`bg-white border rounded-xl overflow-hidden transition-shadow hover:shadow-sm cursor-move ${
                  draggingId === b.id ? "opacity-40 border-blue-400" : "border-gray-200"
                } ${!b.is_active ? "opacity-60" : ""}`}
              >
                <div className="relative w-full aspect-[16/9] bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`${API}${b.file_url}`}
                    alt={b.original_name}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  {!b.is_active && (
                    <span className="absolute top-2 left-2 px-2 py-0.5 bg-gray-700 text-white text-[11px] rounded">
                      비활성
                    </span>
                  )}
                </div>
                <div className="p-3 flex items-center justify-between gap-3">
                  <p className="text-xs text-gray-600 truncate flex-1" title={b.original_name}>
                    {b.original_name}
                  </p>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleActive(b.id)}
                      className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 text-gray-700"
                    >
                      {b.is_active ? "숨김" : "표시"}
                    </button>
                    <button
                      onClick={() => remove(b.id)}
                      className="text-xs px-2 py-1 rounded border border-red-300 hover:bg-red-50 text-red-600"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
