# CLAUDE.md — 본당 홈페이지 (Faith and Me)

> 이 문서는 `~/.claude/CLAUDE.md` 의 작업 흐름(① 지시 검토 → 보고·추천 → 승인 → 작업 시작 → ② 툴 충돌 감지 시 보고·승인)을 따른 뒤 적용되는 프로젝트별 작업 지침이다.

## 프로젝트 한 줄 요약
어떤 본당이라도 자기 본당명·로고·미사시간을 입력하면 그대로 자기 본당 사이트가 되는 본당 홈페이지 시스템. "오늘을 기록하면 역사가 된다" — 주보가 모든 기능의 축(軸).

## 작업 디렉토리
```
/Users/kangtaehun/Dev/faithandme/
├── backend/      # FastAPI + SQLAlchemy + PostgreSQL
└── frontend/     # Next.js 15 App Router + Tailwind CSS v4
```

## 서버 실행
```bash
# 백엔드 (포트 8000)
cd backend && uvicorn main:app --reload

# 프론트엔드 (포트 3000)
cd frontend && npm run dev

# Next.js Turbopack 캐시 손상 시 (require is not defined 등) — 한 명령에 처리
cd frontend && npm run dev:fresh
```

**Turbopack 캐시 이슈 자동 복구**: 클로드에게 `/reset-dev` 라고 입력하면 dev server 종료 → `.next` 삭제 → 재시작 자동 수행.

## 기술 스택
| 레이어 | 기술 |
|--------|------|
| 백엔드 | FastAPI + SQLAlchemy (raw SQL 혼용) + PostgreSQL |
| 프론트엔드 | Next.js 15 App Router + Tailwind CSS v4 |
| 관리자 인증 | JWT (admin_token localStorage) + admin_authed 쿠키 |
| 회원 인증 | NextAuth.js v5 (JWT 세션) |
| AI | AWS Bedrock — Claude Haiku (텍스트), Claude Sonnet (Vision) |
| DB | `postgresql://kangtaehun@localhost/cathedral` |
| Git | github.com/jnano/sjpeter (main 브랜치) |

## 핵심 규칙 (반드시 지킬 것)

### 1. git push 자동화
기능 하나 완성될 때마다 commit + push. 사용자가 따로 요청하지 않아도 자동 수행.
`.env`, `.env.local` 등 민감 파일은 절대 포함 금지.

### 2. 데이터 삭제 전 백업 필수
```bash
pg_dump -U kangtaehun cathedral > backups/cathedral_$(date +%Y%m%d_%H%M%S).sql
```
게시판 삭제, 대량 UPDATE/DELETE, 마이그레이션 전 반드시 실행.

### 3. 기능 완료 전 테스트 필수
curl 또는 psql로 실제 동작 확인 후 완료 보고. 코드만 보고 완료 선언 금지.

### 4. 모든 공개 페이지에 PageHeader 필수
```tsx
import PageHeader from "@/components/PageHeader";
// group: admin/menus 에서 정의한 그룹 라벨 (예: "성당 소개" | "본당 공동체" | "말씀과 기도" | "알림과 게시판" | "사진 갤러리" | "성전건축").
// 실제 사이드바 매칭은 URL → menu_items.href 우선이고 group prop 은 fallback 으로 사용됨.
<PageHeader group="알림과 게시판" title="페이지 제목" subtitle="한 줄 설명" />
```
IntersectionObserver로 헤더 브레드크럼과 연동됨. 없으면 브레드크럼 미작동.

### 5. 모바일 우선 (Mobile-First)
Tailwind 모바일 레이아웃 먼저, sm:/md: 확장. 60대 신자가 쓸 수 있는 UI.

## DB 마이그레이션
Alembic 미설정. 컬럼 추가 시 `backend/main.py`의 startup 블록에 수동 SQL 추가:
```python
conn.execute(text("ALTER TABLE 테이블 ADD COLUMN IF NOT EXISTS 컬럼 타입"))
```

