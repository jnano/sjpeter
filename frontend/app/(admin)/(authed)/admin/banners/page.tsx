"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// 노출 위치(페이지·슬롯). 백엔드 ALLOWED_PLACEMENTS와 동기화 유지
const PLACEMENT_OPTIONS: { value: string; label: string }[] = [
  { value: "home_main", label: "홈 — 메인" },
  { value: "home_middle", label: "홈 — 중단" },
  { value: "home_bottom", label: "홈 — 하단" },
  { value: "about_top", label: "성당 소개 — 상단" },
  { value: "about_bottom", label: "성당 소개 — 하단" },
  { value: "calendar_top", label: "행사 캘린더 — 상단" },
  { value: "bulletin_top", label: "주보 — 상단" },
  { value: "gallery_top", label: "갤러리 — 상단" },
];

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

// 가로:세로 비율 (BannerSlider 컨테이너 aspect-ratio)
const ASPECT_RATIO_OPTIONS: { value: string; label: string }[] = [
  { value: "16:9", label: "16:9 (와이드)" },
  { value: "3:2", label: "3:2" },
  { value: "4:3", label: "4:3" },
  { value: "1:1", label: "1:1 (정사각)" },
  { value: "4:1", label: "4:1 (가로 긴)" },
  { value: "3:1", label: "3:1" },
  { value: "21:9", label: "21:9 (시네마)" },
];

const DELAY_MIN = 2;
const DELAY_MAX = 30;

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
  /** 변수 치환에서 {{ BANNER:slug }} 로 참조. null 이면 변수에서 접근 불가. */
  slug: string | null;
  placement: string;
  is_active: boolean;
  sort_order: number;
  transition: string;
  aspect_ratio: string;
  delay_seconds: number;
  show_caption_overlay: boolean;
  start_at: string | null;
  end_at: string | null;
  created_at: string;
  updated_at: string;
  images: BannerImage[];
}

