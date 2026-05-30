import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import SectionLayout from "@/components/SectionLayout";
import BannerSlider from "@/components/BannerSlider";
import AboutMiniMap from "./AboutMiniMap";
import { fetchParishMin } from "@/lib/parish";
import {
  pickActive, weeksSince, daysUntil, formatBaptism, formatStartDate,
  type CatechumenClass,
} from "@/lib/catechumen";

// v1.5.452 — force-dynamic → 5분 ISR + 태그 기반 무효화. admin 저장 시 revalidateTag 로 즉시 반영.
export const revalidate = 300;
export async function generateMetadata(): Promise<Metadata> {
  const p = await fetchParishMin();
  return { title: "성당 안내", description: `${p.name} 소개 — 세종시 최초 본당` };
}

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL;

interface MassEntry { day: string; time: string; note: string; }
interface MassSchedule { entries: MassEntry[]; note: string; }
interface ParishOut {
  name: string;
  diocese: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  fax: string | null;
  cafe_url: string | null;
  band_url: string | null;
  description: string | null;
  member_count: number | null;
  founded_at: string | null;
  about_photo_url: string | null;
  mass_schedule: MassSchedule | null;
  // Welcome · About 섹션 (v1.5.423)
  about_welcome_eyebrow: string | null;
  about_welcome_h1: string | null;
  about_welcome_h2: string | null;
  about_welcome_body: string | null;
  about_welcome_signature: string | null;
  about_intro_eyebrow: string | null;
  about_intro_heading: string | null;
}

// 미사 요일 → 시안 라벨 (일 SUN …). 토요일은 특전(다크) 카드.
const DAYS: { key: string; label: string; mod?: "sun" | "special" }[] = [
  { key: "주일", label: "일 SUN", mod: "sun" },
  { key: "월요일", label: "월 MON" },
  { key: "화요일", label: "화 TUE" },
  { key: "수요일", label: "수 WED" },
  { key: "목요일", label: "목 THU" },
  { key: "금요일", label: "금 FRI" },
  { key: "토요일", label: "토 SAT", mod: "special" },
];

