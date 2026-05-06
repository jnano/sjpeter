import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "신부님",
  description: "세종성베드로성당 주임신부님 소개",
};

const API = process.env.NEXT_PUBLIC_API_URL;

interface ParishOut {
  pastor_name: string | null;
  pastor_appointed: string | null;
  pastor_message: string | null;
  pastor_photo_url: string | null;
}

interface VisionOut {
  id: number;
  year: number;
  motto: string;
  is_current: boolean;
}

async function getParish(): Promise<ParishOut | null> {
  try {
    const res = await fetch(`${API}/api/parish/`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getCurrentVision(): Promise<VisionOut | null> {
  try {
    const res = await fetch(`${API}/api/content/visions`, { cache: "no-store" });
    if (!res.ok) return null;
    const visions: VisionOut[] = await res.json();
    return visions.find((v) => v.is_current) ?? visions[0] ?? null;
  } catch {
    return null;
  }
}

export default async function PastorPage() {
  const [parish, vision] = await Promise.all([getParish(), getCurrentVision()]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-[var(--color-primary)] mb-2">
          신부님
        </h1>
        <p className="text-[var(--color-text-muted)]">주임신부님을 소개합니다.</p>
      </div>

      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden">
        <div className="bg-[var(--color-primary)] text-white px-8 py-6">
          <div className="flex items-center gap-6">
            {parish?.pastor_photo_url ? (
              <img
                src={parish.pastor_photo_url}
                alt="신부님 사진"
                className="w-24 h-24 rounded-full object-cover shrink-0 border-2 border-white/30"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center text-4xl shrink-0">
                ✝
              </div>
            )}
            <div>
              <p className="text-white/70 text-sm mb-1">주임신부</p>
              <h2 className="font-serif text-2xl font-bold">{parish?.pastor_name ?? "—"}</h2>
              {parish?.pastor_appointed && (
                <p className="text-white/70 text-sm mt-1">{parish.pastor_appointed} 부임</p>
              )}
            </div>
          </div>
        </div>

        <div className="p-8 space-y-6">
          {vision && (
            <>
              <section>
                <h3 className="font-serif text-lg font-bold text-[var(--color-primary)] mb-3">
                  {vision.year}년 사목지표
                </h3>
                <blockquote className="border-l-4 border-[var(--color-accent)] pl-5 italic font-serif text-xl text-[var(--color-primary)]">
                  &ldquo;{vision.motto}&rdquo;
                </blockquote>
              </section>
              <div className="border-t border-[var(--color-border)]" />
            </>
          )}

          {parish?.pastor_message && (
            <section>
              <h3 className="font-serif text-lg font-bold text-[var(--color-primary)] mb-3">
                한 말씀
              </h3>
              <div className="bg-[var(--color-surface-warm)] rounded-lg p-6">
                <p className="leading-relaxed text-[var(--color-text)] whitespace-pre-line">
                  {parish.pastor_message}
                </p>
                {parish.pastor_name && (
                  <p className="mt-4 text-right text-[var(--color-text-muted)] text-sm">
                    — {parish.pastor_name}
                  </p>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