// "YYYY-MM-DDTHH:mm:ss(.…)?" (UTC, from backend) ↔ "YYYY-MM-DDTHH:mm" (datetime-local input)
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  // backend 는 UTC naive 로 저장·반환. 입력 UI 는 그대로 노출(역변환 단순화)
  return iso.slice(0, 16);
}
function localInputToIso(local: string): string | null {
  return local ? `${local}:00` : null;
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
      const created: BannerGroup = await res.json();
      setGroups((prev) =>
        [...prev, created].sort(
          (a, b) =>
            a.placement.localeCompare(b.placement) ||
            a.sort_order - b.sort_order ||
            a.id - b.id,
        ),
      );
      setNewName("");
    } finally {
      setCreating(false);
    }
  }

  // 즉시 로컬 상태 반영 + 백엔드 PATCH + 응답 정합화. 실패 시 전체 재조회로 롤백.
  // (load() 만 의존하면 controlled <select> 가 응답 도착까지 변경 전 값으로 잠시 복원되어
  //  사용자에게 "위치가 안 고정된다"는 깜빡임으로 보임)
  async function updateGroup(id: number, patch: Partial<BannerGroup>) {
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
    const res = await fetch(`${API}/api/banners/groups/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const updated: BannerGroup = await res.json();
      setGroups((prev) => prev.map((g) => (g.id === id ? updated : g)));
    } else {
      alert("저장 실패. 목록을 새로고침합니다.");
      load();
    }
  }

  async function deleteGroup(id: number, name: string) {
    if (!confirm(`「${name}」 그룹과 안의 이미지를 모두 삭제할까요? 되돌릴 수 없습니다.`)) return;
    const res = await fetch(`${API}/api/banners/groups/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (res.ok) {
      setGroups((prev) => prev.filter((g) => g.id !== id));
    } else {
      load();
    }
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
      {/* placement 자유 입력의 자동완성 — 페이지 전체에서 공유 */}
      <datalist id="banner-placement-suggestions">
        {PLACEMENT_OPTIONS.map((p) => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </datalist>

      <div>
        <h1 className="font-serif text-2xl font-bold text-[var(--color-primary)]">광고 배너</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          공개 페이지의 지정된 위치(슬롯)에 배너를 노출합니다. 같은 위치에 활성화된 그룹들의 이미지가
          sort_order 순서로 합쳐지고, 2장 이상이면 자동 슬라이드됩니다. 그룹마다 크기·전환 효과·딜레이·노출 기간·캡션 노출 여부를 따로 설정할 수 있습니다.
        </p>
        <p className="text-xs text-[var(--color-text-muted)] mt-2">
          위치(placement) 는 권장 키 8 개 (홈 메인/중단/하단, 성당 소개 상/하, 캘린더/주보/갤러리 상단) 외에도 자유롭게 입력해
          새 슬롯을 만들 수 있습니다 (예: <code>advent_2026</code>). 공개 페이지에서 <code>&lt;BannerSlider placement=&quot;...&quot; /&gt;</code> 로 같은 키를 참조하면 노출됩니다.
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
            <input
              type="text"
              list="banner-placement-suggestions"
              value={newPlacement}
              onChange={(e) => setNewPlacement(e.target.value)}
              placeholder="home_main"
              title="영문 소문자·숫자·언더스코어·하이픈 — 권장 키는 자동완성, 새 키도 자유롭게 입력 가능"
              className="border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)] bg-white w-44"
            />
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
      {/* 그룹 헤더 — 2행 구조 */}
      <div className="border-b border-[var(--color-border)] bg-[var(--color-surface-warm)]">
        {/* 행 1: 이름·위치·전환·활성·정렬·삭제 */}
        <div className="px-4 pt-3 pb-1.5 flex flex-wrap items-center gap-2">
          <input
            type="text"
            defaultValue={group.name}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== group.name) onUpdate({ name: v });
            }}
            className="flex-1 min-w-[160px] bg-transparent border border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-primary)] focus:bg-white rounded px-2 py-1 text-sm font-semibold text-[var(--color-text)]"
          />
          <input
            type="text"
            list="banner-placement-suggestions"
            defaultValue={group.placement}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== group.placement) onUpdate({ placement: v });
            }}
            title="노출 위치 키 — 영문 소문자·숫자·언더스코어·하이픈 (예: home_main, advent_2026)"
            className="text-xs border border-[var(--color-border)] rounded px-2 py-1 bg-white w-32"
          />
          <input
            type="text"
            defaultValue={group.slug ?? ""}
            placeholder="slug (선택)"
            onBlur={(e) => {
              const raw = e.target.value.trim();
              const v = raw === "" ? null : raw;
              if (v !== (group.slug ?? null)) onUpdate({ slug: v });
            }}
            title="동적페이지 본문에서 {{ BANNER:slug }} 로 참조할 키. 영문 소문자로 시작, 비워두면 변수 미사용."
            className="text-xs border border-[var(--color-border)] rounded px-2 py-1 bg-white w-32 font-mono"
          />
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

        {/* 행 2: 크기·딜레이·캡션 오버레이 */}
        <div className="px-4 pb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--color-text-muted)]">
          <label className="flex items-center gap-1.5">
            <span>크기</span>
            <select
              value={group.aspect_ratio}
              onChange={(e) => onUpdate({ aspect_ratio: e.target.value })}
              className="text-xs border border-[var(--color-border)] rounded px-2 py-1 bg-white"
            >
              {ASPECT_RATIO_OPTIONS.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <span>딜레이</span>
            <input
              type="number"
              min={DELAY_MIN}
              max={DELAY_MAX}
              defaultValue={group.delay_seconds}
              onBlur={(e) => {
                let v = parseInt(e.target.value) || 5;
                if (v < DELAY_MIN) v = DELAY_MIN;
                if (v > DELAY_MAX) v = DELAY_MAX;
                if (v !== group.delay_seconds) onUpdate({ delay_seconds: v });
              }}
              className="w-14 text-xs border border-[var(--color-border)] rounded px-2 py-1 bg-white"
            />
            <span>초 ({DELAY_MIN}~{DELAY_MAX})</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={group.show_caption_overlay}
              onChange={(e) => onUpdate({ show_caption_overlay: e.target.checked })}
            />
            <span>대체 텍스트를 이미지 위에 자막으로 표시</span>
          </label>

          {/* 노출 기간 — 둘 다 비우면 무제한, 한쪽만 채우면 그 방향만 제한 */}
          <label className="flex items-center gap-1.5">
            <span title="이 시각 이후부터 노출">시작</span>
            <input
              type="datetime-local"
              defaultValue={isoToLocalInput(group.start_at)}
              onBlur={(e) => {
                const iso = localInputToIso(e.target.value);
                if (iso !== group.start_at) onUpdate({ start_at: iso });
              }}
              className="text-xs border border-[var(--color-border)] rounded px-2 py-1 bg-white"
            />
          </label>
          <label className="flex items-center gap-1.5">
            <span title="이 시각까지 노출">종료</span>
            <input
              type="datetime-local"
              defaultValue={isoToLocalInput(group.end_at)}
              onBlur={(e) => {
                const iso = localInputToIso(e.target.value);
                if (iso !== group.end_at) onUpdate({ end_at: iso });
              }}
              className="text-xs border border-[var(--color-border)] rounded px-2 py-1 bg-white"
            />
          </label>
        </div>
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
