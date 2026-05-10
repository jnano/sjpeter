"use client";
import { useState, useEffect, useRef } from "react";

const API = process.env.NEXT_PUBLIC_API_URL;

const DAY_OPTIONS = ["주일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "공휴일"] as const;
const DAY_ORDER: Record<string, number> = {
  "주일": 0, "월요일": 1, "화요일": 2, "수요일": 3,
  "목요일": 4, "금요일": 5, "토요일": 6, "공휴일": 7,
};

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
  mass_schedule: MassSchedule | null;
}

const EMPTY_ENTRY: MassEntry = { day: "주일", time: "", note: "" };
const DEFAULT_SCHEDULE: MassSchedule = { entries: [], note: "" };

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("admin_token");
}

function sortedEntries(entries: MassEntry[]) {
  return [...entries].sort((a, b) => {
    const dayDiff = (DAY_ORDER[a.day] ?? 99) - (DAY_ORDER[b.day] ?? 99);
    if (dayDiff !== 0) return dayDiff;
    return a.time.localeCompare(b.time);
  });
}

export default function AdminParishPage() {
  const [info, setInfo] = useState<ParishInfo | null>(null);
  const [schedule, setSchedule] = useState<MassSchedule>(DEFAULT_SCHEDULE);
  const [form, setForm] = useState<MassEntry>({ ...EMPTY_ENTRY });
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<MassEntry>({ ...EMPTY_ENTRY });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [aboutPhotoLoading, setAboutPhotoLoading] = useState(false);
  const aboutFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${API}/api/parish/`).then((r) => r.json()).then((data: ParishInfo) => {
      setInfo(data);
      setSchedule({ ...DEFAULT_SCHEDULE, ...(data.mass_schedule ?? {}) });
    });
  }, []);

  async function uploadAboutPhoto(file: File) {
    setAboutPhotoLoading(true);
    setError("");
    const token = getToken();
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`${API}/api/parish/about-photo/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "업로드에 실패했습니다.");
        return;
      }
      setInfo(data);
      await fetch("/api/revalidate?tag=parish", { method: "POST" });
    } finally {
      setAboutPhotoLoading(false);
    }
  }

  async function deleteAboutPhoto() {
    if (!confirm("성당 소개 사진을 삭제하시겠습니까? 기본 사진(yakhoun.jpg)으로 돌아갑니다.")) return;
    setAboutPhotoLoading(true);
    setError("");
    const token = getToken();
    try {
      const res = await fetch(`${API}/api/parish/about-photo`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "삭제에 실패했습니다.");
        return;
      }
      setInfo(data);
      await fetch("/api/revalidate?tag=parish", { method: "POST" });
    } finally {
      setAboutPhotoLoading(false);
    }
  }

  async function saveParish(newSchedule: MassSchedule) {
    setError(""); setLoading(true); setSaved(false);
    const token = getToken();
    try {
      const res = await fetch(`${API}/api/parish/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...info, mass_schedule: newSchedule }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || "저장에 실패했습니다."); return false; }
      setInfo(data);
      const updated = { ...DEFAULT_SCHEDULE, ...(data.mass_schedule ?? {}) };
      setSchedule(updated);
      // /info 페이지의 parish 캐시를 즉시 무효화한다
      await fetch("/api/revalidate?tag=parish", { method: "POST" });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      return true;
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true); setSaved(false);
    const token = getToken();
    try {
      const res = await fetch(`${API}/api/parish/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...info, mass_schedule: schedule }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || "저장에 실패했습니다."); return; }
      setInfo(data);
      setSchedule({ ...DEFAULT_SCHEDULE, ...(data.mass_schedule ?? {}) });
      await fetch("/api/revalidate?tag=parish", { method: "POST" });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setLoading(false);
    }
  }

  function addEntry() {
    if (!form.time.trim()) { setError("미사 시간을 입력해 주세요."); return; }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.time)) { setError("시간 형식이 올바르지 않습니다. (예: 07:00, 19:30)"); return; }
    setError("");
    const newEntries = [...schedule.entries, { ...form }];
    const newSchedule = { ...schedule, entries: newEntries };
    setSchedule(newSchedule);
    saveParish(newSchedule);
    setForm({ ...EMPTY_ENTRY });
  }

  function deleteEntry(idx: number) {
    const newEntries = schedule.entries.filter((_, i) => i !== idx);
    const newSchedule = { ...schedule, entries: newEntries };
    setSchedule(newSchedule);
    saveParish(newSchedule);
  }

  function startEdit(idx: number) {
    setEditIdx(idx);
    setEditForm({ ...schedule.entries[idx] });
  }

  function saveEdit() {
    if (!editForm.time.trim()) return;
    const newEntries = schedule.entries.map((e, i) => (i === editIdx ? { ...editForm } : e));
    const newSchedule = { ...schedule, entries: newEntries };
    setSchedule(newSchedule);
    saveParish(newSchedule);
    setEditIdx(null);
  }

  if (!info) return (
    <div className="p-8 flex items-center justify-center min-h-[60vh]">
      <p className="text-gray-500">불러오는 중...</p>
    </div>
  );

  const inputCls = "px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const sorted = sortedEntries(schedule.entries);
  const grouped = DAY_OPTIONS.filter((d) => sorted.some((e) => e.day === d));

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">성당 정보 관리</h1>
        <p className="text-sm text-gray-500 mt-1">미사 시간, 연락처, 성당 소개 사진을 관리합니다. 신부님·수녀님 정보는 좌측 메뉴 &quot;본당 가족&quot;에서 관리합니다.</p>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}
      {saved && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">저장되었습니다.</div>}

      <form onSubmit={handleSubmit} className="space-y-8">

        {/* 기본 정보 */}
        <section className="p-6 bg-white border border-gray-200 rounded-xl space-y-4">
          <h2 className="font-semibold text-gray-800 border-b border-gray-100 pb-3">기본 정보</h2>
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

        {/* 미사 시간 */}
        <section className="p-6 bg-white border border-gray-200 rounded-xl space-y-5">
          <div className="border-b border-gray-100 pb-3">
            <h2 className="font-semibold text-gray-800">미사 시간 등록</h2>
          </div>

          {/* 등록 폼 */}
          <div className="flex gap-2 items-center">
            <select
              value={form.day}
              onChange={(e) => setForm((p) => ({ ...p, day: e.target.value }))}
              className={`${inputCls} shrink-0`}
            >
              {DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <input
              type="text"
              value={form.time}
              onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))}
              className={`${inputCls} w-28 shrink-0`}
              placeholder="00:00"
              maxLength={5}
            />
            <input
              value={form.note}
              onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
              className={`${inputCls} flex-1`}
              placeholder="설명추가"
            />
            <button
              type="button"
              onClick={addEntry}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 shrink-0"
            >
              등록
            </button>
          </div>

          {/* 등록된 목록 */}
          {schedule.entries.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">등록된 미사 시간이 없습니다.</p>
          ) : (
            <div className="space-y-4">
              {grouped.map((day) => (
                <div key={day}>
                  <p className="text-xs font-semibold text-gray-500 mb-2">{day}</p>
                  <div className="space-y-1">
                    {sorted.filter((e) => e.day === day).map((entry) => {
                      const realIdx = schedule.entries.indexOf(entry);
                      return editIdx === realIdx ? (
                        <div key={realIdx} className="flex gap-2 items-center p-2 bg-blue-50 rounded-lg">
                          <select
                            value={editForm.day}
                            onChange={(e) => setEditForm((p) => ({ ...p, day: e.target.value }))}
                            className={`${inputCls} shrink-0`}
                          >
                            {DAY_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                          </select>
                          <input
                            type="text"
                            value={editForm.time}
                            onChange={(e) => setEditForm((p) => ({ ...p, time: e.target.value }))}
                            className={`${inputCls} w-28 shrink-0`}
                            placeholder="00:00"
                            maxLength={5}
                          />
                          <input
                            value={editForm.note}
                            onChange={(e) => setEditForm((p) => ({ ...p, note: e.target.value }))}
                            className={`${inputCls} flex-1`}
                            placeholder="설명추가"
                          />
                          <button type="button" onClick={saveEdit} disabled={loading} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">저장</button>
                          <button type="button" onClick={() => setEditIdx(null)} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">취소</button>
                        </div>
                      ) : (
                        <div key={realIdx} className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg">
                          <span className="text-sm font-medium w-14 shrink-0">{entry.time}</span>
                          <span className="text-sm text-gray-600 flex-1">{entry.note}</span>
                          <button type="button" onClick={() => startEdit(realIdx)} className="text-xs text-blue-500 hover:text-blue-700 shrink-0">수정</button>
                          <button type="button" onClick={() => deleteEntry(realIdx)} className="text-xs text-red-400 hover:text-red-600 shrink-0">삭제</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 안내 메모 */}
          <div>
            <label className="block text-sm font-medium mb-1">안내 메모</label>
            <input
              value={schedule.note}
              onChange={(e) => setSchedule((p) => ({ ...p, note: e.target.value }))}
              className={`w-full ${inputCls}`}
              placeholder="미사 시간은 변경될 수 있으니 사전에 확인하세요."
            />
          </div>
        </section>

        <div className="flex justify-end">
          <button type="submit" disabled={loading} className="px-8 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
            {loading ? "저장 중..." : "저장"}
          </button>
        </div>
      </form>

      {/* 성당 소개 사진 (/about 페이지) */}
      <section className="mt-8 p-6 bg-white border border-gray-200 rounded-xl space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <h2 className="font-semibold text-gray-800">성당 소개 사진</h2>
            <p className="text-xs text-gray-400 mt-0.5">/about 페이지 안내 옆에 표시됩니다. 등록하지 않으면 기본 사진(yakhoun.jpg)이 사용됩니다.</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => aboutFileInputRef.current?.click()}
              disabled={aboutPhotoLoading}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {aboutPhotoLoading ? "처리 중..." : info.about_photo_url ? "사진 변경" : "사진 등록"}
            </button>
            {info.about_photo_url && (
              <button
                type="button"
                onClick={deleteAboutPhoto}
                disabled={aboutPhotoLoading}
                className="px-4 py-2 border border-gray-300 text-sm text-gray-600 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                기본 사진으로
              </button>
            )}
          </div>
          <input
            ref={aboutFileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadAboutPhoto(file);
              e.target.value = "";
            }}
          />
        </div>

        <div className="flex items-start gap-4">
          <div className="relative w-64 aspect-[4/3] rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
            <img
              src={info.about_photo_url ? `${API}${info.about_photo_url}` : "/yakhoun.jpg"}
              alt="성당 소개 사진"
              className="w-full h-full object-cover"
              style={{ objectPosition: "center 30%" }}
            />
            {!info.about_photo_url && (
              <div className="absolute top-2 left-2 bg-gray-900/70 text-white text-xs px-2 py-0.5 rounded">
                기본 사진
              </div>
            )}
          </div>
          <div className="flex-1 text-sm text-gray-500 leading-relaxed pt-2">
            <p>이 사진은 <code className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">/about</code> 페이지 상단의 안내 영역 옆에 표시됩니다.</p>
            <p className="mt-1.5">권장 비율: <strong className="text-gray-700">4:3</strong> · 최대 10MB · JPG, PNG, WEBP, GIF</p>
          </div>
        </div>
      </section>
    </div>
  );
}
