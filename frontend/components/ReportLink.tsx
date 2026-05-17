"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

/** Footer에 배치되는 "장애 신고" 바로가기 버튼.
 *
 * 클릭 시 현재 페이지 URL(pathname + search)을 ?ref= 로 전달해
 * /report 폼이 자동으로 page_url 입력란을 채울 수 있게 한다.
 * referrer 헤더에 의존하지 않음(보안·정책상 비어 있을 수 있음). */
export default function ReportLink({ className, children }: { className?: string; children?: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    // /report 페이지에서 본인이 클릭한 경우는 ref 갱신 불필요
    if (pathname?.startsWith("/report")) {
      router.push("/report");
      return;
    }
    const qs = search?.toString();
    const currentPath = qs ? `${pathname}?${qs}` : pathname;
    const ref = currentPath ? encodeURIComponent(currentPath) : "";
    router.push(ref ? `/report?ref=${ref}` : "/report");
  }

  return (
    <a
      href="/report"
      onClick={handleClick}
      className={className ?? "text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"}
    >
      {children ?? "장애 신고"}
    </a>
  );
}
