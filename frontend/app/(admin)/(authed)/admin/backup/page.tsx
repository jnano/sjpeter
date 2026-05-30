"use client";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface BackupFile {
  name: string;
  size: number;
  created_at: string;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR");
}

export default function AdminBackupPage() {
  const [files, setFiles] = useState<BackupFile[]>([]);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState("");
  const [loadingList, setLoadingList] = useState(true);

  function token() {
    return typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
  }

  async function loadList() {
    setLoadingList(true);
    try {
      const r = await fetch(`${API}/api/admin/backup/list`, {
        headers: { Authorization: `Bearer ${token() ?? ""}` },
      });
      if (r.ok) {
        const data = await r.json();
        setFiles(data.files ?? []);
      }
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => { loadList(); }, []);

  async function runBackup() {
    if (!confirm("지금 백업을 만듭니다. DB + 업로드 파일을 묶어 다운로드합니다 (최대 5분).")) return;
    setRunning(true);
    setMsg("백업 생성 중… 잠시 기다려 주세요.");
    try {
      const r = await fetch(`${API}/api/admin/backup/run`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token() ?? ""}` },
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        setMsg(`실패: ${err.detail ?? r.status}`);
        return;
      }
      // 다운로드 처리
      const blob = await r.blob();
      const dispo = r.headers.get("content-disposition") ?? "";
      const m = dispo.match(/filename="([^"]+)"/);
      const filename = m?.[1] ?? `backup_${Date.now()}.tar.gz`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      setMsg(`완료: ${filename} 다운로드됨`);
      loadList();
    } catch (e) {
      setMsg(`예외: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">백업</h1>
        <p className="text-sm text-gray-500 mt-1">
          DB + uploads 전체를 tar.gz 로 묶어 다운로드합니다. backups/ 디렉토리에도 영구 보존됩니다.
        </p>
      </div>

      <section className="p-5 bg-white border border-gray-200 rounded-xl mb-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">지금 백업 만들기</h2>
            <p className="text-xs text-gray-500 mt-1">
              안전한 시점(접속자 적은 시간)에 권장. 평균 30초 ~ 3분 소요.
            </p>
          </div>
          <button
            type="button"
            onClick={runBackup}
            disabled={running}
            className="px-5 py-2.5 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {running ? "생성 중…" : "백업 만들기"}
          </button>
        </div>
        {msg && (
          <p className={`mt-3 text-sm px-3 py-2 rounded-lg ${
            msg.startsWith("완료") ? "bg-green-50 text-green-700 border border-green-200" :
            msg.startsWith("실패") || msg.startsWith("예외") ? "bg-red-50 text-red-700 border border-red-200" :
            "bg-blue-50 text-blue-700 border border-blue-200"
          }`}>
            {msg}
          </p>
        )}
      </section>

      <section className="p-5 bg-white border border-gray-200 rounded-xl">
        <h2 className="font-semibold mb-3">과거 백업 ({files.length}개)</h2>
        {loadingList ? (
          <p className="text-sm text-gray-500 text-center py-6">불러오는 중…</p>
        ) : files.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">백업 파일이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {files.map((f) => (
              <li key={f.name} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-sm text-gray-800 truncate">{f.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {fmtDate(f.created_at)} · {fmtSize(f.size)}
                  </p>
                </div>
                <span className="text-xs text-gray-400 shrink-0">
                  backups/{f.name}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-gray-400 mt-4 leading-relaxed">
          ⓘ 과거 백업 파일은 서버 디스크의 <code>backend/backups/</code> 에 저장됩니다.
          정기 백업이 필요하면 OS cron 으로 이 endpoint(POST /api/admin/backup/run)를 호출하거나
          <code>pg_dump</code> 를 직접 cron 에 등록하세요.
        </p>
      </section>
    </div>
  );
}
