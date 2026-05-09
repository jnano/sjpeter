import logging
import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from app.api import bulletins, notices, auth, members, boards, parish, gospel, content, events, archive
from app.api import settings_api
from app.core.config import settings
from app.core.database import create_tables

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

app = FastAPI(title=settings.PROJECT_NAME)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(bulletins.router, prefix="/api")
app.include_router(notices.router, prefix="/api")
app.include_router(members.router, prefix="/api")
app.include_router(boards.router)  # prefix 포함됨
app.include_router(parish.router, prefix="/api")
app.include_router(gospel.router, prefix="/api")
app.include_router(content.router, prefix="/api")
app.include_router(events.router, prefix="/api")
app.include_router(archive.router, prefix="/api")
app.include_router(settings_api.router)
app.include_router(settings_api.internal_router)

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


@app.on_event("startup")
def startup():
    from app.models import bulletin_extraction  # noqa: F401 — 테이블 등록
    create_tables()
    _migrate_add_columns()
    _seed_initial_data()


def _migrate_add_columns():
    """기존 테이블에 신규 컬럼을 안전하게 추가한다 (IF NOT EXISTS)."""
    from sqlalchemy import text
    from app.core.database import engine

    with engine.connect() as conn:
        for col, col_type in [("lat", "FLOAT"), ("lng", "FLOAT")]:
            try:
                conn.execute(
                    text(f"ALTER TABLE parishes ADD COLUMN IF NOT EXISTS {col} {col_type}")
                )
            except Exception:
                pass

        # posts.member_id NOT NULL → NULL 허용 (AI 생성 게시글 지원)
        try:
            conn.execute(text(
                "ALTER TABLE posts ALTER COLUMN member_id DROP NOT NULL"
            ))
        except Exception:
            pass

        # members 소셜 로그인 컬럼
        for col, col_type in [
            ("name", "VARCHAR(100)"),
            ("phone", "VARCHAR(20)"),
            ("receive_notification", "BOOLEAN DEFAULT FALSE"),
            ("hashed_password", "VARCHAR(200)"),
            ("social_provider", "VARCHAR(20)"),
            ("social_id", "VARCHAR(200)"),
            ("avatar_url", "VARCHAR(500)"),
            ("is_admin", "BOOLEAN DEFAULT FALSE"),
        ]:
            try:
                conn.execute(text(
                    f"ALTER TABLE members ADD COLUMN IF NOT EXISTS {col} {col_type}"
                ))
            except Exception:
                pass
        try:
            conn.execute(text(
                "ALTER TABLE members ALTER COLUMN hashed_password DROP NOT NULL"
            ))
        except Exception:
            pass

        # 세례명(nickname) unique 제약 해제 — 동명 세례명 허용
        try:
            conn.execute(text(
                "ALTER TABLE members DROP CONSTRAINT IF EXISTS members_nickname_key"
            ))
        except Exception:
            pass

        # boards 검색 제외 컬럼
        try:
            conn.execute(text(
                "ALTER TABLE boards ADD COLUMN IF NOT EXISTS exclude_from_search BOOLEAN DEFAULT FALSE"
            ))
        except Exception:
            pass

        # boards 게시판 관리자 전용 쓰기 컬럼
        try:
            conn.execute(text(
                "ALTER TABLE boards ADD COLUMN IF NOT EXISTS moderator_only_write BOOLEAN DEFAULT FALSE"
            ))
        except Exception:
            pass

        # boards 접근 제어 + 관리자 컬럼
        for ddl in [
            "ALTER TABLE boards ADD COLUMN IF NOT EXISTS members_only_write BOOLEAN DEFAULT TRUE",
            "ALTER TABLE boards ADD COLUMN IF NOT EXISTS members_only_read BOOLEAN DEFAULT FALSE",
            "ALTER TABLE boards ADD COLUMN IF NOT EXISTS moderator_id INTEGER REFERENCES members(id) ON DELETE SET NULL",
            "ALTER TABLE boards ADD COLUMN IF NOT EXISTS members_selected BOOLEAN DEFAULT FALSE",
        ]:
            try:
                conn.execute(text(ddl))
            except Exception:
                pass

        # 지정 회원 접근 테이블
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS board_allowed_members (
                id SERIAL PRIMARY KEY,
                board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
                member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
                UNIQUE (board_id, member_id)
            )
        """))

        # 신부님 사진 테이블
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS pastor_photos (
                id SERIAL PRIMARY KEY,
                url VARCHAR(500) NOT NULL,
                is_selected BOOLEAN DEFAULT FALSE,
                uploaded_at TIMESTAMP DEFAULT NOW()
            )
        """))

        # parishes 추가 컬럼
        for col, col_type in [
            ("member_count", "INTEGER"),
            ("pastor_appointed", "VARCHAR(100)"),
        ]:
            try:
                conn.execute(text(f"ALTER TABLE parishes ADD COLUMN IF NOT EXISTS {col} {col_type}"))
            except Exception:
                pass

        # 정적 콘텐츠 테이블 생성
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS history_items (
                id SERIAL PRIMARY KEY,
                year INTEGER NOT NULL,
                event VARCHAR(300) NOT NULL,
                detail TEXT,
                highlight BOOLEAN DEFAULT FALSE,
                is_current BOOLEAN DEFAULT FALSE,
                sort_order INTEGER DEFAULT 0
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS visions (
                id SERIAL PRIMARY KEY,
                year INTEGER NOT NULL,
                motto VARCHAR(300) NOT NULL,
                is_current BOOLEAN DEFAULT FALSE
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS community_groups (
                id SERIAL PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                description TEXT,
                activity_time VARCHAR(200),
                link_url VARCHAR(500),
                sort_order INTEGER DEFAULT 0
            )
        """))
        try:
            conn.execute(text(
                "ALTER TABLE community_groups ADD COLUMN IF NOT EXISTS link_url VARCHAR(500)"
            ))
        except Exception:
            pass
        try:
            conn.execute(text(
                "ALTER TABLE community_groups ADD COLUMN IF NOT EXISTS board_slug VARCHAR(100)"
            ))
        except Exception:
            pass

        # 정적 페이지 테이블
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS static_pages (
                slug VARCHAR(100) PRIMARY KEY,
                title VARCHAR(200) NOT NULL,
                subtitle VARCHAR(300),
                body TEXT,
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """))

        # 묵상 테이블
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS meditations (
                id SERIAL PRIMARY KEY,
                title VARCHAR(200) NOT NULL,
                scripture VARCHAR(300),
                body TEXT NOT NULL,
                author VARCHAR(100),
                published_date DATE NOT NULL,
                is_published BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """))

        # 사목평의회 구성원 테이블
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS council_members (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                role VARCHAR(200) NOT NULL,
                category VARCHAR(100) NOT NULL,
                photo_url VARCHAR(500),
                sort_order INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT TRUE
            )
        """))

        # 이메일 인증 컬럼
        try:
            conn.execute(text(
                "ALTER TABLE members ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN DEFAULT FALSE"
            ))
        except Exception:
            pass

        # 관리 활동 로그 테이블
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS admin_logs (
                id SERIAL PRIMARY KEY,
                admin_identifier VARCHAR(200) NOT NULL,
                action VARCHAR(100) NOT NULL,
                target_type VARCHAR(50),
                target_id INTEGER,
                detail TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """))

        # 행사 캘린더 테이블
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS events (
                id SERIAL PRIMARY KEY,
                title VARCHAR(300) NOT NULL,
                description TEXT,
                event_date DATE NOT NULL,
                end_date DATE,
                start_time VARCHAR(10),
                location VARCHAR(300),
                category VARCHAR(50) DEFAULT 'general',
                is_public BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """))

        # 댓글 대댓글 parent_id
        try:
            conn.execute(text(
                "ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE"
            ))
        except Exception:
            pass

        # 이메일 인증 토큰 테이블
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS email_verification_tokens (
                id SERIAL PRIMARY KEY,
                member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
                token VARCHAR(200) NOT NULL UNIQUE,
                expires_at TIMESTAMP NOT NULL,
                used BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """))

        # 비밀번호 재설정 토큰 테이블
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id SERIAL PRIMARY KEY,
                member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
                token VARCHAR(200) NOT NULL UNIQUE,
                expires_at TIMESTAMP NOT NULL,
                used BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """))

        # 게시글 임시저장 컬럼 (AI 자동 분류 초안)
        try:
            conn.execute(text(
                "ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT TRUE"
            ))
        except Exception:
            pass

        # AI 생성 표시 컬럼
        for tbl in ["notices", "events"]:
            try:
                conn.execute(text(
                    f"ALTER TABLE {tbl} ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN DEFAULT FALSE"
                ))
            except Exception:
                pass

        # 공지사항 게시판 신설 (주보 AI 추출 기본 대상)
        conn.execute(text("""
            INSERT INTO boards (name, slug, is_active, moderator_only_write,
                                members_only_write, members_only_read, members_selected, exclude_from_search)
            VALUES ('공지사항', 'notice', TRUE, TRUE, TRUE, FALSE, FALSE, FALSE)
            ON CONFLICT (slug) DO NOTHING
        """))

        # AI 추출 게시판 (주보 AI 분석 결과 임시 보관, 검색 제외)
        conn.execute(text("""
            INSERT INTO boards (name, slug, is_active, moderator_only_write,
                                members_only_write, members_only_read, members_selected, exclude_from_search)
            VALUES ('AI 추출', 'ai-extract', TRUE, TRUE, TRUE, TRUE, FALSE, TRUE)
            ON CONFLICT (slug) DO NOTHING
        """))

        # 이벤트 유형 → 게시판 매핑 테이블
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS event_board_mappings (
                id SERIAL PRIMARY KEY,
                event_type VARCHAR(50) UNIQUE NOT NULL,
                board_id INTEGER REFERENCES boards(id) ON DELETE SET NULL
            )
        """))

        # 기본 매핑: 행사·모임·봉사·순례·피정·강의 → 공지사항, 기타 → 미지정
        conn.execute(text("""
            INSERT INTO event_board_mappings (event_type, board_id)
            SELECT t.event_type, b.id
            FROM (VALUES ('행사'), ('모임'), ('봉사'), ('순례'), ('피정'), ('강의')) AS t(event_type)
            CROSS JOIN (SELECT id FROM boards WHERE slug = 'notice') AS b
            ON CONFLICT (event_type) DO NOTHING
        """))
        conn.execute(text("""
            INSERT INTO event_board_mappings (event_type, board_id)
            VALUES ('기타', NULL)
            ON CONFLICT (event_type) DO NOTHING
        """))

        # 새 3-분류 타입 씨드 (공지/행사/모임 — auto_process 라우팅용)
        conn.execute(text("""
            INSERT INTO event_board_mappings (event_type, board_id)
            VALUES ('공지', NULL), ('모임', NULL)
            ON CONFLICT (event_type) DO NOTHING
        """))

        # use_calendar 컬럼 추가
        conn.execute(text(
            "ALTER TABLE event_board_mappings ADD COLUMN IF NOT EXISTS use_calendar BOOLEAN NOT NULL DEFAULT FALSE"
        ))

        # 사이트 설정 테이블
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS site_settings (
                key VARCHAR(100) PRIMARY KEY,
                value TEXT,
                label VARCHAR(200) NOT NULL,
                description TEXT,
                is_secret BOOLEAN NOT NULL DEFAULT FALSE,
                group_name VARCHAR(50) NOT NULL DEFAULT '기타'
            )
        """))

        # 기본 설정 항목 씨드 (ON CONFLICT DO NOTHING — 기존값 보호)
        conn.execute(text("""
            INSERT INTO site_settings (key, label, description, is_secret, group_name) VALUES
            ('SITE_URL',              '사이트 URL',            '이메일 링크 등에 사용되는 홈페이지 주소',         FALSE, '사이트'),
            ('SMTP_FROM',             '발신자 이름/주소',       '예: 세종성베드로성당 <noreply@sjpeter.com>',      FALSE, '사이트'),
            ('SMTP_HOST',             'SMTP 서버',             '예: smtp.gmail.com',                            FALSE, '이메일'),
            ('SMTP_PORT',             'SMTP 포트',             '일반적으로 587 (TLS)',                           FALSE, '이메일'),
            ('SMTP_USER',             'SMTP 계정',             '발송에 사용할 이메일 계정',                       FALSE, '이메일'),
            ('SMTP_PASSWORD',         'SMTP 비밀번호',          'Gmail 앱 비밀번호 (16자리)',                     TRUE,  '이메일'),
            ('AWS_REGION',            'AWS 리전',              '예: ap-northeast-1 (도쿄)',                      FALSE, 'AI'),
            ('AWS_ACCESS_KEY_ID',     'AWS 액세스 키 ID',      'IAM 사용자 액세스 키',                            TRUE,  'AI'),
            ('AWS_SECRET_ACCESS_KEY', 'AWS 시크릿 키',         'IAM 사용자 시크릿 액세스 키',                     TRUE,  'AI'),
            ('GOOGLE_CLIENT_ID',      'Google 클라이언트 ID',  'Google OAuth 앱 클라이언트 ID',                   TRUE,  'OAuth'),
            ('GOOGLE_CLIENT_SECRET',  'Google 클라이언트 시크릿', 'Google OAuth 앱 클라이언트 시크릿',             TRUE,  'OAuth'),
            ('KAKAO_CLIENT_ID',       '카카오 클라이언트 ID',   '카카오 OAuth 앱 REST API 키',                    TRUE,  'OAuth'),
            ('KAKAO_CLIENT_SECRET',   '카카오 클라이언트 시크릿', '카카오 OAuth 앱 시크릿 키',                     TRUE,  'OAuth'),
            ('KAKAO_MAP_KEY',         '카카오맵 JavaScript 키', '카카오맵 API JavaScript 키',                     TRUE,  'OAuth'),
            ('AUTH_SECRET',           'NextAuth 시크릿',       '세션 암호화 키 (32자 이상 임의 문자열)',             TRUE,  '보안')
            ON CONFLICT (key) DO NOTHING
        """))

        # events.event_kind 컬럼 추가 (행사 | 모임 | null)
        conn.execute(text(
            "ALTER TABLE events ADD COLUMN IF NOT EXISTS event_kind VARCHAR(10)"
        ))

        conn.commit()


