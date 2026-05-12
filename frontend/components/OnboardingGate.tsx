"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";

const EXCLUDED_PREFIXES = ["/onboarding", "/admin", "/api"];

/**
 * 인증된 회원의 interest_prompt_completed가 false면 관심분과 온보딩 페이지로 자동 이동.
 * 관리자/온보딩/내부 API 경로는 제외.
 *
 * 트리거 시점: 로그인 직후 session에 interestPromptCompleted=false가 들어왔을 때,
 *              또는 SessionSync의 update() 결과로 false로 갱신됐을 때.
 */
export default function OnboardingGate() {
  const { status, data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status !== "authenticated") return;
    const completed = (session as { interestPromptCompleted?: boolean })?.interestPromptCompleted;
    if (completed !== false) return; // undefined/true는 건드리지 않음
    if (EXCLUDED_PREFIXES.some((p) => pathname.startsWith(p))) return;
    router.replace("/onboarding/interests");
  }, [status, session, pathname, router]);

  return null;
}
