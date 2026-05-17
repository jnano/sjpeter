"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";

const API = process.env.NEXT_PUBLIC_API_URL;

interface MeData {
  nickname?: string;
  email?: string;
}

function ReportFormInner() {
  const search = useSearchParams();
  const { data: session } = useSession();

  const [me, setMe] = useState<MeData | null>(null);
  const [content, setContent] = useState("");
  const [reporterName, setReporterName] = useState("");
  const [reporterEmail, setReporterEmail] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  // ?ref= 또는 document.referrer 로 신고 발생 페이지 자동 수집
  useEffect(() => {
    const ref = search?.get("ref");
    if (ref) {
      setPageUrl(ref);
      return;
    }
    if (typeof window !== "undefined" && document.referrer) {
      try {
        const ru = new URL(document.referrer);
        if (ru.origin === window.location.origin) setPageUrl(ru.pathname + ru.search);
      } catch {}
    }
  }, [search]);

  // 로그인 회원이면 이름/이메일 자동 채움
  useEffect(() => {
    if (!session?.accessToken) return;
    fetch(`${API}/api/members/me`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: MeData | null) => {
        if (!d) return;
        setMe(d);
        setReporterName(d.nickname ?? "");
        setReporterEmail(d.email ?? "");
      })
      .catch(() => {});
  }, [session?.accessToken]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!content.trim()) {
      setError("신고 내용을 입력해 주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
      const body: Record<string, unknown> = {
        content: content.trim(),
        page_url: pageUrl || null,
      };
      // 비회원만 이름·이메일을 직접 전달. 회원은 백엔드가 세션에서 가져옴.
      if (!session) {
        body.reporter_name = reporterName.trim() || null;
        body.reporter_email = reporterEmail.trim() || null;
      }
      const res = await fetch(`${API}/api/reports`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? "신고 등록에 실패했습니다.");
        return;
      }
      setDone(true);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="max-w-xl mx-auto text-center py-16">
        <p className="text-5xl mb-4">✅</p>
        <h2 className="text-xl font-bold text-[var(--color-primary)] mb-2">신고가 접수되었습니다</h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-8">
          확인 후 빠르게 처리하겠습니다. 협조해 주셔서 감사합니다.
        </p>
        <div className="flex justify-center gap-2">
          <Link
            href="/"
            className="px-5 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
          >
            홈으로
          </Link>
          <button
            type="button"
            onClick={() => { setDone(false); setContent(""); }}
            className="px-5 py-2 border border-[var(--color-border)] text-sm rounded-lg hover:bg-[var(--color-surface-warm)] transition-colors"
          >
            추가 신고
          </button>
        </div>
      </div>
    );
  }

  const inputClass =
    "w-full px-3 py-2 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] text-sm";

  return (
    <form onSubmit={handleSubmit} className="max-w-xl mx-auto space-y-4">
      {error && (
        <p className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </p>
      )}

      {/* 신고자 정보 — 회원이면 자동 채움 + readonly, 비회원이면 직접 입력 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase mb-1.5">
            이름 / 세례명 <span className="text-[var(--color-text-muted)] font-normal normal-case">(선택)</span>
          </label>
          <input
            type="text"
            value={reporterName}
            onChange={(e) => setReporterName(e.target.value)}
            readOnly={!!session}
            className={`${inputClass} ${session ? "bg-[var(--color-surface-warm)] cursor-not-allowed" : ""}`}
            placeholder={session ? "" : "선택"}
            maxLength={80}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase mb-1.5">
            이메일 <span className="text-[var(--color-text-muted)] font-normal normal-case">(답변 받으시려면 입력)</span>
          </label>
          <input
            type="email"
            value={reporterEmail}
            onChange={(e) => setReporterEmail(e.target.value)}
            readOnly={!!session}
            className={`${inputClass} ${session ? "bg-[var(--color-surface-warm)] cursor-not-allowed" : ""}`}
            placeholder={session ? "" : "example@email.com"}
            maxLength={200}
          />
        </div>
      </div>
      {session && (
        <p className="text-xs text-[var(--color-text-muted)] -mt-2">
          로그인 회원의 이름·이메일은 프로필 정보가 사용됩니다.
        </p>
      )}
      {!session && (
        <p className="text-xs text-[var(--color-text-muted)] -mt-2">
          비회원도 신고 가능합니다. 이메일을 남겨주시면 처리 결과를 받아보실 수 있습니다.
        </p>
      )}

      {/* 발생 페이지 URL — 자동 수집 (사용자에게는 안 보임, 폼 제출 시 함께 전송) */}
      <input type="hidden" name="page_url" value={pageUrl} />

      {/* 내용 */}
      <div>
        <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase mb-1.5">
          신고 내용 <span className="text-red-400 normal-case">*</span>
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          rows={6}
          className={inputClass}
          placeholder="언제, 어떤 화면에서, 무엇을 하다 어떤 문제가 발생했는지 적어 주세요. 예) 주보 PDF를 클릭했는데 다운로드가 안 됩니다."
          maxLength={5000}
        />
        <p className="mt-1 text-xs text-[var(--color-text-muted)] text-right">
          {content.length}/5000
        </p>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 bg-[var(--color-primary)] text-white font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50"
      >
        {submitting ? "전송 중..." : "신고 보내기"}
      </button>
    </form>
  );
}

export default function ReportPage() {
  return (
    <>
      <PageHeader
        group="알림과 게시판"
        title="장애 신고"
        subtitle="홈페이지 이용 중 오류·불편을 알려주세요. 운영자가 확인 후 처리합니다."
      />
      <SectionLayout autoHero={false}>
        <Suspense fallback={<p className="text-center py-12 text-[var(--color-text-muted)]">불러오는 중…</p>}>
          <ReportFormInner />
        </Suspense>
      </SectionLayout>
    </>
  );
}
