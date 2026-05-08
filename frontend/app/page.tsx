import Link from "next/link";
import Image from "next/image";
import type { Bulletin } from "@/lib/api";
import HomeBoards from "./HomeBoards";
import NoticeTicker from "./NoticeTicker";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const PF = "'Playfair Display', var(--font-playfair), Georgia, serif";

const DAY_ORDER: Record<string, number> = {
  "주일": 0, "월요일": 1, "화요일": 2, "수요일": 3,
  "목요일": 4, "금요일": 5, "토요일": 6, "공휴일": 7,
};

interface MassEntry { day: string; time: string; note: string; }
interface Parish {
  name: string; phone: string | null; address: string | null;
  fax: string | null;
  mass_schedule: { entries: MassEntry[]; note: string; } | null;
}
interface Notice { id: number; title: string; is_pinned: boolean; created_at: string; }
interface CommunityGroupDB { id: number; name: string; description: string | null; board_slug: string | null; sort_order: number; }
interface GospelToday {
  date: string;
  liturgical_season: string | null;
  gospel_reference: string | null;
  gospel_text: string | null;
}

async function getParish(): Promise<Parish | null> {
  try { const r = await fetch(`${API}/api/parish/`, { next: { revalidate: 3600 } }); return r.ok ? r.json() : null; } catch { return null; }
}
async function getNotices(): Promise<Notice[]> {
  try { const r = await fetch(`${API}/api/notices/`, { next: { revalidate: 300 } }); return r.ok ? r.json() : []; } catch { return []; }
}
async function getBulletins(): Promise<Bulletin[]> {
  try { const r = await fetch(`${API}/api/bulletins/`, { next: { revalidate: 300 } }); return r.ok ? r.json() : []; } catch { return []; }
}
async function getCommunityGroups(): Promise<CommunityGroupDB[]> {
  try { const r = await fetch(`${API}/api/content/community`, { next: { revalidate: 600 } }); return r.ok ? r.json() : []; } catch { return []; }
}
async function getGospelToday(): Promise<GospelToday | null> {
  try {
    const r = await fetch(`${API}/api/gospel/today`, { next: { revalidate: 3600 } });
    if (!r.ok) return null;
    const json = await r.json();
    return json.success ? json.data : null;
  } catch { return null; }
}


