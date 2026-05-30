"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import OnboardingChecklist from "@/components/admin/OnboardingChecklist";

const API = process.env.NEXT_PUBLIC_API_URL;

interface Stats {
  total_members: number;
  active_members: number;
  total_posts: number;
  total_comments: number;
  recent_members: { id: number; name: string | null; nickname: string; email: string; created_at: string }[];
}
interface BulletinLatest {
  id: number;
  issue_number: number | null;
  published_date: string;
}
interface EventBrief {
  id: number;
  title: string;
  event_date: string;
  start_time: string | null;
  event_kind: string | null;
}
interface EventsSummary {
  total: number;
  pending_recording_count: number;
  upcoming: EventBrief[];
}
interface NoticeItem {
  id: number;
  title: string;
  created_at: string;
  is_pinned?: boolean;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("ko-KR");
}

// 자주 쓰는 작업 바로가기
const QUICK_ACTIONS = [
  { href: "/admin/bulletin/new", icon: "📤", label: "주보 업로드" },
  { href: "/admin/notices", icon: "📢", label: "공지 작성" },
  { href: "/admin/calendar", icon: "📅", label: "일정 등록" },
  { href: "/admin/meditation", icon: "🙏", label: "주일 말씀" },
  { href: "/admin/menus", icon: "🧭", label: "메뉴 편집" },
  { href: "/admin/home", icon: "🏠", label: "홈 편집" },
];

