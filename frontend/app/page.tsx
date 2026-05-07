import Link from "next/link";
import type { Bulletin } from "@/lib/api";
import HomeBoards from "./HomeBoards";

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
async function getGospelToday(): Promise<GospelToday | null> {
  try {
    const r = await fetch(`${API}/api/gospel/today`, { next: { revalidate: 3600 } });
    if (!r.ok) return null;
    const json = await r.json();
    return json.success ? json.data : null;
  } catch { return null; }
}

const quickLinks = [
  { href: "/about", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width={26} height={26}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, label: "미사 시간" },
  { href: "/info", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width={26} height={26}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>, label: "오시는 길" },
  { href: "/bulletin", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width={26} height={26}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>, label: "주보" },
  { href: "/boards", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width={26} height={26}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>, label: "게시판" },
  { href: "/community", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width={26} height={26}><circle cx="17" cy="21" r="1"/><circle cx="9" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>, label: "단체/분과" },
];

const communities = [
  { href: "/community", icon: "⚖️", name: "사목평의회", en: "Parish Council" },
  { href: "/community", icon: "🌹", name: "레지오마리애", en: "Legion of Mary" },
  { href: "/community", icon: "🎵", name: "성가대", en: "Choir" },
  { href: "/community", icon: "📖", name: "교육분과", en: "Education" },
  { href: "/community", icon: "✝️", name: "청년부", en: "Youth Ministry" },
  { href: "/community", icon: "🤝", name: "봉사단체", en: "Volunteers" },
];