export default async function HomePage() {
  const [parish, notices, bulletins, gospel, communityGroupsDB] = await Promise.all([getParish(), getNotices(), getBulletins(), getGospelToday(), getCommunityGroups()]);

  const entries = parish?.mass_schedule?.entries ?? [];
  const sorted = [...entries].sort((a, b) => {
    const d = (DAY_ORDER[a.day] ?? 99) - (DAY_ORDER[b.day] ?? 99);
    return d !== 0 ? d : a.time.localeCompare(b.time);
  });
  const massDays = Object.keys(DAY_ORDER).filter((d) => sorted.some((e) => e.day === d));

  const pinnedNotices = notices.filter((n) => n.is_pinned);

  const resolvedCommunities = communityGroupsDB.map((g) => ({
    name: g.name,
    description: g.description,
    href: g.board_slug ? `/boards/${g.board_slug}` : "/community",
  }));

  return (
    <div style={{ fontFamily: "var(--font-sans)", overflowX: "hidden" }}>

      {/* ── HERO (65vh) ── */}
      <section style={{
        height: "65vh", minHeight: "480px",
        background: "var(--navy-deep)",
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative", overflow: "hidden", isolation: "isolate",
      }}>
        <Image src="/yakhoun.jpg" alt="" fill priority style={{ objectFit: "cover", objectPosition: "center" }} />
        <div style={{ position: "absolute", inset: 0, background: "rgba(10,18,40,0.62)" }} />
        <svg style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "min(900px,100vw)", height: "min(900px,100vw)", opacity: 0.06, animation: "slowRotate 140s linear infinite", pointerEvents: "none" }} viewBox="0 0 400 400" fill="none">
          <circle cx="200" cy="200" r="196" stroke="#b8975a" strokeWidth="0.4"/>
          <circle cx="200" cy="200" r="158" stroke="#b8975a" strokeWidth="0.4"/>
          <circle cx="200" cy="200" r="110" stroke="#b8975a" strokeWidth="0.4"/>
          <circle cx="200" cy="200" r="60"  stroke="#b8975a" strokeWidth="0.6"/>
          <circle cx="200" cy="200" r="24"  stroke="#b8975a" strokeWidth="1"/>
          <line x1="200" y1="4"   x2="200" y2="396" stroke="#b8975a" strokeWidth="0.25"/>
          <line x1="4"   y1="200" x2="396" y2="200" stroke="#b8975a" strokeWidth="0.25"/>
          <line x1="60"  y1="60"  x2="340" y2="340" stroke="#b8975a" strokeWidth="0.2"/>
          <line x1="340" y1="60"  x2="60"  y2="340" stroke="#b8975a" strokeWidth="0.2"/>
          <line x1="126" y1="8"   x2="274" y2="392" stroke="#b8975a" strokeWidth="0.15"/>
          <line x1="274" y1="8"   x2="126" y2="392" stroke="#b8975a" strokeWidth="0.15"/>
          <circle cx="200" cy="42"  r="16" stroke="#b8975a" strokeWidth="0.4"/>
          <circle cx="200" cy="358" r="16" stroke="#b8975a" strokeWidth="0.4"/>
          <circle cx="42"  cy="200" r="16" stroke="#b8975a" strokeWidth="0.4"/>
          <circle cx="358" cy="200" r="16" stroke="#b8975a" strokeWidth="0.4"/>
          <circle cx="88"  cy="88"  r="16" stroke="#b8975a" strokeWidth="0.4"/>
          <circle cx="312" cy="88"  r="16" stroke="#b8975a" strokeWidth="0.4"/>
          <circle cx="88"  cy="312" r="16" stroke="#b8975a" strokeWidth="0.4"/>
          <circle cx="312" cy="312" r="16" stroke="#b8975a" strokeWidth="0.4"/>
        </svg>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 55% 70% at 50% 38%, rgba(184,151,90,0.09) 0%, transparent 70%)" }} />
        <div style={{ position: "relative", zIndex: 2, textAlign: "center", padding: "40px 24px", maxWidth: "820px" }}>
          <p style={{ fontFamily: PF, fontStyle: "italic", fontSize: "13px", color: "var(--gold)", letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: "22px" }}>
            Parochia Sancti Petri · Sejong · 대전교구
          </p>
          <h1 style={{ fontFamily: PF, fontSize: "clamp(46px,7vw,84px)", fontWeight: 700, color: "#fff", lineHeight: 1.02, letterSpacing: "-0.01em", margin: 0 }}>
            St. Peter
            <em style={{ display: "block", fontStyle: "italic", color: "var(--gold-light)", fontSize: "0.65em" }}>Parish</em>
          </h1>
          <p style={{ fontSize: "clamp(16px,2.4vw,22px)", fontWeight: 600, color: "rgba(232,216,180,0.85)", letterSpacing: "0.22em", margin: "14px 0 24px" }}>
            세종 성베드로 성당
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "14px", margin: "0 auto 22px", width: "280px" }}>
            <div style={{ flex: 1, height: "1px", background: "linear-gradient(to right, transparent, var(--gold))" }} />
            <span style={{ color: "var(--gold)" }}>✦</span>
            <div style={{ flex: 1, height: "1px", background: "linear-gradient(to left, transparent, var(--gold))" }} />
          </div>
          <div style={{ display: "flex", gap: "14px", justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/about" style={{ display: "inline-block", background: "var(--gold)", color: "#fff", padding: "12px 28px", borderRadius: "2px", fontWeight: 600, fontSize: "14px", textDecoration: "none", letterSpacing: "0.05em" }}>
              미사 시간표
            </Link>
            <Link href="/about" style={{ display: "inline-block", border: "1px solid rgba(232,216,180,0.4)", color: "rgba(232,216,180,0.9)", padding: "12px 28px", borderRadius: "2px", fontWeight: 400, fontSize: "14px", textDecoration: "none", letterSpacing: "0.05em" }}>
              본당 안내
            </Link>
          </div>
        </div>
      </section>

      {/* ── TICKER ── */}
      <div className="ticker-section" style={{ background: "var(--burgundy)", padding: "10px 40px", display: "flex", alignItems: "center", gap: "20px", overflow: "hidden" }}>
        <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.2em", color: "rgba(255,255,255,0.9)", textTransform: "uppercase", whiteSpace: "nowrap", flexShrink: 0, paddingRight: "16px", borderRight: "1px solid rgba(255,255,255,0.2)" }}>
          알림
        </span>
        <NoticeTicker notices={pinnedNotices} />
      </div>

      {/* ── INFO SNAPSHOT ── */}
      <div className="snapshot-section" style={{ background: "var(--cream-dark)", padding: "52px 40px" }}>
        <div className="snapshot-grid" style={{ maxWidth: "1200px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", border: "1px solid var(--border-gold)" }}>

          {/* 미사 시간 */}
          <div className="snapshot-col" style={{ padding: "32px 28px", background: "#fff", borderRight: "1px solid var(--border-gold)" }}>
            <p style={{ fontFamily: PF, fontStyle: "italic", fontSize: "11px", color: "var(--gold)", letterSpacing: "0.25em", textTransform: "uppercase", margin: "0 0 6px" }}>Liturgy</p>
            <h3 style={{ fontFamily: PF, fontSize: "20px", fontWeight: 700, color: "var(--navy)", margin: "0 0 22px" }}>미사 시간</h3>
            {massDays.length === 0 ? (
              <p style={{ fontSize: "13px", color: "var(--stone)" }}>미사 시간 정보가 없습니다.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0", marginBottom: "22px" }}>
                {massDays.slice(0, 5).map((day) => {
                  const dayEntries = sorted.filter((e) => e.day === day);
                  return (
                    <div key={day} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "10px 0", borderBottom: "1px solid var(--border-gold)" }}>
                      <span style={{ fontFamily: PF, fontStyle: "italic", fontSize: "13px", color: "var(--gold)", fontWeight: 600, minWidth: "52px" }}>{day}</span>
                      <span style={{ fontSize: "14px", color: "var(--navy)", fontWeight: 300, textAlign: "right" }}>
                        {dayEntries.map((e) => e.time).join(" · ")}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <Link href="/about" style={{ fontSize: "12px", color: "var(--gold)", fontWeight: 600, textDecoration: "none", letterSpacing: "0.05em", borderBottom: "1px solid var(--border-gold)", paddingBottom: "1px" }}>
              전체 미사 안내 →
            </Link>
          </div>

          {/* 최신 공지 */}
          <div className="snapshot-col" style={{ padding: "32px 28px", background: "#fff", borderRight: "1px solid var(--border-gold)" }}>
            <p style={{ fontFamily: PF, fontStyle: "italic", fontSize: "11px", color: "var(--gold)", letterSpacing: "0.25em", textTransform: "uppercase", margin: "0 0 6px" }}>Notice</p>
            <h3 style={{ fontFamily: PF, fontSize: "20px", fontWeight: 700, color: "var(--navy)", margin: "0 0 22px" }}>공지 사항</h3>
            {notices.length === 0 ? (
              <p style={{ fontSize: "13px", color: "var(--stone)" }}>등록된 공지사항이 없습니다.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 22px" }}>
                {notices.slice(0, 5).map((n) => (
                  <li key={n.id} style={{ borderBottom: "1px solid var(--border-gold)" }}>
                    <Link href={`/boards/notice/${n.id}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "10px", padding: "10px 0", textDecoration: "none", color: "inherit" }}>
                      <span style={{ fontSize: "13.5px", color: "var(--navy)", fontWeight: n.is_pinned ? 600 : 400, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {n.is_pinned && <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "var(--burgundy)", marginRight: "7px", verticalAlign: "middle", flexShrink: 0 }} />}
                        {n.title}
                      </span>
                      <span style={{ fontSize: "11px", color: "var(--stone)", whiteSpace: "nowrap", flexShrink: 0 }}>
                        {new Date(n.created_at).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/boards/notice" style={{ fontSize: "12px", color: "var(--gold)", fontWeight: 600, textDecoration: "none", letterSpacing: "0.05em", borderBottom: "1px solid var(--border-gold)", paddingBottom: "1px" }}>
              더 보기 →
            </Link>
          </div>

          {/* 오늘의 말씀 */}
          <div className="snapshot-col" style={{ padding: "32px 28px", background: "var(--navy)" }}>
            <p style={{ fontFamily: PF, fontStyle: "italic", fontSize: "11px", color: "rgba(184,151,90,0.6)", letterSpacing: "0.25em", textTransform: "uppercase", margin: "0 0 6px" }}>Word of God</p>
            <h3 style={{ fontFamily: PF, fontSize: "20px", fontWeight: 700, color: "#fff", margin: "0 0 16px" }}>
              오늘의 말씀
              {gospel?.liturgical_season && (
                <span style={{ display: "block", fontSize: "12px", fontWeight: 400, color: "rgba(184,151,90,0.55)", marginTop: "4px", fontStyle: "italic" }}>{gospel.liturgical_season}</span>
              )}
            </h3>
            {gospel?.gospel_text ? (
              <>
                <blockquote style={{ fontStyle: "italic", fontSize: "14px", lineHeight: 1.9, color: "rgba(232,216,180,0.82)", margin: "0 0 12px", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 6, WebkitBoxOrient: "vertical" } as React.CSSProperties}>
                  &ldquo;{gospel.gospel_text}&rdquo;
                </blockquote>
                {gospel.gospel_reference && (
                  <cite style={{ display: "block", fontSize: "11px", color: "rgba(184,151,90,0.6)", marginBottom: "16px", letterSpacing: "0.1em", fontStyle: "normal" }}>
                    — {gospel.gospel_reference}
                  </cite>
                )}
              </>
            ) : (
              <p style={{ fontSize: "13px", color: "rgba(232,216,180,0.5)", fontStyle: "italic", marginBottom: "16px", lineHeight: 1.8 }}>
                오늘의 말씀을 불러오는 중입니다…
              </p>
            )}
            <a href="/word" style={{ fontSize: "12px", color: "rgba(184,151,90,0.7)", textDecoration: "none", letterSpacing: "0.05em", borderBottom: "1px solid rgba(184,151,90,0.3)", paddingBottom: "1px" }}>
              전체 독서 보기 →
            </a>
          </div>
        </div>
      </div>

      {/* ── 게시판 (사이드바 없음 · 전체 너비) ── */}
      <div className="boards-section" style={{ maxWidth: "1200px", margin: "0 auto", padding: "72px 40px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "24px" }}>
          <div>
            <p style={{ fontFamily: PF, fontStyle: "italic", fontSize: "11px", color: "var(--gold)", letterSpacing: "0.25em", textTransform: "uppercase", margin: "0 0 6px" }}>Bulletin Board</p>
            <h2 style={{ fontFamily: PF, fontSize: "clamp(20px,2.5vw,28px)", color: "var(--navy)", margin: 0, fontWeight: 700 }}>소식</h2>
          </div>
        </div>
        <HomeBoards notices={notices.slice(0, 10)} bulletins={bulletins.slice(0, 7)} />
      </div>

      {/* ── 단체/분과 ── */}
      <div className="community-section" style={{ background: "var(--cream-dark)", padding: "60px 40px" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "8px" }}>
            <div>
              <p style={{ fontFamily: PF, fontStyle: "italic", fontSize: "11px", color: "var(--gold)", letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: "4px" }}>Community</p>
              <h2 style={{ fontFamily: PF, fontSize: "clamp(22px,3vw,32px)", color: "var(--navy)", margin: 0, fontWeight: 700 }}>우리 가족</h2>
            </div>
            <Link href="/community" style={{ background: "var(--gold)", color: "#fff", padding: "10px 22px", borderRadius: "2px", fontSize: "13px", fontWeight: 600, textDecoration: "none" }}>
              전체보기
            </Link>
          </div>
          <div style={{ width: "100%", height: "1px", background: "var(--border-gold)", margin: "20px 0 28px" }} />
          {resolvedCommunities.length === 0 ? (
            <p style={{ fontSize: "14px", color: "var(--stone)" }}>등록된 단체/분과가 없습니다.</p>
          ) : (
            <div className="community-grid" style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(resolvedCommunities.length, 6)}, 1fr)`, gap: "12px" }}>
              {resolvedCommunities.map((c) => (
                <Link key={c.name} href={c.href} style={{ background: "#fff", padding: "24px 16px", textAlign: "center", border: "1px solid var(--border-gold)", textDecoration: "none", color: "inherit", display: "block", transition: "all 0.25s" }}>
                  <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: "var(--cream-dark)", border: "1px solid var(--border-gold)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontSize: "18px", fontWeight: 700, color: "var(--navy)", fontFamily: PF }}>
                    {c.name.slice(0, 1)}
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--navy)", marginBottom: "4px" }}>{c.name}</div>
                  {c.description && (
                    <div style={{ fontSize: "11px", color: "var(--stone)", fontWeight: 300, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as React.CSSProperties}>{c.description}</div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── PETER FEATURE (축소) ── */}
      <section className="peter-section" style={{ background: "var(--navy-deep)", padding: "52px 40px" }}>
        <div className="peter-inner" style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "40px", flexWrap: "wrap" }}>
          <div>
            <p style={{ fontFamily: PF, fontStyle: "italic", fontSize: "11px", color: "var(--gold)", letterSpacing: "0.3em", textTransform: "uppercase", margin: "0 0 10px" }}>Vita Sancti Petri</p>
            <h2 style={{ fontFamily: PF, fontSize: "clamp(22px,3vw,34px)", color: "#fff", margin: "0 0 8px", fontWeight: 700 }}>성 베드로의 생애</h2>
            <p style={{ fontSize: "14px", color: "rgba(232,216,180,0.5)", margin: 0, fontWeight: 300, letterSpacing: "0.05em" }}>어부에서 교회의 반석으로</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "40px", flexWrap: "wrap" }}>
            <p style={{ fontSize: "15px", color: "rgba(232,216,180,0.65)", maxWidth: "440px", fontWeight: 300, lineHeight: 2, margin: 0 }}>
              갈릴래아 호수의 어부 시몬은 예수님의 부르심으로 교회의 반석 베드로가 되었습니다.
            </p>
            <Link href="/about" style={{ display: "inline-block", border: "1px solid rgba(184,151,90,0.4)", color: "rgba(232,216,180,0.88)", padding: "12px 26px", borderRadius: "2px", fontSize: "13px", fontWeight: 400, textDecoration: "none", letterSpacing: "0.06em", whiteSpace: "nowrap", transition: "border-color 0.2s" }}>
              더 알아보기 →
            </Link>
          </div>
        </div>
      </section>

      {/* 애니메이션 + 반응형 CSS */}
      <style>{`
        @keyframes slowRotate { to { transform: translate(-50%,-50%) rotate(360deg); } }

        @media (max-width: 767px) {
          .ticker-section { padding: 10px 16px !important; }
          .peter-section { padding: 40px 16px !important; }

          .snapshot-section { padding: 0 !important; }
          .snapshot-grid {
            grid-template-columns: 1fr !important;
            border: none !important;
          }
          .snapshot-col {
            border-right: none !important;
            border-bottom: 1px solid var(--border-gold);
            padding: 28px 20px !important;
          }
          .snapshot-col:last-child { border-bottom: none; }

          .boards-section {
            padding: 48px 16px !important;
          }

          .community-section { padding: 40px 16px !important; }
          .community-grid { grid-template-columns: repeat(3, 1fr) !important; }

          .peter-inner {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 20px !important;
          }
          .peter-inner > div:last-child {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 16px !important;
          }
        }
      `}</style>
    </div>
  );
}
