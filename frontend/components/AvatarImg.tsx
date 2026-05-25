"use client";

/**
 * 아바타 이미지 — 로드 실패 시(외부 OAuth 사진 차단 등) 숨김 처리.
 * onError 는 클라이언트 전용이라, 서버 컴포넌트(게시판 목록 등)에서 직접 <img onError> 를
 * 쓰면 "Event handlers cannot be passed to Client Component props" 에러가 난다.
 * 이 작은 클라이언트 컴포넌트로 감싸 서버 컴포넌트 안에서도 안전하게 사용. (v1.5.372)
 */
export default function AvatarImg({ src, className }: { src: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className={className}
      referrerPolicy="no-referrer"
      onError={(e) => { e.currentTarget.style.display = "none"; }}
    />
  );
}
