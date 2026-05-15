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
  return { title: "주보", description: `${p.name} 주보 — 이번 주 주보와 지난 주보 아카이브` };
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function getBulletins(): Promise<Bulletin[]> {
  try {
    const res = await fetch(`${API}/api/bulletins/`, { next: { revalidate: 3600, tags: ["bulletins"] } });
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
    const res = await fetch(`${API}/api/public/site-config`, { next: { revalidate: 300 } });
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
        <BulletinClient bulletins={bulletins} kakaoKey={kakaoKey} parishName={p.name} />
      </SectionLayout>
    </>
  );
}
