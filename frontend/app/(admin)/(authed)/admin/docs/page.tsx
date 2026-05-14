"use client";
import { useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
//  버전 관리: 새 버전 배포 시 CHANGELOG 배열 맨 앞에 항목을 추가하세요.
//  tag: "기능" | "수정" | "디자인" | "인프라"
// ─────────────────────────────────────────────────────────────────────────────
export const CURRENT_VERSION = "1.5.26";
export const LAST_UPDATED = "2026-05-13";

// 버전 규칙:
// - 모든 변경은 patch +1로 누적 (기능/수정 무관)
// - tag로 성격 구분: "기능" | "수정" | "디자인" | "인프라"
// - minor bump (1.5 → 1.6)는 큰 마일스톤에서만
type Tag = "기능" | "수정" | "디자인" | "인프라";

const CHANGELOG: { version: string; date: string; tag: Tag; items: string[] }[] = [
  {
    version: "1.5.26", date: "2026-05-13", tag: "기능",
    items: [
      "주보 AI 추출 카테고리 확장 — '묵상' / '지표' 추가",
      "묵상은 주보 발행일로 meditations에 자동 INSERT (scripture 필드 포함)",
      "사목지표는 추출만 pending 상태로 보관, admin이 visions에 수동 등록",
      "Bedrock client read_timeout 60→300초, max_tokens 4096→8192 (긴 묵상 본문 잘림 방지)",
    ],
  },
  {
    version: "1.5.25", date: "2026-05-13", tag: "수정",
    items: [
      "AI 추출 항목 누락 버그 — _fingerprint에 title 추가",
      "이전: (group_name, event_date, event_type)만 사용 → 날짜·그룹 없는 항목이 같은 event_type이면 한 fp로 뭉쳐 첫 건만 저장됨",
      "75호 사례: 성모 신심미사·성체 강복·병자(영성체)·유아세례 4건이 1건으로 합쳐졌던 문제. 재분석 시 10건 모두 정상 등록",
    ],
  },
  {
    version: "1.5.24", date: "2026-05-13", tag: "수정",
    items: [
      "통합검색 공백 무시 매칭 — '구역 미사' = '구역미사' 동일 결과",
      "검색어와 검색 대상 모두 공백 제거 후 ILIKE (posts/notices/history/vision/community/comments/events)",
    ],
  },
  {
    version: "1.5.23", date: "2026-05-12", tag: "기능",
    items: [
      "/calendar 헤더 년월 라벨을 클릭하면 빠른 선택 팝오버 — 년도 ‹›·12개월 그리드",
      "빠른 점프 버튼: -10년 / -5년 / 작년 / 올해 — 과거 일정 빠르게 접근",
      "오늘 위치 강조 + 현재 보고 있는 월 강조, 바깥 클릭 시 자동 닫힘",
    ],
  },
  {
    version: "1.5.22", date: "2026-05-12", tag: "수정",
    items: [
      "통합검색에 행사·캘린더 결과 포함 — events 테이블의 title/description/location ILIKE 매칭",
      "결과 라벨 '행사·캘린더' + 날짜·종류(행사/모임) 뱃지 표시, 클릭 시 /calendar 이동",
    ],
  },
  {
    version: "1.5.21", date: "2026-05-12", tag: "수정",
    items: [
      "AI 생성 공지·행사의 created_at을 등록 시각이 아닌 주보 발행일로 설정",
      "과거 주보(예: 2025-11-30)를 오늘 업로드해도 게시판/캘린더에서 해당 날짜로 자연 정렬",
      "기존에 오늘 날짜로 잘못 등록된 AI 데이터(notices 10건·events 6건) 발행일로 보정",
    ],
  },
  {
    version: "1.5.20", date: "2026-05-12", tag: "수정",
    items: [
      "주보 수동 재분석(/analyze)도 자동 라우팅까지 수행 — 공지 → notices INSERT, 행사·모임 → events INSERT, 나머지 → ai-extract 게시판",
      "라우팅 로직을 _route_and_save_events 헬퍼로 분리해 자동 분석·수동 분석 양쪽이 동일 동작",
      "이전 manual /analyze는 status='pending'만 만들고 라우팅 누락 — UI '등록 완료' 라벨과 실제 DB 상태가 불일치하던 버그 해결",
    ],
  },
  {
    version: "1.5.19", date: "2026-05-12", tag: "수정",
    items: [
      "주보 AI 추출 0건 문제 해결 — 네이버 카페 등에서 인쇄한 PDF(본문이 이미지인 경우) 자동 인식",
      "is_text_sparse 강화 — URL·페이지번호·시간도장 제거 후 의미 있는 글자 수 카운트",
      "텍스트 분석 0건이면 Vision fallback 자동 — 본문이 이미지인 PDF도 정상 추출",
      "claude_analyzer 진단 로그 추가 — Bedrock 응답 길이/시작 + 파싱 결과 로그",
    ],
  },
  {
    version: "1.5.18", date: "2026-05-12", tag: "기능",
    items: [
      "분과·단체 대표 이미지 — community_groups.representative_photo_url 컬럼 + 업로드/삭제 API",
      "/groups 카드 좌측에 원형 대표 이미지 표시 (없으면 ✝ 아이콘)",
      "/admin/content?tab=community 수정 폼에 대표사진 업로드/변경/삭제 영역 추가",
      "사이드바 hover popup 안정화 — 가로 스크롤 제거 + 동적 maxHeight로 viewport 끝단 접근 가능",
    ],
  },
  {
    version: "1.5.17", date: "2026-05-12", tag: "기능",
    items: [
      "공지에 사진 등록 가능 — 여러 장 업로드, 미리보기, 개별 삭제 (notice_attachments 테이블)",
      "공지 공개 상세 페이지에 사진 갤러리 + 클릭 시 원본 보기",
      "공지 목록에서 사진 첨부 여부를 📷 N 뱃지로 표시",
      "POST/DELETE /api/notices/{id}/attachments — 다중 업로드, 공지 삭제 시 파일 자동 정리",
    ],
  },
  {
    version: "1.5.16", date: "2026-05-12", tag: "기능",
    items: [
      "공지사항 등록 날짜 강제 지정 — 과거 공지를 그 날짜로 등록 가능",
      "날짜 미지정 시 현재 시각 자동 적용, 수정 시 빈 값이면 기존 날짜 유지",
      "NoticeIn.created_at(Optional) + admin 폼에 날짜 입력 추가 (정오 12:00 저장으로 정렬 안정화)",
    ],
  },
  {
    version: "1.5.15", date: "2026-05-12", tag: "기능",
    items: [
      "성당 기본 정보 동적화 — /admin/parish에 성당명 입력 폼 + 로고 업로드/삭제 폼 추가",
      "parishes.logo_url 컬럼 + POST/DELETE /api/parish/logo 엔드포인트",
      "Header 로고/성당명 동적화 — 로고 등록 시 ✝ 자리에 이미지, 텍스트는 parish.name",
      "lib/parish.ts 공통 헬퍼(React cache) — Header·Footer·layout·22개 페이지가 동일 데이터 공유",
      "layout.tsx + 22개 페이지를 generateMetadata로 전환 — 성당명 변경 시 모든 메타/본문 즉시 반영",
      "PageHeader subtitle 하드코딩 일괄 정리 (saint/history/sisters/priests/pastors/info)",
      "주보 카카오 공유 제목·about alt·info 버스 안내도 동적 성당명 사용",
    ],
  },
  {
    version: "1.5.14", date: "2026-05-12", tag: "기능",
    items: [
      "사목지표 본문에 마크다운 에디터(MarkdownEditor) 적용 — 제목(##)·작은 제목(###)·카드 섹션(>)·구분선(---) 지원",
      "/vision 공개 페이지에 MarkdownContent 렌더 — 줄바꿈·단락·카드 박스 자동 시각화",
      "MarkdownContent의 blockquote 스타일 강화 — 좌측 강조 보더 + 따뜻한 배경 + 라운드. 게시판·동적 페이지 인용에도 일관 적용",
    ],
  },
  {
    version: "1.5.13", date: "2026-05-12", tag: "기능",
    items: [
      "사목지표에 본문(body) 입력 추가 — 슬로건 외에 신부님의 한 해 사목 방향·말씀을 단락으로 기록 가능",
      "/vision 공개 페이지에 올해 지표 본문 카드 노출 (줄바꿈 보존)",
      "/admin/content?tab=vision 생성/수정 폼에 textarea 추가, no-store로 즉시 반영",
    ],
  },
  {
    version: "1.5.12", date: "2026-05-12", tag: "기능",
    items: [
      "한 줄 게시판 시스템 — boards.kind('default'|'line') 도입, 게시판 생성/수정 시 형식 선택 가능",
      "한 줄 게시판 전용 UI — 카드 그리드, 종류(위령/감사/청원/기타)·대상·메시지 입력 폼, 페이지네이션",
      "'함께 기도합니다' 추천 토글 — 회원당 1회, 낙관적 UI 업데이트, post_likes 테이블 + UNIQUE 제약",
      "'한줄 봉헌'(/boards/build_offering) 게시판을 line 형식으로 전환 — 메뉴 그룹 '성전건축' 안에서 즉시 활용",
    ],
  },
  {
    version: "1.5.11", date: "2026-05-12", tag: "기능",
    items: [
      "헤더 메뉴 그룹 '성전건축' 신설 — 성전 건축 현황 / 한줄 봉헌 / 성전 사진 3개 항목",
      "게시판 2개 신설: '한줄 봉헌'(/boards/build_offering), '성전 사진'(/boards/build_photo)",
      "공사 일지 → '성전 건축 현황'으로 라벨 일관 통일 (페이지/위젯/관리자 사이드바)",
      "홈 위젯 헤더 '새 성당 짓는 중' → '새 성전 건축'",
    ],
  },
  {
    version: "1.5.10", date: "2026-05-12", tag: "기능",
    items: [
      "성당 건축 공사 일지 시스템 — 단계 마일스톤 + 한 줄 일지 + 정점 사진 슬라이드쇼 (/construction)",
      "홈에 '공사 진행 현황' 위젯 — 등록된 단계가 있을 때만 자동 노출 (현재 단계·전체 진행률·최신 일지)",
      "관리 페이지 /admin/construction — 단계 CRUD, 진행률 입력, 사진 업로드, 일지 작성",
      "기술문서·소유권 탭 → 사용권 탭으로 재구성 (사용 허가·개발 주체·외부 API·호스팅 면책)",
    ],
  },
  {
    version: "1.5.9", date: "2026-05-12", tag: "기능",
    items: [
      "회원 관심 분과·단체 시스템 — 가입 후 첫 로그인 시 /onboarding/interests 자동 안내",
      "단체 선택 시 부모 분과 자동 포함, 분과 해제 시 등록된 소속단체 함께 해제 confirm",
      "마이페이지 섹션 + /groups/[slug] 관심 등록 패널 + 카톡 알림 수신 동의 (발송은 채널 개설 후)",
      "마이페이지 일시적 오류 수정 (SessionSync deps 무한 루프 → 429 → TypeError)",
    ],
  },
  {
    version: "1.5.8", date: "2026-05-12", tag: "기능",
    items: [
      "세션 만료 정책 정비 — 기본 12시간 + idle 30분 자동 로그아웃, '로그인 상태 유지' 체크 시 7일",
      "위임 관리자 해제된 회원에게 헤더 '관리페이지' 링크 노출 차단",
      "SessionSync로 권한 변경 즉시 동기화 (재로그인 없이 반영)",
    ],
  },
  {
    version: "1.5.7", date: "2026-05-11", tag: "수정",
    items: [
      "데스크톱 사이드바 sticky 고정 + 페이지 로드 시 위치 즉시 고정",
      "게시판 글 상세·동적 페이지에 SectionLayout 적용 — 사이드바 메뉴 자동 노출",
    ],
  },
  {
    version: "1.5.6", date: "2026-05-11", tag: "기능",
    items: [
      "동적 페이지 시스템 — 코드 없이 관리자에서 페이지 생성 + 레이아웃 선택",
    ],
  },
  {
    version: "1.5.5", date: "2026-05-10", tag: "수정",
    items: [
      "메뉴 시스템 안정화 — 한글 IME 조합 깨짐, sort_order 자동 정규화, reorder 엔드포인트 충돌",
      "외부 링크 여부(is_external) href 편집 시 자동 동기화",
      "삭제된 source의 auto menu_item 물리 삭제 + auto:* 뱃지 표시",
      "boards-list 500 에러 해결, ai-extract 게시판 메뉴에서 숨김",
    ],
  },
  {
    version: "1.5.4", date: "2026-05-10", tag: "기능",
    items: [
      "메뉴 관리 시스템 — Header/Sidebar 동적 통합, 백엔드 메뉴 인프라 (/admin/menus)",
      "3-deep 트리 메뉴 + 메가메뉴 + 2-row 모바일 칩",
      "게시판/분과 자동 메뉴 동기화 (link_type 기반 3-way: 페이지·게시판·외부 URL)",
      "SSR fetch + MenusProvider context로 FOUC 제거",
    ],
  },
  {
    version: "1.5.3", date: "2026-05-09", tag: "수정",
    items: [
      "분과 페이지 모바일 레이아웃 보정 — 사이드바 칩 변환, 사진 2열 유지, 칩 nav sticky 위치 정정",
    ],
  },
  {
    version: "1.5.2", date: "2026-05-09", tag: "기능",
    items: [
      "분과·단체 시스템 — 트리(분과 → 소속단체) + 상세 페이지 (/groups, /groups/[slug])",
      "분과별 사진 표시 방식 선택 (슬라이드쇼 / 격자), 1장 업로드 시 가로 전체 16:9",
    ],
  },
  {
    version: "1.5.1", date: "2026-05-08", tag: "수정",
    items: [
      "9개 관리자 페이지 다중 선택 + 일괄 삭제 UI 모바일 보정",
    ],
  },
  {
    version: "1.5.0", date: "2026-05-08", tag: "기능",
    items: [
      "본당 인물 아카이브 — 역대 사목자(/admin/pastors), 본당 출신 사제(/priests, /admin/priests)",
      "9개 관리자 페이지에 다중 선택·일괄 삭제 패턴 통일",
      "게시판별 게시글 인라인 다중 선택·일괄 삭제",
      "주보 페이지 카카오 공유 버튼 + 기술문서·도움말 페이지 (/admin/docs)",
    ],
  },
  {
    version: "1.4.1", date: "2026-05-06", tag: "수정",
    items: [
      "모바일 iOS Safari 가로 스크롤 버그 수정 (SVG isolation 처리)",
      "관리자 페이지 콘텐츠 중앙 정렬 일괄 적용 (mx-auto)",
      "갤러리 '사진 올리기' 버튼 비로그인 시 완전 숨김",
    ],
  },
  {
    version: "1.4.0", date: "2026-05-01", tag: "기능",
    items: [
      "관리자 위임 기능 — is_admin 회원에게 관리 권한 부여·회수 (최고관리자만)",
      "활동 로그 페이지 (/admin/logs) — 관리자 행동 자동 기록 조회",
      "갤러리 관리 페이지 (/admin/gallery) — 다중 사진 업로드",
      "공개 갤러리 페이지 (/gallery/liturgy, /gallery/events)",
    ],
  },
  {
    version: "1.3.0", date: "2026-04-15", tag: "기능",
    items: [
      "주보 AI 분석 기능 — Claude claude-haiku-4-5로 행사·공지 자동 추출",
      "행사 캘린더 관리 페이지 (/admin/calendar)",
      "주보 추출 승인(게시글·캘린더)·거부 워크플로우",
    ],
  },
  {
    version: "1.2.0", date: "2026-04-01", tag: "기능",
    items: [
      "회원 가입·로그인·이메일 인증 시스템",
      "게시판 CRUD, 댓글, 첨부파일 업로드 (10 MB 제한)",
      "비밀번호 찾기·재설정 (이메일 링크)",
      "프로필 아바타 업로드",
    ],
  },
  {
    version: "1.1.0", date: "2026-03-15", tag: "기능",
    items: [
      "공지 관리 — 상단 고정 포함",
      "본당 정보 편집 — 미사 시간·주임 신부 소개·사진",
      "사목 방향·단체·성당 역사 콘텐츠 관리",
      "사목평의회 위원 관리 (사진 포함)",
      "묵상 글 관리 — 날짜별 발행",
    ],
  },
  {
    version: "1.0.0", date: "2026-03-01", tag: "인프라",
    items: [
      "최초 배포 — Cafe24 VPS + Nginx + Uvicorn",
      "주보 PDF 업로드·목록 페이지",
      "최고관리자 로그인 (/admin)",
      "홈페이지 기본 구조 (Next.js 15 + FastAPI)",
    ],
  },
];

// ─── 보조 컴포넌트 ─────────────────────────────────────────────────────────

function MethodBadge({ method }: { method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" }) {
  const c = {
    GET: "bg-blue-100 text-blue-700",
    POST: "bg-green-100 text-green-700",
    PUT: "bg-yellow-100 text-yellow-700",
    PATCH: "bg-orange-100 text-orange-700",
    DELETE: "bg-red-100 text-red-700",
  }[method];
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-mono font-bold ${c}`}>
      {method}
    </span>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-3 border-l-4 border-blue-400 bg-blue-50 px-4 py-2.5 text-sm text-blue-800 rounded-r-lg">
      {children}
    </div>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-3 border-l-4 border-amber-400 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 rounded-r-lg">
      {children}
    </div>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="my-3 space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-sm">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-bold text-white">
            {i + 1}
          </span>
          <span className="leading-relaxed">{item}</span>
        </li>
      ))}
    </ol>
  );
}

function Accordion({
  icon, title, badge, children,
}: {
  icon: string; title: string; badge?: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-[var(--color-surface-warm)] transition-colors"
      >
        <span className="text-xl">{icon}</span>
        <span className="flex-1 font-semibold text-[var(--color-primary)]">{title}</span>
        {badge && (
          <span className="mr-2 rounded-full bg-[var(--color-surface-warm)] border border-[var(--color-border)] px-2.5 py-0.5 text-xs text-[var(--color-text-muted)]">
            {badge}
          </span>
        )}
        <span className="text-[var(--color-text-muted)] text-sm">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="border-t border-[var(--color-border)] bg-white px-5 py-4 text-[var(--color-text)] text-sm leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
}

function ApiRow({ method, path, desc, auth }: {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  desc: string;
  auth?: "관리자" | "회원" | "최고관리자";
}) {
  const authColor = auth === "최고관리자"
    ? "bg-yellow-100 text-yellow-700"
    : auth === "관리자"
    ? "bg-purple-100 text-purple-700"
    : auth === "회원"
    ? "bg-green-100 text-green-700"
    : "";
  return (
    <tr className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-warm)]">
      <td className="px-3 py-2.5 w-20"><MethodBadge method={method} /></td>
      <td className="px-3 py-2.5 font-mono text-xs text-[var(--color-primary)]">{path}</td>
      <td className="px-3 py-2.5 text-xs text-[var(--color-text)]">{desc}</td>
      <td className="px-3 py-2.5 w-20">
        {auth && (
          <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${authColor}`}>{auth}</span>
        )}
      </td>
    </tr>
  );
}

function ApiTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--color-surface-warm)] border-b border-[var(--color-border)]">
            <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--color-text-muted)]">메서드</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--color-text-muted)]">경로</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--color-text-muted)]">설명</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--color-text-muted)]">권한</th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

// ─── 탭 콘텐츠 ─────────────────────────────────────────────────────────────

function GuideTab() {
  return (
    <div className="space-y-3">

      <Accordion icon="🔐" title="관리자 인증" badge="2가지 유형">
        <p className="mb-3 text-[var(--color-text-muted)]">이 시스템에는 <strong>두 종류의 관리자</strong>가 있습니다.</p>
        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
            <p className="font-semibold text-yellow-800 mb-1">⭐ 최고관리자 (Super Admin)</p>
            <ul className="text-xs text-yellow-700 space-y-1">
              <li>• ID/PW로 <code>/admin</code> 직접 로그인</li>
              <li>• 회원 관리자 권한 부여·회수 가능</li>
              <li>• localStorage: <code>admin_is_super = "true"</code></li>
              <li>• 게시글 작성 시 author = null (성당 명의)</li>
            </ul>
          </div>
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
            <p className="font-semibold text-purple-800 mb-1">👤 위임 관리자 (Delegated Admin)</p>
            <ul className="text-xs text-purple-700 space-y-1">
              <li>• 회원 로그인 → 관리자 페이지 접근</li>
              <li>• 최고관리자가 회원에게 권한 부여</li>
              <li>• 회원 권한 부여·회수 불가</li>
              <li>• 게시글 작성 시 author = 해당 회원</li>
            </ul>
          </div>
        </div>
        <Tip>로그아웃은 최고관리자에게만 표시됩니다. 위임 관리자는 브라우저 탭을 닫거나 <code>localStorage</code>를 직접 삭제하세요.</Tip>
        <p className="text-xs text-[var(--color-text-muted)]">세션 저장 키: <code>admin_token</code>, <code>admin_display_name</code>, <code>admin_role</code>, <code>admin_is_super</code></p>
      </Accordion>

      <Accordion icon="📤" title="주보 관리" badge="/admin/bulletin">
        <p className="mb-2 font-medium">주보 업로드</p>
        <Steps items={[
          "/admin/bulletin/new 페이지로 이동",
          "발행일, 호수, 전례시기, 복음 구절 입력",
          "PDF 파일 선택 후 업로드",
          "업로드 완료 후 대시보드에서 확인",
        ]} />
        <p className="mb-2 font-medium mt-4">AI 행사 추출</p>
        <Steps items={[
          "주보 목록에서 '분석' 버튼 클릭",
          "Claude Haiku가 PDF 텍스트를 분석하여 행사·공지 추출",
          "/admin/bulletin/extractions 에서 추출 결과 확인",
          "각 항목을 '게시글로 등록' 또는 '캘린더 행사로 등록' 또는 '무시'",
        ]} />
        <Tip>최신 업로드된 주보가 홈페이지와 /bulletin 페이지에 자동으로 표시됩니다.</Tip>
      </Accordion>

      <Accordion icon="📢" title="공지 관리" badge="/admin/notices">
        <Steps items={[
          "+ 공지 작성 버튼 클릭",
          "제목·내용 입력, 상단 고정 여부 선택",
          "저장하면 /boards/notice 게시판에 즉시 표시",
          "수정/삭제는 목록의 각 행 버튼으로 처리",
        ]} />
        <Tip>상단 고정(is_pinned)된 공지는 목록 최상단에 고정 표시됩니다.</Tip>
      </Accordion>

      <Accordion icon="💬" title="게시판·게시글 관리" badge="/admin/boards">
        <p className="mb-2 font-medium">게시판 생성</p>
        <Steps items={[
          "게시판 이름·slug(영문 소문자) 입력. slug는 URL에 사용됨 (예: free → /boards/free)",
          "members_only_read: 로그인 회원만 읽기 가능",
          "members_only_write: 로그인 회원만 쓰기 가능",
          "posts_per_page: 페이지당 게시글 수 설정",
        ]} />
        <p className="mb-2 font-medium mt-4">게시글·댓글 삭제</p>
        <p>관리자는 모든 게시판의 게시글·댓글을 삭제할 수 있습니다. 게시글 상세 페이지에서 삭제 버튼이 표시됩니다.</p>
        <Warn>게시글 삭제 시 첨부파일과 댓글이 함께 삭제됩니다. 복구 불가합니다.</Warn>
        <p className="text-xs text-[var(--color-text-muted)] mt-2">기본 게시판 slug: <code>notice</code>, <code>free</code>, <code>news</code>, <code>liturgy</code>, <code>photo</code></p>
      </Accordion>

      <Accordion icon="👥" title="회원 관리" badge="/admin/members">
        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          {[
            { label: "활성화", desc: "이메일 미인증 또는 비활성 회원을 수동으로 로그인 가능 상태로 전환" },
            { label: "비활성화", desc: "로그인을 차단하되 데이터는 보존. 언제든 재활성화 가능" },
            { label: "초기 비밀번호 재설정", desc: "임시 비밀번호 0629 로 초기화. 회원에게 별도 안내 필요" },
            { label: "삭제", desc: "회원 계정·게시글·댓글 완전 삭제. 복구 불가" },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-[var(--color-border)] p-3">
              <p className="font-medium text-xs mb-1">{item.label}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{item.desc}</p>
            </div>
          ))}
        </div>
        <Warn>관리자 권한 부여·회수는 최고관리자만 가능합니다. 위임 관리자에게는 해당 버튼이 표시되지 않습니다.</Warn>
      </Accordion>

      <Accordion icon="⛪" title="본당 정보" badge="/admin/parish">
        <Steps items={[
          "미사 시간 텍스트 수정 (평일·토요일·주일·공휴일 등)",
          "주임 신부 이름·소개글 수정",
          "신부님 사진 업로드 후 목록에서 '대표 선택' 클릭",
          "저장하면 홈페이지·/about 페이지에 즉시 반영",
        ]} />
        <Tip>사진은 여러 장 업로드 후 하나를 대표로 선택할 수 있습니다. 대표 사진만 공개 페이지에 표시됩니다.</Tip>
      </Accordion>

      <Accordion icon="📄" title="페이지 콘텐츠 관리" badge="/admin/content">
        <p className="text-xs text-[var(--color-text-muted)] mb-3">탭 선택으로 각 콘텐츠 영역을 관리합니다.</p>
        {[
          { label: "성당 역사", desc: "연도·제목·설명 항목으로 /history 페이지 구성" },
          { label: "사목 방향", desc: "연도별 사목 목표·슬로건. /vision 페이지에 최신 항목 표시" },
          { label: "단체 목록", desc: "/groups 페이지의 본당 단체·분과 정보" },
          { label: "정적 페이지", desc: "성 베드로 (/saint), 사목평의회 (/council), 묵상 (/meditation), 기도문 (/prayer) 본문 편집" },
          { label: "묵상 글", desc: "날짜별 묵상. 발행일 기준으로 /meditation/archive 에 목록 표시" },
          { label: "사목평의회 위원", desc: "사진 포함 위원 목록. /council 페이지에 표시" },
        ].map((item) => (
          <div key={item.label} className="flex gap-2 py-2 border-b border-[var(--color-border)] last:border-0">
            <span className="font-medium text-xs w-28 shrink-0">{item.label}</span>
            <span className="text-xs text-[var(--color-text-muted)]">{item.desc}</span>
          </div>
        ))}
      </Accordion>

      <Accordion icon="🧭" title="메뉴 관리" badge="/admin/menus">
        <p className="mb-3 text-[var(--color-text-muted)]">
          홈페이지 상단 헤더(드롭다운/메가메뉴)와 페이지 사이드바에 노출되는 모든 메뉴를 한 곳에서 관리합니다.
          코드 수정 없이 메뉴 구성을 바꿀 수 있습니다.
        </p>

        <p className="mb-2 font-medium">기본 구조</p>
        <ul className="text-xs text-[var(--color-text-muted)] space-y-1 mb-4">
          <li>• <strong>그룹</strong>(예: 본당 소개, 본당 가족) — 헤더의 큰 카테고리. 사이드바 최상위.</li>
          <li>• <strong>항목</strong> — 그룹 안의 메뉴. 항목 아래 자식 항목까지 <strong>최대 2-deep</strong> 서브메뉴 가능</li>
          <li>• 같은 그룹/항목 데이터가 헤더와 사이드바 양쪽에 동시에 사용됩니다</li>
        </ul>

        <p className="mb-2 font-medium">새 항목 만들기 — 3가지 연결 방식</p>
        <div className="rounded-lg border border-[var(--color-border)] overflow-hidden mb-4">
          {[
            {
              type: "정적 페이지",
              code: "page",
              desc: "내부 페이지 경로. 화이트리스트(/about, /history 등)에서 선택하거나 /groups/{slug} 같은 동적 경로 직접 입력. 같은 페이지는 한 메뉴 항목에만 연결 가능.",
            },
            {
              type: "게시판",
              code: "board",
              desc: "드롭다운에서 게시판 선택. 라벨은 게시판 이름이 자동 매핑됨. 한 게시판은 한 메뉴 항목에만 연결.",
            },
            {
              type: "외부 URL",
              code: "external",
              desc: "https://… 형태의 외부 링크. 새 탭으로 자동 열림. 중복 허용.",
            },
          ].map((row, i) => (
            <div key={row.code} className={`px-4 py-3 text-xs ${i % 2 === 0 ? "bg-white" : "bg-[var(--color-surface-warm)]"}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-[var(--color-primary)]">{row.type}</span>
                <code className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-border)] text-[var(--color-text)]">{row.code}</code>
              </div>
              <p className="text-[var(--color-text-muted)]">{row.desc}</p>
            </div>
          ))}
        </div>

        <p className="mb-2 font-medium">메뉴 라벨 — 사이트 전역 단일 진실 소스</p>
        <Steps items={[
          "메뉴 라벨은 항상 직접 입력 (필수). 페이지/게시판 이름 자동 모드는 폐기됨",
          "여기에 적은 라벨이 헤더 네비, 그룹 사이드바, 페이지 제목(브레드크럼+H1), 사이트맵에 일괄 적용",
          "메뉴에 등록되지 않은 동적/하위 페이지(예: 게시글 상세, 묵상 아카이브)는 페이지 자체의 title 유지",
        ]} />

        <p className="mb-2 font-medium mt-4">사이드바 전용 설정 (그룹 단위)</p>
        <ul className="text-xs text-[var(--color-text-muted)] space-y-1">
          <li>• <strong>sidebar_image_url</strong> — 사이드바 상단에 표시되는 배너 이미지</li>
          <li>• <strong>sidebar_width_px</strong> — 160~400px 범위. 모바일은 자동으로 가로 스크롤 칩으로 변환</li>
          <li>• <strong>show_in_header</strong> 해제 시 헤더에서만 숨김 (사이드바에는 여전히 노출)</li>
        </ul>

        <p className="mb-2 font-medium mt-4">순서·이동·표시 제어</p>
        <Steps items={[
          "↑↓ 버튼으로 항목/그룹 순서 변경 (sort_order 자동 정규화)",
          "항목의 '그룹 이동' 드롭다운으로 다른 그룹으로 이동 가능",
          "is_active 해제 = 공개 메뉴에서 숨김. 관리자 페이지에서는 여전히 보임",
        ]} />

        <p className="mb-2 font-medium mt-4">자동 동기화 항목 (auto:*)</p>
        <p className="text-xs text-[var(--color-text-muted)] mb-2">
          새 게시판이나 분과(/admin/boards · /admin/content?tab=community)를 추가하면
          해당 메뉴 항목이 <strong>자동으로 생성</strong>되어 적절한 그룹에 들어갑니다.
          관리 화면에서 <code className="font-mono">auto:boards</code>, <code className="font-mono">auto:groups</code> 등의 뱃지로 표시됩니다.
        </p>
        <Tip>
          원본(게시판·분과)을 삭제하면 자동 메뉴 항목도 함께 사라집니다.
          자동 항목도 라벨·순서·그룹은 자유롭게 바꿀 수 있고, 그 설정은 보존됩니다.
        </Tip>

        <p className="mb-2 font-medium mt-4">자주 쓰는 흐름</p>
        <Steps items={[
          "정적 페이지 추가: /admin/pages 에서 페이지 생성 → 자동으로 메뉴 후보 등장 → /admin/menus에서 그룹 선택",
          "외부 링크 추가: + 항목 추가 → link_type=외부 URL → https://… 입력 → 저장",
          "그룹 새로 만들기: + 그룹 추가 → 키(영문)·라벨 입력 → 사이드바 이미지·폭 선택",
          "메뉴에서 임시로 숨기기: 항목 행에서 is_active 체크 해제",
        ]} />
        <Warn>
          한 페이지/게시판은 한 메뉴 항목에만 연결할 수 있습니다 (중복 등록 차단).
          외부 URL은 같은 주소를 여러 곳에 두는 것이 허용됩니다.
        </Warn>
      </Accordion>

      <Accordion icon="🖼️" title="갤러리 관리" badge="/admin/gallery">
        <Steps items={[
          "상단에서 게시판 선택: 전례 사진(liturgy) 또는 행사 사진(photo)",
          "제목 입력 + 사진 파일 다중 선택",
          "업로드 버튼 클릭 → 게시글 생성 후 이미지 자동 첨부",
          "삭제: 갤러리 카드에 마우스를 올리면 나타나는 ✕ 버튼 클릭",
        ]} />
        <Tip>업로드된 사진은 /gallery/liturgy 또는 /gallery/events 공개 페이지에 즉시 표시됩니다. 로그인 회원만 갤러리에 직접 사진을 올릴 수 있습니다 (관리자 외).</Tip>
      </Accordion>

      <Accordion icon="📅" title="행사 캘린더" badge="/admin/calendar">
        <Steps items={[
          "+ 행사 등록 버튼 클릭",
          "행사명, 날짜(시작·종료), 유형, 설명 입력",
          "저장하면 /calendar 페이지 해당 월에 표시",
          "행사 완료 후 상태를 '기록대기' → '기록됨'으로 변경 가능",
        ]} />
        <p className="text-xs text-[var(--color-text-muted)] mt-2">행사 상태: <span className="text-blue-600">예정</span> → <span className="text-orange-600">기록대기</span> → <span className="text-green-600">기록됨</span></p>
        <Tip>주보 AI 분석 결과를 '캘린더 행사로 등록' 승인하면 자동으로 이 목록에 추가됩니다.</Tip>
      </Accordion>

      <Accordion icon="📚" title="아카이브 관리" badge="/admin/pastors · /admin/priests">
        <p className="mb-2 font-medium">역대 사목자 (/admin/pastors)</p>
        <p className="text-xs text-[var(--color-text-muted)] mb-3">이름, 직함(주임신부·보좌신부 등), 부임일, 이임일(현직이면 비워둠), 소개글, 사진</p>
        <p className="mb-2 font-medium">본당 출신 사제 (/admin/priests)</p>
        <p className="text-xs text-[var(--color-text-muted)] mb-3">이름, 직책/현황(예: 대전교구 ○○본당 주임), 사제서품일(필수), 세례일(선택), 소개글, 사진</p>
        <Tip>사진은 등록 후 목록에서 '사진' 버튼으로 별도 업로드합니다.</Tip>
      </Accordion>

      <Accordion icon="💚" title="회원 관심 분과·단체" badge="자동 온보딩 + 카톡 알림 대상">
        <p className="mb-3 text-[var(--color-text-muted)]">
          회원이 관심 있는 분과·단체를 선택해두면, 향후 그 분과의 새 글·행사 알림을 카톡으로 받을 수 있습니다.
          카톡 발송 자체는 채널 개설 후 활성화 예정입니다.
        </p>
        <p className="mb-2 font-medium">동작 흐름</p>
        <Steps items={[
          "신규 회원 첫 로그인 → OnboardingGate가 /onboarding/interests로 자동 redirect",
          "분과(parent) 또는 소속단체(child)를 자유롭게 선택. 단체만 선택해도 백엔드가 부모 분과를 자동 INSERT",
          "응답('완료' 또는 '선택 안함') 시 interest_prompt_completed=true 마킹 → 다음 로그인부터 묻지 않음",
          "이후 마이페이지 '내 관심 분과·단체' 섹션에서 언제든 수정",
          "/groups/[slug] 분과 상세 페이지에서도 단건 등록·해제 가능",
        ]} />
        <p className="mb-2 mt-4 font-medium">데이터 모델</p>
        <ul className="text-xs text-[var(--color-text-muted)] space-y-1">
          <li>• <code>members.interest_prompt_completed</code> (bool) — 온보딩 응답 여부</li>
          <li>• <code>members.notify_kakao</code> (bool) — 카톡 알림 수신 동의 (글로벌)</li>
          <li>• <code>member_community_interests(member_id, community_group_id, UNIQUE)</code> — 다대다</li>
        </ul>
        <Tip>
          분과 해제 시 등록된 소속단체가 있으면 <strong>confirm</strong> 후 함께 해제됩니다.
          백엔드 부모 자동 포함 정책과 충돌 방지를 위함입니다.
        </Tip>
        <Warn>
          카톡 발송 로직은 미구현(stub)입니다. 카카오 비즈니스 채널 개설 후 어댑터를 연결해 활성화합니다.
        </Warn>
      </Accordion>

      <Accordion icon="🔒" title="세션 만료 정책" badge="12h 기본 / 7d 옵션">
        <p className="mb-3 text-[var(--color-text-muted)]">관리자·회원 공통 정책입니다.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-lg border border-[var(--color-border)] p-3">
            <p className="font-semibold text-sm mb-1">기본 (체크 안 함)</p>
            <ul className="text-xs text-[var(--color-text-muted)] space-y-1">
              <li>• 토큰 만료: <strong>12시간</strong></li>
              <li>• <strong>30분 무활동</strong> 시 경고 + 5분 카운트 후 자동 로그아웃</li>
              <li>• 재부팅 후 다음날 접속 시 만료</li>
            </ul>
          </div>
          <div className="rounded-lg border border-[var(--color-border)] p-3">
            <p className="font-semibold text-sm mb-1">로그인 상태 유지 체크</p>
            <ul className="text-xs text-[var(--color-text-muted)] space-y-1">
              <li>• 토큰 만료: <strong>7일</strong></li>
              <li>• idle 타이머 비활성</li>
              <li>• 명시적으로 선택한 경우만</li>
            </ul>
          </div>
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mt-3">
          관리자 admin_authed 쿠키 max-age와 localStorage admin_token_exp가 동시에 토큰 만료에 맞춰 설정됩니다.
          페이지 로드 시 만료된 토큰은 자동 정리됩니다.
        </p>
      </Accordion>

      <Accordion icon="📋" title="활동 로그" badge="/admin/logs">
        <p className="text-[var(--color-text-muted)] mb-2">관리자가 수행한 모든 주요 행동이 자동으로 기록됩니다.</p>
        <p className="font-medium mb-2">기록되는 항목</p>
        <div className="grid grid-cols-2 gap-1 text-xs text-[var(--color-text-muted)]">
          {["관리자 로그인", "주보 업로드·삭제", "공지 생성·수정·삭제", "회원 활성화·비활성화", "관리자 권한 부여·회수", "게시글·댓글 삭제", "본당 정보 수정", "행사 등록·수정·삭제"].map((i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-[var(--color-primary)] shrink-0" />
              {i}
            </div>
          ))}
        </div>
        <Tip>로그는 삭제되지 않으며 페이지네이션으로 전체 이력을 조회할 수 있습니다.</Tip>
      </Accordion>

    </div>
  );
}

function TechTab() {
  return (
    <div className="space-y-6">
      {/* 기술 스택 카드 */}
      <div>
        <h2 className="text-sm font-bold text-[var(--color-primary)] mb-3">기술 스택</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            {
              label: "Frontend", icon: "🖥️",
              items: ["Next.js 16 (App Router · Turbopack)", "TypeScript", "Tailwind CSS", "NextAuth.js 5", "Kakao Maps/Share JS SDK"],
            },
            {
              label: "Backend", icon: "⚙️",
              items: ["FastAPI 0.110+", "SQLAlchemy 2 (ORM)", "Alembic (마이그레이션)", "Pydantic v2", "python-jose (JWT)", "bcrypt"],
            },
            {
              label: "Database", icon: "🗄️",
              items: ["PostgreSQL 15", "psycopg2-binary"],
            },
            {
              label: "AI", icon: "🤖",
              items: ["Claude claude-haiku-4-5 (Anthropic)", "주보 PDF 텍스트·이미지 분석", "행사·공지 자동 추출"],
            },
            {
              label: "인프라", icon: "🚀",
              items: ["Cafe24 VPS (Linux)", "Nginx (리버스 프록시)", "Uvicorn (ASGI)", "로컬 /uploads/ 파일 저장"],
            },
            {
              label: "인증", icon: "🔑",
              items: ["관리자: FastAPI JWT (localStorage)", "회원: NextAuth HTTP-only cookie", "세션: 기본 12h + idle 30분 / 유지 옵션 7일", "권한 변경 즉시 동기화 (SessionSync)", "이메일 인증 토큰 · Google·Kakao 소셜 로그인"],
            },
          ].map((stack) => (
            <div key={stack.label} className="rounded-xl border border-[var(--color-border)] p-4 bg-white">
              <div className="flex items-center gap-2 mb-2">
                <span>{stack.icon}</span>
                <span className="font-semibold text-sm text-[var(--color-primary)]">{stack.label}</span>
              </div>
              <ul className="space-y-1">
                {stack.items.map((item) => (
                  <li key={item} className="text-xs text-[var(--color-text-muted)] flex items-start gap-1.5">
                    <span className="mt-1 w-1 h-1 rounded-full bg-[var(--color-border-dark)] shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* 환경 변수 */}
      <div>
        <h2 className="text-sm font-bold text-[var(--color-primary)] mb-3">환경 변수</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold text-[var(--color-text-muted)] mb-2 uppercase tracking-wide">Frontend (.env.local)</p>
            <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
              {[
                { key: "NEXT_PUBLIC_API_URL", desc: "백엔드 API 기본 URL (예: http://localhost:8000)" },
                { key: "NEXT_PUBLIC_KAKAO_MAP_KEY", desc: "카카오 JS API 키 — 지도 + 공유 버튼 공용" },
                { key: "NEXTAUTH_SECRET", desc: "NextAuth 세션 JWT 서명 키 (랜덤 32자 이상)" },
                { key: "NEXTAUTH_URL", desc: "배포 공개 URL (예: https://sjpeter.org)" },
              ].map((env, i) => (
                <div key={env.key} className={`px-4 py-3 text-xs ${i % 2 === 0 ? "bg-white" : "bg-[var(--color-surface-warm)]"}`}>
                  <code className="font-mono font-bold text-[var(--color-primary)]">{env.key}</code>
                  <p className="text-[var(--color-text-muted)] mt-0.5">{env.desc}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-[var(--color-text-muted)] mb-2 uppercase tracking-wide">Backend (.env)</p>
            <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
              {[
                { key: "DATABASE_URL", desc: "PostgreSQL 연결 문자열 (postgresql+psycopg2://...)" },
                { key: "SECRET_KEY", desc: "JWT 서명 키 (관리자·회원 토큰 공용)" },
                { key: "ANTHROPIC_API_KEY", desc: "Claude API 키 — 주보 AI 분석에 사용" },
                { key: "UPLOAD_DIR", desc: "업로드 파일 저장 경로 (기본: ./uploads)" },
                { key: "ADMIN_ID / ADMIN_PASSWORD", desc: "최고관리자 ID·비밀번호 (해시 저장)" },
              ].map((env, i) => (
                <div key={env.key} className={`px-4 py-3 text-xs ${i % 2 === 0 ? "bg-white" : "bg-[var(--color-surface-warm)]"}`}>
                  <code className="font-mono font-bold text-[var(--color-primary)]">{env.key}</code>
                  <p className="text-[var(--color-text-muted)] mt-0.5">{env.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 디렉토리 구조 */}
      <div>
        <h2 className="text-sm font-bold text-[var(--color-primary)] mb-3">주요 디렉토리 구조</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-[var(--color-border)] bg-gray-950 text-green-300 p-4 font-mono text-xs leading-6">
            <p className="text-gray-500 mb-2"># Frontend</p>
            <p>frontend/</p>
            <p>├── app/</p>
            <p>│&nbsp;&nbsp; ├── admin/        # 관리자 패널</p>
            <p>│&nbsp;&nbsp; ├── boards/       # 게시판·게시글</p>
            <p>│&nbsp;&nbsp; ├── gallery/      # 갤러리</p>
            <p>│&nbsp;&nbsp; ├── groups/       # 분과·단체 + 관심 등록</p>
            <p>│&nbsp;&nbsp; ├── members/      # 회원 인증·마이페이지</p>
            <p>│&nbsp;&nbsp; ├── onboarding/   # 관심분과 첫 선택</p>
            <p>│&nbsp;&nbsp; └── ...           # 공개 페이지</p>
            <p>├── components/       # SessionSync·OnboardingGate 등</p>
            <p>├── lib/              # API 타입·유틸</p>
            <p>└── auth.ts           # NextAuth (isAdmin·interestPromptCompleted)</p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-gray-950 text-green-300 p-4 font-mono text-xs leading-6">
            <p className="text-gray-500 mb-2"># Backend</p>
            <p>backend/</p>
            <p>├── app/</p>
            <p>│&nbsp;&nbsp; ├── api/          # 라우터 모듈</p>
            <p>│&nbsp;&nbsp; ├── models/       # SQLAlchemy 모델</p>
            <p>│&nbsp;&nbsp; └── deps.py       # 의존성 (auth 등)</p>
            <p>├── alembic/          # DB 마이그레이션</p>
            <p>├── uploads/          # 업로드 파일</p>
            <p>└── main.py           # FastAPI 앱 진입점</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ApiTab() {
  return (
    <div className="space-y-6 text-sm">
      <p className="text-[var(--color-text-muted)] text-xs">기본 URL: <code className="font-mono">{"{NEXT_PUBLIC_API_URL}"}/api</code> — 권한 없는 항목은 <code>Authorization: Bearer {"{token}"}</code> 헤더 필요</p>

      <div>
        <h3 className="font-semibold text-[var(--color-primary)] mb-2">인증 (Auth)</h3>
        <ApiTable>
          <ApiRow method="POST" path="/auth/admin-login" desc="최고관리자 또는 위임 관리자 로그인 (identifier, password)" />
          <ApiRow method="POST" path="/auth/admin-session" desc="회원 JWT → 관리자 토큰 교환 (위임 관리자용)" auth="회원" />
          <ApiRow method="GET"  path="/auth/admin-me" desc="현재 관리자 정보 조회" auth="관리자" />
          <ApiRow method="POST" path="/members/login" desc="회원 로그인 (email, password)" />
          <ApiRow method="POST" path="/members/register" desc="회원 가입" />
        </ApiTable>
      </div>

      <div>
        <h3 className="font-semibold text-[var(--color-primary)] mb-2">주보 (Bulletins)</h3>
        <ApiTable>
          <ApiRow method="GET"  path="/bulletins/" desc="주보 목록 (skip, limit)" />
          <ApiRow method="GET"  path="/bulletins/latest" desc="최신 주보 1건" />
          <ApiRow method="POST" path="/bulletins/" desc="주보 업로드 (multipart: date, issue_number, season, gospel_ref, file)" auth="관리자" />
          <ApiRow method="DELETE" path="/bulletins/{id}" desc="주보 삭제" auth="관리자" />
          <ApiRow method="POST" path="/bulletins/{id}/analyze" desc="AI 분석 트리거" auth="관리자" />
          <ApiRow method="GET"  path="/bulletins/extractions/pending" desc="미처리 추출 목록" auth="관리자" />
          <ApiRow method="POST" path="/bulletins/extractions/{id}/approve" desc="추출 → 게시글 등록" auth="관리자" />
          <ApiRow method="POST" path="/bulletins/extractions/{id}/approve-as-event" desc="추출 → 캘린더 행사 등록" auth="관리자" />
          <ApiRow method="POST" path="/bulletins/extractions/{id}/reject" desc="추출 거부" auth="관리자" />
        </ApiTable>
      </div>

      <div>
        <h3 className="font-semibold text-[var(--color-primary)] mb-2">회원 (Members)</h3>
        <ApiTable>
          <ApiRow method="GET"  path="/members/me" desc="내 프로필 (interest_prompt_completed, notify_kakao 포함)" auth="회원" />
          <ApiRow method="PUT"  path="/members/me" desc="프로필 수정 (name, nickname, phone, password)" auth="회원" />
          <ApiRow method="DELETE" path="/members/me" desc="계정 삭제" auth="회원" />
          <ApiRow method="POST" path="/members/me/avatar" desc="아바타 업로드" auth="회원" />
          <ApiRow method="GET"  path="/members/me/interests" desc="내 관심 분과·단체 + 카톡 알림 설정" auth="회원" />
          <ApiRow method="PUT"  path="/members/me/interests" desc="관심분과 덮어쓰기 (단체 선택 시 부모 자동 포함)" auth="회원" />
          <ApiRow method="POST" path="/members/me/interests/skip" desc="'관심분과 선택 안함' 온보딩 응답 마킹" auth="회원" />
          <ApiRow method="GET"  path="/members/admin/stats" desc="대시보드 통계" auth="관리자" />
          <ApiRow method="GET"  path="/members/admin/list" desc="회원 목록 (page, q, is_active)" auth="관리자" />
          <ApiRow method="PUT"  path="/members/admin/{id}/activate" desc="회원 활성화" auth="관리자" />
          <ApiRow method="PUT"  path="/members/admin/{id}/deactivate" desc="회원 비활성화" auth="관리자" />
          <ApiRow method="PATCH" path="/members/admin/{id}/reset-password" desc="비밀번호 0629 초기화" auth="관리자" />
          <ApiRow method="PATCH" path="/members/admin/{id}/grant-admin" desc="관리자 권한 부여" auth="최고관리자" />
          <ApiRow method="PATCH" path="/members/admin/{id}/revoke-admin" desc="관리자 권한 회수" auth="최고관리자" />
          <ApiRow method="DELETE" path="/members/admin/{id}" desc="회원 삭제" auth="관리자" />
          <ApiRow method="GET"  path="/members/admin/logs" desc="활동 로그 (page, size)" auth="관리자" />
        </ApiTable>
      </div>

      <div>
        <h3 className="font-semibold text-[var(--color-primary)] mb-2">게시판·게시글 (Boards)</h3>
        <ApiTable>
          <ApiRow method="GET"  path="/boards" desc="게시판 목록" />
          <ApiRow method="POST" path="/boards" desc="게시판 생성" auth="관리자" />
          <ApiRow method="PUT"  path="/boards/{slug}" desc="게시판 수정" auth="관리자" />
          <ApiRow method="DELETE" path="/boards/{slug}" desc="게시판 삭제" auth="관리자" />
          <ApiRow method="GET"  path="/boards/{slug}/posts" desc="게시글 목록 (page)" />
          <ApiRow method="POST" path="/boards/{slug}/posts" desc="게시글 작성" auth="회원" />
          <ApiRow method="GET"  path="/boards/{slug}/posts/{id}" desc="게시글 상세 (조회수 증가)" />
          <ApiRow method="PUT"  path="/boards/{slug}/posts/{id}" desc="게시글 수정" auth="회원" />
          <ApiRow method="DELETE" path="/boards/{slug}/posts/{id}" desc="게시글 삭제 (작성자 또는 관리자)" auth="회원" />
          <ApiRow method="POST" path="/boards/{slug}/posts/{id}/comments" desc="댓글 작성" auth="회원" />
          <ApiRow method="DELETE" path="/boards/{slug}/posts/{id}/comments/{cid}" desc="댓글 삭제" auth="회원" />
          <ApiRow method="POST" path="/boards/{slug}/posts/{id}/attachments" desc="첨부파일 업로드 (10 MB 제한)" auth="회원" />
        </ApiTable>
      </div>

      <div>
        <h3 className="font-semibold text-[var(--color-primary)] mb-2">공지·본당·콘텐츠·이벤트·아카이브</h3>
        <ApiTable>
          <ApiRow method="GET"  path="/notices/" desc="공지 목록 (상단 고정 우선)" />
          <ApiRow method="POST" path="/notices/" desc="공지 생성" auth="관리자" />
          <ApiRow method="PUT"  path="/notices/{id}" desc="공지 수정" auth="관리자" />
          <ApiRow method="DELETE" path="/notices/{id}" desc="공지 삭제" auth="관리자" />
          <ApiRow method="GET"  path="/parish/" desc="본당 정보 (미사 시간·신부님)" />
          <ApiRow method="PUT"  path="/parish/" desc="본당 정보 수정" auth="관리자" />
          <ApiRow method="POST" path="/parish/photos/upload" desc="신부님 사진 업로드" auth="관리자" />
          <ApiRow method="GET"  path="/events" desc="월별 행사 목록 (year, month)" />
          <ApiRow method="POST" path="/events" desc="행사 등록" auth="관리자" />
          <ApiRow method="PATCH" path="/events/{id}/status" desc="행사 상태 변경" auth="관리자" />
          <ApiRow method="GET"  path="/archive/pastors" desc="역대 사목자 목록" />
          <ApiRow method="POST" path="/archive/pastors" desc="사목자 등록" auth="관리자" />
          <ApiRow method="POST" path="/archive/pastors/{id}/photo" desc="사목자 사진 업로드" auth="관리자" />
          <ApiRow method="GET"  path="/archive/priests" desc="본당 출신 사제 목록" />
          <ApiRow method="POST" path="/archive/priests" desc="사제 등록" auth="관리자" />
          <ApiRow method="POST" path="/archive/priests/{id}/photo" desc="사제 사진 업로드" auth="관리자" />
          <ApiRow method="GET"  path="/gospel/today" desc="오늘의 복음 (캐시 24h)" />
          <ApiRow method="GET"  path="/search" desc="전체 검색 (q)" />
          <ApiRow method="GET"  path="/health" desc="헬스체크" />
        </ApiTable>
      </div>
    </div>
  );
}

function ChangelogTab() {
  const tagColor: Record<Tag, string> = {
    기능: "bg-blue-100 text-blue-700",
    수정: "bg-red-100 text-red-700",
    디자인: "bg-purple-100 text-purple-700",
    인프라: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="space-y-1">
      <div className="mb-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-warm)] px-4 py-3 text-xs text-[var(--color-text)] space-y-1">
        <p className="font-semibold text-[var(--color-primary)]">버전 규칙</p>
        <ul className="space-y-0.5 text-[var(--color-text-muted)]">
          <li>· 모든 변경은 <strong>patch +1</strong>로 누적합니다 (기능·수정 모두)</li>
          <li>· <span className="inline-block px-1 rounded bg-blue-100 text-blue-700">기능</span> / <span className="inline-block px-1 rounded bg-red-100 text-red-700">수정</span> 태그로 성격 구분</li>
          <li>· minor bump(1.5 → 1.6)는 큰 마일스톤에서만</li>
        </ul>
        <p className="text-[var(--color-text-muted)] pt-1 border-t border-[var(--color-border)] mt-1">
          새 항목은 <code className="font-mono">frontend/app/admin/docs/page.tsx</code> 상단 <code className="font-mono">CHANGELOG</code> 배열 맨 앞에 추가하세요.
        </p>
      </div>
      {CHANGELOG.map((v, i) => (
        <div key={v.version} className="flex gap-4">
          {/* 타임라인 선 */}
          <div className="flex flex-col items-center">
            <div className={`w-3 h-3 rounded-full border-2 mt-1 ${i === 0 ? "bg-[var(--color-primary)] border-[var(--color-primary)]" : "bg-white border-[var(--color-border-dark)]"}`} />
            {i < CHANGELOG.length - 1 && <div className="w-px flex-1 bg-[var(--color-border)] mt-1" />}
          </div>
          {/* 내용 */}
          <div className="pb-6 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`text-base font-bold ${i === 0 ? "text-[var(--color-primary)]" : "text-[var(--color-text)]"}`}>
                v{v.version}
              </span>
              {i === 0 && (
                <span className="rounded-full bg-[var(--color-primary)] text-white text-[11px] px-2 py-0.5 font-semibold">
                  최신
                </span>
              )}
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${tagColor[v.tag]}`}>{v.tag}</span>
              <span className="text-xs text-[var(--color-text-muted)]">{v.date}</span>
            </div>
            <ul className="space-y-1">
              {v.items.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--color-border-dark)] shrink-0" />
                  <span className="text-[var(--color-text)]">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
}

function PhilosophyTab() {
  return (
    <div className="space-y-10 text-sm max-w-2xl mx-auto py-4">

      {/* 헤더 — 소유권 탭과 동일한 Cephas 카드 + 핵심 문구 */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white px-6 py-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-3">소프트웨어 이름</p>
        <p className="font-serif text-4xl font-bold tracking-widest text-[var(--color-primary)] mb-1">Cephas</p>
        <p className="text-lg text-[var(--color-text-muted)] mb-4">세파스</p>
        <div className="mx-auto max-w-lg border-t border-[var(--color-border)] pt-4 space-y-1.5 text-xs text-[var(--color-text-muted)] leading-relaxed">
          <p>
            아람어 <span className="font-semibold text-[var(--color-text)]">כֵּיפָא (Kēpā)</span>에서 온 말로
            <span className="font-semibold text-[var(--color-text)]"> &ldquo;반석&rdquo;</span>을 뜻합니다.
            요한복음 1,42에서 예수님이 시몬에게 직접 붙여주신 이름으로,
            그리스어 Petros(페트로스), 한국어 베드로에 해당합니다.
          </p>
          <p className="italic text-[var(--color-text-muted)]">
            &ldquo;너는 베드로이다. 내가 이 반석 위에 내 교회를 세울 것이다.&rdquo; — 마태오 16,18
          </p>
        </div>
        <p className="mt-5 font-serif text-base text-[var(--color-primary)] italic leading-relaxed">
          &ldquo;우리 성당이 무엇을 소중히 여기는가&rdquo;를 기록하는 것.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-warm)] px-4 py-1.5 text-xs text-[var(--color-text-muted)]">
          <span className="font-mono font-semibold text-[var(--color-primary)]">v{CURRENT_VERSION}</span>
          <span>·</span>
          <span>세종 성베드로 성당 본당 홈페이지 소프트웨어</span>
        </div>
      </div>

      <hr className="border-[var(--color-border)]" />

      {/* 철학 1 */}
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-bold text-white">1</span>
          <p className="font-serif font-bold text-base text-[var(--color-primary)] leading-snug">
            홈페이지는 &ldquo;디지털 안내판&rdquo;이지 &ldquo;포털&rdquo;이 아니다
          </p>
        </div>
        <div className="pl-9 space-y-2 text-[var(--color-text)] leading-relaxed">
          <p>
            화려한 기능이 많을수록 좋은 홈페이지가 아닙니다.
            방문자가 <strong>10초 안에 필요한 정보를 찾을 수 있는 것</strong>이 좋은 홈페이지입니다.
          </p>
          <p>
            미사 시간, 이번 주 주보, 오늘의 복음. 신자가 성당 홈페이지에 들어오는 이유는
            대부분 이 세 가지 중 하나입니다. 세파스는 이 단순한 진실을 중심에 놓고 설계되었습니다.
          </p>
          <p className="text-[var(--color-text-muted)]">
            외형은 정보 전달. 내면은 역사 기록과 보존. 이 두 가지가 하나의 동작으로 이루어지도록
            구조를 설계했습니다.
          </p>
        </div>
      </div>

      {/* 철학 2 */}
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-bold text-white">2</span>
          <p className="font-serif font-bold text-base text-[var(--color-primary)] leading-snug">
            오늘을 기록하면 역사가 된다
          </p>
        </div>
        <div className="pl-9 space-y-2 text-[var(--color-text)] leading-relaxed">
          <p>
            &ldquo;역사를 기록해야겠다&rdquo;고 마음먹고 앉아서 하는 일은 지속되지 않습니다.
            대부분의 기록은 의도가 아니라 <strong>습관에서 태어납니다.</strong>
          </p>
          <p>
            세파스에서 관리자는 별도의 &ldquo;역사 기록&rdquo; 작업을 하지 않습니다.
            이번 주 주보를 올리고, 행사를 등록하고, 사진을 올리는 것.
            <strong>평소 하던 일을 그대로 하면, 역사가 쌓입니다.</strong>
          </p>
          <p className="text-[var(--color-text-muted)]">
            입력은 한 번. 역할은 두 가지 — 지금 이 순간의 정보 전달, 그리고 시간이 지난 뒤의 아카이브.
            10년 후 이 성당의 누군가가 오늘을 찾아볼 수 있도록.
          </p>
        </div>
      </div>

      {/* 철학 3 */}
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-bold text-white">3</span>
          <p className="font-serif font-bold text-base text-[var(--color-primary)] leading-snug">
            모든 기록은 주보와 연결된다
          </p>
        </div>
        <div className="pl-9 space-y-2 text-[var(--color-text)] leading-relaxed">
          <p>
            주보는 단순한 인쇄물이 아닙니다.
            매주 한 번, 공동체가 함께 나눈 말씀과 삶의 기록입니다.
            세파스는 <strong>주보를 공동체 역사의 축(軸)</strong>으로 설정합니다.
          </p>
          <p>
            주보 한 장을 올리면, AI가 그 안에 담긴 행사와 공지를 읽어내고,
            캘린더에 등록되고, 게시판에 공지됩니다.
            <strong>&ldquo;주보 하나 올리면, 나머지는 시스템이 한다.&rdquo;</strong>
          </p>
          <p className="text-[var(--color-text-muted)]">
            사목지표, 행사 기록, 공지, 사진 — 이 모든 것이 주보를 중심으로 연결될 때,
            하나하나는 파편이 아니라 하나의 이야기가 됩니다.
          </p>
        </div>
      </div>

      {/* 철학 4 */}
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-bold text-white">4</span>
          <p className="font-serif font-bold text-base text-[var(--color-primary)] leading-snug">
            우리 성당이 무엇을 소중히 여기는가
          </p>
        </div>
        <div className="pl-9 space-y-2 text-[var(--color-text)] leading-relaxed">
          <p>
            모든 기획의 끝에는 이 질문이 있습니다.
            홈페이지의 구조, 기능의 우선순위, 데이터의 형태 —
            세파스의 모든 설계는 이 질문으로 수렴합니다.
          </p>
          <p>
            미사를 드리고, 말씀을 나누고, 함께 밥을 먹고, 아픈 이를 돕고,
            세상을 떠난 이를 기억하는 것.
            세파스가 기록하는 것은 결국 <strong>그 공동체가 살아낸 방식</strong>입니다.
          </p>
          <p className="text-[var(--color-text-muted)]">
            오늘 올린 주보, 오늘 등록한 사진, 오늘 남긴 공지 하나가
            언젠가 누군가에게 &ldquo;우리가 어떻게 살았는가&rdquo;를 말해줄 것입니다.
          </p>
        </div>
      </div>

      <hr className="border-[var(--color-border)]" />

      {/* 마무리 */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-warm)] px-6 py-6 text-center space-y-3">
        <p className="text-[var(--color-text)] leading-relaxed">
          세파스는 소프트웨어입니다. 하지만 그 안에 담기는 것은
        </p>
        <p className="font-serif text-lg font-bold text-[var(--color-primary)]">
          세종 성베드로 성당 공동체의 시간과 기억입니다.
        </p>
        <p className="text-xs text-[var(--color-text-muted)]">
          &ldquo;너는 베드로이다. 내가 이 반석 위에 내 교회를 세울 것이다.&rdquo; — 마태오 16,18
        </p>
      </div>

    </div>
  );
}

