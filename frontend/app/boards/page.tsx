import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL;

interface Board {
  id: number;
  name: string;
  slug: string;
  description: string;
  members_only_write: boolean;
}

async function getBoards(): Promise<Board[]> {
  try {
    const res = await fetch(`${API}/api/boards`, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function BoardsPage() {
  const boards = await getBoards();

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-[var(--color-primary)] mb-2">게시판</h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-8">
        성당 회원들의 이야기를 나누는 공간입니다.
      </p>

      {boards.length === 0 ? (
        <p className="text-center py-16 text-[var(--color-text-muted)]">
          등록된 게시판이 없습니다.
        </p>
      ) : (
        <div className="space-y-3">
          {boards.map((board) => (
            <Link
              key={board.id}
              href={`/boards/${board.slug}`}
              className="flex items-center justify-between p-5 bg-white border border-[var(--color-border)] rounded-xl hover:border-[var(--color-primary)] hover:shadow-sm transition-all"
            >
              <div>
                <p className="font-semibold text-[var(--color-text)]">{board.name}</p>
                {board.description && (
                  <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{board.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {board.members_only_write && (
                  <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">회원 전용</span>
                )}
                <span className="text-[var(--color-text-muted)]">›</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
