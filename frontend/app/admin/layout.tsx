"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import AdminNav from "./AdminNav";
import AdminSidebar from "./AdminSidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 라우트 변경 시 모바일 사이드바 닫기
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // 로그인 페이지(/admin)에서는 사이드바·헤더 숨김
  const isLoginPage = pathname === "/admin";
  if (isLoginPage) {
    return (
      <div className="min-h-screen bg-[var(--color-surface-warm)]">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface-warm)] flex flex-col">
      <AdminNav onMenuClick={() => setSidebarOpen(true)} />
      <div className="flex flex-1 min-h-0">
        <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
