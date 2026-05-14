"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// 향후 위치(placement) enum 늘리면 여기 라벨 추가
const PLACEMENT_OPTIONS: { value: string; label: string }[] = [
  { value: "home_main", label: "홈 메인 영역" },
];
const placementLabel = (v: string) =>
  PLACEMENT_OPTIONS.find((p) => p.value === v)?.label ?? v;

// 슬라이드 전환 효과 (이미지 2장 이상일 때 적용)
const TRANSITION_OPTIONS: { value: string; label: string }[] = [
  { value: "none", label: "없음 (즉시 전환)" },
  { value: "fade", label: "페이드" },
  { value: "slide", label: "슬라이드 (좌→우)" },
  { value: "slide-up", label: "슬라이드 (아래→위)" },
  { value: "slide-down", label: "슬라이드 (위→아래)" },
  { value: "zoom-in", label: "줌 인" },
  { value: "zoom-out", label: "줌 아웃" },
  { value: "ken-burns", label: "켄 번스 (서서히 확대)" },
  { value: "blur", label: "블러" },
];

interface BannerImage {
  id: number;
  file_url: string;
  link_url: string | null;
  alt_text: string;
  sort_order: number;
}

interface BannerGroup {
  id: number;
  name: string;
  placement: string;
  is_active: boolean;
  sort_order: number;
  transition: string;
  created_at: string;
  updated_at: string;
  images: BannerImage[];
}

function absoluteUrl(path: string): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API}${path}`;
}

function authHeaders(): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function AdminBannersPage() {
  const [groups, setGroups] = useState<BannerGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPlacement, setNewPlacement] = useState("home_main");

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API}/api/banners/groups`, { headers: authHeaders(), cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: BannerGroup[]) => setGroups(Array.isArray(data) ? data : []))
      .catch(() => setGroups([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createGroup() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const res = await fetch(`${API}/api/banners/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ name, placement: newPlacement, is_active: true, sort_order: 0 }),
      });
      if (!res.ok) {
        alert("그룹 생성 실패");
        return;
      }
      setNewName("");
      load();
    } finally {
      setCreating(false);
    }
  }

  async function updateGroup(id: number, patch: Partial<BannerGroup>) {
    const res = await fetch(`${API}/api/banners/groups/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(patch),
    });
    if (res.ok) load();
  }

  async function deleteGroup(id: number, name: string) {
    if (!confirm(`「${name}」 그룹과 안의 이미지를 모두 삭제할까요? 되돌릴 수 없습니다.`)) return;
    const res = await fetch(`${API}/api/banners/groups/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (res.ok) load();
  }

  async function uploadImage(groupId: number, file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API}/api/banners/groups/${groupId}/images`, {
      method: "POST",
      headers: authHeaders(),
      body: fd,
    });
    if (!res.ok) {
      alert("이미지 업로드 실패");
      return;
    }
    load();
  }

  async function updateImage(imageId: number, patch: Partial<BannerImage>) {
    const res = await fetch(`${API}/api/banners/images/${imageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(patch),
    });
    if (res.ok) load();
  }

  async function deleteImage(imageId: number) {
    if (!confirm("이 이미지를 삭제할까요?")) return;
    const res = await fetch(`${API}/api/banners/images/${imageId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (res.ok) load();
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-[var(--color-primary)]">배너 관리</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          위치별 슬라이드 배너를 등록합니다. 같은 위치에 활성화된 그룹들의 이미지가
          sort_order 순서로 합쳐져 노출되고, 2장 이상이면 5초 간격 자동 슬라이드 + 인디케이터가 표시됩니다.
        </p>
      </div>

      {/* 새 그룹 생성 */}
      <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4">
        <h2 className="font-semibold text-sm text-[var(--color-text)] mb-3">새 그룹 만들기</h2>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-[var(--color-text-muted)] mb-1">그룹 이름</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="예: 첫영성체 축하 (시즌)"
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--color-text-muted)] mb-1">위치</label>
            <select
              value={newPlacement}
              onChange={(e) => setNewPlacement(e.target.value)}
              className="border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)] bg-white"
            >
              {PLACEMENT_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={createGroup}
            disabled={creating || !newName.trim()}
            className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] disabled:opacity-40 text-white text-sm rounded-lg"
          >
            {creating ? "만드는 중…" : "그룹 만들기"}
          </button>
        </div>
      </section>

      {/* 그룹 목록 */}
      {loading ? (
        <div className="text-center py-16 text-[var(--color-text-muted)]">불러오는 중…</div>
      ) : groups.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-text-muted)]">
          아직 등록된 배너 그룹이 없습니다.
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <GroupCard
              key={g.id}
              group={g}
              onUpdate={(patch) => updateGroup(g.id, patch)}
              onDelete={() => deleteGroup(g.id, g.name)}
              onUploadImage={(file) => uploadImage(g.id, file)}
              onUpdateImage={(id, patch) => updateImage(id, patch)}
              onDeleteImage={(id) => deleteImage(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GroupCard({
  group,
  onUpdate,
  onDelete,
  onUploadImage,
  onUpdateImage,
  onDeleteImage,
}: {
  group: BannerGroup;
  onUpdate: (patch: Partial<BannerGroup>) => void;
  onDelete: () => void;
  onUploadImage: (file: File) => void;
  onUpdateImage: (id: number, patch: Partial<BannerImage>) => void;
  onDeleteImage: (id: number) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden">
      {/* 그룹 헤더 */}
      <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-warm)] flex flex-wrap items-center gap-2">
        <input
          type="text"
          defaultValue={group.name}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== group.name) onUpdate({ name: v });
          }}
          className="flex-1 min-w-[160px] bg-transparent border border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-primary)] focus:bg-white rounded px-2 py-1 text-sm font-semibold text-[var(--color-text)]"
        />
        <select
          value={group.placement}
          onChange={(e) => onUpdate({ placement: e.target.value })}
          className="text-xs border border-[var(--color-border)] rounded px-2 py-1 bg-white"
        >
          {PLACEMENT_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        <select
          value={group.transition}
          onChange={(e) => onUpdate({ transition: e.target.value })}
          title="슬라이드 전환 효과 (2장 이상일 때 적용)"
          className="text-xs border border-[var(--color-border)] rounded px-2 py-1 bg-white"
        >
          {TRANSITION_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <label className="text-xs text-[var(--color-text-muted)] flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={group.is_active}
            onChange={(e) => onUpdate({ is_active: e.target.checked })}
          />
          활성
        </label>
        <input
          type="number"
          value={group.sort_order}
          onChange={(e) => onUpdate({ sort_order: parseInt(e.target.value) || 0 })}
          title="정렬 (작을수록 위)"
          className="w-14 text-xs border border-[var(--color-border)] rounded px-2 py-1"
        />
        <button
          onClick={onDelete}
          className="text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded"
        >
          그룹 삭제
        </button>
      </div>

      {/* 이미지 목록 */}
      <div className="p-4 space-y-3">
        {group.images.length === 0 ? (
          <p className="text-xs text-[var(--color-text-muted)] text-center py-4">
            이미지가 아직 없습니다. 아래 [이미지 추가]로 업로드하세요.
          </p>
        ) : (
          group.images.map((img) => (
            <ImageRow
              key={img.id}
              img={img}
              onUpdate={(patch) => onUpdateImage(img.id, patch)}
              onDelete={() => onDeleteImage(img.id)}
            />
          ))
        )}

        {/* 새 이미지 업로드 */}
        <div className="pt-2 border-t border-[var(--color-border)] flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                onUploadImage(f);
                e.target.value = "";  // 같은 파일 재업로드 허용
              }
            }}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-xs px-3 py-1.5 border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-warm)]"
          >
            + 이미지 추가
          </button>
          <span className="text-[11px] text-[var(--color-text-muted)]">
            jpg·png·webp·gif, 최대 10MB
          </span>
        </div>
      </div>
    </div>
  );
}

