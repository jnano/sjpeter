import Link from "next/link";
import CrossIcon from "@/components/icons/CrossIcon";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <div className="mb-6">
        <CrossIcon className="text-[var(--color-accent)] text-5xl" />
      </div>
      <p className="text-8xl font-bold text-[var(--color-primary)]/10 select-none leading-none mb-2">
        404
      </p>
      <h1 className="font-serif text-2xl font-bold text-[var(--color-primary)] mb-3">
        페이지를 찾을 수 없습니다
      </h1>
      <p className="text-sm text-[var(--color-text-muted)] max-w-sm mb-8 leading-relaxed">
        요청하신 페이지가 존재하지 않거나 이동되었습니다.
        주소를 다시 확인해 주세요.
      </p>
      <Link
        href="/"
        className="px-6 py-2.5 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
      >
        홈으로 돌아가기
      </Link>
    </div>
  );
}
