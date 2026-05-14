"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL;

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("유효하지 않은 링크입니다.");
      return;
    }
    fetch(`${API}/api/members/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setStatus("ok");
          setMessage(data.message || "이메일 인증이 완료되었습니다.");
        } else {
          setStatus("error");
          setMessage(data.detail || "인증에 실패했습니다.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("서버에 연결할 수 없습니다.");
      });
  }, [token]);

  if (status === "loading") {
    return <p className="text-center text-[var(--color-text-muted)] py-8">인증 처리 중...</p>;
  }

  if (status === "ok") {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center space-y-4">
        <div className="text-5xl">✅</div>
        <h2 className="text-xl font-bold text-green-800">인증 완료!</h2>
        <p className="text-sm text-green-700">{message}</p>
        <Link
          href="/members/me"
          className="inline-block mt-2 px-6 py-2.5 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          마이페이지로 이동
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center space-y-4">
      <div className="text-5xl">❌</div>
      <h2 className="text-xl font-bold text-red-800">인증 실패</h2>
      <p className="text-sm text-red-700">{message}</p>
      <Link
        href="/members/me"
        className="inline-block mt-2 px-5 py-2 border border-[var(--color-border)] text-sm rounded-lg hover:bg-gray-50 transition-colors"
      >
        마이페이지에서 재발송
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[var(--color-primary)]">이메일 인증</h1>
        </div>
        <Suspense fallback={<p className="text-center text-[var(--color-text-muted)] py-8">불러오는 중...</p>}>
          <VerifyEmailContent />
        </Suspense>
      </div>
    </div>
  );
}
