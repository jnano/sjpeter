"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Props {
  content: string;
  /** 본문 글자 크기. sm=14px(기본) · base=16px (게시글 본문 등 가독성 우선). */
  size?: "sm" | "base";
}

/** YouTube URL 에서 비디오 ID 추출. 인식 못 하면 null. */
function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    if (u.hostname.endsWith("youtube.com") || u.hostname.endsWith("youtube-nocookie.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      if (u.pathname.startsWith("/embed/")) return u.pathname.slice("/embed/".length);
      if (u.pathname.startsWith("/shorts/")) return u.pathname.slice("/shorts/".length);
    }
    return null;
  } catch { return null; }
}

/** Naver TV URL 에서 비디오 ID 추출. 인식 못 하면 null. */
function naverTvId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "tv.naver.com") {
      const m = u.pathname.match(/^\/(?:v|embed)\/(\d+)/);
      return m ? m[1] : null;
    }
    return null;
  } catch { return null; }
}

/** naver.me 단축 URL → 공유 코드. 인식 못 하면 null. */
function naverShareCode(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "naver.me") {
      const code = u.pathname.slice(1);
      return /^[A-Za-z0-9]{1,40}$/.test(code) ? code : null;
    }
    return null;
  } catch { return null; }
}

/** naver.me 공유 URL 을 백엔드 resolver 로 풀어 Naver TV 임베드 시도.
 *  CORS 때문에 클라이언트에서 직접 redirect 추적 못 함 → /api/util/resolve-naver-share 호출. */
function NaverShareEmbed({ code, originalUrl }: { code: string; originalUrl: string }) {
  const [videoId, setVideoId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/api/util/resolve-naver-share?code=${encodeURIComponent(code)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        setVideoId(d?.video_id ?? null);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => { cancelled = true; };
  }, [code]);

  if (!loaded) {
    return (
      <div className="my-4 w-full aspect-video rounded-lg border border-[var(--color-border)] bg-gray-50 flex items-center justify-center text-sm text-[var(--color-text-muted)]">
        동영상 불러오는 중…
      </div>
    );
  }
  if (videoId) {
    return <VideoEmbed src={`https://tv.naver.com/embed/${videoId}`} title="Naver TV video" />;
  }
  // Naver TV 아니거나 resolve 실패 — 일반 외부 링크로
  return (
    <a href={originalUrl} target="_blank" rel="noopener noreferrer">
      {originalUrl}
    </a>
  );
}

function VideoEmbed({ src, title }: { src: string; title: string }) {
  return (
    <div className="my-4 relative w-full aspect-video rounded-lg overflow-hidden border border-[var(--color-border)]">
      <iframe
        src={src}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        loading="lazy"
        className="absolute inset-0 w-full h-full"
      />
    </div>
  );
}

export default function MarkdownContent({ content, size = "sm" }: Props) {
  const proseSize = size === "base" ? "prose-base" : "prose-sm";
  return (
    <div className={`prose ${proseSize} max-w-none text-[var(--color-text)] leading-relaxed
      prose-headings:text-[var(--color-primary)] prose-headings:font-bold
      prose-a:text-[var(--color-primary)] prose-a:no-underline hover:prose-a:underline
      prose-blockquote:border-l-4 prose-blockquote:border-l-[var(--color-primary)]
      prose-blockquote:bg-[var(--color-surface-warm)] prose-blockquote:rounded-r-lg
      prose-blockquote:px-5 prose-blockquote:py-3 prose-blockquote:not-italic
      prose-blockquote:text-[var(--color-text)] prose-blockquote:my-4
      prose-blockquote:[&_p]:my-1
      prose-code:bg-gray-100 prose-code:px-1 prose-code:rounded prose-code:text-sm
      prose-pre:bg-gray-100 prose-pre:rounded-lg prose-pre:overflow-x-auto
      prose-img:rounded-lg prose-img:border prose-img:border-[var(--color-border)]
      prose-hr:border-[var(--color-border)]`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          img({ src, alt }) {
            if (!src) return null;
            // eslint-disable-next-line @next/next/no-img-element
            return <img src={src} alt={alt ?? ""} className="rounded-lg border border-[var(--color-border)]" />;
          },
          // YouTube / Naver TV URL 을 자동 iframe 임베드. 텍스트가 URL 과 같을 때(자동 링크)만 변환.
          a({ href, children }) {
            const url = typeof href === "string" ? href : "";
            const sole = Array.isArray(children) && children.length === 1
              ? String(children[0])
              : typeof children === "string" ? children : "";
            const isAutoLink = sole === url;
            if (url && isAutoLink) {
              const yt = youtubeId(url);
              if (yt) return <VideoEmbed src={`https://www.youtube.com/embed/${yt}`} title="YouTube video" />;
              const nv = naverTvId(url);
              if (nv) return <VideoEmbed src={`https://tv.naver.com/embed/${nv}`} title="Naver TV video" />;
              const shareCode = naverShareCode(url);
              if (shareCode) return <NaverShareEmbed code={shareCode} originalUrl={url} />;
            }
            return (
              <a href={url} target={url.startsWith("http") ? "_blank" : undefined} rel={url.startsWith("http") ? "noopener noreferrer" : undefined}>
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
