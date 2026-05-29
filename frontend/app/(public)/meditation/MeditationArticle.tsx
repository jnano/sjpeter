import Link from "next/link";
import ArticleTools from "@/components/ArticleTools";
import MeditationReactions from "./MeditationReactions";

export interface MeditationData {
  id: number;
  title: string;
  scripture: string | null;
  body: string;
  pull_quote?: string | null;
  practice?: string | null;
  author: string | null;
  published_date: string;
}
export interface NeighborBrief { id: number; title: string; published_date: string; scripture?: string | null; }

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}
function readingMin(body: string): number {
  const chars = (body || "").replace(/\s/g, "").length;
  return Math.max(1, Math.round(chars / 500));
}
/** pull_quote: 줄 중 '—'/'-' 로 시작하는 줄을 출처(cite)로, 나머지를 인용으로 분리 */
function splitPullQuote(pq: string): { quote: string[]; cite: string | null } {
  const lines = pq.split("\n").map((l) => l.trim()).filter(Boolean);
  const cite = lines.find((l) => /^[—–-]/.test(l)) ?? null;
  const quote = lines.filter((l) => !/^[—–-]/.test(l));
  return { quote, cite: cite ? cite.replace(/^[—–-]\s*/, "") : null };
}

/** 주일 말씀 묵상 본문 — meditation.html 시안 재현. */
export default function MeditationArticle({
  meditation, parishName, prev, next,
}: {
  meditation: MeditationData;
  parishName: string;
  prev: NeighborBrief | null;
  next: NeighborBrief | null;
}) {
  const paras = (meditation.body || "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const practiceItems = (meditation.practice || "").split("\n").map((p) => p.trim()).filter(Boolean);
  const pq = meditation.pull_quote ? splitPullQuote(meditation.pull_quote) : null;
  const initial = (meditation.author || "묵").trim().charAt(0) || "묵";

  return (
    <article className="med-article">
      <div className="med-art-eyebrow">주일 말씀 묵상 · Sunday Reflection</div>
      <h1 className="med-art-title">{meditation.title}</h1>

      <div className="med-art-meta">
        <div className="avatar">{initial}</div>
        <div className="author">
          <b>{meditation.author || "주일 말씀 묵상"}</b>
          <span>{parishName} · Sejong</span>
        </div>
        <div className="pub">
          <b>{fmtDate(meditation.published_date)}</b>
          <span>Reading · {readingMin(meditation.body)} min</span>
        </div>
        <ArticleTools divider />
      </div>

      {meditation.scripture && (() => {
        // scripture 끝의 성경 출처(예: "요한 20,19-23")를 ref 박스로 분리, 나머지는 본문
        const m = meditation.scripture.match(/\s*\(?([가-힣]{1,6}\s?\d+[,\s]\s?\d+(?:[-–]\d+)?)\)?\s*$/);
        const ref = m ? m[1] : null;
        const text = m && m.index ? meditation.scripture.slice(0, m.index).trim() : (m ? "" : meditation.scripture);
        return (
          <div className="med-verse">
            <span className="label">오늘의 복음</span>
            <div className="text">
              {text && <b>{text}</b>}
              {ref && <span className="ref">{ref}</span>}
            </div>
          </div>
        );
      })()}

      <div className="med-body">
        {/* whitespace-pre-line: 단락 안의 단일 \n 도 줄바꿈으로 표시 (v1.5.421).
            split(/\n{2,}/) 로 빈 줄 두번 = 단락 분리, 그 안의 단일 \n 은 줄바꿈 유지. */}
        {paras.length === 0 ? <p>본문이 곧 게재됩니다.</p> : paras.map((p, i) => <p key={i} style={{ whiteSpace: "pre-line" }}>{p}</p>)}
      </div>

      {pq && pq.quote.length > 0 && (
        <blockquote className="med-pull">
          <p>{pq.quote.map((l, i) => (<span key={i}>{l}{i < pq.quote.length - 1 && <br />}</span>))}</p>
          {pq.cite && <cite>— {pq.cite}</cite>}
        </blockquote>
      )}

      {practiceItems.length > 0 && (
        <section className="med-practice" id="practice">
          <div className="med-practice-head">
            <div className="med-practice-icon">
              <svg viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6"><polyline points="5 11 9 15 17 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <h3><small>이번 주 실천 — Practice</small>실천합시다.</h3>
          </div>
          <p className="med-practice-intro">한 주 동안 다음을 마음에 새기고 살아갑시다.</p>
          <ol className="med-practice-list">
            {practiceItems.map((item, i) => (
              <li key={i} className="med-practice-item">
                <span className="med-practice-num">{i + 1}</span>
                <p>{item}</p>
              </li>
            ))}
          </ol>
          <div className="med-practice-foot">
            <span className="note">한 주 동안 마음에 새기고, 다음 주일에 함께 나눕니다.</span>
          </div>
        </section>
      )}

      <MeditationReactions meditationId={meditation.id} title={meditation.title} />

      {(prev || next) && (
        <nav className="med-prev-next">
          {prev ? (
            <Link href={`/meditation/archive/${prev.id}`} className="med-pn">
              <span className="med-pn-arrow"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="3" y1="8" x2="13" y2="8" /><polyline points="7 4 3 8 7 12" /></svg></span>
              <div className="info"><div className="lbl">이전 묵상</div><h5>{prev.title}</h5><div className="date">{fmtDate(prev.published_date)}{prev.scripture ? ` · ${prev.scripture}` : ""}</div></div>
            </Link>
          ) : <span />}
          {next ? (
            <Link href={`/meditation/archive/${next.id}`} className="med-pn next">
              <span className="med-pn-arrow"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="3" y1="8" x2="13" y2="8" /><polyline points="9 4 13 8 9 12" /></svg></span>
              <div className="info"><div className="lbl">다음 묵상</div><h5>{next.title}</h5><div className="date">{fmtDate(next.published_date)}{next.scripture ? ` · ${next.scripture}` : ""}</div></div>
            </Link>
          ) : <span />}
        </nav>
      )}
    </article>
  );
}
