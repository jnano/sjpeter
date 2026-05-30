import Image from "next/image";

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Props {
  /** 원본 src 또는 /uploads/... 상대 경로. http로 시작하면 그대로, 아니면 API prefix. */
  src: string;
  alt: string;
  /** 컨테이너 비율(예: 4/3, 16/9, 1/1). undefined면 부모 크기 따름. */
  aspect?: string;
  className?: string;
  /** sizes 속성 — 반응형 srcset 생성용. 디폴트는 모바일 50vw / 데스크탑 25vw. */
  sizes?: string;
  /** LCP 후보 첫 카드 등은 priority=true. */
  priority?: boolean;
  /** object-fit 모드 — 디폴트 cover. */
  fit?: "cover" | "contain";
}

/**
 * 6 스킨의 갤러리 썸네일 공용 컴포넌트 (v1.5.453).
 *
 * 기존: `<img src={`${API}${p.thumbnail_url}`} alt={p.title} />` 6 스킨 동일 반복
 * 변경: `<Image fill sizes=…>` 로 AVIF 자동 변환·LCP/CLS 보호·반응형 srcset.
 *
 * 부모 컨테이너에 `position: relative` 또는 `aspect` prop 필수 (fill 모드 요구).
 */
export default function ThumbnailImage({
  src,
  alt,
  aspect,
  className,
  sizes = "(max-width: 768px) 50vw, 25vw",
  priority = false,
  fit = "cover",
}: Props) {
  const resolved = src.startsWith("http") ? src : `${API}${src}`;
  const wrapperStyle: React.CSSProperties = aspect
    ? { position: "relative", aspectRatio: aspect, width: "100%" }
    : { position: "relative", width: "100%", height: "100%" };
  return (
    <div className={className} style={wrapperStyle}>
      <Image
        src={resolved}
        alt={alt}
        fill
        sizes={sizes}
        style={{ objectFit: fit }}
        priority={priority}
      />
    </div>
  );
}