function ImageRow({
  img,
  onUpdate,
  onDelete,
}: {
  img: BannerImage;
  onUpdate: (patch: Partial<BannerImage>) => void;
  onDelete: () => void;
}) {
  const [linkUrl, setLinkUrl] = useState(img.link_url ?? "");
  const [altText, setAltText] = useState(img.alt_text);

  // 외부에서 데이터가 바뀌면(load 후) state 동기화
  useEffect(() => {
    setLinkUrl(img.link_url ?? "");
    setAltText(img.alt_text);
  }, [img.id, img.link_url, img.alt_text]);

  return (
    <div className="flex gap-3 items-start">
      <a
        href={absoluteUrl(img.file_url)}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={absoluteUrl(img.file_url)}
          alt={img.alt_text || ""}
          className="w-28 h-20 object-cover rounded-lg border border-[var(--color-border)]"
        />
      </a>
      <div className="flex-1 min-w-0 space-y-2">
        <div>
          <label className="block text-[11px] text-[var(--color-text-muted)] mb-0.5">
            클릭 시 이동 URL (선택)
          </label>
          <input
            type="text"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onBlur={() => {
              if ((linkUrl || null) !== (img.link_url || null)) {
                onUpdate({ link_url: linkUrl });
              }
            }}
            placeholder="https://example.com 또는 /boards/notice/123"
            className="w-full text-sm border border-[var(--color-border)] rounded px-2 py-1 focus:outline-none focus:border-[var(--color-primary)]"
          />
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex-1">
            <label className="block text-[11px] text-[var(--color-text-muted)] mb-0.5">
              대체 텍스트 (alt)
            </label>
            <input
              type="text"
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              onBlur={() => {
                if (altText !== img.alt_text) onUpdate({ alt_text: altText });
              }}
              className="w-full text-sm border border-[var(--color-border)] rounded px-2 py-1 focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <div className="w-20">
            <label className="block text-[11px] text-[var(--color-text-muted)] mb-0.5">
              순서
            </label>
            <input
              type="number"
              defaultValue={img.sort_order}
              onBlur={(e) => {
                const v = parseInt(e.target.value) || 0;
                if (v !== img.sort_order) onUpdate({ sort_order: v });
              }}
              className="w-full text-sm border border-[var(--color-border)] rounded px-2 py-1"
            />
          </div>
        </div>
      </div>
      <button
        onClick={onDelete}
        className="shrink-0 text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded"
      >
        삭제
      </button>
    </div>
  );
}
