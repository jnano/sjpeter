import { permanentRedirect } from "next/navigation";

// v1.5.235: /saint 라우트의 코드 하드코딩 (8 장면 scenes 배열) 을 dynamic_pages 의
// HTML 레이아웃으로 이전. 옛 URL 호환을 위해 /p/saint 로 301 영구 리다이렉트.
// 이제 콘텐츠 편집은 /admin/pages 에서 slug='saint' 페이지를 통해.
export default function SaintLegacyRedirect(): never {
  permanentRedirect("/p/saint");
}
