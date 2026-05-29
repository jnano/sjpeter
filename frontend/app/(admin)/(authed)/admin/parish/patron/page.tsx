"use client";
import { useEffect, useRef, useState } from "react";
import { formatErrorDetail } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL;

interface PatronInfo {
  patron_name: string | null;
  patron_feast_day: string | null;
  patron_intro: string | null;
  patron_quote: string | null;
  patron_quote_ref: string | null;
  patron_image_url: string | null;
}

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("admin_token");
}

export default function AdminParishPatronPage() {
  const [info, setInfo] = useState<PatronInfo>({
    patron_name: "",
    patron_feast_day: "",
    patron_intro: "",
    patron_quote: "",
    patron_quote_ref: "",
    patron_image_url: null,
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [photoLoading, setPhotoLoading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${API}/api/parish/`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setInfo({
            patron_name: d.patron_name ?? "",
            patron_feast_day: d.patron_feast_day ?? "",
            patron_intro: d.patron_intro ?? "",
            patron_quote: d.patron_quote ?? "",
            patron_quote_ref: d.patron_quote_ref ?? "",
            patron_image_url: d.patron_image_url ?? null,
          });
        }
      });
  }, []);

  function field<K extends keyof PatronInfo>(k: K, v: PatronInfo[K]) {
    setInfo((prev) => ({ ...prev, [k]: v }));
  }

  async function handleSave() {
    setLoading(true);
    setSaved(false);
    setError("");
    try {
      const token = getToken();
      const res = await fetch(`${API}/api/parish/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          patron_name: info.patron_name || null,
          patron_feast_day: info.patron_feast_day || null,
          patron_intro: info.patron_intro || null,
          patron_quote: info.patron_quote || null,
          patron_quote_ref: info.patron_quote_ref || null,
        }),
      });
      if (!res.ok) throw new Error(await formatErrorDetail(res, "저장에 실패했습니다."));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoLoading(true);
    setError("");
    try {
      const token = getToken();
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API}/api/parish/patron-photo/upload`, {
        method: "POST",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: fd,
      });
      if (!res.ok) throw new Error(await formatErrorDetail(res, "업로드 실패"));
      const d = await res.json();
      setInfo((prev) => ({ ...prev, patron_image_url: d.patron_image_url }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "업로드 실패");
    } finally {
      setPhotoLoading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  async function handleDeletePhoto() {
    if (!confirm("사진을 삭제하시겠습니까?")) return;
    setPhotoLoading(true);
    setError("");
    try {
      const token = getToken();
      const res = await fetch(`${API}/api/parish/patron-photo`, {
        method: "DELETE",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error(await formatErrorDetail(res, "삭제 실패"));
      setInfo((prev) => ({ ...prev, patron_image_url: null }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제 실패");
    } finally {
      setPhotoLoading(false);
    }
  }

  const photoUrl = info.patron_image_url
    ? (info.patron_image_url.startsWith("http") ? info.patron_image_url : `${API}${info.patron_image_url}`)
    : null;

  return (
    <div className="p-6 sm:p-8 max-w-3xl mx-auto">
      <header className="mb-7">
        <h1 className="text-2xl font-bold tracking-tight">수호 성인</h1>
        <p className="text-sm text-gray-500 mt-1">
          본당이 모시는 수호 성인의 이름·축일·소개를 입력합니다. 공개 페이지 <code className="px-1 py-0.5 bg-gray-100 rounded">/patron</code> 에 표시됩니다.
        </p>
      </header>

      {error && (
        <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}
      {saved && (
        <p className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">저장되었습니다.</p>
      )}

      <div className="space-y-5">
        {/* 사진 업로드 */}
        <section className="bg-white border border-gray-200 rounded-2xl p-5">
          <h2 className="text-[13px] tracking-[0.12em] uppercase font-bold text-[var(--color-primary)] mb-3">성인 이미지</h2>
          <div className="flex items-start gap-4">
            <div className="w-28 h-36 sm:w-32 sm:h-40 rounded-xl overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center shrink-0">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt="patron" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl text-gray-300">✠</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 mb-3">JPG/PNG/WEBP, 최대 10MB. 빈 자리는 공개 페이지에서 십자가 아이콘으로 대체됩니다.</p>
              <input ref={photoInputRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" id="patron-photo-input" />
              <div className="flex gap-2">
                <label htmlFor="patron-photo-input" className="px-3 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium cursor-pointer hover:opacity-90">
                  {photoLoading ? "업로드 중…" : photoUrl ? "사진 변경" : "사진 업로드"}
                </label>
                {photoUrl && (
                  <button type="button" onClick={handleDeletePhoto} disabled={photoLoading} className="px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-40">
                    사진 제거
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 텍스트 필드 */}
        <section className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
          <h2 className="text-[13px] tracking-[0.12em] uppercase font-bold text-[var(--color-primary)]">기본 정보</h2>

          <Field label="성인 이름" required>
            <input
              type="text" value={info.patron_name ?? ""}
              onChange={(e) => field("patron_name", e.target.value)}
              placeholder="예: 성 베드로 사도"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </Field>

          <Field label="축일">
            <input
              type="text" value={info.patron_feast_day ?? ""}
              onChange={(e) => field("patron_feast_day", e.target.value)}
              placeholder="예: 6월 29일"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </Field>

          <Field label="대표 인용문" hint="여러 줄 입력 가능. 공개 페이지의 hero 큰 인용에 표시.">
            <textarea
              value={info.patron_quote ?? ""}
              onChange={(e) => field("patron_quote", e.target.value)}
              placeholder='예: "너는 베드로이다. 나는 이 반석 위에 내 교회를 세우겠다."'
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm leading-relaxed"
            />
          </Field>

          <Field label="인용 출처" hint="복음·서간 출처를 짧게.">
            <input
              type="text" value={info.patron_quote_ref ?? ""}
              onChange={(e) => field("patron_quote_ref", e.target.value)}
              placeholder="예: 마태 16,18"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </Field>

          <Field label="생애·소개" hint="빈 줄 두 번으로 단락 구분.">
            <textarea
              value={info.patron_intro ?? ""}
              onChange={(e) => field("patron_intro", e.target.value)}
              placeholder="시몬 베드로는 갈릴래아 호숫가의 어부였습니다…"
              rows={10}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm leading-relaxed"
            />
          </Field>
        </section>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-5 py-2.5 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40"
          >
            {loading ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
        {hint && <span className="ml-2 text-[11px] font-normal text-gray-400">{hint}</span>}
      </label>
      {children}
    </div>
  );
}
