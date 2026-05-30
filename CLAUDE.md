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

### 6. 메뉴 등록 자원 = 사이드바 필수 (시스템 불변량)
**`/admin/menus` 의 활성 `menu_items` 에 등록된 URL 은 어떤 상황에서도 사이드바를 가진다.**
- 정적 라우트 (`/about`, `/pastor`, `/history` 등): `SectionLayout` 으로 감쌈
- 게시판 (`/boards/*`): 자체 SectionLayout 사용
- 동적 페이지 (`/p/*`): layout_kind 가 `html` 이라도 `in_menu=true` 면 자동 wrap (런타임 가드 — pages.py)
- 의도된 예외: 풀폭 갤러리 (`/photos`) — 본문 폭이 우선이라 의도적으로 사이드바 생략

새 라우트 추가 시:
1. 메뉴에 등록한다면 `<PageHeader>` + `<SectionLayout>` 또는 chipsOnly 사용
2. 메뉴 미등록 자유 페이지(랜딩 등)는 wrapper 없이 자유

[[feedback_menu_sidebar_invariant]] 메모리에 자세한 가드 동작·예외 케이스·검증 방법 정리.

## DB 마이그레이션 (v1.5.452 이후 — Alembic)

**신규 스키마 변경은 alembic revision 으로만 작성합니다.**

```bash
cd backend && source venv/bin/activate
alembic revision --autogenerate -m "add member.foo column"
# 생성된 versions/XXXX_*.py 검토·수정
# 서버 재기동 시 _alembic_upgrade_to_head() 가 startup 자동 적용
```

- ❌ `backend/main.py` 의 `_migrate_add_columns()` 에 신규 ALTER 추가 금지
- ✅ 모델 수정 → alembic revision → commit 한 묶음으로
- 상세 워크플로: `backend/docs/SCHEMA_CHANGES.md`

기존 1100+ 줄 `_migrate_add_columns()` 는 baseline 으로 보존(빈 DB 초기화용).

## 데이터 삭제 정책 (Hard Delete)

이 프로젝트는 **hard delete** 를 사용한다. 글로벌 `~/.claude/CLAUDE.md` 의 `is_deleted` 소프트 삭제 규칙은 본 프로젝트에 **미적용**.

- 게시판/회원 도메인 특성상 사용자 요청·관리자 정리·GDPR 등 hard delete 가 자연스러움
- `db.delete(obj)` 또는 `DELETE FROM …` 그대로 사용
- 삭제 전 백업 의무는 별도 (CLAUDE.md §2 "데이터 삭제 전 백업 필수" 참조)
- `is_active` 토글은 "활성/비활성" 의미로 사용 (삭제와 다름) — Member.is_active, Board.is_active

## 배포 파일 생성 시 `site_settings` 데이터 포함 (필수)

이 프로젝트는 OAuth·AWS Bedrock·KAKAO·SMTP·AUTH_SECRET 등 **운영에 필수적인 외부 키 23종을 `site_settings` DB 테이블에 보관**한다 (CLAUDE.md "중요한 아키텍처 결정" 참조). 글로벌 `~/.claude/CLAUDE.md` ③ 백업 규칙의 `pg_dump --schema-only` 만으로는 이 데이터가 모두 누락되어, 새 환경에 배포해도 소셜 로그인·AI 추출·알림 발송이 모두 불능 상태가 된다.

**그러므로 이 프로젝트의 배포 파일을 생성할 때는 글로벌 ③ 규칙에 더해 반드시 아래 두 단계를 추가한다.**

### 1) `site_settings` 데이터 dump 추가

`~/.claude/CLAUDE.md` 의 ③ 백업 절차 중 "3) DB 스키마" 단계 직후에 다음을 실행:

```bash
pg_dump -U kangtaehun --data-only --inserts -t site_settings cathedral \
  > "$STAGING/site_settings_data.sql"
```

- `--data-only`: 데이터만 (스키마는 위 단계의 db_schema.sql에 이미 포함됨)
- `--inserts`: COPY 가 아닌 INSERT 문으로 — 사람이 검토·편집 가능

