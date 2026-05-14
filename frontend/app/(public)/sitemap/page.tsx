import type { Metadata } from "next";
import Link from "next/link";
import { fetchParishMin } from "@/lib/parish";
import { fetchServerMenus } from "@/components/fetchServerMenus";
import type { MenuItem } from "@/components/useNavigation";

export async function generateMetadata(): Promise<Metadata> {
  const p = await fetchParishMin();
  return { title: "사이트맵", description: `${p.name} 홈페이지 전체 페이지 안내` };
}

/** children 포함 평평하게. useNavigation의 flattenItems가 client-only라 서버에서
    재사용 못 하므로 인라인 구현 (같은 로직). */
function flatten(items: MenuItem[]): MenuItem[] {
  const out: MenuItem[] = [];
  for (const it of items) {
    out.push(it);
    if (it.children?.length) out.push(...flatten(it.children));
  }
  return out;
}

/** 메뉴 그룹의 모든 내부 항목을 평평하게 펼친 뒤 활성·내부 링크만 반환. */
function visibleItems(items: MenuItem[]): MenuItem[] {
  return flatten(items).filter(
    (it) => it.is_active && !it.is_external && it.href.startsWith("/"),
  );
}

export default async function SitemapPage() {
  const [p, groups] = await Promise.all([
    fetchParishMin(),
    fetchServerMenus(),
  ]);
  const visibleGroups = groups
    .filter((g) => g.is_active)
    .map((g) => ({ ...g, _items: visibleItems(g.items) }))
    .filter((g) => g._items.length > 0);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-10">
        <p className="text-xs tracking-wide text-[var(--color-text-muted)] mb-3">
          {p.name}
          <span className="mx-1.5 opacity-40">›</span>
          사이트맵
        </p>
        <h1 className="font-serif text-3xl font-bold text-[var(--color-primary)] mb-2">
          사이트맵
        </h1>
        <p className="text-[var(--color-text-muted)]">
          홈페이지의 모든 페이지를 한 눈에 확인하세요.
        </p>
      </div>

      {visibleGroups.length === 0 ? (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-10 text-center text-[var(--color-text-muted)]">
          <p>등록된 메뉴가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {visibleGroups.map((section) => (
            <section
              key={section.id}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden"
            >
              {/* 섹션 헤더 — menu_groups.label / subtitle / icon */}
              <div className="bg-[var(--color-primary)] px-6 py-4 flex items-center gap-3">
                {section.icon && <span className="text-xl">{section.icon}</span>}
                <div>
                  <h2 className="font-serif font-bold text-white text-lg leading-tight">
                    {section.label}
                  </h2>
                  {section.subtitle && (
                    <p className="text-white/60 text-xs">{section.subtitle}</p>
                  )}
                </div>
              </div>

              {/* 페이지 목록 — menu_items.label 그대로 노출 */}
              <ul className="divide-y divide-[var(--color-border)]">
                {section._items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className="flex items-center justify-between px-6 py-4 hover:bg-[var(--color-surface-warm)] transition-colors group"
                    >
                      <span
                        className={`font-medium text-sm text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors ${
                          item.parent_id ? "pl-4 text-[var(--color-text-muted)]" : ""
                        }`}
                      >
                        {item.parent_id && (
                          <span className="text-[var(--color-border-dark)] mr-1.5">└</span>
                        )}
                        {item.label}
                      </span>
                      <span className="text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] transition-colors ml-4 shrink-0 text-sm">
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
