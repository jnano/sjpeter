import Link from "next/link";
import { auth } from "@/auth";
import PageHeader from "@/components/PageHeader";
import PhotosClient from "./PhotosClient";

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const dynamic = "force-dynamic";

async function fetchViewScope(): Promise<"public" | "members"> {
  try {
    const res = await fetch(`${API}/api/photos/access`, { cache: "no-store" });
    if (!res.ok) return "public";
    const data = await res.json();
    return data.view_scope === "members" ? "members" : "public";
  } catch {
    return "public";
  }
}

export default async function PhotosPage() {
  const [viewScope, session] = await Promise.all([
    fetchViewScope(),
    auth(),
  ]);

  const isMember = !!session?.user;

  if (viewScope === "members" && !isMember) {
    const next = encodeURIComponent("/photos");
    return (
      <main className="min-h-screen bg-white">
        <PageHeader
          group="사진 기록"
          title="모든 날 모든 기억"
          subtitle="등록된 모든 사진을 한 곳에서 — 클릭하면 원래 자리로 이동합니다"
        />
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-muted,#fafafa)] p-8">
            <p className="mb-2 text-base font-semibold text-[var(--color-text)]">
              회원만 볼 수 있는 페이지입니다
            </p>
            <p className="mb-6 text-sm text-[var(--color-text-muted)] leading-relaxed">
              로그인 후 다시 방문해 주세요.
            </p>
            <Link
              href={`/members/login?callbackUrl=${next}`}
              className="inline-block rounded-md bg-[var(--color-primary)] px-5 py-2 text-sm font-medium text-white transition hover:opacity-90"
            >
              로그인하러 가기
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return <PhotosClient />;
}
