import type { Metadata } from "next";
import type { Bulletin } from "@/lib/api";
import BulletinClient from "./BulletinClient";
import PageHeader from "@/components/PageHeader";
import BannerSlider from "@/components/BannerSlider";
import SectionLayout from "@/components/SectionLayout";
import { fetchParishMin } from "@/lib/parish";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const p = await fetchParishMin();
  return { title: "주보 아카이브", description: `${p.name} 주보 — 이번 주 주보와 지난 주보 아카이브` };
}

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function getBulletins(): Promise<Bulletin[]> {
  try {
    const res = await fetch(`${API}/api/bulletins/`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function getKakaoKey(): Promise<string> {
  const envKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY ?? "";
  if (envKey) return envKey;
  try {
    const res = await fetch(`${API}/api/public/site-config`);
    if (res.ok) {
      const cfg = await res.json();
      return cfg.KAKAO_MAP_KEY ?? "";
    }
  } catch {}
  return "";
}

export default async function BulletinPage() {
  const [bulletins, kakaoKey, p] = await Promise.all([getBulletins(), getKakaoKey(), fetchParishMin()]);
  return (
    <>
      <PageHeader group="말씀과 기도" title="주보 아카이브" subtitle="이번 주 주보와 지난 주보를 한 자리에서 만납니다" />
      <SectionLayout group="word">
        <BannerSlider placement="bulletin_top" className="mb-6" />
        {bulletins.length === 0 ? (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-12 text-center">
            <p className="text-4xl mb-3">📰</p>
            <p className="font-serif text-lg text-[var(--color-primary)] mb-2">주보가 아직 등록되지 않았습니다</p>
            <p className="text-sm text-[var(--color-text-muted)]">관리자가 주보를 업로드하면 이곳에 표시됩니다.</p>
          </div>
        ) : (
          <BulletinClient bulletins={bulletins} kakaoKey={kakaoKey} parishName={p.name} />
        )}
      </SectionLayout>
    </>
  );
}
