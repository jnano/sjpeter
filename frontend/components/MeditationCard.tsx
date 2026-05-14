import Link from "next/link";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface MeditationContent {
  id: number;
  title: string;
  scripture: string | null;
  body: string;
  author: string | null;
  published_date: string;
  background_image_url?: string | null;
  background_repeat?: boolean;
  background_position?: string;
  background_blur?: number;
  background_opacity?: number;
  background_gradient?: string;
  background_gradient_size?: number;
  body_font_size_px?: number;
}

const POSITION_TO_CSS: Record<string, string> = {
  "top-left": "top left",
  "top-center": "top center",
  "top-right": "top right",
  "bottom-left": "bottom left",
  "bottom-center": "bottom center",
  "bottom-right": "bottom right",
};

const GRADIENT_DIRECTION: Record<string, string | null> = {
  none: null,
  top: "to bottom",     // 위가 진하고 → 아래로 사라짐
  bottom: "to top",     // 아래가 진하고 → 위로 사라짐
  left: "to right",     // 왼쪽이 진하고 → 오른쪽으로 사라짐
  right: "to left",     // 오른쪽이 진하고 → 왼쪽으로 사라짐
};

/** 그라데이션 mask CSS 값을 만든다. size = 페이드가 끝나는 위치(%). */
function buildGradientMask(direction: string | null, sizePct: number): string | null {
  if (!direction) return null;
  const clamped = Math.max(10, Math.min(100, sizePct));
  return `linear-gradient(${direction}, rgba(0,0,0,1), rgba(0,0,0,0) ${clamped}%)`;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

function resolveImageUrl(url: string): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API}${url}`;
}

/** 묵상 본문 박스 — 배경 이미지·반복·시작점·흐림 적용. */
export function MeditationCard({
  meditation,
  footer,
}: {
  meditation: MeditationContent;
  footer?: ReactNode;
}) {
  const bgUrl = meditation.background_image_url || "";
  const repeat = !!meditation.background_repeat;
  const position = POSITION_TO_CSS[meditation.background_position ?? "top-left"] ?? "top left";
  const blur = Math.max(0, Math.min(40, meditation.background_blur ?? 0));
  const opacityRaw = meditation.background_opacity;
  const opacity = Math.max(0, Math.min(100, typeof opacityRaw === "number" ? opacityRaw : 100)) / 100;
  const gradientKey = meditation.background_gradient ?? "none";
  const gradientSize = Math.max(10, Math.min(100, meditation.background_gradient_size ?? 100));
  const gradientMask = buildGradientMask(GRADIENT_DIRECTION[gradientKey] ?? null, gradientSize);
  const bodyFontSize = Math.max(
    12, Math.min(32, meditation.body_font_size_px ?? 15),
  );

  return (
    <article className="relative bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden">
      {/* 배경 레이어 — 흐림·투명도·그라데이션 마스크가 텍스트에 번지지 않게 별도 absolute,
          scale 로 blur 가장자리 가림. mask 는 webkit prefix 도 함께 지정해야 사파리에서 동작. */}
      {bgUrl && (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `url("${resolveImageUrl(bgUrl)}")`,
            backgroundRepeat: repeat ? "repeat" : "no-repeat",
            backgroundPosition: repeat ? "top left" : position,
            backgroundSize: repeat ? "auto" : "contain",
            filter: blur > 0 ? `blur(${blur}px)` : "none",
            transform: blur > 0 ? "scale(1.06)" : "none",
            opacity,
            ...(gradientMask
              ? {
                  maskImage: gradientMask,
                  WebkitMaskImage: gradientMask,
                }
              : {}),
          }}
        />
      )}

      {/* 내용 레이어 */}
      <div className="relative z-10">
        {/* 헤더 */}
        <div className="px-8 pt-8 pb-6 border-b border-[var(--color-border)]/60">
          {meditation.scripture && (
            <p className="text-xs font-medium text-[var(--color-accent)] uppercase tracking-widest mb-3">
              {meditation.scripture}
            </p>
          )}
          <h2 className="font-serif text-2xl font-bold text-[var(--color-text)] mb-3 leading-snug">
            {meditation.title}
          </h2>
          <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
            <span>{formatDate(meditation.published_date)}</span>
            {meditation.author && (
              <>
                <span className="text-[var(--color-border)]">·</span>
                <span>{meditation.author}</span>
              </>
            )}
          </div>
        </div>

        {/* 본문 — 마크다운 렌더링 (단일 줄바꿈은 remark-breaks 로 <br> 유지) */}
        <div className="px-8 py-8">
          <div
            className="prose prose-neutral max-w-none font-serif text-[var(--color-text)] leading-[2] prose-p:my-3 prose-headings:font-serif prose-headings:text-[var(--color-text)] prose-a:text-[var(--color-primary)] prose-blockquote:border-l-[var(--color-accent)] prose-blockquote:text-[var(--color-text-muted)]"
            style={{ fontSize: `${bodyFontSize}px` }}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkBreaks]}
              // 보안: react-markdown 은 기본적으로 raw HTML 을 렌더링하지 않음
            >
              {meditation.body}
            </ReactMarkdown>
          </div>
        </div>

        {/* 하단 */}
        {footer && <div className="px-8 pb-6">{footer}</div>}
      </div>
    </article>
  );
}

/** 기본 하단 네비 — 오늘의 묵상 페이지용. */
export function CurrentMeditationFooter() {
  return (
    <div className="flex justify-end">
      <Link
        href="/meditation/archive"
        className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
      >
        이전 묵상 보기 →
      </Link>
    </div>
  );
}

/** 기본 하단 네비 — 아카이브 상세 페이지용. */
export function ArchiveDetailFooter() {
  return (
    <div className="flex justify-between items-center">
      <Link
        href="/meditation/archive"
        className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
      >
        ← 아카이브 목록
      </Link>
      <Link
        href="/meditation"
        className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
      >
        오늘의 묵상 →
      </Link>
    </div>
  );
}
