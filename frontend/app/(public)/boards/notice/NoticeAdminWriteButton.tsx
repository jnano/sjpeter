"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/** 공지사항 목록 상단 — admin/운영자에게만 "새 공지 작성" 버튼 노출. */
export default function NoticeAdminWriteButton() {
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    try {
      const t = localStorage.getItem("admin_token");
      const expStr = localStorage.getItem("admin_token_exp");
      const exp = expStr ? Number(expStr) : 0;
      if (t && exp && Date.now() < exp) setHasToken(true);
    } catch {}
  }, []);

  if (!hasToken) return null;

  return (
    <div className="flex justify-end mb-4">
      <Link
        href="/admin/notices"
        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100"
      >
        ⚙ admin · 공지 관리
      </Link>
    </div>
  );
}
