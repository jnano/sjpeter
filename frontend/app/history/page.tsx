import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "우리의 역사",
  description: "세종성베드로성당 창립부터 현재까지의 연표",
};

const API = process.env.NEXT_PUBLIC_API_URL;

interface HistoryItem {
  id: number;
  year: number;
  event: string;
  detail: string | null;
  highlight: boolean;
  is_current: boolean;
  sort_order: number;
}

async function getHistory(): Promise<HistoryItem[]> {
  try {
    const res = await fetch(`${API}/api/content/history`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function HistoryPage() {
  const historyItems = await getHistory();

  return (
    <>
      <PageHeader group="성당 소개" title="본당 연혁" subtitle="현재부터 창립까지 — 세종성베드로성당의 역사" />
      <SectionLayout group="about">

      <div className="relative">
        <div className="absolute left-[5.5rem] top-0 bottom-0 w-0.5 bg-[var(--color-border)]" />

        <div className="space-y-0">
          {historyItems.map((item) => (
            <div key={item.id} className="relative flex gap-6 pb-8">
              <div className="w-20 shrink-0 text-right pt-1">
                <span
                  className={`text-sm font-bold ${
                    item.is_current
                      ? "text-[var(--color-accent)]"
                      : "text-[var(--color-text-muted)]"
                  }`}
                >
                  {item.year}
                </span>
              </div>

              <div className="relative z-10 shrink-0 mt-2">
                <div
                  className={`w-4 h-4 rounded-full border-2 ${
                    item.highlight || item.is_current
                      ? "bg-[var(--color-primary)] border-[var(--color-primary)]"
                      : "bg-white border-[var(--color-border-dark)]"
                  }`}
                />
              </div>

              <div
                className={`flex-1 pb-4 ${
                  item.highlight
                    ? "bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 -mt-1"
                    : ""
                }`}
              >
                <h3
                  className={`font-serif font-bold mb-1 ${
                    item.is_current
                      ? "text-[var(--color-accent)] text-lg"
                      : item.highlight
                      ? "text-[var(--color-primary)] text-lg"
                      : "text-[var(--color-text)]"
                  }`}
                >
                  {item.event}
                  {item.is_current && (
                    <span className="ml-2 text-xs bg-[var(--color-accent)] text-white px-2 py-0.5 rounded-full font-sans">
                      현재
                    </span>
                  )}
                </h3>
                {item.detail && (
                  <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    {item.detail}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 bg-[var(--color-surface-warm)] border border-[var(--color-border)] rounded-xl p-5 text-center">
        <p className="text-sm text-[var(--color-text-muted)]">
          오늘을 기록하면 역사가 됩니다. 주보 아카이브에서 본당의 전체 역사를 확인하세요.
        </p>
      </div>
      </SectionLayout>
    </>
  );
}
