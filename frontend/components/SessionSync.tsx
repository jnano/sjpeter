"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

/**
 * 인증된 세션이 마운트되면 백엔드 /api/members/me 를 통해 is_admin 최신값을 NextAuth 토큰에 동기화.
 * 위임 관리자 권한이 부여/회수된 경우 재로그인 없이 즉시 반영하기 위한 컴포넌트.
 * 실제 is_admin 값 갱신은 auth.ts의 jwt callback (trigger==="update")에서 백엔드 재조회로 수행.
 */
export default function SessionSync() {
  const { status, update } = useSession();
  const syncedRef = useRef(false);

  useEffect(() => {
    if (status !== "authenticated") {
      syncedRef.current = false;
      return;
    }
    if (syncedRef.current) return;
    syncedRef.current = true;
    update({ refreshAdmin: true }).catch(() => {});
  }, [status, update]);

  return null;
}