def _seed_initial_data():
    from app.core.database import SessionLocal
    from app.models.parish import Parish
    from app.models.admin import Admin
    from app.models.content import HistoryItem, Vision, CommunityGroup, StaticPage
    from app.core.auth import hash_password

    db = SessionLocal()
    try:
        # 성당 데이터 초기 입력
        if not db.query(Parish).first():
            db.add(Parish(
                slug="sejong-peter",
                name="세종성베드로성당",
                diocese="대전교구",
                address="세종특별자치시 도움5로 00",
                phone="044-000-0000",
            ))
            db.commit()

        # 기본 관리자 계정 (최초 1회)
        if not db.query(Admin).first():
            db.add(Admin(
                username="admin",
                hashed_password=hash_password("change-this-password"),
            ))
            db.commit()

        # 연혁 초기 데이터
        if not db.query(HistoryItem).first():
            history_seed = [
                HistoryItem(year=2011, event="세종성베드로성당 설립", detail="세종특별자치시 출범과 함께 세종시 최초 가톨릭 본당으로 설립. 초대 주임신부 부임.", highlight=True, is_current=False, sort_order=0),
                HistoryItem(year=2012, event="성당 건물 축성", detail="현재 성당 건물이 완공되어 축성 미사를 봉헌.", highlight=False, is_current=False, sort_order=1),
                HistoryItem(year=2015, event="신자 수 200명 돌파", detail="세종시 인구 증가와 함께 공동체가 빠르게 성장.", highlight=False, is_current=False, sort_order=2),
                HistoryItem(year=2019, event="창립 8주년 — 사목평의회 창설", detail="본당 운영의 민주적 참여를 위한 사목평의회 공식 발족.", highlight=False, is_current=False, sort_order=3),
                HistoryItem(year=2021, event="창립 10주년 기념 행사", detail="10주년 감사 미사 및 공동체 축제 개최. 주보 500호 달성.", highlight=True, is_current=False, sort_order=4),
                HistoryItem(year=2023, event="현 주임신부 부임", detail="새로운 사목 시대의 시작.", highlight=False, is_current=False, sort_order=5),
                HistoryItem(year=2026, event="현재", detail="신자 약 480명. 주보 제623호 발행 중.", highlight=False, is_current=True, sort_order=6),
            ]
            db.add_all(history_seed)
            db.commit()

        # 사목지표 초기 데이터
        if not db.query(Vision).first():
            vision_seed = [
                Vision(year=2026, motto="거룩한 향기의 해", is_current=True),
                Vision(year=2025, motto="사랑으로 하나 되는 공동체", is_current=False),
                Vision(year=2024, motto="말씀 안에서 성장하는 해", is_current=False),
                Vision(year=2023, motto="새로운 출발, 함께하는 신앙", is_current=False),
                Vision(year=2022, motto="희망을 향하여", is_current=False),
                Vision(year=2021, motto="창립 10주년 — 감사와 새로운 다짐", is_current=False),
                Vision(year=2020, motto="코로나를 넘어 — 연결된 신앙", is_current=False),
                Vision(year=2019, motto="하느님 안에서 하나 되는 공동체", is_current=False),
            ]
            db.add_all(vision_seed)
            db.commit()

        # 단체/분과 초기 데이터
        if not db.query(CommunityGroup).first():
            community_seed = [
                CommunityGroup(name="사목평의회", description="본당 운영 전반을 논의하고 결정하는 최고 의결 기구", activity_time="회장단 및 각 분과 대표", sort_order=0),
                CommunityGroup(name="레지아 마리애", description="성모 마리아를 통한 사도직 수행 — 병자 방문, 본당 봉사", activity_time="매주 화요일 활동", sort_order=1),
                CommunityGroup(name="성가대", description="미사의 전례 음악을 담당하는 봉사자 모임", activity_time="주일 미사 봉사", sort_order=2),
                CommunityGroup(name="청년회", description="20–40대 청년 신앙 공동체. 신앙 활동 및 봉사", activity_time="매달 모임", sort_order=3),
                CommunityGroup(name="교리반", description="예비신자, 어린이, 청소년 교리 교육 담당", activity_time="주일 오전", sort_order=4),
                CommunityGroup(name="구역·반 모임", description="지역별 소공동체 모임. 신앙 나눔 및 상호 돌봄", activity_time="구역별 자율 운영", sort_order=5),
            ]
            db.add_all(community_seed)
            db.commit()

        # 정적 페이지 초기 데이터
        if not db.query(StaticPage).first():
            pages = [
                StaticPage(
                    slug="saint",
                    title="성 베드로",
                    subtitle="반석 위에 세운 교회의 수호성인",
                    body="예수님께서 시몬에게 베드로(반석)라는 이름을 주시며 말씀하셨습니다.\n"
                         "\"나는 이 반석 위에 내 교회를 세울 터인즉 저승의 세력도 그것을 이기지 못할 것이다.\" (마태 16,18)\n\n"
                         "세종성베드로성당은 성 베드로 사도의 신앙과 용기를 본받아,\n"
                         "세종 땅에 하느님 나라를 세워가는 공동체입니다.\n\n"
                         "갈릴래아 어부 출신의 평범한 사람이었지만, 예수님의 부르심에 응답하여\n"
                         "교회의 초석이 된 베드로처럼,\n"
                         "우리 공동체도 날마다 주님께 더 가까이 나아가길 다짐합니다.",
                ),
                StaticPage(
                    slug="council",
                    title="사목평의회",
                    subtitle="본당 공동체의 사목 방향을 함께 의논하는 기구",
                    body="사목평의회는 주임신부님을 중심으로 본당 운영의 주요 사항을 협의하고\n"
                         "공동체 발전을 위해 함께 기도하고 실천하는 본당 최고 의결 기구입니다.\n\n"
                         "구성: 회장단, 각 분과 대표, 구역장 대표\n"
                         "회의: 분기별 정기회의 및 필요시 임시회의\n\n"
                         "문의사항은 본당 사무실로 연락해 주시기 바랍니다.",
                ),
                StaticPage(
                    slug="meditation",
                    title="작은 묵상",
                    subtitle="말씀 안에서 머무는 시간",
                    body="\"그의 법을 밤낮으로 묵상하는 사람, 그는 시냇가에 심긴 나무와 같아\n"
                         "제때에 열매를 내며 잎이 시들지 않으니, 그가 하는 일마다 잘 되리라.\" (시편 1,2-3)\n\n"
                         "이 공간은 신앙 안에서 작은 묵상을 나누는 곳입니다.\n"
                         "말씀, 기도, 삶의 이야기를 함께 나누어 주세요.\n\n"
                         "※ 내용은 관리자가 수시로 업데이트합니다.",
                ),
                StaticPage(
                    slug="prayer",
                    title="기도문 모음",
                    subtitle="함께 드리는 기도",
                    body="기도는 하느님과 나누는 대화입니다.\n\n"
                         "[ 아침 기도 ]\n"
                         "주님, 오늘 하루도 당신의 뜻 안에서 살아가게 하소서.\n\n"
                         "[ 식사 전 기도 ]\n"
                         "주님, 이 음식을 주신 것과 저희를 사랑해 주심에 감사드립니다.\n\n"
                         "[ 저녁 기도 ]\n"
                         "오늘 하루 동안 주신 은혜에 감사드리며, 평안한 밤을 허락하소서.\n\n"
                         "※ 더 많은 기도문은 관리자가 계속 추가할 예정입니다.",
                ),
            ]
            db.add_all(pages)
            db.commit()

    finally:
        db.close()


