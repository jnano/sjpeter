"use client";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ProfileEditPage from "./profile/page";
import MyInterestsPage from "./interests/page";
import MyPostsPage from "./posts/page";
import NotificationsPage from "../notifications/page";
import { PRAYER_CATEGORY_LABELS, type PrayerCategory } from "@/lib/prayer";

const API = process.env.NEXT_PUBLIC_API_URL;
const SAVE_KEY = "prayer-saved";

interface MemberInfo {
  id: number;
  email: string;
  name: string | null;
  nickname: string;
  avatar_url: string | null;
  has_password: boolean;
  is_admin: boolean;
  is_email_verified: boolean;
  social_provider: string | null;
  created_at: string;
}
interface MyPost {
  id: number; title: string; view_count: number;
  created_at: string; comment_count: number;
  board: { id: number; name: string; slug: string };
}
interface MyComment {
  id: number; content: string; created_at: string;
  post_id: number; post_title: string; board_slug: string;
}
interface PrayerItem { id: number; title: string; category: string; scripture: string | null; }
interface EventItem { id: number; title: string; event_date: string; end_date: string | null; start_time: string | null; location: string | null; event_kind: string | null; }

type TabKey = "dash" | "edit" | "notify" | "inbox" | "posts";
const TAB_LABELS: Record<TabKey, string> = {
  dash: "대시보드", edit: "프로필 편집", notify: "관심 분과·콘텐츠 알림", inbox: "알림함", posts: "내가 쓴 글",
};

/* ── 아이콘 (시안 mypage.html stroke 1.6) ── */
const IcGrid = () => <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="2" y="2" width="4" height="4" /><rect x="8" y="2" width="4" height="4" /><rect x="2" y="8" width="4" height="4" /><rect x="8" y="8" width="4" height="4" /></svg>;
const IcUser = () => <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="7" cy="4.5" r="2.5" /><path d="M2 12c0-2.5 2-4.5 5-4.5s5 2 5 4.5" /></svg>;
const IcBell = () => <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3.5 10.5h7V6.5a3.5 3.5 0 0 0-7 0v4z" /><path d="M5.5 12a1.5 1.5 0 0 0 3 0" strokeLinecap="round" /></svg>;
const IcMail = () => <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="2" y="3" width="10" height="8" /><polyline points="2 4 7 8 12 4" /></svg>;
const IcDoc = () => <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="2" y="2" width="10" height="10" /><line x1="4" y1="5" x2="10" y2="5" /><line x1="4" y1="8" x2="8" y2="8" /></svg>;
const IcChat = () => <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 3h10v6H8l-3 3v-3H2z" /></svg>;
const IcCal = () => <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="2" y="3" width="10" height="8" /><line x1="4" y1="2" x2="4" y2="4" /><line x1="10" y1="2" x2="10" y2="4" /></svg>;
const IcChevron = () => <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4"><polyline points="4 2 6.5 5 4 8" /></svg>;

