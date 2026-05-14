"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DataEvent, notify } from "@/components/dataEvents";

const API = "http://localhost:8000";

const LITURGICAL_SEASONS = [
  "대림 제1주일", "대림 제2주일", "대림 제3주일", "대림 제4주일",
  "주님 성탄 대축일", "주님 성탄 후 주일",
  "주님 공현 대축일", "주님 세례 축일",
  "연중 제2주일", "연중 제3주일", "연중 제4주일", "연중 제5주일",
  "재의 수요일", "사순 제1주일", "사순 제2주일", "사순 제3주일", "사순 제4주일", "사순 제5주일",
  "성지 주일", "성목요일", "성금요일", "성토요일",
  "부활 대축일", "부활 제2주일", "부활 제3주일", "부활 제4주일", "부활 제5주일", "부활 제6주일",
  "주님 승천 대축일", "성령 강림 대축일",
  "삼위일체 대축일", "그리스도의 성체 성혈 대축일",
];

export default function NewBulletinPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    published_date: new Date().toISOString().split("T")[0],
    issue_number: "",
    liturgical_season: "",
    gospel_reference: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fetchingGospel, setFetchingGospel] = useState(false);
  const [gospelFetchMsg, setGospelFetchMsg] = useState("");
  const [error, setError] = useState("");
  const [uploadedId, setUploadedId] = useState<number | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<"analyzing" | "done" | "timeout">("analyzing");
  const [extractionCount, setExtractionCount] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!uploadedId) return;
    setAnalysisStatus("analyzing");
    let attempts = 0;
    const maxAttempts = 40; // 40 × 3s = 2분
    const token = localStorage.getItem("admin_token");

    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`${API}/api/bulletins/${uploadedId}/extractions`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.length > 0) {
            setExtractionCount(data.length);
            setAnalysisStatus("done");
            clearInterval(pollRef.current!);
            notify(DataEvent.DRAFTS_COUNT);  // AI 추출 결과가 일부 drafts로 저장됨
            return;
          }
        }
      } catch { /* ignore */ }
      if (attempts >= maxAttempts) {
        setAnalysisStatus("timeout");
        clearInterval(pollRef.current!);
      }
    }, 3000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [uploadedId]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function fetchGospel() {
    if (!form.published_date) return;
    setFetchingGospel(true);
    setGospelFetchMsg("");
    try {
      const res = await fetch(`${API}/api/gospel?date=${form.published_date}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "복음 구절 가져오기 실패");

      const { gospel_reference, liturgical_season } = data.data;
      // 드롭다운 목록에서 가장 가까운 시기를 찾는다 (예: "부활 제3주일(생명 주일)" → "부활 제3주일")
      const matchedSeason = liturgical_season
        ? (LITURGICAL_SEASONS.find((s) => liturgical_season.includes(s)) ?? "")
        : "";
      setForm((prev) => ({
        ...prev,
        ...(gospel_reference ? { gospel_reference } : {}),
        ...(matchedSeason && !prev.liturgical_season ? { liturgical_season: matchedSeason } : {}),
      }));
      setGospelFetchMsg(
        gospel_reference ? "복음 구절을 가져왔습니다." : "해당 날짜의 복음 구절을 찾지 못했습니다."
      );
    } catch (err) {
      setGospelFetchMsg(err instanceof Error ? err.message : "가져오기에 실패했습니다.");
    } finally {
      setFetchingGospel(false);
    }
  }

  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    handleChange(e);
    setGospelFetchMsg("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError("PDF 파일을 선택해 주세요."); return; }

    const token = localStorage.getItem("admin_token");
    if (!token) { router.push("/admin"); return; }

    setError("");
    setUploading(true);

    try {
      const fd = new FormData();
      fd.append("published_date", form.published_date);
      fd.append("pdf_file", file);
      if (form.issue_number) fd.append("issue_number", form.issue_number);
      if (form.liturgical_season) fd.append("liturgical_season", form.liturgical_season);
      if (form.gospel_reference) fd.append("gospel_reference", form.gospel_reference);

      const res = await fetch(`${API}/api/bulletins/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail ?? "업로드 실패");
      }

      const data = await res.json();
      await fetch("/api/revalidate", { method: "POST" });
      setUploadedId(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "업로드에 실패했습니다.");
    } finally {
      setUploading(false);
    }
  }


  return (
    <div className="min-h-screen bg-[var(--color-surface-warm)]">
      {/* 관리자 헤더 */}
      <div className="bg-[var(--color-primary)] text-white px-6 py-4 flex items-center gap-4">
        <Link href="/admin/dashboard" className="text-white/70 hover:text-white text-sm transition-colors">
          ← 대시보드
        </Link>
        <span className="text-white/30">|</span>
        <span className="font-serif font-bold">새 주보 등록</span>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <form
          onSubmit={handleSubmit}
          className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-8 space-y-5"
        >
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* PDF 파일 */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              주보 PDF <span className="text-red-500">*</span>
            </label>
            <div
              className="border-2 border-dashed border-[var(--color-border)] rounded-xl p-8 text-center cursor-pointer hover:border-[var(--color-primary)] transition-colors"
              onClick={() => document.getElementById("pdf-input")?.click()}
            >
              {file ? (
                <div>
                  <p className="text-[var(--color-primary)] font-medium">{file.name}</p>
                  <p className="text-sm text-[var(--color-text-muted)] mt-1">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-3xl mb-2">📄</p>
                  <p className="text-[var(--color-text-muted)] text-sm">
                    클릭하여 PDF 파일 선택
                  </p>
                </div>
              )}
            </div>
            <input
              id="pdf-input"
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {/* 발행일 */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              발행일 <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                name="published_date"
                value={form.published_date}
                onChange={handleDateChange}
                required
                className="flex-1 border border-[var(--color-border)] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--color-primary)]"
              />
              <button
                type="button"
                onClick={fetchGospel}
                disabled={fetchingGospel || !form.published_date}
                className="shrink-0 border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white disabled:opacity-40 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors"
              >
                {fetchingGospel ? "가져오는 중…" : "복음 구절 가져오기"}
              </button>
            </div>
            {gospelFetchMsg && (
              <p className={`text-xs mt-1.5 ${gospelFetchMsg.includes("못했") || gospelFetchMsg.includes("실패") ? "text-amber-600" : "text-green-600"}`}>
                {gospelFetchMsg}
              </p>
            )}
          </div>

          {/* 호수 */}
          <div>
            <label className="block text-sm font-medium mb-1.5">호수</label>
            <input
              type="number"
              name="issue_number"
              value={form.issue_number}
              onChange={handleChange}
              placeholder="예: 623"
              className="w-full border border-[var(--color-border)] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>

          {/* 전례 시기 */}
          <div>
            <label className="block text-sm font-medium mb-1.5">전례 시기</label>
            <select
              name="liturgical_season"
              value={form.liturgical_season}
              onChange={handleChange}
              className="w-full border border-[var(--color-border)] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--color-primary)] bg-white"
            >
              <option value="">선택 (선택사항)</option>
              {LITURGICAL_SEASONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* 복음 구절 */}
          <div>
            <label className="block text-sm font-medium mb-1.5">복음 구절</label>
            <input
              type="text"
              name="gospel_reference"
              value={form.gospel_reference}
              onChange={handleChange}
              placeholder="예: 요한 15,1-8  (발행일 옆 버튼으로 자동 입력 가능)"
              className="w-full border border-[var(--color-border)] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>

          {uploadedId ? (
            <div className="space-y-3 pt-2">
              <div className="bg-green-50 border border-green-200 text-green-800 text-sm px-4 py-3 rounded-lg text-center">
                <p className="font-medium">주보가 등록되었습니다.</p>
              </div>

              {/* 분석 진행 상태 */}
              {analysisStatus === "analyzing" && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-1.5">
                    <div className="w-4 h-4 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
                    <span className="text-amber-800 font-medium text-sm">AI 분석 중…</span>
                  </div>
                  <p className="text-xs text-amber-700">스캔 PDF는 Vision 분석을 거쳐 1~2분 소요됩니다.</p>
                </div>
              )}
              {analysisStatus === "done" && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-4 text-center">
                  <p className="text-blue-800 font-medium text-sm">분석 완료 — {extractionCount}건 추출됨</p>
                  <p className="text-xs text-blue-700 mt-1">임시저장 게시글을 검토한 후 게시해 주세요.</p>
                </div>
              )}
              {analysisStatus === "timeout" && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-center">
                  <p className="text-slate-600 text-sm">분석이 진행 중입니다. 임시저장에서 결과를 확인해 주세요.</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => router.push("/admin/bulletin")}
                  className="flex-1 border border-[var(--color-border)] hover:bg-[var(--color-surface-warm)] py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  주보 목록
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/admin/drafts")}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    analysisStatus === "done"
                      ? "bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white"
                      : "border border-[var(--color-border)] hover:bg-[var(--color-surface-warm)]"
                  }`}
                >
                  임시저장 확인{analysisStatus === "done" ? ` (${extractionCount})` : ""}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3 pt-2">
              <Link
                href="/admin/dashboard"
                className="flex-1 text-center border border-[var(--color-border)] hover:bg-[var(--color-surface-warm)] py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                취소
              </Link>
              <button
                type="submit"
                disabled={uploading}
                className="flex-1 bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] disabled:opacity-60 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                {uploading ? "업로드 중…" : "주보 등록"}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
