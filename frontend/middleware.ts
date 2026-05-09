import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 관리자 하위 경로 보호 — 쿠키 기반, NextAuth 불필요
  if (pathname.startsWith("/admin/")) {
    const adminAuthed = req.cookies.get("admin_authed");
    if (!adminAuthed) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
  }
}

export const config = {
  matcher: ["/admin/:path*"],
};
