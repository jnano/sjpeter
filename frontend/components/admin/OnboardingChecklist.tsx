"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL;

interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
  href: string;
  optional: boolean;
  hint: string;
}

interface ChecklistResponse {
  items: ChecklistItem[];
  all_done: boolean;
}

/** admin 대시보드 첫 운영 가이드 — 필수 항목 모두 완료되면 카드 자체가 사라짐. */
export default function OnboardingChecklist() {
  const [data, setData] = useState<ChecklistResponse | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) return;
    fetch(`${API}/api/admin/onboarding/checklist`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data || data.all_done) return null;

  const requiredDone = data.items.filter((it) => !it.optional && it.done).length;
  const requiredTotal = data.items.filter((it) => !it.optional).length;

  return (
    <div className="mb-6 p-5 bg-blue-50 border border-blue-200 rounded-xl">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">📋</span>
        <h2 className="text-sm font-bold text-blue-900">사이트 운영 시작 가이드</h2>
        <span className="text-xs text-blue-700 ml-auto">
          {requiredDone} / {requiredTotal} 완료
        </span>
      </div>
      <p className="text-xs text-blue-800 mb-4">
        본당 신자와 방문자가 사이트를 잘 쓸 수 있도록 다음 항목을 채워 주세요.
        모두 완료되면 이 안내는 자동으로 사라집니다.
      </p>
      <ul className="space-y-2">
        {data.items.map((it) => (
          <li key={it.key}>
            <Link
              href={it.href}
              className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                it.done
                  ? "border-green-200 bg-green-50 hover:bg-green-100"
                  : "border-blue-100 bg-white hover:bg-blue-100/50"
              }`}
            >
              <span
                className={`mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
                  it.done
                    ? "bg-green-500 text-white"
                    : "bg-white border border-blue-300 text-blue-400"
                }`}
                aria-hidden
              >
                {it.done ? "✓" : ""}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-medium ${
                      it.done ? "text-green-900 line-through opacity-70" : "text-blue-900"
                    }`}
                  >
                    {it.label}
                  </span>
                  {it.optional && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">
                      선택
                    </span>
                  )}
                </div>
                {it.hint && (
                  <p className={`text-xs mt-0.5 ${it.done ? "text-green-700/70" : "text-blue-700/80"}`}>
                    {it.hint}
                  </p>
                )}
              </div>
              <span className="text-xs text-blue-500 self-center shrink-0">
                {it.done ? "" : "→"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