@app.get("/api/health")
def health():
    return {"status": "ok", "project": settings.PROJECT_NAME}


@app.get("/", response_class=HTMLResponse, include_in_schema=False)
def root():
    return HTMLResponse(content="""<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>세종성베드로성당 API</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f8f7f4;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    .card {
      background: #fff;
      border-radius: 20px;
      box-shadow: 0 4px 32px rgba(0,0,0,.08);
      padding: 3rem 3.5rem;
      max-width: 520px;
      width: 100%;
      text-align: center;
    }
    .cross {
      font-size: 3rem;
      color: #7c5c3e;
      margin-bottom: 1rem;
      line-height: 1;
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 700;
      color: #3b2f1e;
      margin-bottom: .25rem;
    }
    .sub {
      font-size: .85rem;
      color: #9c8c7a;
      margin-bottom: 2rem;
      letter-spacing: .04em;
    }
    .status {
      display: inline-flex;
      align-items: center;
      gap: .4rem;
      background: #f0faf0;
      color: #2d7a3a;
      font-size: .8rem;
      font-weight: 600;
      padding: .35rem .9rem;
      border-radius: 999px;
      margin-bottom: 2rem;
    }
    .dot {
      width: 8px; height: 8px;
      background: #3aad47;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: .4; }
    }
    .links {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: .75rem;
      margin-bottom: 2rem;
    }
    .link-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: .3rem;
      padding: 1rem .75rem;
      border-radius: 12px;
      text-decoration: none;
      font-size: .82rem;
      font-weight: 600;
      transition: transform .15s, box-shadow .15s;
      border: 1.5px solid transparent;
    }
    .link-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(0,0,0,.1);
    }
    .link-btn .icon { font-size: 1.4rem; }
    .btn-site   { background: #7c5c3e; color: #fff; }
    .btn-docs   { background: #f5f0eb; color: #5a3e28; border-color: #e5d9cc; }
    .btn-redoc  { background: #f5f0eb; color: #5a3e28; border-color: #e5d9cc; }
    .btn-health { background: #f5f0eb; color: #5a3e28; border-color: #e5d9cc; }
    .divider {
      border: none;
      border-top: 1px solid #ede9e4;
      margin-bottom: 1.25rem;
    }
    .footer {
      font-size: .75rem;
      color: #b0a090;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="cross">✝</div>
    <h1>세종성베드로성당</h1>
    <p class="sub">St. Peter&rsquo;s Cathedral, Sejong &mdash; Backend API</p>

    <div class="status">
      <span class="dot"></span>
      서버 정상 운영 중
    </div>

    <div class="links">
      <a class="link-btn btn-site" href="http://localhost:3000" target="_blank">
        <span class="icon">🏠</span>홈페이지
      </a>
      <a class="link-btn btn-docs" href="/docs" target="_blank">
        <span class="icon">📄</span>Swagger UI
      </a>
      <a class="link-btn btn-redoc" href="/redoc" target="_blank">
        <span class="icon">📘</span>ReDoc
      </a>
      <a class="link-btn btn-health" href="/api/health" target="_blank">
        <span class="icon">💚</span>Health Check
      </a>
    </div>

    <hr class="divider" />
    <p class="footer">대전교구 세종성베드로성당 &copy; 2025</p>
  </div>
</body>
</html>""")