const TONE: Record<string, string> = {
  violet: "bg-violet-50 border-violet-200 hover:bg-violet-100 text-violet-900",
  amber: "bg-amber-50 border-amber-200 hover:bg-amber-100 text-amber-900",
  sky: "bg-sky-50 border-sky-200 hover:bg-sky-100 text-sky-900",
  red: "bg-red-50 border-red-200 hover:bg-red-100 text-red-900",
};
const TONE_BADGE: Record<string, string> = {
  violet: "bg-violet-600",
  amber: "bg-amber-500",
  sky: "bg-sky-600",
  red: "bg-red-600",
};

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [bulletinCount, setBulletinCount] = useState<number | null>(null);
  const [latestBulletin, setLatestBulletin] = useState<BulletinLatest | null>(null);
  const [events, setEvents] = useState<EventsSummary | null>(null);
  const [notices, setNotices] = useState<{ items: NoticeItem[]; total: number } | null>(null);
  const [draftCount, setDraftCount] = useState(0);
  const [extractions, setExtractions] = useState<{ total: number; vision: number }>({ total: 0, vision: 0 });
  const [reportsPending, setReportsPending] = useState(0);

  const fetchAll = useCallback(async () => {
    const token = localStorage.getItem("admin_token");
    if (!token) { router.push("/admin"); return; }
    const headers = { Authorization: `Bearer ${token}` };
    const j = (res: Response) => (res.ok ? res.json() : null);
    const get = (path: string) => fetch(`${API}${path}`, { headers }).then(j).catch(() => null);

    // 대시보드 한 화면에 필요한 집계를 병렬로 모은다. 개별 실패는 무시(해당 블록만 비움).
    const [statsR, bcR, lbR, evR, ntR, dfR, exR, rpR] = await Promise.all([
      get("/api/members/admin/stats"),
      get("/api/bulletins/admin/count"),
      get("/api/bulletins/latest"),
      get("/api/events/admin/summary"),
      get("/api/notices/paged?page=1&size=5"),
      get("/api/boards/drafts/count"),
      get("/api/bulletins/extractions/pending/count"),
      get("/api/reports?status=pending&size=1"),
    ]);
    if (statsR) setStats(statsR);
    if (bcR) setBulletinCount(bcR.total ?? 0);
    if (lbR) setLatestBulletin(lbR);
    if (evR) setEvents(evR);
    if (ntR) setNotices({ items: ntR.items ?? [], total: ntR.total ?? 0 });
    if (dfR) setDraftCount(dfR.count ?? 0);
    if (exR) setExtractions({ total: exR.total ?? 0, vision: exR.vision ?? 0 });
    if (rpR) setReportsPending(rpR.counts?.pending ?? 0);
  }, [router]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // 처리 대기 알림 카드 — 건수가 있는 것만 노출
  const actions = [
    extractions.total > 0 && {
      href: "/admin/bulletin/extractions", icon: "🤖", label: "AI 추출 검토 대기",
      count: extractions.total, tone: "violet",
      sub: extractions.vision > 0 ? `이미지(Vision) ${extractions.vision}건 포함` : "검토 후 게시·반영",
    },
    draftCount > 0 && {
      href: "/admin/drafts", icon: "📝", label: "AI 임시저장 검토",
      count: draftCount, tone: "amber", sub: "게시 또는 삭제",
    },
    (events?.pending_recording_count ?? 0) > 0 && {
      href: "/admin/calendar", icon: "📅", label: "기록대기 행사",
      count: events!.pending_recording_count, tone: "sky", sub: "지난 일정 기록 정리",
    },
    reportsPending > 0 && {
      href: "/admin/reports", icon: "🛠", label: "장애 신고 미처리",
      count: reportsPending, tone: "red", sub: "확인 후 처리",
    },
  ].filter(Boolean) as { href: string; icon: string; label: string; count: number; tone: string; sub: string }[];

  const statCards = [
    { label: "전체 회원", value: stats ? stats.total_members : "—", sub: stats ? `활성 ${stats.active_members}명` : "", icon: "👥" },
    { label: "게시글", value: stats ? stats.total_posts : "—", sub: "전체", icon: "📝" },
    { label: "댓글", value: stats ? stats.total_comments : "—", sub: "전체", icon: "💬" },
    { label: "주보", value: bulletinCount ?? "—", sub: "발행", icon: "📖" },
    { label: "행사·모임", value: events ? events.total : "—", sub: "전체", icon: "📅" },
    { label: "공지", value: notices ? notices.total : "—", sub: "전체", icon: "📢" },
  ];

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-primary)]">대시보드</h1>
        <p className="text-sm text-gray-500 mt-1">사이트 현황과 처리할 일을 한눈에 확인합니다.</p>
      </div>

      {/* 첫 운영 가이드 (필수 항목 모두 완료 시 자동 숨김) */}
      <OnboardingChecklist />

      {/* 빠른 작업 바로가기 */}
      <div className="mb-6">
        <h2 className="text-xs font-bold tracking-wider text-gray-400 uppercase mb-2">빠른 작업</h2>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {QUICK_ACTIONS.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="flex flex-col items-center justify-center gap-1.5 py-3 px-2 bg-white border border-[var(--color-border)] rounded-xl hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-colors text-center"
            >
              <span className="text-xl" aria-hidden="true">{a.icon}</span>
              <span className="text-[11px] font-medium text-gray-700 leading-tight">{a.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* 처리 대기 알림 */}
      <div className="mb-6">
        <h2 className="text-xs font-bold tracking-wider text-gray-400 uppercase mb-2">처리 대기</h2>
        {actions.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {actions.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className={`flex items-center gap-3 p-4 border rounded-xl transition-colors ${TONE[a.tone]}`}
              >
                <span className="text-2xl" aria-hidden="true">{a.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    {a.label}
                    <span className={`text-[11px] font-bold text-white px-1.5 py-0.5 rounded-full leading-none ${TONE_BADGE[a.tone]}`}>
                      {a.count}
                    </span>
                  </p>
                  <p className="text-xs opacity-70 mt-0.5">{a.sub}</p>
                </div>
                <span className="text-sm opacity-60">→</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
            ✅ 지금 처리할 일이 없습니다.
          </div>
        )}
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-6">
        {statCards.map((s) => (
          <div key={s.label} className="bg-white border border-[var(--color-border)] rounded-xl p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[var(--color-text-muted)]">{s.label}</span>
              <span className="text-base" aria-hidden="true">{s.icon}</span>
            </div>
            <p className="text-2xl font-bold text-[var(--color-primary)] truncate">{s.value}</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* 콘텐츠 현황 — 최신 주보 / 다가오는 일정 / 최근 공지 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* 최신 주보 */}
        <div className="bg-white border border-[var(--color-border)] rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-[var(--color-primary)]">최신 주보</h2>
            <Link href="/admin/bulletin" className="text-xs text-blue-500 hover:underline">관리 →</Link>
          </div>
          {latestBulletin ? (
            <div>
              <p className="text-2xl font-bold text-[var(--color-primary)]">
                제 {latestBulletin.issue_number ?? "—"} 호
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                발행일 {fmtDate(latestBulletin.published_date)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-400">발행된 주보가 없습니다.</p>
          )}
        </div>

        {/* 다가오는 일정 */}
        <div className="bg-white border border-[var(--color-border)] rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-[var(--color-primary)]">다가오는 일정</h2>
            <Link href="/admin/calendar" className="text-xs text-blue-500 hover:underline">관리 →</Link>
          </div>
          {events && events.upcoming.length > 0 ? (
            <ul className="space-y-2">
              {events.upcoming.map((e) => (
                <li key={e.id} className="flex items-center gap-2 text-sm">
                  {e.event_kind === "행사" && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 shrink-0">행사</span>}
                  {e.event_kind === "모임" && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700 shrink-0">모임</span>}
                  <span className="flex-1 truncate">{e.title}</span>
                  <span className="text-xs text-[var(--color-text-muted)] shrink-0">{fmtDate(e.event_date)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">예정된 일정이 없습니다.</p>
          )}
        </div>

        {/* 최근 공지 */}
        <div className="bg-white border border-[var(--color-border)] rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-[var(--color-primary)]">최근 공지</h2>
            <Link href="/admin/notices" className="text-xs text-blue-500 hover:underline">관리 →</Link>
          </div>
          {notices && notices.items.length > 0 ? (
            <ul className="space-y-2">
              {notices.items.map((n) => (
                <li key={n.id} className="flex items-center gap-2 text-sm">
                  {n.is_pinned && <span className="text-amber-500 shrink-0" aria-hidden="true">📌</span>}
                  <span className="flex-1 truncate">{n.title}</span>
                  <span className="text-xs text-[var(--color-text-muted)] shrink-0">{fmtDate(n.created_at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">등록된 공지가 없습니다.</p>
          )}
        </div>
      </div>

      {/* 최근 가입 회원 */}
      {stats && stats.recent_members.length > 0 && (
        <div className="bg-white border border-[var(--color-border)] rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-[var(--color-primary)]">최근 가입 회원</h2>
            <Link href="/admin/members" className="text-xs text-blue-500 hover:underline">
              전체 회원 →
            </Link>
          </div>
          <ul className="divide-y divide-gray-100">
            {stats.recent_members.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium">
                  {m.name ? `${m.name}(${m.nickname})` : m.nickname}
                </span>
                <span className="text-[var(--color-text-muted)] text-xs hidden sm:inline">{m.email}</span>
                <span className="text-[var(--color-text-muted)] text-xs">
                  {fmtDate(m.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
