"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { resolveClientApi } from "@/lib/api";

const PAGE_SIZE = 60;

type Mode = "shuffle" | "grouped";

function parseMode(v: string | null): Mode {
  return v === "grouped" ? "grouped" : "shuffle";
}

interface PhotoItem {
  source: string;
  source_id: number;
  file_url: string;
  source_label: string;
  click_href: string;
  created_at: string | null;
}

interface PhotosResponse {
  items: PhotoItem[];
  next_offset: number;
  has_more: boolean;
  total: number;
  seed: string;
  mode: Mode;
}

function imgUrl(fileUrl: string): string {
  if (!fileUrl) return "";
  if (fileUrl.startsWith("http")) return fileUrl;
  return `${resolveClientApi()}${fileUrl}`;
}

export default function PhotosClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL query 가 단일 진실원 — mode/seed 가 history 에 보존되어 뒤로가기 시 자동 복원.
  const urlMode = parseMode(searchParams.get("mode"));
  const urlSeed = searchParams.get("seed") ?? "";

  const [mode, setMode] = useState<Mode>(urlMode);
  const [items, setItems] = useState<PhotoItem[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [seed, setSeed] = useState<string>(urlSeed);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reqIdRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // 뒤로가기·앞으로가기 → URL 변경 감지 → state 동기화 (initial mount 후의 URL 변화만 처리)
  useEffect(() => {
    if (urlMode !== mode) setMode(urlMode);
    if (urlSeed !== seed) setSeed(urlSeed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlMode, urlSeed]);

  const fetchPage = useCallback(
    async (nextOffset: number, currentMode: Mode, currentSeed: string, reset: boolean) => {
      const myReqId = ++reqIdRef.current;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          mode: currentMode,
          offset: String(nextOffset),
          limit: String(PAGE_SIZE),
        });
        if (currentMode === "shuffle" && currentSeed) params.set("seed", currentSeed);
        const res = await fetch(`${resolveClientApi()}/api/photos?${params.toString()}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: PhotosResponse = await res.json();
        if (myReqId !== reqIdRef.current) return;
        setItems((prev) => (reset ? data.items : [...prev, ...data.items]));
        setOffset(data.next_offset);
        setHasMore(data.has_more);
        setTotal(data.total);
        if (data.seed) setSeed(data.seed);
      } catch (e) {
        if (myReqId === reqIdRef.current) {
          setError(e instanceof Error ? e.message : "사진을 불러오지 못했습니다.");
          // 에러 시 더 이상 자동 fetch 안 함 — IntersectionObserver 가 trigger 해도 멈춤.
          // (없으면 fetch 실패 → hasMore 유지 → observer 또 trigger → retry loop → rate limit 초과)
          setHasMore(false);
        }
      } finally {
        if (myReqId === reqIdRef.current) setLoading(false);
      }
    },
    [],
  );

  // mode 또는 seed(URL 복원 시) 변경 시 초기화 + 첫 페이지 로드.
  // seed 가 URL 에 이미 있으면 그 seed 로 첫 fetch — 같은 셔플 순서 복원.
  useEffect(() => {
    setItems([]);
    setOffset(0);
    setHasMore(true);
    setTotal(0);
    fetchPage(0, mode, mode === "shuffle" ? seed : "", true);
    // mode/seed 둘 다 deps — URL 복원으로 둘 중 하나 바뀌면 재로드
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, seed]);

  // 첫 shuffle fetch 응답에서 받은 seed 를 URL 에 박아 뒤로가기 시 같은 순서 유지.
  // 이미 URL 에 seed 가 있으면 skip — 무한 router.replace 회피.
  useEffect(() => {
    if (mode !== "shuffle" || !seed) return;
    if (searchParams.get("seed") === seed) return;
    const qs = new URLSearchParams();
    qs.set("mode", "shuffle");
    qs.set("seed", seed);
    router.replace(`/photos?${qs.toString()}`, { scroll: false });
  }, [mode, seed, router, searchParams]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e.isIntersecting && hasMore && !loading) {
          fetchPage(offset, mode, seed, false);
        }
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, offset, mode, seed, fetchPage]);

  // 모드 토글 — URL 도 함께 바꿔 history 보존. 새 모드는 항상 fresh seed 로 시작
  // (셔플로 토글 시 옛 seed 들고가면 같은 순서 → 사용자가 새로 섞고 싶었을 가능성 무시).
  const switchMode = useCallback((next: Mode) => {
    setSeed("");
    setMode(next);
    const qs = new URLSearchParams();
    qs.set("mode", next);
    // shuffle 일 때 seed 는 다음 fetch 응답으로 채워져 다시 URL 동기화 됨
    router.replace(`/photos?${qs.toString()}`, { scroll: false });
  }, [router]);

  const groupedSections = useMemo(() => {
    if (mode !== "grouped") return [];
    const groups: { label: string; items: PhotoItem[] }[] = [];
    for (const it of items) {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.label === it.source_label) {
        lastGroup.items.push(it);
      } else {
        groups.push({ label: it.source_label, items: [it] });
      }
    }
    return groups;
  }, [items, mode]);

  return (
    <main className="min-h-screen bg-white">
      <PageHeader
        group="사진 기록"
        title="모든 날 모든 기억"
        subtitle="등록된 모든 사진을 한 곳에서 — 클릭하면 원래 자리로 이동합니다"
        action={
          <div className="flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-white p-1 text-[13px]">
            <button
              type="button"
              onClick={() => switchMode("shuffle")}
              className={`rounded-full px-3 py-1 transition ${
                mode === "shuffle"
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              섞어서
            </button>
            <button
              type="button"
              onClick={() => switchMode("grouped")}
              className={`rounded-full px-3 py-1 transition ${
                mode === "grouped"
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              모아서
            </button>
          </div>
        }
      />

      <div className="py-2">
        {total > 0 && (
          <div className="px-2 pb-2 text-center text-[12px] text-[var(--color-text-muted)]">
            총 {total.toLocaleString()}장
          </div>
        )}

        {error && (
          <div className="mx-auto max-w-xl rounded-md border border-red-200 bg-red-50 p-3 text-center text-sm text-red-700">
            {error}
          </div>
        )}

        {mode === "shuffle" ? (
          <PhotoGrid items={items} />
        ) : (
          <div className="space-y-6">
            {groupedSections.map((sec, idx) => (
              <section key={`${sec.label}-${idx}`}>
                <h2 className="sticky top-0 z-10 bg-white/90 px-3 py-2 text-[13px] font-semibold text-[var(--color-text)] backdrop-blur">
                  {sec.label} <span className="ml-1 text-[var(--color-text-muted)] font-normal">· {sec.items.length}장</span>
                </h2>
                <PhotoGrid items={sec.items} />
              </section>
            ))}
          </div>
        )}

        <div ref={sentinelRef} className="h-12" aria-hidden="true" />

        {loading && (
          <div className="py-4 text-center text-[12px] text-[var(--color-text-muted)]">불러오는 중…</div>
        )}
        {!hasMore && items.length > 0 && (
          <div className="py-6 text-center text-[12px] text-[var(--color-text-muted)]">마지막 사진입니다.</div>
        )}
        {!loading && items.length === 0 && !error && (
          <div className="py-12 text-center text-sm text-[var(--color-text-muted)]">등록된 사진이 없습니다.</div>
        )}
      </div>
    </main>
  );
}

function PhotoGrid({ items }: { items: PhotoItem[] }) {
  return (
    <div className="grid grid-cols-4 gap-0 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
      {items.map((it) => (
        <Link
          key={`${it.source}-${it.source_id}`}
          href={it.click_href}
          prefetch={false}
          className="group relative block aspect-[3/4] overflow-hidden bg-[var(--color-bg-muted,#f6f6f6)]"
          title={`${it.source_label} — 등록 위치로 이동`}
          aria-label={`${it.source_label} 사진. 클릭하면 등록 위치로 이동합니다.`}
        >
          <img
            src={imgUrl(it.file_url)}
            alt={it.source_label}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
          <span className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/70 to-transparent px-2 py-1 text-[10px] text-white opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
            {it.source_label}
          </span>
        </Link>
      ))}
    </div>
  );
}
