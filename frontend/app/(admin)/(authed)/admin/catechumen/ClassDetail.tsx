"use client";
import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { PHOTO_CATEGORIES } from "@/lib/catechumen";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface MemberRow {
  id: number;
  class_id: number;
  member_id: number | null;
  name: string | null;
  baptismal_name: string | null;
  baptized_at: string | null;
  sort_order: number;
  member_nickname: string | null;
}
interface PhotoRow {
  id: number;
  class_id: number;
  category: string;
  file_url: string;
  alt: string | null;
  sort_order: number;
}
interface SearchHit { id: number; nickname: string; email: string; avatar_url: string | null; }

function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
}

export default function ClassDetail({ classId, roundNo, onChanged }: {
  classId: number;
  roundNo: number | null;
  onChanged: () => void;
}) {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);

  // 참여자 추가 폼
  const [pName, setPName] = useState("");
  const [pBaptismal, setPBaptismal] = useState("");
  const [pBaptizedAt, setPBaptizedAt] = useState("");
  const [pMemberId, setPMemberId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);

  // 사진 업로드
  const [cat, setCat] = useState(PHOTO_CATEGORIES[0]);
  const [customCat, setCustomCat] = useState("");
  const [uploading, setUploading] = useState(false);

  const authHeader = { Authorization: `Bearer ${getToken()}` };

  const loadDetail = useCallback(async () => {
    const [mRes, pRes] = await Promise.all([
      fetch(`${API}/api/catechumen/classes/${classId}/members`),
      fetch(`${API}/api/catechumen/classes/${classId}/photos`),
    ]);
    if (mRes.ok) setMembers(await mRes.json());
    if (pRes.ok) setPhotos(await pRes.json());
  }, [classId]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  // 회원 검색 (디바운스)
  useEffect(() => {
    if (!search.trim()) { setHits([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`${API}/api/members/admin/search?q=${encodeURIComponent(search)}&limit=8`, { headers: authHeader });
      if (res.ok) setHits(await res.json());
    }, 250);
    return () => clearTimeout(t);
  }, [search]);  // eslint-disable-line react-hooks/exhaustive-deps

  function pickMember(h: SearchHit) {
    setPMemberId(h.id);
    setPName(h.nickname);
    setSearch("");
    setHits([]);
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    if (!pName.trim() && pMemberId === null) return;
    const res = await fetch(`${API}/api/catechumen/classes/${classId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({
        member_id: pMemberId,
        name: pName.trim() || null,
        baptismal_name: pBaptismal.trim() || null,
        baptized_at: pBaptizedAt || null,
      }),
    });
    if (res.ok) {
      setPName(""); setPBaptismal(""); setPBaptizedAt(""); setPMemberId(null);
      loadDetail(); onChanged();
    }
  }

  async function delMember(id: number) {
    if (!confirm("참여자를 명단에서 제거하시겠습니까?")) return;
    await fetch(`${API}/api/catechumen/members/${id}`, { method: "DELETE", headers: authHeader });
    loadDetail(); onChanged();
  }

  async function uploadPhoto(file: File) {
    const category = (customCat.trim() || cat).trim();
    if (!category) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("category", category);
    fd.append("file", file);
    await fetch(`${API}/api/catechumen/classes/${classId}/photos`, { method: "POST", headers: authHeader, body: fd });
    setUploading(false);
    setCustomCat("");
    loadDetail(); onChanged();
  }

  async function delPhoto(id: number) {
    if (!confirm("사진을 삭제하시겠습니까?")) return;
    await fetch(`${API}/api/catechumen/photos/${id}`, { method: "DELETE", headers: authHeader });
    loadDetail(); onChanged();
  }

  // 사진을 category 별로 그룹핑 (기본 종류 순서 우선, 그 외는 뒤에)
  const grouped: Record<string, PhotoRow[]> = {};
  for (const p of photos) (grouped[p.category] ??= []).push(p);
  const catOrder = [
    ...PHOTO_CATEGORIES.filter((c) => grouped[c]),
    ...Object.keys(grouped).filter((c) => !PHOTO_CATEGORIES.includes(c)),
  ];

  return (
    <div className="border border-t-0 border-[var(--color-primary)]/30 rounded-b-xl bg-[var(--color-surface-warm)]/40 p-5 space-y-6">
      {/* ── 참여자 ── */}
      <section>
        <h3 className="font-semibold text-sm text-[var(--color-primary)] mb-3">참여자 ({members.length}명)</h3>

        <form onSubmit={addMember} className="bg-white border border-[var(--color-border)] rounded-lg p-3 mb-3 space-y-2">
          <div className="relative">
            <label className="block text-[11px] font-medium mb-1 text-[var(--color-text-muted)]">회원 검색 (선택 — 닉네임·이메일)</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="회원을 검색해 연결하거나, 아래에 이름만 입력"
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--color-primary)]" />
            {hits.length > 0 && (
              <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-[var(--color-border)] rounded-lg shadow-lg max-h-56 overflow-auto">
                {hits.map((h) => (
                  <li key={h.id}>
                    <button type="button" onClick={() => pickMember(h)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-surface-warm)] flex items-center gap-2">
                      <span className="font-medium">{h.nickname}</span>
                      <span className="text-xs text-[var(--color-text-muted)]">{h.email}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="grid sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-medium mb-1 text-[var(--color-text-muted)]">이름 {pMemberId && <span className="text-[var(--color-primary)]">(회원 연결됨)</span>}</label>
              <input value={pName} onChange={(e) => { setPName(e.target.value); setPMemberId(null); }} placeholder="홍길동"
                className="w-full border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--color-primary)]" />
            </div>
            <div>
              <label className="block text-[11px] font-medium mb-1 text-[var(--color-text-muted)]">세례명</label>
              <input value={pBaptismal} onChange={(e) => setPBaptismal(e.target.value)} placeholder="베드로"
                className="w-full border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--color-primary)]" />
            </div>
            <div>
              <label className="block text-[11px] font-medium mb-1 text-[var(--color-text-muted)]">세례일 (선택)</label>
              <input type="date" value={pBaptizedAt} onChange={(e) => setPBaptizedAt(e.target.value)}
                className="w-full border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--color-primary)]" />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-[var(--color-primary)] hover:opacity-90">참여자 추가</button>
          </div>
        </form>

        {members.length > 0 && (
          <ul className="space-y-1.5">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 bg-white border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm">
                <span className="font-medium">{m.name || m.member_nickname || "(이름 없음)"}</span>
                {m.baptismal_name && <span className="text-xs text-[var(--color-text-muted)]">{m.baptismal_name}</span>}
                {m.member_id ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">회원 {m.member_nickname ? `· ${m.member_nickname}` : ""}</span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">비회원</span>
                )}
                {m.baptized_at && <span className="text-xs text-[var(--color-text-muted)]">세례 {m.baptized_at.slice(0, 10)}</span>}
                <button onClick={() => delMember(m.id)} className="ml-auto text-xs text-red-500 hover:underline">제거</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── 사진 ── */}
      <section>
        <h3 className="font-semibold text-sm text-[var(--color-primary)] mb-3">세례성사 사진 ({photos.length}장)</h3>

        <div className="bg-white border border-[var(--color-border)] rounded-lg p-3 mb-3 flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-[11px] font-medium mb-1 text-[var(--color-text-muted)]">종류</label>
            <select value={cat} onChange={(e) => setCat(e.target.value)}
              className="border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--color-primary)]">
              {PHOTO_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium mb-1 text-[var(--color-text-muted)]">직접 입력 (선택)</label>
            <input value={customCat} onChange={(e) => setCustomCat(e.target.value)} placeholder="새 종류명"
              className="border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--color-primary)]" />
          </div>
          <label className="px-3 py-1.5 text-xs border border-[var(--color-primary)] text-[var(--color-primary)] rounded-lg cursor-pointer hover:bg-[var(--color-surface-warm)]">
            {uploading ? "업로드 중…" : "+ 사진 업로드"}
            <input type="file" accept="image/*" className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])} />
          </label>
        </div>

        {catOrder.length === 0 && <p className="text-xs text-[var(--color-text-muted)]">아직 사진이 없습니다.</p>}
        <div className="space-y-4">
          {catOrder.map((c) => (
            <div key={c}>
              <p className="text-xs font-medium text-[var(--color-text)] mb-1.5">{c} <span className="text-[var(--color-text-muted)]">({grouped[c].length})</span></p>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {grouped[c].map((p) => (
                  <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden border border-[var(--color-border)] bg-white group">
                    <Image src={p.file_url.startsWith("/") ? `${API}${p.file_url}` : p.file_url} alt={p.alt ?? c} fill className="object-cover" />
                    <button onClick={() => delPhoto(p.id)}
                      className="absolute top-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">삭제</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