## 현재 구현된 백엔드 API
```
/api/auth/          # 관리자·회원 로그인/인증
/api/bulletins/     # 주보 PDF 업로드·목록·AI 추출·라우팅
/api/notices/       # 공지사항 CRUD
/api/events/        # 행사·모임 캘린더 CRUD
/api/boards/        # 게시판 관리 + 게시글·댓글·첨부파일
/api/parish/        # 성당정보 (미사시간, 신부님 소개 등)
/api/members/       # 회원 가입·로그인·마이페이지·이메일 인증
/api/archive/       # 역대 사목자(pastors), 본당 출신 사제(priests)
/api/content/       # 역사·사목지표·공동체 그룹·정적 페이지 등
/api/gospel/        # 오늘의 말씀 RSS
/api/settings/      # DB 기반 사이트 설정 (SMTP, OAuth, AWS 키 등)
/api/boards/drafts/ # AI 추출 임시저장 게시글 관리
```

## 주보 AI 추출 파이프라인 (핵심 기능)
```
PDF 업로드
  → Claude AI 분석 (텍스트/Vision)
  → 3분류 자동 라우팅:
      공지     → posts (board.slug='notice') 등록 (source_bulletin_id 로 추적)
      행사+날짜 → events 테이블 직등록 (event_kind='행사', is_ai_generated=TRUE)
      모임+날짜 → events 테이블 직등록 (event_kind='모임', is_ai_generated=TRUE)
      날짜없음  → ai-extract 게시판 임시저장 ([제XXX호] 제목 prefix)
```
- 결과 확인: `/admin/bulletin/[id]/result`
- 임시저장 관리: `/admin/drafts`

## 행사·모임 캘린더
- `events.event_kind`: "행사" | "모임" | null
- `events.end_date`: 멀티데이 스패닝 지원 (캘린더에서 날짜 가로지르는 바 렌더링)
- 상태: 예정 → 기록대기(자동전환, 지난 날짜) → 기록됨
- 공개 캘린더: `/calendar` — 행사 모아보기 / 모임 모아보기 필터 칩

## 관리자 페이지 목록 (`/admin/*`)
| 경로 | 기능 |
|------|------|
| /admin | 로그인 (이미 로그인 시 dashboard로 자동 리다이렉트) |
| /admin/dashboard | 대시보드 |
| /admin/bulletin | 주보 업로드·AI 추출 결과 목록 |
| /admin/bulletin/[id]/result | 주보별 AI 추출 결과 확인 |
| /admin/notices | 공지 관리 (인라인 수정, 다중선택 삭제, 월별 필터) |
| /admin/calendar | 본당 행사·모임 일정 (인라인 수정, 다중선택 삭제, 구분 필터) |
| /admin/drafts | AI 추출 임시저장 관리 (제호 필터, 게시/이동/삭제) |
| /admin/boards | 게시판 관리 (게시물 수 표시) |
| /admin/parish | 성당정보·미사시간 관리 |
| /admin/members | 회원 관리 |
| /admin/pastors | 역대 사목자 관리 |
| /admin/priests | 본당 출신 사제 관리 |
| /admin/content | 정적 콘텐츠 관리 |
| /admin/gallery | 갤러리 관리 |
| /admin/settings | DB 기반 사이트 설정 (SMTP, OAuth 키 등) |
| /admin/logs | 관리자 활동 로그 |

## 공개 페이지 목록
| 경로 | 기능 |
|------|------|
| / | 홈 |
| /bulletin | 주보 아카이브 |
| /calendar | 행사·모임 캘린더 (멀티데이 스패닝, 구분 필터) |
| /boards/[slug] | 게시판 목록·상세 |
| /boards/notice | 공지사항 (boards.slug='notice' 의 posts) |
| /about, /pastor, /history, /vision, /community | 정적 소개 페이지 |
| /pastors, /priests | 역대 사목자·본당 출신 사제 |
| /word | 오늘의 말씀 (RSS) |
| /info | 오시는 길 |
| /gallery | 갤러리 |
| /members/* | 회원 가입·로그인·마이페이지 |

## AI 뱃지 표시
- `is_ai_generated=TRUE`인 notices/events/posts에는 보라색 "AI" 뱃지 표시
- `event_kind`에 따라 파랑("행사") / 초록("모임") 뱃지 별도 표시

## 중요한 아키텍처 결정
- `ai-extract` 게시판: `exclude_from_search=TRUE`, `members_only_read=TRUE` — 공개 목록에서 숨김
- 관리자 미들웨어 없음 (`middleware.ts` 삭제됨) — 각 페이지 레벨에서 토큰 확인
- SMTP, OAuth 키 등 설정값은 `site_settings` DB 테이블에서 관리 (환경변수 폴백)
- DB 기반 설정 읽기: `from app.core.site_settings import get_setting`
