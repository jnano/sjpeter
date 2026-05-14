"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import AdminNav from "./AdminNav";
import AdminSidebar from "./AdminSidebar";

export default function AdminAuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

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
