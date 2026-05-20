import { redirect } from "next/navigation";

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default async function AdminGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // setup 미완이면 /setup 으로 강제 리다이렉트.
  // 주의: redirect()는 NEXT_REDIRECT 에러를 throw 하므로 try/catch 안에 두면 catch가 삼킴 → try 밖에서 호출.
  // 백엔드 페치 실패 시 fail-open — admin 페이지는 그대로 노출 (백엔드 죽었으면 어차피 admin 도 못 씀).
  let setupCompleted = true;
  try {
    const res = await fetch(`${API}/api/setup/status`, { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { setup_completed?: boolean };
      setupCompleted = data.setup_completed !== false;
    }
  } catch {
    // 백엔드 미기동 시 admin 진입 그대로
  }
  if (!setupCompleted) {
    redirect("/setup");
  }

  return <div data-skin="admin">{children}</div>;
}
