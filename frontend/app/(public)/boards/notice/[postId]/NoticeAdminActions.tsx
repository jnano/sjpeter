"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** 공지사항 상세 — admin/운영자 전용 수정·삭제 액션. 권한 없으면 아무것도 렌더링 안 함. */
export default function NoticeAdminActions({ noticeId }: { noticeId: number }) {
  const router = useRouter();
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const t = localStorage.getItem("admin_token");
      const expStr = localStorage.getItem("admin_token_exp");
      const exp = expStr ? Number(expStr) : 0;
      if (t && exp && Date.now() < exp) setAdminToken(t);
    } catch {}
  }, []);

  if (!adminToken) return null;

  async function handleDelete() {
    if (!confirm("이 공지를 삭제하시겠습니까? 되돌릴 수 없습니다.")) return;
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/notices/${noticeId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.ok || res.status === 204) {
        router.push("/boards/notice");
      } else {
        alert("삭제 실패");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-xs">
      <span className="text-blue-700 font-medium">⚙ admin</span>
      <Link
        href={`/boards/notice/${noticeId}/edit`}
        className="px-3 py-1 rounded border border-blue-300 bg-white hover:bg-blue-100 text-blue-700"
      >
        수정
      </Link>
      <button
        type="button"
        onClick={handleDelete}
        disabled={busy}
        className="px-3 py-1 rounded border border-red-300 bg-white hover:bg-red-50 text-red-700 disabled:opacity-50"
      >
        {busy ? "삭제 중…" : "삭제"}
      </button>
    </div>
  );
}