function MonthShort(d: Date) { return `${d.getMonth() + 1}월`; }
function fmtAgo(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "어제";
  if (day < 7) return `${day}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit" });
}

export default function MypagePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("dash");
  const [member, setMember] = useState<MemberInfo | null>(null);
  const [posts, setPosts] = useState<MyPost[]>([]);
  const [comments, setComments] = useState<MyComment[]>([]);
  const [interestCount, setInterestCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [prayers, setPrayers] = useState<PrayerItem[]>([]);
  const [savedIds, setSavedIds] = useState<number[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/members/login?callbackUrl=/members/me");
  }, [status, router]);

  // localStorage 저장 기도 ID
  useEffect(() => {
    try { setSavedIds(JSON.parse(localStorage.getItem(SAVE_KEY) || "[]") as number[]); } catch { /* 무시 */ }
  }, []);

  useEffect(() => {
    const token = session?.accessToken;
    if (!token) { if (status !== "loading") setLoading(false); return; }
    const headers = { Authorization: `Bearer ${token}` };
    const sj = async (r: Response) => (r.ok ? r.json() : null);
    const now = new Date();
    const m1 = `${now.getFullYear()}-${now.getMonth() + 1}`;
    const nx = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const m2 = `${nx.getFullYear()}-${nx.getMonth() + 1}`;
    Promise.all([
      fetch(`${API}/api/members/me`, { headers }).then(sj).catch(() => null),
      fetch(`${API}/api/members/me/posts`, { headers }).then(sj).catch(() => null),
      fetch(`${API}/api/members/me/comments`, { headers }).then(sj).catch(() => null),
      fetch(`${API}/api/members/me/interests`, { headers }).then(sj).catch(() => null),
      fetch(`${API}/api/members/me/notifications/unread-count`, { headers }).then(sj).catch(() => null),
      fetch(`${API}/api/content/prayers?limit=500`).then(sj).catch(() => null),
      fetch(`${API}/api/events/?year=${m1.split("-")[0]}&month=${m1.split("-")[1]}`).then(sj).catch(() => null),
      fetch(`${API}/api/events/?year=${m2.split("-")[0]}&month=${m2.split("-")[1]}`).then(sj).catch(() => null),
    ]).then(([m, ps, cs, ints, unread, prs, ev1, ev2]) => {
      if (m?.id) setMember(m);
      setPosts(Array.isArray(ps) ? ps : []);
      setComments(Array.isArray(cs) ? cs : []);
      setInterestCount(Array.isArray(ints?.groups) ? ints.groups.length : 0);
      setUnreadCount(typeof unread?.count === "number" ? unread.count : 0);
      // /api/content/prayers 는 {items:[...]} 페이지네이션 객체를 반환
      setPrayers(Array.isArray(prs?.items) ? prs.items : Array.isArray(prs) ? prs : []);
      const merged: EventItem[] = [];
      const seen = new Set<number>();
      for (const arr of [ev1, ev2]) {
        if (!Array.isArray(arr)) continue;
        for (const e of arr) if (!seen.has(e.id)) { seen.add(e.id); merged.push(e); }
      }
      setEvents(merged);
      setLoading(false);
    });
  }, [session?.accessToken, status]);

  // ── 파생 데이터 ──
  const thisMonth = useMemo(() => {
    const now = new Date();
    const sameMonth = (iso: string) => { const d = new Date(iso); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); };
    return {
      posts: posts.filter((p) => sameMonth(p.created_at)).length,
      comments: comments.filter((c) => sameMonth(c.created_at)).length,
    };
  }, [posts, comments]);

  const feed = useMemo(() => {
    const items = [
      ...posts.map((p) => ({ kind: "post" as const, at: p.created_at, p })),
      ...comments.map((c) => ({ kind: "comment" as const, at: c.created_at, c })),
    ];
    items.sort((a, b) => b.at.localeCompare(a.at));
    return items.slice(0, 6);
  }, [posts, comments]);

  const monthBars = useMemo(() => {
    const yr = new Date().getFullYear();
    const counts = new Array(12).fill(0);
    for (const p of posts) { const d = new Date(p.created_at); if (d.getFullYear() === yr) counts[d.getMonth()]++; }
    const max = Math.max(1, ...counts);
    return counts.map((c) => ({ c, h: Math.round((c / max) * 100) }));
  }, [posts]);

  const savedPrayers = useMemo(
    () => prayers.filter((p) => savedIds.includes(p.id)).slice(0, 5),
    [prayers, savedIds],
  );

  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return events
      .filter((e) => (e.end_date ?? e.event_date) >= today)
      .sort((a, b) => a.event_date.localeCompare(b.event_date))
      .slice(0, 4);
  }, [events]);

  function removeSaved(id: number) {
    const next = savedIds.filter((x) => x !== id);
    setSavedIds(next);
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(next)); } catch { /* 무시 */ }
  }

  function handleLogout() {
    if (member?.is_admin) {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_display_name");
      localStorage.removeItem("admin_role");
      localStorage.removeItem("admin_is_super");
      document.cookie = "admin_authed=; path=/; max-age=0";
      document.cookie = "admin_token=; path=/; max-age=0";
    }
    signOut({ callbackUrl: "/" });
  }

  async function goAdmin() {
    if (!session?.accessToken) return;
    const res = await fetch(`${API}/api/auth/admin-session`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem("admin_token", data.access_token);
      localStorage.setItem("admin_display_name", data.display_name);
      localStorage.setItem("admin_role", data.role);
      localStorage.setItem("admin_is_super", String(data.is_super_admin));
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `admin_authed=1; path=/; max-age=${7 * 24 * 3600}; SameSite=Lax${secure}`;
      document.cookie = `admin_token=${data.access_token}; path=/; max-age=${7 * 24 * 3600}; SameSite=Lax${secure}`;
    }
    router.push("/admin/dashboard");
  }

  if (loading) {
    return <div className="min-h-[70vh] flex items-center justify-center"><p className="text-[var(--color-text-muted)]">불러오는 중...</p></div>;
  }
  if (!member) return null;

  const avatarSrc = member.avatar_url
    ? member.avatar_url.startsWith("http") ? member.avatar_url : `${API}${member.avatar_url}`
    : null;
  const initial = (member.name ?? member.nickname ?? "?").charAt(0);
  const joinDate = new Date(member.created_at).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\. /g, ".").replace(/\.$/, "");

  const TABS: { key: TabKey; icon: React.ReactNode; label: string; count?: number }[] = [
    { key: "dash", icon: <IcGrid />, label: "대시보드" },
    { key: "edit", icon: <IcUser />, label: "프로필 편집" },
    { key: "notify", icon: <IcBell />, label: "알림 설정" },
    { key: "inbox", icon: <IcMail />, label: "알림함", count: unreadCount },
    { key: "posts", icon: <IcDoc />, label: "내가 쓴 글", count: posts.length },
  ];

  return (
    <div className="mp-page">
      {/* profile hero */}
      <section className="mp-hero">
        <div className="mp-hero-inner">
          <div className="mp-crumb">
            <span>마이페이지</span>
            <IcChevron />
            <span className="current">{TAB_LABELS[tab]}</span>
          </div>

          <div className="mp-prow">
            <div className="mp-av-lg">
              {avatarSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarSrc} alt={member.nickname} referrerPolicy="no-referrer"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              ) : initial}
            </div>
            <div className="mp-info">
              <h1>
                {member.name ?? member.nickname}
                {member.name && member.nickname && <span className="baptismal">{member.nickname}</span>}
              </h1>
              <div className="meta">
                <span className="role">{member.is_admin ? "관리자" : "회원"}</span>
                <span>가입 {joinDate}</span>
                <span className="sep">·</span>
                <span>{member.is_email_verified ? "이메일 인증 완료" : "이메일 미인증"}</span>
              </div>
            </div>
            <div className="mp-actions">
              {member.is_admin && (
                <button className="pri" onClick={goAdmin}>
                  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="1.5" y="1.5" width="9" height="9" rx="1" /><path d="M3 4h6M3 6h6M3 8h4" /></svg>
                  관리자 페이지
                </button>
              )}
              <button onClick={handleLogout}>
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5 1.5H2v9h3" /><polyline points="7.5 3.5 10.5 6 7.5 8.5" /><line x1="10.5" y1="6" x2="4.5" y2="6" /></svg>
                로그아웃
              </button>
            </div>
          </div>

          <nav className="mp-tabnav">
            {TABS.map((t) => (
              <button key={t.key} className={tab === t.key ? "on" : ""} onClick={() => setTab(t.key)}>
                {t.icon}
                {t.label}
                {t.count != null && t.count > 0 && <span className="count">{t.count}</span>}
              </button>
            ))}
          </nav>
        </div>
      </section>

      <main className="mp-main">
        {tab === "dash" && (
          <>
            {/* KPI */}
            <div className="mp-dash-grid">
              <div className="mp-kpi">
                <div className="lbl">내가 쓴 글</div>
                <div className="num">{posts.length}<sub>편</sub></div>
                <div className={`delta${thisMonth.posts === 0 ? " neg" : ""}`}>{thisMonth.posts > 0 ? `+ ${thisMonth.posts} 이번 달` : "이번 달 없음"}</div>
              </div>
              <div className="mp-kpi">
                <div className="lbl">남긴 댓글</div>
                <div className="num">{comments.length}<sub>개</sub></div>
                <div className={`delta${thisMonth.comments === 0 ? " neg" : ""}`}>{thisMonth.comments > 0 ? `+ ${thisMonth.comments} 이번 달` : "이번 달 없음"}</div>
              </div>
              <div className="mp-kpi">
                <div className="lbl">관심 분과</div>
                <div className="num">{interestCount}<sub>개</sub></div>
                <div className="delta neg">
                  <button type="button" onClick={() => setTab("notify")} className="hover:underline">설정 →</button>
                </div>
              </div>
              <div className="mp-kpi feat">
                <div className="lbl">안 읽은 알림</div>
                <div className="num">{unreadCount}</div>
                <div className="delta">
                  <button type="button" onClick={() => setTab("inbox")} className="hover:underline">알림함 보기 →</button>
                </div>
              </div>
            </div>

            <div className="mp-dash-cols">
              {/* 좌 */}
              <div className="mp-dash-stack">
                <article className="mp-card">
                  <div className="mp-sect-h">
                    <h2>최근 활동</h2>
                    <button type="button" className="all hover:underline" onClick={() => setTab("posts")}>전체 보기 →</button>
                  </div>
                  {feed.length === 0 ? (
                    <p className="text-sm text-[var(--color-text-muted)] py-6 text-center">아직 활동 내역이 없습니다.</p>
                  ) : feed.map((it) => it.kind === "post" ? (
                    <div key={`p${it.p.id}`} className="mp-feed-item">
                      <span className="ic"><IcDoc /></span>
                      <span className="text">
                        <Link href={`/boards/${it.p.board.slug}/${it.p.id}`}>{it.p.title}</Link> 글을 작성했습니다.
                        <span className="sub">{it.p.board.name} · 댓글 {it.p.comment_count} · 조회 {it.p.view_count}</span>
                      </span>
                      <span className="date">{fmtAgo(it.at)}</span>
                    </div>
                  ) : (
                    <div key={`c${it.c.id}`} className="mp-feed-item">
                      <span className="ic"><IcChat /></span>
                      <span className="text">
                        <Link href={`/boards/${it.c.board_slug}/${it.c.post_id}`}>{it.c.post_title}</Link>에 댓글을 남겼습니다.
                        <span className="sub">{it.c.content.length > 40 ? `${it.c.content.slice(0, 40)}…` : it.c.content}</span>
                      </span>
                      <span className="date">{fmtAgo(it.at)}</span>
                    </div>
                  ))}
                </article>

                <article className="mp-card">
                  <div className="mp-sect-h">
                    <h2>저장한 기도·묵상</h2>
                    <Link href="/prayer" className="all">기도문 전체 →</Link>
                  </div>
                  {savedPrayers.length === 0 ? (
                    <p className="text-sm text-[var(--color-text-muted)] py-6 text-center">저장한 기도문이 없습니다. <Link href="/prayer" className="text-[var(--color-primary)] hover:underline">기도문 둘러보기</Link></p>
                  ) : savedPrayers.map((pr) => (
                    <div key={pr.id} className="mp-saved">
                      <span className="bar" />
                      <div>
                        <Link href={`/prayer/${pr.id}`} className="ttl block hover:underline">{pr.title}</Link>
                        <div className="ref">{PRAYER_CATEGORY_LABELS[pr.category as PrayerCategory] ?? pr.category}{pr.scripture ? ` · ${pr.scripture}` : ""}</div>
                      </div>
                      <button className="x" onClick={() => removeSaved(pr.id)} title="저장 해제">×</button>
                    </div>
                  ))}
                </article>
              </div>

              {/* 우 */}
              <div className="mp-dash-stack">
                <article className="mp-card">
                  <div className="mp-sect-h">
                    <h2>다가오는 행사</h2>
                    <Link href="/calendar" className="all">본당 일정 →</Link>
                  </div>
                  {upcoming.length === 0 ? (
                    <p className="text-sm text-[var(--color-text-muted)] py-6 text-center">예정된 행사가 없습니다.</p>
                  ) : upcoming.map((e) => {
                    const d = new Date(e.event_date);
                    const kindColor = e.event_kind === "모임"
                      ? undefined
                      : { background: "rgba(180,83,9,0.1)", color: "var(--cat-service)" };
                    return (
                      <Link key={e.id} href="/calendar" className="mp-evt-row">
                        <div className="date-block">
                          <div className="d">{d.getDate()}</div>
                          <div className="m">{MonthShort(d)}</div>
                        </div>
                        <div>
                          <div className="ttl">{e.title}</div>
                          <div className="meta-sm">{[e.location, e.start_time].filter(Boolean).join(" · ") || "시간 미정"}</div>
                        </div>
                        <span className="pill" style={kindColor}>{e.event_kind ?? "행사"}</span>
                      </Link>
                    );
                  })}
                </article>

                <article className="mp-card">
                  <div className="mp-sect-h">
                    <h2>올해 활동</h2>
                    <span style={{ fontSize: 11, color: "var(--color-text-muted)", fontWeight: 600 }}>{new Date().getFullYear()}년 기준</span>
                  </div>
                  <div className="mp-chart" aria-hidden="true">
                    {monthBars.map((b, i) => (
                      <span key={i} className={`bar${b.c === 0 ? " mute" : ""}`} style={{ height: `${b.h}%` }} />
                    ))}
                  </div>
                  <div className="mp-chart-labels">
                    {monthBars.map((_, i) => <span key={i}>{i + 1}</span>)}
                  </div>
                  <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--color-border)", display: "flex", gap: 14, fontSize: 12, color: "var(--color-text-muted)" }}>
                    <span><b style={{ color: "var(--color-text)", fontVariantNumeric: "tabular-nums" }}>{posts.length}</b>편 발행</span>
                    <span style={{ color: "var(--color-border-dark)" }}>·</span>
                    <span><b style={{ color: "var(--color-text)", fontVariantNumeric: "tabular-nums" }}>{comments.length}</b>개 댓글</span>
                    <span style={{ color: "var(--color-border-dark)" }}>·</span>
                    <span><b style={{ color: "var(--color-text)", fontVariantNumeric: "tabular-nums" }}>{interestCount}</b>개 분과</span>
                  </div>
                </article>

                <article className="mp-card" style={{ background: "var(--color-surface-warm)", borderColor: "var(--color-border-dark)" }}>
                  <div className="mp-sect-h">
                    <h2 style={{ fontSize: 16 }}>계정</h2>
                    <button type="button" className="all hover:underline" onClick={() => setTab("edit")}>편집 →</button>
                  </div>
                  <div className="mp-acct">
                    <div className="row"><span>이메일</span><b>{member.email}</b></div>
                    <div className="row"><span>가입일</span><b>{joinDate}</b></div>
                    <div className="row"><span>로그인 방식</span><b>{member.social_provider ? (member.social_provider === "kakao" ? "카카오" : member.social_provider === "google" ? "구글" : member.social_provider) : "이메일"}</b></div>
                  </div>
                </article>
              </div>
            </div>
          </>
        )}

        {tab === "edit" && <div className="mp-embed"><ProfileEditPage embedded /></div>}
        {tab === "notify" && <div className="mp-embed"><MyInterestsPage embedded /></div>}
        {tab === "inbox" && <div className="mp-embed"><NotificationsPage embedded /></div>}
        {tab === "posts" && <div className="mp-embed"><MyPostsPage embedded /></div>}
      </main>
    </div>
  );
}