### 2) RESTORE.md 의 "4. DB 복구" 절에 추가 안내

```markdown
### 외부 키 복원 (소셜 로그인·AI·SMTP 활성화에 필수)
psql -U <user> -d <db> < site_settings_data.sql
```

이 단계를 빠뜨리면 새 서버에서 `/admin/settings` 페이지로 23개 키를 수동 재입력해야 한다.

### 보안 주의

`site_settings_data.sql` 은 평문 키를 그대로 포함하므로 `.env` 와 동일한 보안 등급으로 취급한다. 백업 압축파일 자체를 안전한 저장소(예: 암호 관리자, 별도 암호화된 폴더)에 보관하고, 공개 저장소·공유 드라이브에 절대 업로드하지 않는다.

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

사이드바 그룹 순서 기준 (v1.5.274):

| 그룹 | 경로 | 기능 |
|------|------|------|
| (단독) | /admin | 로그인 (이미 로그인 시 dashboard 자동 리다이렉트) |
| (단독) | /admin/dashboard | 대시보드 |
| (단독) | /admin/construction | 성전 건축 — 단계·마일스톤·일지 |
| 성당 정보 | /admin/parish, /admin/parish/info | 기본 정보 |
| 성당 정보 | /admin/parish/mass-times | 미사 시간 |
| 성당 정보 | /admin/history | 연혁 관리 |
| 신부님·수녀님 | /admin/parish-staff | 사목자 |
| 신부님·수녀님 | /admin/pastors | 역대 신부님·수녀님 |
| 신부님·수녀님 | /admin/priests | 본당 출신 사제 |
| 말씀·기도 | /admin/vision | 사목지표 |
| 말씀·기도 | /admin/meditation | 주일 말씀 |
| 말씀·기도 | /admin/prayers | 기도문 관리 |
| 말씀·기도 | /admin/saints | 성인 사전 |
| 주보 관리 | /admin/bulletin | 주보 업로드·목록 |
| 주보 관리 | /admin/bulletin/new | 신규 업로드 |
| 주보 관리 | /admin/bulletin/[id]/result | 주보별 AI 추출 결과 |
| 주보 관리 | /admin/bulletin/extractions | AI 추출 검토 (전체 큐) |
| 주보 관리 | /admin/bulletin/stats | AI 분석 통계 |
| 주보 관리 | /admin/drafts | AI 임시저장 (제호 필터, 게시/이동/삭제) |
| 주보 관리 | /admin/event-mapping | AI 분류 설정 |
| 소식·일정 | /admin/notices | 공지 관리 (인라인 수정, 다중선택 삭제, 월별 필터) |
| 소식·일정 | /admin/calendar | 본당 행사·모임 일정 (인라인 수정, 구분 필터) |
| 단체·분과 | /admin/council | 사목평의회 |
| 단체·분과 | /admin/community | 단체·분과 |
| 게시판·회원 | /admin/boards | 게시판 관리 (게시물 수 표시) |
| 게시판·회원 | /admin/members, /admin/members/[id] | 회원 관리·상세 |
| 페이지·배너 | /admin/pages | 페이지 만들기 (동적 페이지) |
| 페이지·배너 | /admin/banners | 광고 배너 |
| 레이아웃 | /admin/home | 홈 페이지 블록 빌더 |
| 레이아웃 | /admin/menus | 메뉴 |
| 레이아웃 | /admin/home-banner | 메인 사진 |
| 레이아웃 | /admin/page-photos, /admin/page-photos/[slug] | 페이지 사진 슬라이드쇼 |
| 레이아웃 | /admin/season | 전례 시기 테마 |
| 시스템 | /admin/settings | DB 기반 사이트 설정 (SMTP, OAuth 키 등 — super-admin 전용) |
| 시스템 | /admin/reports | 장애 신고 |
| 시스템 | /admin/logs | 활동 로그 |
| 시스템 | /admin/docs | 기술 문서 (CHANGELOG, API 표) |
| (기타) | /admin/content, /admin/gallery | 정적 콘텐츠·갤러리 (구버전, 점진적 폐기) |

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
