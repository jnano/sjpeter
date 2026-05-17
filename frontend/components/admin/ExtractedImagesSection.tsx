"use client";

import { useEffect, useState } from "react";
import ImageCropModal from "./ImageCropModal";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface ExtractedImage {
  id: number;
  bulletin_id: number;
  file_url: string;
  width: number;
  height: number;
  page_number: number;
  status: "pending" | "routed" | "ignored";
  routed_to: string | null;
  created_at: string;
}

interface GalleryOption {
  slug: string;
  label: string;
}

interface BoardOption {
  slug: string;
  name: string;
}

interface Props {
  bulletinId: number | string;
}

// 운영상 노출하면 안 되는 시스템 전용 게시판 (AI 자동 흐름 보호)
const HIDDEN_BOARD_SLUGS = new Set(["ai-extract"]);

/** 주보 PDF에서 추출된 사진을 보여주고 분류·삭제하는 섹션.
 *  /admin/bulletin/[id]/result 와 /admin/bulletin/extractions?bulletin_id=N 양쪽에서 재사용. */
export default function ExtractedImagesSection({ bulletinId }: Props) {
  const [images, setImages] = useState<ExtractedImage[]>([]);
  const [galleryOptions, setGalleryOptions] = useState<GalleryOption[]>([]);
  const [otherBoards, setOtherBoards] = useState<BoardOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
    if (!token) return;
    let cancelled = false;
    async function load() {
      try {
        const [imgRes, menuRes, boardsRes] = await Promise.all([
          fetch(`${API}/api/bulletins/${bulletinId}/extracted-images`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API}/api/menus/public`),
          fetch(`${API}/api/boards/`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const imgs: ExtractedImage[] = imgRes.ok ? await imgRes.json() : [];
        if (cancelled) return;
        setImages(imgs);

        // 갤러리 메뉴 (/gallery/<slug>) — 별도 그룹으로 우선 표시
        const galleries: GalleryOption[] = [];
        const gallerySlugs = new Set<string>();
        if (menuRes.ok) {
          const groups = await menuRes.json();
          for (const g of groups) {
            for (const item of g.items ?? []) {
              if (typeof item.href === "string" && item.href.startsWith("/gallery/")) {
                const slug = item.href.replace("/gallery/", "");
                galleries.push({ slug, label: item.label });
                gallerySlugs.add(slug);
              }
            }
          }
        }
        setGalleryOptions(galleries);

        // 그 외 모든 활성 게시판 (갤러리·시스템 보호 게시판 제외)
        if (boardsRes.ok) {
          const all = await boardsRes.json();
          const others: BoardOption[] = (all as Array<{ slug: string; name: string; is_active?: boolean }>)
            .filter((b) => b.is_active !== false)
            .filter((b) => !HIDDEN_BOARD_SLUGS.has(b.slug))
            .filter((b) => !gallerySlugs.has(b.slug))
            .map((b) => ({ slug: b.slug, name: b.name }));
          setOtherBoards(others);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [bulletinId]);

  async function handleRoute(
    imageId: number,
    target: "construction" | "gallery" | "ignore",
    gallerySlug?: string,
  ) {
    const token = localStorage.getItem("admin_token");
    if (!token) return;
    const res = await fetch(`${API}/api/bulletins/extracted-images/${imageId}/route`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ target, gallery_slug: gallerySlug ?? null }),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      throw new Error(detail.detail ?? "분류 실패");
    }
    const data = await res.json();
    setImages((prev) => prev.map((img) =>
      img.id === imageId
        ? { ...img, status: target === "ignore" ? "ignored" : "routed", routed_to: data.routed_to }
        : img
    ));
  }

  async function handleDelete(imageId: number) {
    if (!confirm("이 이미지를 완전히 삭제할까요? (파일 + 레코드)")) return;
    const token = localStorage.getItem("admin_token");
    if (!token) return;
    const res = await fetch(`${API}/api/bulletins/extracted-images/${imageId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      alert("삭제 실패");
      return;
    }
    setImages((prev) => prev.filter((img) => img.id !== imageId));
  }

  async function handleCropSave(imageId: number, blob: Blob) {
    const token = localStorage.getItem("admin_token");
    if (!token) throw new Error("admin 인증 정보가 없습니다.");
    const fd = new FormData();
    fd.append("file", blob, "crop.jpg");
    const res = await fetch(`${API}/api/bulletins/extracted-images/${imageId}/crop`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      throw new Error(detail.detail ?? "자르기 저장 실패");
    }
    const updated: ExtractedImage = await res.json();
    // 캐시 무력화 위해 url에 timestamp 추가 — 새 width/height 즉시 반영, 이미지도 새로 로드
    setImages((prev) => prev.map((img) =>
      img.id === imageId ? { ...updated, file_url: `${updated.file_url}?v=${Date.now()}` } : img
    ));
  }

  if (loading || images.length === 0) return null;

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between px-4 py-2.5 rounded-t-xl border border-violet-200 bg-violet-50">
        <div className="flex items-center gap-2">
          <span>📷</span>
          <h2 className="font-bold text-violet-900">PDF에서 추출한 사진</h2>
          <span className="text-xs text-violet-700">
            {images.length}장 · 200px 이상 사진만 자동 추출
          </span>
        </div>
      </div>
      <div className="border border-t-0 border-[var(--color-border)] rounded-b-xl bg-[var(--color-surface)] p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {images.map((img) => (
            <ExtractedImageCard
              key={img.id}
              img={img}
              galleryOptions={galleryOptions}
              otherBoards={otherBoards}
              onRoute={handleRoute}
              onDelete={handleDelete}
              onCropSave={(blob) => handleCropSave(img.id, blob)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function ExtractedImageCard({
  img,
  galleryOptions,
  otherBoards,
  onRoute,
  onDelete,
  onCropSave,
}: {
  img: ExtractedImage;
  galleryOptions: GalleryOption[];
  otherBoards: BoardOption[];
  onRoute: (id: number, target: "construction" | "gallery" | "ignore", gallerySlug?: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onCropSave: (blob: Blob) => Promise<void>;
}) {
  const [selection, setSelection] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);

  async function handleApply() {
    if (!selection) return;
    setBusy(true);
    try {
      if (selection === "construction") {
        await onRoute(img.id, "construction");
      } else if (selection === "ignore") {
        await onRoute(img.id, "ignore");
      } else if (selection.startsWith("gallery:")) {
        await onRoute(img.id, "gallery", selection.slice("gallery:".length));
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "분류 실패");
    } finally {
      setBusy(false);
    }
  }

  const statusBadge =
    img.status === "routed" ? (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-800 font-medium">
        ✓ {img.routed_to}
      </span>
    ) : img.status === "ignored" ? (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">무시됨</span>
    ) : (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">대기</span>
    );

  return (
    <div className="border border-[var(--color-border)] rounded-lg overflow-hidden bg-white">
      <a href={`${API}${img.file_url}`} target="_blank" rel="noreferrer" className="block aspect-video bg-gray-100 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${API}${img.file_url}`} alt="" className="w-full h-full object-cover" />
      </a>
      <div className="px-2 py-1.5 text-[11px] text-[var(--color-text-muted)] flex items-center justify-between border-b">
        <span>{img.width}×{img.height} · {img.page_number}p</span>
        {statusBadge}
      </div>
      <div className="p-2 space-y-1.5">
        <select
          value={selection}
          onChange={(e) => setSelection(e.target.value)}
          disabled={busy}
          className="w-full text-xs px-2 py-1 border border-gray-300 rounded"
        >
          <option value="">분류 선택…</option>
          <option value="construction">건축 슬라이드 (page_photos: construction)</option>
          {galleryOptions.length > 0 && (
            <optgroup label="갤러리">
              {galleryOptions.map((g) => (
                <option key={`gal-${g.slug}`} value={`gallery:${g.slug}`}>📷 {g.label}</option>
              ))}
            </optgroup>
          )}
          {otherBoards.length > 0 && (
            <optgroup label="게시판">
              {otherBoards.map((b) => (
                <option key={`brd-${b.slug}`} value={`gallery:${b.slug}`}>📋 {b.name}</option>
              ))}
            </optgroup>
          )}
          <option value="ignore">무시</option>
        </select>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={handleApply}
            disabled={!selection || busy}
            className="flex-1 text-xs px-2 py-1 bg-violet-600 text-white rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-violet-700"
          >
            {busy ? "처리 중…" : "적용"}
          </button>
          <button
            type="button"
            onClick={() => setCropOpen(true)}
            disabled={busy}
            className="text-xs px-2 py-1 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-40"
            title="이미지에서 사진 영역만 잘라내기 (스캔 PDF용)"
          >
            자르기
          </button>
          <button
            type="button"
            onClick={() => onDelete(img.id)}
            disabled={busy}
            className="text-xs px-2 py-1 border border-red-300 text-red-700 rounded hover:bg-red-50 disabled:opacity-40"
            title="이미지 영구 삭제"
          >
            삭제
          </button>
        </div>
      </div>
      {cropOpen && (
        <ImageCropModal
          imageUrl={img.file_url.replace(/\?.*$/, "")}
          onSave={onCropSave}
          onClose={() => setCropOpen(false)}
        />
      )}
    </div>
  );
}
