import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL;

interface Board {
  id: number;
  name: string;
  slug: string;
  description: string;
  members_only_write: boolean;
  members_only_read: boolean;
}

const BOARD_ICONS: Record<string, string> = {
  free:             "💬",
  notice:           "📢",
  liturgy:          "⛪",
  building:         "🏗️",
  building_photo:   "🏛️",
  events:           "📸",
  "media-family":   "📣",
  "build_offering": "🤲",
};

async function getBoards(): Promise<Board[]> {
  try {
    const res = await fetch(`${API}/api/boards`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function BoardsPage() {
  const boards = await getBoards();

  return (
    <>
      <PageHeader group="알림과 게시판" title="자유 게시판" subtitle="성당 공동체의 이야기를 나누는 공간입니다." />
      <SectionLayout autoHero={false}>

      {boards.length === 0 ? (
        <p className="text-center py-16 text-[var(--color-text-muted)]">등록된 게시판이 없습니다.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {boards.map((board) => (
            <Link
              key={board.id}
              href={`/boards/${board.slug}`}
              className="group flex flex-col bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 hover:border-[var(--color-primary)] hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-3xl">{BOARD_ICONS[board.slug] ?? "📋"}</span>
                <div className="flex items-center gap-1.5">
                  {board.members_only_read && (
                    <span className="text-[11px] px-2 py-0.5 bg-purple-50 text-purple-600 border border-purple-200 rounded-full">
                      🔒 회원 전용
                    </span>
                  )}
                  {!board.members_only_read && board.members_only_write && (
                    <span className="text-[11px] px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-full">
                      쓰기 회원 전용
                    </span>
                  )}
                </div>
              </div>

              <p className="font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors text-lg">
                {board.name}
              </p>
              {board.description && (
                <p className="text-sm text-[var(--color-text-muted)] mt-1 line-clamp-2">
                  {board.description}
                </p>
              )}

              <div className="mt-auto pt-4 flex items-center justify-end text-xs text-[var(--color-primary)] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                바로가기 →
              </div>
            </Link>
          ))}
        </div>
      )}
      </SectionLayout>
    </>
  );
}
