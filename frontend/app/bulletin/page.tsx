import type { Metadata } from "next";
import type { Bulletin } from "@/lib/api";
import BulletinClient from "./BulletinClient";

export const metadata: Metadata = {
  title: "주보",
  description: "세종성베드로성당 주보 — 이번 주 주보와 지난 주보 아카이브",
};

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

export default async function BulletinPage() {
  const bulletins = await getBulletins();
  return <BulletinClient bulletins={bulletins} />;
}