export default async function HomePage() {
  const [parish, notices, bulletins, gospel] = await Promise.all([getParish(), getNotices(), getBulletins(), getGospelToday()]);

  const entries = parish?.mass_schedule?.entries ?? [];
  const sorted = [...entries].sort((a, b) => {
    const d = (DAY_ORDER[a.day] ?? 99) - (DAY_ORDER[b.day] ?? 99);
    return d !== 0 ? d : a.time.localeCompare(b.time);
  });
  const massDays = Object.keys(DAY_ORDER).filter((d) => sorted.some((e) => e.day === d));

  const tickerText = notices.slice(0, 4).map((n) => n.title).join("  |  ") || "공지사항이 없습니다.";

  return (
    <div style={{ fontFamily: "var(--font-sans)" }}>

      {/* ── HERO ── */}
      <section style={{
        minHeight: "100vh", background: "var(--navy-deep)",
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative", overflow: "hidden",
      }}>
        {/* 로즈 윈도우 SVG */}
        <svg style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "min(900px,130vw)", height: "min(900px,130vw)", opacity: 0.06, animation: "slowRotate 140s linear infinite", pointerEvents: "none" }} viewBox="0 0 400 400" fill="none">
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
        {/* 글로우 */}
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 55% 70% at 50% 38%, rgba(184,151,90,0.09) 0%, transparent 70%)" }} />
        {/* 콘텐츠 */}
        <div style={{ position: "relative", zIndex: 2, textAlign: "center", padding: "40px 24px", maxWidth: "820px" }}>
          <p style={{ fontFamily: PF, fontStyle: "italic", fontSize: "13px", color: "var(--gold)", letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: "22px" }}>
            Parochia Sancti Petri · Sejong · 대전교구
          </p>
          <h1 style={{ fontFamily: PF, fontSize: "clamp(50px,8vw,92px)", fontWeight: 700, color: "#fff", lineHeight: 1.02, letterSpacing: "-0.01em", margin: 0 }}>
            St. Peter
            <em style={{ display: "block", fontStyle: "italic", color: "var(--gold-light)", fontSize: "0.65em" }}>Parish</em>
          </h1>
          <p style={{ fontSize: "clamp(18px,2.8vw,26px)", fontWeight: 600, color: "rgba(232,216,180,0.85)", letterSpacing: "0.22em", margin: "16px 0 28px" }}>
            세종 성베드로 성당
          </p>
          {/* 구분선 */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "14px", margin: "0 auto 26px", width: "280px" }}>
            <div style={{ flex: 1, height: "1px", background: "linear-gradient(to right, transparent, var(--gold))" }} />
            <span style={{ color: "var(--gold)" }}>✦</span>
            <div style={{ flex: 1, height: "1px", background: "linear-gradient(to left, transparent, var(--gold))" }} />
          </div>
          <p style={{ fontSize: "15px", color: "rgba(232,216,180,0.58)", lineHeight: 2.1, maxWidth: "480px", margin: "0 auto 44px", fontWeight: 300 }}>
            반석 위에 세워진 교회,<br/>
            하느님의 사랑 안에서 함께 걷는 세종 성베드로 본당입니다.
          </p>
          <div style={{ display: "flex", gap: "14px", justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/about" style={{ display: "inline-block", background: "var(--gold)", color: "#fff", padding: "12px 28px", borderRadius: "2px", fontWeight: 600, fontSize: "14px", textDecoration: "none", letterSpacing: "0.05em" }}>
              미사 시간표
            </Link>
            <Link href="/about" style={{ display: "inline-block", border: "1px solid rgba(232,216,180,0.4)", color: "rgba(232,216,180,0.9)", padding: "12px 28px", borderRadius: "2px", fontWeight: 400, fontSize: "14px", textDecoration: "none", letterSpacing: "0.05em" }}>
              본당 안내
            </Link>
          </div>
        </div>
        {/* 스크롤 인디케이터 */}
        <div style={{ position: "absolute", bottom: "28px", left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: "7px" }}>
          <span style={{ fontSize: "10px", color: "rgba(184,151,90,0.45)", letterSpacing: "0.3em" }}>SCROLL</span>
          <div style={{ width: "1px", height: "44px", background: "linear-gradient(to bottom, var(--gold), transparent)" }} />
        </div>
      </section>

      {/* ── TICKER ── */}
      <div style={{ background: "var(--burgundy)", padding: "10px 40px", display: "flex", alignItems: "center", gap: "20px", overflow: "hidden" }}>
        <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.2em", color: "rgba(255,255,255,0.9)", textTransform: "uppercase", whiteSpace: "nowrap", flexShrink: 0, paddingRight: "16px", borderRight: "1px solid rgba(255,255,255,0.2)" }}>
          알림
        </span>
        <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.85)", fontWeight: 300, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", margin: 0 }}>
          {tickerText}
        </p>
      </div>

      {/* ── QUICK LINKS ── */}
      <div style={{ background: "var(--navy)", borderBottom: "1px solid var(--border-gold)" }}>
        <div className="quick-links-grid" style={{ maxWidth: "1200px", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(5,1fr)" }}>
          {quickLinks.map((q) => (
            <Link key={q.href + q.label} href={q.href} style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "22px 16px", gap: "8px", textDecoration: "none", color: "rgba(232,216,180,0.75)", borderRight: "1px solid rgba(184,151,90,0.1)", transition: "background 0.2s" }}>
              <span style={{ color: "var(--gold)", opacity: 0.8 }}>{q.icon}</span>
              <span style={{ fontSize: "12.5px", fontWeight: 500, letterSpacing: "0.05em" }}>{q.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── MASS SCHEDULE ── */}
      <div className="mass-section" style={{ background: "var(--cream-dark)", padding: "60px 40px" }}>
        <div className="mass-inner" style={{ maxWidth: "1200px", margin: "0 auto", display: "grid", gridTemplateColumns: "260px 1fr", gap: "60px", alignItems: "center" }}>
          {/* 좌측 소개 */}
          <div>
            <p style={{ fontSize: "11px", color: "var(--gold)", letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: "8px", fontFamily: PF, fontStyle: "italic" }}>Liturgy</p>
            <h2 style={{ fontFamily: PF, fontSize: "28px", fontWeight: 700, color: "var(--navy)", marginBottom: "12px", marginTop: 0 }}>미사 시간표</h2>
            <p style={{ fontSize: "14px", color: "var(--text-soft)", fontWeight: 300, lineHeight: 1.9, margin: "0 0 20px" }}>
              미사 시간은 변동될 수 있으니<br/>성당 사무실로 확인해 주십시오.
              {parish?.phone && <><br/>☎ {parish.phone}</>}
            </p>
            <Link href="/about" style={{ display: "inline-block", background: "var(--gold)", color: "#fff", padding: "10px 22px", borderRadius: "2px", fontSize: "13px", fontWeight: 600, textDecoration: "none", letterSpacing: "0.05em" }}>
              전체 미사 안내 →
            </Link>
          </div>
          {/* 우측 그리드 */}
          {massDays.length === 0 ? (
            <p style={{ color: "var(--stone)", fontSize: "14px" }}>미사 시간 정보가 없습니다.</p>
          ) : (
            <div className="mass-days-scroll">
            <div className="mass-days-grid" style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(massDays.length, 4)}, 1fr)`, gap: "1px", background: "var(--border-gold)", border: "1px solid var(--border-gold)" }}>
              {massDays.map((day) => {
                const dayEntries = sorted.filter((e) => e.day === day);
                return (
                  <div key={day} className="mass-day-card" style={{ background: "#fff", padding: "24px 18px", textAlign: "center" }}>
                    <div style={{ fontFamily: PF, fontStyle: "italic", fontSize: "12px", color: "var(--gold)", letterSpacing: "0.18em", marginBottom: "12px" }}>
                      {day}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {dayEntries.map((e, i) => (
                        <div key={i} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <div style={{ fontSize: "18px", fontWeight: 300, color: "var(--navy)" }}>{e.time}</div>
                          {e.note && (
                            <div style={{ fontSize: "10.5px", color: "var(--stone)", letterSpacing: "0.06em" }}>{e.note}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 게시판 + 사이드바 ── */}
      <div className="boards-section" style={{ maxWidth: "1200px", margin: "0 auto", padding: "72px 40px", display: "grid", gridTemplateColumns: "1fr 340px", gap: "48px" }}>
        {/* 게시판 탭 */}
        <HomeBoards notices={notices.slice(0, 7)} bulletins={bulletins.slice(0, 5)} />

        {/* 사이드바 */}
        <aside>
          {/* 오늘의 말씀 */}
          <div style={{ marginBottom: "32px" }}>
            <div style={{ background: "var(--navy)", padding: "24px 20px", color: "#fff" }}>
              <p style={{ fontSize: "11px", color: "rgba(184,151,90,0.55)", marginBottom: "4px", letterSpacing: "0.06em" }}>
                {gospel?.date
                  ? new Date(gospel.date).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" })
                  : new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}
              </p>
              <p style={{ fontFamily: PF, fontStyle: "italic", fontSize: "13px", color: "var(--gold)", marginBottom: "12px", letterSpacing: "0.12em" }}>
                오늘의 말씀{gospel?.liturgical_season ? ` · ${gospel.liturgical_season}` : ""}
              </p>
              {gospel?.gospel_text ? (
                <>
                  <blockquote style={{ fontStyle: "italic", fontSize: "14px", lineHeight: 1.9, color: "rgba(232,216,180,0.82)", margin: 0 }}>
                    &ldquo;{gospel.gospel_text}&rdquo;
                  </blockquote>
                  {gospel.gospel_reference && (
                    <cite style={{ display: "block", fontSize: "11px", color: "rgba(184,151,90,0.6)", marginTop: "12px", letterSpacing: "0.1em", fontStyle: "normal" }}>
                      — {gospel.gospel_reference}
                    </cite>
                  )}
                </>
              ) : (
                <p style={{ fontSize: "13px", color: "rgba(232,216,180,0.5)", fontStyle: "italic" }}>
                  오늘의 말씀을 불러오는 중입니다…
                </p>
              )}
              <a href="/word" style={{ display: "inline-block", marginTop: "14px", fontSize: "11px", color: "rgba(184,151,90,0.7)", textDecoration: "none", letterSpacing: "0.08em", borderBottom: "1px solid rgba(184,151,90,0.3)", paddingBottom: "1px" }}>
                전체 독서 보기 →
              </a>
            </div>
          </div>
          {/* 본당 안내 */}
          <div>
            <div style={{ fontFamily: PF, fontSize: "16px", fontWeight: 700, color: "var(--navy)", paddingBottom: "12px", borderBottom: "2px solid var(--gold)", marginBottom: "18px", letterSpacing: "0.03em" }}>
              본당 안내
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {[
                { label: "주소", value: parish?.address },
                { label: "전화", value: parish?.phone },
                { label: "팩스", value: parish?.fax },
                { label: "사무실", value: "평일 09:00 – 17:00" },
              ].filter((r) => r.value).map((r) => (
                <li key={r.label} style={{ display: "flex", gap: "12px", alignItems: "flex-start", padding: "10px 0", borderBottom: "1px solid var(--border-gold)", fontSize: "13.5px" }}>
                  <span style={{ fontSize: "11px", color: "var(--gold)", fontWeight: 600, letterSpacing: "0.1em", minWidth: "44px", paddingTop: "2px" }}>{r.label}</span>
                  <span style={{ color: "var(--text-soft)", fontWeight: 300, lineHeight: 1.6 }}>{r.value}</span>
                </li>
              ))}
            </ul>
            <Link href="/info" style={{ display: "block", background: "var(--gold)", color: "#fff", padding: "10px 0", borderRadius: "2px", fontSize: "13px", fontWeight: 600, textDecoration: "none", letterSpacing: "0.05em", textAlign: "center", marginTop: "16px" }}>
              오시는 길 →
            </Link>
          </div>
        </aside>
      </div>

      {/* ── PETER FEATURE ── */}
      <section style={{ background: "var(--navy-deep)", padding: "80px 40px", textAlign: "center" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <p style={{ fontSize: "11px", color: "var(--gold)", letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: "14px", fontFamily: PF, fontStyle: "italic" }}>Vita Sancti Petri</p>
          <h2 style={{ fontFamily: PF, fontSize: "clamp(28px,4vw,44px)", color: "#fff", marginBottom: "8px", fontWeight: 700 }}>성 베드로의 생애</h2>
          <p style={{ fontSize: "clamp(15px,2vw,18px)", color: "rgba(232,216,180,0.6)", marginBottom: "32px", fontWeight: 300, letterSpacing: "0.05em" }}>어부에서 교회의 반석으로</p>
          <div style={{ width: "48px", height: "2px", background: "var(--gold)", margin: "0 auto 36px" }} />
          <p style={{ fontSize: "15px", color: "rgba(232,216,180,0.65)", maxWidth: "560px", margin: "0 auto 40px", fontWeight: 300, lineHeight: 2 }}>
            갈릴래아 호수의 어부 시몬은 예수님의 부르심으로 교회의 반석 베드로가 되었습니다.
          </p>
        </div>
      </section>

      {/* ── COMMUNITY STRIP ── */}
      <div className="community-section" style={{ background: "var(--cream-dark)", padding: "60px 40px" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "8px" }}>
            <div>
              <p style={{ fontSize: "11px", color: "var(--gold)", letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: "4px", fontFamily: PF, fontStyle: "italic" }}>Community</p>
              <h2 style={{ fontFamily: PF, fontSize: "clamp(22px,3vw,32px)", color: "var(--navy)", margin: 0, fontWeight: 700 }}>본당 공동체</h2>
            </div>
            <Link href="/community" style={{ background: "var(--gold)", color: "#fff", padding: "10px 22px", borderRadius: "2px", fontSize: "13px", fontWeight: 600, textDecoration: "none" }}>
              전체보기
            </Link>
          </div>
          <div style={{ width: "100%", height: "1px", background: "var(--border-gold)", margin: "20px 0 28px" }} />
          <div className="community-grid" style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: "12px" }}>
            {communities.map((c) => (
              <Link key={c.name} href={c.href} style={{ background: "#fff", padding: "24px 16px", textAlign: "center", border: "1px solid var(--border-gold)", textDecoration: "none", color: "inherit", display: "block", transition: "all 0.25s" }}>
                <div style={{ fontSize: "28px", marginBottom: "10px" }}>{c.icon}</div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--navy)", marginBottom: "4px" }}>{c.name}</div>
                <div style={{ fontSize: "11px", color: "var(--stone)", fontWeight: 300 }}>{c.en}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* 애니메이션 + 반응형 CSS */}
      <style>{`
        @keyframes slowRotate { to { transform: translate(-50%,-50%) rotate(360deg); } }

        @media (max-width: 767px) {
          .quick-links-grid { grid-template-columns: repeat(5, 1fr) !important; }
          .quick-links-grid a { padding: 14px 6px !important; gap: 5px !important; }
          .quick-links-grid a span:last-child { font-size: 11px !important; }

          .mass-section { padding: 36px 16px !important; }
          .mass-inner { grid-template-columns: 1fr !important; gap: 24px !important; }

          .mass-days-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .mass-days-grid {
            display: flex !important;
            background: transparent !important;
            border: 1px solid var(--border-gold) !important;
            gap: 0 !important;
            min-width: max-content;
          }
          .mass-day-card {
            min-width: 100px !important;
            flex-shrink: 0;
            border-right: 1px solid var(--border-gold);
          }
          .mass-day-card:last-child { border-right: none; }

          .boards-section {
            grid-template-columns: 1fr !important;
            padding: 40px 16px !important;
            gap: 32px !important;
          }

          .community-section { padding: 40px 16px !important; }
          .community-grid { grid-template-columns: repeat(3, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}