async function getParish(): Promise<ParishOut | null> {
  try {
    const res = await fetch(`${API}/api/parish/`, { next: { revalidate: 300, tags: ["parish"] } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// KAKAO_MAP_KEY 는 site_settings DB 단일 source (info 페이지와 동일 패턴).
async function getMapKey(): Promise<string> {
  try {
    const res = await fetch(`${API}/api/public/site-config`, { next: { revalidate: 300, tags: ["parish"] } });
    if (!res.ok) return "";
    const cfg = await res.json();
    return cfg.KAKAO_MAP_KEY ?? "";
  } catch {
    return "";
  }
}

async function getCatechumenClasses(): Promise<CatechumenClass[]> {
  try {
    const res = await fetch(`${API}/api/catechumen/classes`, { next: { revalidate: 300, tags: ["catechumen"] } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function getCommunityCount(): Promise<number | null> {
  try {
    const res = await fetch(`${API}/api/content/community`, { next: { revalidate: 300, tags: ["community"] } });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? data.length : null;
  } catch {
    return null;
  }
}

export default async function AboutPage() {
  const [parish, communityCount, appKey, catechumenClasses] = await Promise.all([
    getParish(),
    getCommunityCount(),
    getMapKey(),
    getCatechumenClasses(),
  ]);

  // 예비자교리 카드 상태 (교육중 / 접수중)
  const { educating, recruiting, latest } = pickActive(catechumenClasses);

  // 키·좌표가 모두 있으면 실제 미니맵, 아니면 기존 격자 placeholder 로 폴백
  const mapLat = parish?.lat ?? null;
  const mapLng = parish?.lng ?? null;
  const mapReady =
    !!appKey && appKey !== "여기에_JavaScript_키_입력" && mapLat !== null && mapLng !== null;

  const entries = parish?.mass_schedule?.entries ?? [];
  const byDay = (day: string) =>
    entries.filter((e) => e.day === day).sort((a, b) => a.time.localeCompare(b.time));
  const foundedYear = parish?.founded_at ? new Date(parish.founded_at).getFullYear() : null;

  const heroSrc = parish?.about_photo_url
    ? parish.about_photo_url.startsWith("http")
      ? parish.about_photo_url
      : `${API}${parish.about_photo_url}`
    : null;

  return (
    <>
      <PageHeader group="성당 소개" title="성당 안내" subtitle="세종시 첫 본당, 함께 짓고 함께 머무는 공동체입니다." />
      <SectionLayout group="about" tools>
        <div className="ab-page">
          <BannerSlider placement="about_top" className="mb-6" />

          {/* HERO */}
          <div className="ab-hero">
            {heroSrc ? (
              <Image src={heroSrc} alt={parish?.name ?? "본당"} fill sizes="(max-width: 768px) 100vw, 920px" style={{ objectFit: "cover" }} priority />
            ) : (
              <div className="ph">성당 사진</div>
            )}
            <div className="overlay">
              <span className="badge"><span className="dot" />{parish?.name ?? "본당"}</span>
            </div>
          </div>

          {/* Welcome — v1.5.423 admin/parish/info 편집 가능. 빈 값이면 기본 문구. */}
          <section className="ab-welcome">
            <div className="eyebrow">{parish?.about_welcome_eyebrow?.trim() || "환영합니다 · Welcome"}</div>
            <h2>
              {parish?.about_welcome_h1?.trim() || "모든 분께,"}
              <br />
              <em>{parish?.about_welcome_h2?.trim() || "주님의 평화가 함께하시기를."}</em>
            </h2>
            <p style={{ whiteSpace: "pre-line" }}>
              {parish?.about_welcome_body?.trim()
                || "처음 오신 분도, 오래 함께해 주신 분도, 이 공동체에서 주님의 따뜻한 손길을 느끼시기를 기도합니다. 우리 성당의 문은 언제나 열려 있습니다."}
            </p>
            <div className="signature">
              <b>{parish?.name ?? "본당"}</b> {parish?.about_welcome_signature?.trim() || "사목회 일동"}
            </div>
          </section>

          {/* Quick facts — 예비자교리 상태 · 입교신청 · 분과/단체 · 본당설립 */}
          <div className="ab-facts">
            {/* 예비자교리 상태 (교육중 / 없음) */}
            <div className="fact">
              {educating ? (
                <>
                  <div className="lbl">제{educating.round_no ?? "?"}차 예비자교리 교육중</div>
                  <div className="val">{weeksSince(educating.start_date!)}주<sub>차</sub></div>
                  <div className="help">
                    {educating.baptism_at
                      ? `세례성사까지 ${daysUntil(educating.baptism_at)}일 · ${formatBaptism(educating.baptism_at)}`
                      : "교육 진행 중"}
                  </div>
                </>
              ) : (
                <>
                  <div className="lbl">예비자교리</div>
                  <div className="val">
                    {(recruiting ?? latest)?.round_no != null ? `제${(recruiting ?? latest)!.round_no}회` : "—"}
                  </div>
                  <div className="help">{recruiting?.apply_note || latest?.apply_note || "입교신청 기간입니다."}</div>
                </>
              )}
            </div>

            {/* 입교신청 */}
            <div className="fact">
              <div className="lbl">{recruiting ? "예비자교리 접수중" : "예비자교리"}</div>
              <div className="val">
                <Link href="/catechumen/apply" style={{ color: "var(--primary)" }} className="hover:underline">
                  입교신청
                </Link>
              </div>
              <div className="help">
                {recruiting?.apply_start_date
                  ? `${formatStartDate(recruiting.apply_start_date)} 시작합니다.`
                  : recruiting?.apply_note || "회원가입 후 신청할 수 있습니다."}
              </div>
            </div>

            {/* 분과 · 단체 */}
            <div className="fact">
              <div className="lbl">분과 · 단체</div>
              <div className="val">{communityCount != null ? communityCount : "—"}{communityCount != null ? <sub>개</sub> : null}</div>
              <div className="help">본당 활동 공동체</div>
            </div>

            {/* 본당 설립 */}
            <div className="fact">
              <div className="lbl">본당 설립</div>
              <div className="val">{foundedYear ?? "—"}{foundedYear ? <sub>년</sub> : null}</div>
              <div className="help">{parish?.diocese ? `천주교 ${parish.diocese}` : "대전교구"}</div>
            </div>
          </div>

          {/* About — v1.5.423 admin/parish/info 편집 가능. 빈 값이면 기본 문구. */}
          <section className="ab-about">
            <div className="section-eyebrow">{parish?.about_intro_eyebrow?.trim() || "About · 우리 성당"}</div>
            <h2>{parish?.about_intro_heading?.trim() || `${parish?.name ?? "우리 성당"}, 함께 짓고 함께 머무는 공동체입니다.`}</h2>
            {parish?.description ? (
              <p style={{ whiteSpace: "pre-line" }}>{parish.description}</p>
            ) : (
              <>
                <p>세종시에 새로 자라나는 본당으로, 매주 미사와 기도, 분과 활동과 봉사를 통해 그리스도의 제자로 살아가는 공동체입니다.</p>
                <p>수호성인의 이름 아래, 한 반석 위에 세워지는 공동체. 우리는 한 해 한 해를 함께 짓고 있습니다.</p>
              </>
            )}
            <div className="stats">
              <div className="s"><b>{foundedYear ?? "—"}</b><span>본당 설립</span></div>
              <div className="s"><b>{parish?.diocese ?? "대전"}</b><span>교구 소속</span></div>
              <div className="s"><b>{parish?.member_count ? `${Math.round(parish.member_count / 1000)}천+` : (communityCount ?? "—")}</b><span>{parish?.member_count ? "교적 신자" : "분과 · 단체"}</span></div>
            </div>
          </section>

          {/* Mass times */}
          <section className="ab-mass">
            <div className="section-eyebrow">Mass Schedule · 미사 시간</div>
            <h2>매주 함께 모이는 시간.</h2>
            <div className="ab-mass-grid">
              {DAYS.map((d) => {
                const list = byDay(d.key);
                return (
                  <div key={d.key} className={`ab-mass-day${d.mod ? ` ${d.mod}` : ""}`}>
                    <div className="day">{d.label}</div>
                    <div className="times">
                      {list.length === 0 ? (
                        <span className="none">—</span>
                      ) : list.map((e, i) => (
                        <div key={i}>
                          <div className="t">{e.time}</div>
                          {e.note && <div className="tlbl">{e.note}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="ab-mass-note">
              <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="7" cy="7" r="5" /><line x1="7" y1="4" x2="7" y2="7.5" /><circle cx="7" cy="10" r="0.7" fill="currentColor" /></svg>
              <span>
                {parish?.mass_schedule?.note ? `${parish.mass_schedule.note} ` : "대축일·특별 전례 일정은 별도 공지를 따라 주세요. "}
                <Link href="/calendar">본당 일정 →</Link>
              </span>
            </div>
          </section>

          {/* Visit */}
          <section className="ab-visit">
            <div className="head">
              <div>
                <div className="section-eyebrow">Visit · 찾아오시는 길</div>
                <h2>찾아오시는 길</h2>
              </div>
              <Link href="/info" className="full-link">오시는 길 자세히 →</Link>
            </div>
            <div className="ab-visit-grid">
              {mapReady ? (
                <AboutMiniMap name={parish?.name ?? "본당"} appKey={appKey} lat={mapLat!} lng={mapLng!} />
              ) : (
                <Link href="/info" className="ab-map" aria-label="오시는 길">
                  <div className="map-ph">
                    <div className="pin">
                      <span className="pin-dot" />
                      <span className="pin-label">{parish?.name ?? "본당"}</span>
                    </div>
                  </div>
                </Link>
              )}
              <div className="ab-visit-info">
                {parish?.address && (
                  <div className="ab-visit-item">
                    <span className="ico">
                      <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M9 1c-3.5 0-6 2.5-6 6 0 4 6 10 6 10s6-6 6-10c0-3.5-2.5-6-6-6z" /><circle cx="9" cy="7.5" r="2.5" /></svg>
                    </span>
                    <div>
                      <div className="lbl">주소</div>
                      <div className="val">{parish.address}</div>
                    </div>
                  </div>
                )}
                {parish?.phone && (
                  <div className="ab-visit-item">
                    <span className="ico">
                      <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 3h3l1.5 4-2 1.5a9 9 0 0 0 4 4l1.5-2 4 1.5v3a1 1 0 0 1-1 1A13 13 0 0 1 3 4a1 1 0 0 1 1-1z" /></svg>
                    </span>
                    <div>
                      <div className="lbl">연락</div>
                      <div className="val">
                        <a href={`tel:${parish.phone.replace(/[^0-9+]/g, "")}`}>{parish.phone}</a>
                        {parish.fax && <small>fax {parish.fax}</small>}
                      </div>
                    </div>
                  </div>
                )}
                {(parish?.cafe_url || parish?.band_url) && (
                  <div className="ab-visit-item">
                    <span className="ico">
                      <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="9" cy="9" r="7" /><path d="M2 9h14M9 2c2 2.5 2 11.5 0 14M9 2c-2 2.5-2 11.5 0 14" /></svg>
                    </span>
                    <div>
                      <div className="lbl">온라인</div>
                      <div className="val" style={{ fontSize: 14 }}>
                        {parish.cafe_url && <a href={parish.cafe_url} target="_blank" rel="noopener noreferrer">카페</a>}
                        {parish.cafe_url && parish.band_url && " · "}
                        {parish.band_url && <a href={parish.band_url} target="_blank" rel="noopener noreferrer">밴드</a>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* CTA */}
          <div className="ab-cta">
            <div>
              <div className="lead">함께하기</div>
              <h2>처음 오셨나요?<br /><em>편하게 문의해 주세요.</em></h2>
            </div>
            <div className="actions">
              {parish?.phone && (
                <a href={`tel:${parish.phone.replace(/[^0-9+]/g, "")}`} className="btn-pri">
                  전화 문의
                  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="2" y1="7" x2="12" y2="7" /><polyline points="8 3 12 7 8 11" /></svg>
                </a>
              )}
              <Link href="/info" className="btn-sec">오시는 길</Link>
            </div>
          </div>

          <BannerSlider placement="about_bottom" className="mt-8" />
        </div>
      </SectionLayout>
    </>
  );
}