function OwnershipTab() {
  return (
    <div className="space-y-6 text-sm max-w-2xl mx-auto">

      {/* 1. 가톨릭 교회 무료 사용 */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white px-6 py-5">
        <h2 className="font-bold text-[var(--color-primary)] mb-3">사용 허가</h2>
        <p className="leading-relaxed text-[var(--color-text)]">
          본 소프트웨어 <strong>세파스(Cephas)</strong>는 <strong>가톨릭 교회</strong>에 한하여
          누구나 <strong>무료</strong>로 사용할 수 있습니다.
          본당·교구·수도회 단위로 자체 운영하실 수 있으며 별도의 사용료가 발생하지 않습니다.
        </p>
        <p className="text-xs text-[var(--color-text-muted)] mt-3 leading-relaxed">
          단, <strong>상업적 용도</strong>로는 사용할 수 없습니다.
        </p>
      </div>

      {/* 2. 개발·배포 주체 */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white px-6 py-5">
        <h2 className="font-bold text-[var(--color-primary)] mb-3">개발·배포 주체</h2>
        <p className="leading-relaxed text-[var(--color-text)]">
          본 소프트웨어의 설계·구현·유지보수 책임은 개발자에게 있습니다.
          가톨릭 교회의 무료 사용 권리와는 별개로,
          소프트웨어 자체의 저작자(authorship) 권리는 개발자에게 있습니다.
        </p>
        <p className="text-xs text-[var(--color-text-muted)] mt-3 leading-relaxed">
          본 시스템을 통해 등록·관리되는 모든 데이터(주보·사진·게시글·회원 정보 등)의 소유권은
          이를 운영하는 본당 — 본 사이트의 경우 <strong>세종 성베드로 성당</strong> — 에 있습니다.
        </p>
        <p className="text-xs text-[var(--color-text-muted)] mt-3 leading-relaxed">
          본 소프트웨어가 사용하는 <strong>외부 API·서비스</strong>(카카오, AWS Bedrock(Claude) 등)의
          정책 변경·중단·요금 변동, 그리고 <strong>호스팅·서버 관리 및 장애 대응</strong>에 대한
          동작 보장 및 유지보수 의무는 개발자에게 없습니다.
        </p>
      </div>

      {/* 3. 개인정보 처리 고지 */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-6 py-5">
        <h2 className="font-bold text-amber-800 mb-2">개인정보 처리 고지</h2>
        <p className="text-amber-800 leading-relaxed">
          본 시스템은 회원 가입 시 이름·이메일·연락처 등 개인정보를 수집합니다.
          수집된 개인정보는 본당 서비스 제공 목적으로만 사용되며,
          「개인정보 보호법」에 따라 <strong>세종 성베드로 성당</strong>이 처리 책임을 집니다.
          개인정보 관련 문의는 본당 사무실 또는 관리자 이메일로 연락하시기 바랍니다.
        </p>
      </div>

      {/* 4. 하단 © */}
      <div className="border-t border-[var(--color-border)] pt-4 text-xs text-[var(--color-text-muted)] text-center space-y-1">
        <p>
          <span className="font-medium text-[var(--color-text)]">소프트웨어·설계</span> © 강태훈 야고보 (hunskang@gmail.com · 010-5099-9979)
          <span className="mx-2 text-[var(--color-border-dark)]">·</span>
          <span className="font-medium text-[var(--color-text)]">데이터·콘텐츠</span> © 세종 성베드로 성당
        </p>
        <p>최초 작성: 2026-5</p>
      </div>

    </div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────

const TABS = [
  { id: "philosophy", label: "세파스는",   icon: "✝"  },
  { id: "guide",      label: "기능 가이드", icon: "📖" },
  { id: "tech",       label: "기술 스택",   icon: "⚙️" },
  { id: "api",        label: "API",         icon: "🔌" },
  { id: "changelog",  label: "변경 이력",   icon: "📝" },
  { id: "ownership",  label: "사용권",      icon: "©️"  },
] as const;

type TabId = typeof TABS[number]["id"];

export default function AdminDocsPage() {
  const [tab, setTab] = useState<TabId>("philosophy");

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-primary)]">기술문서 · 도움말</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">세종성베드로성당 홈페이지 관리 가이드</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-primary)] bg-[var(--color-primary)]/10 px-3 py-1 text-sm font-bold text-[var(--color-primary)]">
            v{CURRENT_VERSION}
          </span>
          <span className="text-xs text-[var(--color-text-muted)]">마지막 업데이트: {LAST_UPDATED}</span>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex gap-1 mb-6 border-b border-[var(--color-border)]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            <span className="mr-1.5">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      {tab === "philosophy" && <PhilosophyTab />}
      {tab === "guide"      && <GuideTab />}
      {tab === "tech"       && <TechTab />}
      {tab === "api"        && <ApiTab />}
      {tab === "changelog"  && <ChangelogTab />}
      {tab === "ownership"  && <OwnershipTab />}
    </div>
  );
}
