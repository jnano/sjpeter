"use client";

import { useEffect, useRef, useState } from "react";
import ReactCrop, { Crop, PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

/** PixelCrop 영역으로 원본 이미지를 잘라 JPEG Blob 반환. */
async function getCroppedBlob(image: HTMLImageElement, crop: PixelCrop): Promise<Blob> {
  // 화면 표시된 이미지와 원본 사이의 스케일 보정 (object-fit: contain 으로 표시될 때)
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(crop.width * scaleX));
  canvas.height = Math.max(1, Math.round(crop.height * scaleY));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas context 생성 실패");

  ctx.drawImage(
    image,
    crop.x * scaleX, crop.y * scaleY,
    crop.width * scaleX, crop.height * scaleY,
    0, 0, canvas.width, canvas.height,
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Blob 변환 실패"))),
      "image/jpeg",
      0.92,
    );
  });
}

interface Props {
  imageUrl: string;
  onSave: (blob: Blob) => Promise<void>;
  onClose: () => void;
}

/** 추출 이미지 crop 모달. 자유 박스(모서리 8방향 핸들 드래그로 크기 조정 + 박스 자체 이동).
 *  스캔본 PDF에서 한 페이지가 통째로 추출된 사진에서 필요한 부분만 남길 때 사용. */
export default function ImageCropModal({ imageUrl, onSave, onClose }: Props) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop | undefined>(undefined);
  const [completed, setCompleted] = useState<PixelCrop | null>(null);
  const [saving, setSaving] = useState(false);
  // 이미지를 fetch → dataURL 로 변환해 같은 origin 처리 (CORS·canvas tainted 회피)
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const token = localStorage.getItem("admin_token");
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(imageUrl, { headers });
        if (!res.ok) throw new Error("이미지를 불러올 수 없습니다.");
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onload = () => { if (!cancelled) setDataUrl(reader.result as string); };
        reader.onerror = () => { if (!cancelled) setLoadError("이미지 변환 실패"); };
        reader.readAsDataURL(blob);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "이미지 로드 실패");
      }
    }
    load();
    return () => { cancelled = true; };
  }, [imageUrl]);

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    // 처음 띄울 때 이미지 전체의 60% 영역을 가운데에 기본 선택 — 사용자가 즉시 드래그 시작 가능
    const { width, height } = e.currentTarget;
    const initW = Math.round(width * 0.6);
    const initH = Math.round(height * 0.6);
    setCrop({
      unit: "px",
      x: Math.round((width - initW) / 2),
      y: Math.round((height - initH) / 2),
      width: initW,
      height: initH,
    });
  }

  async function handleSave() {
    if (!imgRef.current || !completed || completed.width === 0 || completed.height === 0) {
      alert("자를 영역을 선택해 주세요.");
      return;
    }
    setSaving(true);
    try {
      const blob = await getCroppedBlob(imgRef.current, completed);
      await onSave(blob);
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl w-full max-w-3xl flex flex-col max-h-[90vh]">
        <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-800">이미지 자르기</h3>
            <p className="text-xs text-gray-500 mt-0.5">모서리·테두리 드래그로 영역 자유 조정, 박스 내부 드래그로 이동</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-gray-100 p-4 flex items-center justify-center min-h-[300px]">
          {loadError ? (
            <p className="text-red-600 text-sm">{loadError}</p>
          ) : !dataUrl ? (
            <p className="text-gray-500 text-sm">이미지 불러오는 중…</p>
          ) : (
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(c) => setCompleted(c)}
              ruleOfThirds
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={dataUrl}
                alt="자를 이미지"
                onLoad={onImageLoad}
                style={{ maxWidth: "100%", maxHeight: "70vh", display: "block" }}
              />
            </ReactCrop>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-between gap-3">
          <span className="text-xs text-gray-500">
            {completed
              ? `선택 영역: ${Math.round(completed.width)} × ${Math.round(completed.height)} px`
              : "박스를 드래그하여 영역을 정하세요"}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !completed || completed.width === 0}
              className="px-4 py-2 text-sm bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-50"
            >
              {saving ? "저장 중…" : "저장 (원본 덮어쓰기)"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
