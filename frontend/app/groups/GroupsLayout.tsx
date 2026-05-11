import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface CommunityGroup {
  id: number;
  name: string;
  description: string | null;
  activity_time: string | null;
  link_url: string | null;
  board_slug: string | null;
  slug: string | null;
  parent_id: number | null;
  sort_order: number;
  activities: string | null;
  photo_urls: string[] | null;
}

export async function fetchGroups(): Promise<CommunityGroup[]> {
  try {
    const res = await fetch(`${API}/api/content/community`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default function GroupsLayout({
  groups,
  currentSlug,
  children,
}: {
  groups: CommunityGroup[];
  currentSlug?: string;
  children: React.ReactNode;
}) {
  // 사이드바: 슬러그가 있는 최상위 분과만
  const sidebarItems = groups
    .filter((g) => !g.parent_id && g.slug)
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* 모바일: 가로 스크롤 칩 (Header h-16 바로 아래 sticky) */}
      <nav className="md:hidden -mx-6 px-6 mb-5 sticky top-16 z-30 bg-white border-b border-[var(--color-border)]">
        <ul className="flex gap-1.5 overflow-x-auto py-2" style={{ WebkitOverflowScrolling: "touch" }}>
          <li className="shrink-0">
            <Link
              href="/groups"
              className={`inline-block px-3 py-1.5 text-xs rounded-full border transition-colors ${
                !currentSlug
                  ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                  : "border-[var(--color-border)] text-[var(--color-text-muted)] bg-white"
              }`}
            >
              전체
            </Link>
          </li>
          {sidebarItems.map((g) => {
            const active = g.slug === currentSlug;
            return (
              <li key={g.id} className="shrink-0">
                <Link
                  href={`/groups/${g.slug}`}
                  className={`inline-block px-3 py-1.5 text-xs rounded-full border transition-colors ${
                    active
                      ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                      : "border-[var(--color-border)] text-[var(--color-text-muted)] bg-white"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  {g.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="md:grid md:grid-cols-[220px_1fr] md:gap-8">
        <aside className="hidden md:block md:sticky md:top-24 md:self-start">
          <h3 className="font-serif font-bold text-[var(--color-primary)] mb-3 text-sm">분과 목록</h3>
          <nav>
            <ul className="space-y-0">
              <li className="border-b border-[var(--color-border)]">
                <Link
                  href="/groups"
                  className={`block py-2.5 text-sm transition-colors ${
                    !currentSlug
                      ? "text-[var(--color-primary)] font-bold"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                  }`}
                >
                  전체 보기
                </Link>
              </li>
              {sidebarItems.map((g) => {
                const active = g.slug === currentSlug;
                return (
                  <li key={g.id} className="border-b border-[var(--color-border)] last:border-b-0">
                    <Link
                      href={`/groups/${g.slug}`}
                      className={`block py-2.5 text-sm transition-colors ${
                        active
                          ? "text-[var(--color-primary)] font-bold"
                          : "text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                      }`}
                      aria-current={active ? "page" : undefined}
                    >
                      {g.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
