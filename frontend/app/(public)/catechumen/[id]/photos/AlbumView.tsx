"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { PHOTO_CATEGORIES } from "@/lib/catechumen";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Photo { id: number; category: string; file_url: string; alt: string | null; }
interface Album { class_id: number; round_no: number | null; baptism_at: string | null; photos: Photo[]; }

export default function AlbumView({ classId }: { classId: number }) {
  const { data: session, status } = useSession();
  const token = session?.accessToken as string | undefined;

  const [album, setAlbum] = useState<Album | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (!token) { setLoading(false); return; }
    fetch(`${API}/api/catechumen/classes/${classId}/album`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setAlbum)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [status, token, classId]);

  if (status === "loading" || loading) {
    return <p className="text-center py-12 text-sm text-[var(--color-text-muted)]">불러오는 중…</p>;
  }

  if (!token) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-4">🔒</div>
        <h2 className="text-lg font-bold text-[var(--color-primary)] mb-2">회원 전용입니다</h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-8">예비자교리 사진은 로그인한 본당 가족만 볼 수 있습니다.</p>
        <div className="flex gap-3 justify-center">
          <Link href="/members/login" className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-[var(--color-primary)] hover:opacity-90">회원 로그인</Link>
          <Link href="/members/register" className="px-5 py-2.5 rounded-lg text-sm font-medium border border-[var(--color-border)] hover:bg-[var(--color-surface-warm)]">회원가입</Link>
        </div>
      </div>
    );
  }

  if (notFound || !album) {
    return <p className="text-center py-12 text-sm text-[var(--color-text-muted)]">사진을 찾을 수 없습니다.</p>;
  }

  // 종류별 그룹핑 (기본 순서 우선, 그 외 뒤로)
  const grouped: Record<string, Photo[]> = {};
  for (const p of album.photos) (grouped[p.category] ??= []).push(p);
  const order = [
    ...PHOTO_CATEGORIES.filter((c) => grouped[c]),
    ...Object.keys(grouped).filter((c) => !PHOTO_CATEGORIES.includes(c)),
  ];

  return (
    <div>
      <h2 className="text-xl font-bold text-[var(--color-primary)] mb-6">제{album.round_no ?? "?"}차 예비자교리 사진</h2>

      {album.photos.length === 0 ? (
        <p className="text-center py-12 text-sm text-[var(--color-text-muted)]">아직 등록된 사진이 없습니다.</p>
      ) : (
        <div className="space-y-10">
          {order.map((c) => (
            // id={c} 로 마이페이지의 "#세례성사" 링크가 해당 섹션으로 스크롤
            <section key={c} id={c} className="scroll-mt-24">
              <h3 className="text-base font-semibold text-[var(--color-text)] mb-3 flex items-center gap-2">
                {c}
                <span className="text-xs font-normal text-[var(--color-text-muted)]">({grouped[c].length})</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {grouped[c].map((p) => (
                  <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-warm)]">
                    <Image src={p.file_url.startsWith("/") ? `${API}${p.file_url}` : p.file_url} alt={p.alt ?? c} fill className="object-cover" />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
