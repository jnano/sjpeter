"use client";

import { useEffect } from "react";
import Link from "next/link";
import CrossIcon from "@/components/icons/CrossIcon";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <div className="mb-6">
        <CrossIcon className="text-[var(--color-accent)] text-5xl" />
      </div>
      <p className="text-8xl font-bold text-[var(--color-primary)]/10 select-none leading-none mb-2">
        오류
      </p>
      <h1 className="font-serif text-2xl font-bold text-[var(--color-primary)] mb-3">
        문제가 발생했습니다
      </h1>
      <p className="text-sm text-[var(--color-text-muted)] max-w-sm mb-8 leading-relaxed">
        일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="px-6 py-2.5 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          다시 시도
        </button>
        <Link
          href="/"
          className="px-6 py-2.5 border border-[var(--color-border)] text-[var(--color-text-muted)] text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          홈으로
        </Link>
      </div>
    </div>
  );
}
