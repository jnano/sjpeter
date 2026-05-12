"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

/**
 * 인증된 세션이 마운트되면 백엔드 /api/members/me 를 통해 is_admin 최신값을 NextAuth 토큰에 동기화.
 * 위임 관리자 권한이 부여/회수된 경우 재로그인 없이 즉시 반영하기 위한 컴포넌트.
 * 실제 is_admin 값 갱신은 auth.ts의 jwt callback (trigger==="update")에서 백엔드 재조회로 수행.
 *
 * 주의: NextAuth의 `update` 함수 reference는 매 렌더마다 새로 생성될 수 있어
 *       deps에 넣으면 무한 루프가 발생. ref로 capture 후 status 단일 의존성만 사용.
 */
export default function SessionSync() {
  const { status, update } = useSession();
  const updateRef = useRef(update);
  const syncedRef = useRef(false);

  // update 함수의 최신 참조를 ref에 유지 (deps에 update를 넣지 않기 위함)
  useEffect(() => {
    updateRef.current = update;
  }, [update]);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (syncedRef.current) return;
    syncedRef.current = true;
    updateRef.current({ refreshAdmin: true }).catch(() => {});
  }, [status]);

  return null;
}
