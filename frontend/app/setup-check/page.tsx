"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface CheckItem {
  label: string;
  value: string;
  status: "ok" | "warn" | "fail" | "info";
  detail?: string;
}

interface CheckResponse {
  items: CheckItem[];
  setup_completed: boolean;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; icon: string; label: string }> = {
  ok:   { bg: "bg-green-50",  text: "text-green-800",  border: "border-green-200",  icon: "✓", label: "충족" },
  warn: { bg: "bg-amber-50",  text: "text-amber-800",  border: "border-amber-200",  icon: "!", label: "권장 미달" },
  fail: { bg: "bg-red-50",    text: "text-red-800",    border: "border-red-200",    icon: "✗", label: "미충족" },
  info: { bg: "bg-gray-50",   text: "text-gray-700",   border: "border-gray-200",   icon: "·", label: "안내" },
};

export default function SetupCheckPage() {
  const [data, setData] = useState<CheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const res = await fetch(`${API}/api/setup/system-check`, { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} — backend 가 실행 중이고 도달 가능한지 확인하세요.`);
        }
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "알 수 없는 오류");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, []);

  const failCount = data?.items.filter((i) => i.status === "fail").length ?? 0;
  const warnCount = data?.items.filter((i) => i.status === "warn").length ?? 0;
  const okCount = data?.items.filter((i) => i.status === "ok").length ?? 0;

  return (
    <div className="min-h-screen bg-[var(--color-surface-warm)]">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[var(--color-primary)]">서버 설치 점검</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            본당 홈페이지 시스템이 설치된 서버의 환경을 자가진단합니다.
            <br />
            다른 본당이 호스팅 서버에 처음 설치한 직후, 운영 준비가 되었는지 확인하세요.
          </p>
        </div>

        {/* 최소사양 요약 */}
        <details className="bg-white border border-[var(--color-border)] rounded-xl p-6 mb-6">
          <summary className="cursor-pointer font-bold text-[var(--color-primary)]">
            📋 시스템 최소사양 (펼쳐 보기)
          </summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
            <div>
              <h3 className="font-semibold mb-2">최소</h3>
              <ul className="space-y-1 text-[var(--color-text-muted)]">
                <li>• Python 3.11+</li>
                <li>• PostgreSQL 13+</li>
                <li>• Node.js 22+ (Next.js 15)</li>
                <li>• RAM 1GB</li>
                <li>• 디스크 여유 2GB</li>
                <li>• Linux/macOS (Ubuntu 22.04+ 권장)</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">권장 (운영)</h3>
              <ul className="space-y-1 text-[var(--color-text-muted)]">
                <li>• Python 3.11+</li>
                <li>• PostgreSQL 15+</li>
                <li>• Node.js 22+</li>
                <li>• RAM 2GB+</li>
                <li>• 디스크 여유 5GB+</li>
                <li>• Ubuntu 22.04 LTS · Debian 12</li>
              </ul>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
            <p className="mb-1">
              <strong>외부 서비스 (모두 선택)</strong> — admin/settings 에서 키 입력 시 활성화:
            </p>
            <ul className="space-y-0.5 pl-3">
              <li>• AWS Bedrock (Claude AI): 주보 PDF 자동 추출·분류</li>
              <li>• SMTP: 비밀번호 재설정·주보 알림 메일 발송</li>
              <li>• Google·Kakao OAuth: 소셜 로그인</li>
              <li>• 카카오맵 API: 오시는 길 지도</li>
            </ul>
          </div>
        </details>

        {/* 진단 결과 */}
        {loading && (
          <div className="bg-white border border-[var(--color-border)] rounded-xl p-12 text-center text-[var(--color-text-muted)]">
            진단 중…
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-sm text-red-800">
            <p className="font-bold mb-2">❌ 진단 API 호출 실패</p>
            <p>{error}</p>
            <p className="mt-3 text-xs">
              <code className="bg-white px-2 py-1 rounded">cd backend && uvicorn main:app --reload</code>
              {" 로 백엔드를 실행 중인지 확인하세요."}
            </p>
          </div>
        )}

        {data && (
          <>
            {/* 요약 카드 */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <SummaryCard count={okCount} label="충족" color="green" />
              <SummaryCard count={warnCount} label="권장 미달" color="amber" />
              <SummaryCard count={failCount} label="미충족" color="red" />
            </div>

            {failCount === 0 && warnCount === 0 ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-6">
                <p className="font-bold text-green-800">✅ 모든 항목이 권장사양을 충족합니다</p>
                <p className="text-sm text-green-700 mt-1">
                  바로 운영을 시작할 수 있습니다.{" "}
                  {!data.setup_completed && (
                    <>
                      먼저{" "}
                      <Link href="/setup" className="underline font-medium">
                        첫 관리자 등록
                      </Link>
                      을 진행하세요.
                    </>
                  )}
                </p>
              </div>
            ) : failCount > 0 ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-6">
                <p className="font-bold text-red-800">❌ 미충족 항목이 있어 운영 시작 전 조치가 필요합니다</p>
                <p className="text-sm text-red-700 mt-1">
                  아래 ✗ 표시된 항목을 해결하세요. 각 항목의 상세 메시지를 참고하시면 됩니다.
                </p>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
                <p className="font-bold text-amber-800">⚠ 권장 미달 항목이 있습니다</p>
                <p className="text-sm text-amber-700 mt-1">
                  운영은 가능하지만 안정성·성능을 위해 검토를 권장합니다.
                </p>
              </div>
            )}

            {/* 항목 리스트 */}
            <div className="bg-white border border-[var(--color-border)] rounded-xl overflow-hidden">
              {data.items.map((item, idx) => {
                const s = STATUS_STYLES[item.status];
                return (
                  <div
                    key={idx}
                    className={`flex items-start gap-3 px-5 py-4 ${
                      idx > 0 ? "border-t border-[var(--color-border)]" : ""
                    }`}
                  >
                    <span
                      className={`shrink-0 w-7 h-7 rounded-full ${s.bg} ${s.text} ${s.border} border flex items-center justify-center font-bold text-sm`}
                      aria-hidden
                    >
                      {s.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="font-medium text-[var(--color-text)]">{item.label}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${s.bg} ${s.text}`}>{s.label}</span>
                      </div>
                      <p className="text-sm text-[var(--color-text-muted)] mt-0.5 font-mono">{item.value}</p>
                      {item.detail && (
                        <p className="text-xs text-[var(--color-text-muted)] mt-1.5 leading-relaxed">
                          {item.detail}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 다음 단계 안내 */}
            <div className="mt-8 bg-white border border-[var(--color-border)] rounded-xl p-6">
              <h2 className="font-bold text-[var(--color-primary)] mb-3">다음 단계</h2>
              <ol className="list-decimal pl-5 space-y-2 text-sm">
                {!data.setup_completed && (
                  <li>
                    <Link href="/setup" className="text-[var(--color-primary)] font-medium hover:underline">
                      /setup
                    </Link>{" "}
                    페이지에서 첫 관리자 계정·본당 정보를 등록합니다.
                  </li>
                )}
                <li>
                  관리자 로그인 후{" "}
                  <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">/admin/settings</code> 에서 외부
                  키(SMTP·OAuth·AWS·KAKAO_MAP)를 입력합니다. <span className="text-[var(--color-text-muted)]">선택 기능별로 필요한 키만 입력하면 됩니다.</span>
                </li>
                <li>
                  <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">/admin/pages</code> 에서 이용약관·개인정보 처리방침 본문을 본당 운영 정책에 맞게 검수·수정합니다.
                </li>
                <li>
                  <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">/admin/parish</code> 에서 본당 정보·미사 시간을 입력합니다.
                </li>
                <li>
                  운영 도메인이 정해졌다면 <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">backend/.env</code> 의 <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">CORS_ORIGINS</code> 에 추가하고 backend 를 재기동합니다.
                </li>
                <li>
                  <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">backend/.env</code> 의{" "}
                  <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">SECRET_KEY</code> ·
                  <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">INTERNAL_API_SECRET</code> 를{" "}
                  <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">openssl rand -hex 32</code>{" "}
                  결과로 교체합니다. (운영 시작 전 반드시)
                </li>
              </ol>
            </div>

            {/* 푸터 */}
            <div className="mt-8 text-center text-xs text-[var(--color-text-muted)] space-x-4">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="hover:text-[var(--color-primary)] transition-colors underline"
              >
                다시 진단
              </button>
              <Link href="/" className="hover:text-[var(--color-primary)] transition-colors">
                홈으로
              </Link>
              {!data.setup_completed && (
                <Link href="/setup" className="hover:text-[var(--color-primary)] transition-colors">
                  setup 시작
                </Link>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ count, label, color }: { count: number; label: string; color: "green" | "amber" | "red" }) {
  const colorMap = {
    green: "bg-green-50 border-green-200 text-green-800",
    amber: "bg-amber-50 border-amber-200 text-amber-800",
    red: "bg-red-50 border-red-200 text-red-800",
  };
  return (
    <div className={`rounded-xl border p-4 text-center ${colorMap[color]}`}>
      <p className="text-3xl font-bold">{count}</p>
      <p className="text-xs mt-1">{label}</p>
    </div>
  );
}
