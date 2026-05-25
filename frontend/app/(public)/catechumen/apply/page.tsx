import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "입교신청",
  description: "예비자교리 입교신청 안내",
};

// 3단계에서 회원 전용 입교신청 양식으로 교체될 placeholder.
// 현재는 /about 입교신청 카드의 링크 대상(404 방지) + 안내.
export default function CatechumenApplyPage() {
  return (
    <>
      <PageHeader group="성당 소개" title="입교신청" subtitle="예비자교리 입교를 신청합니다" />
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">📝</div>
        <h2 className="text-lg font-bold text-[var(--color-primary)] mb-3">
          입교신청 양식을 준비하고 있습니다
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-8">
          예비자교리 입교신청은 회원가입 후 이용하실 수 있습니다.
          <br />
          신청 양식이 곧 제공될 예정입니다.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/members/login"
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-[var(--color-primary)] hover:opacity-90"
          >
            회원 로그인
          </Link>
          <Link
            href="/members/register"
            className="px-5 py-2.5 rounded-lg text-sm font-medium border border-[var(--color-border)] hover:bg-[var(--color-surface-warm)]"
          >
            회원가입
          </Link>
        </div>
      </div>
    </>
  );
}
