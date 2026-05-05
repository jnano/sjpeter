import { auth } from "@/auth";
import { NextResponse } from "next/server";

const MEMBER_ONLY = ["/members/me", "/boards/"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // 관리자 하위 경로 보호 (/admin 로그인 페이지 자체는 제외)
  if (pathname.startsWith("/admin/")) {
    const adminAuthed = req.cookies.get("admin_authed");
    if (!adminAuthed) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
  }

  // 회원 경로 보호
  const isWritePath = pathname.includes("/write");
  const isMemberOnly = MEMBER_ONLY.some((p) => pathname.startsWith(p));

  if ((isWritePath || isMemberOnly) && !req.auth) {
    const loginUrl = new URL("/members/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
