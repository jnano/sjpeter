import { redirect } from "next/navigation";

/**
 * /admin/gallery 는 /admin/boards 로 통합되었습니다 (v1.5.61).
 * 갤러리 게시판(전례 사진·행사 사진)도 일반 게시판처럼 /admin/boards 에서
 * 관리합니다. 글 작성은 공개 페이지 /gallery/liturgy/write, /gallery/events/write
 * 에서 진행합니다. 즐겨찾기·검색엔진 흔적 보호용 영구 리다이렉트.
 */
export default function AdminGalleryRedirect() {
  redirect("/admin/boards");
}
