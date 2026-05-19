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
from app.api import settings_api, home_banner, parish_staff, page_photos, menus, pages, construction, banners, util
from app.api import issue_reports, transport_routes, photos, saints
from app.core.config import settings
from app.core.database import create_tables

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

limiter = Limiter(key_func=get_remote_address, default_limits=[f"{settings.RATE_LIMIT_PER_MINUTE}/minute"])

app = FastAPI(title=settings.PROJECT_NAME)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://121.152.118.40:3000",  # LAN 접속 (같은 Wi-Fi 휴대폰)
    ],
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
app.include_router(home_banner.router, prefix="/api")
app.include_router(parish_staff.router, prefix="/api")
app.include_router(page_photos.router, prefix="/api")
app.include_router(menus.router, prefix="/api")
app.include_router(pages.router, prefix="/api")
app.include_router(construction.router, prefix="/api")
app.include_router(banners.router, prefix="/api")
app.include_router(issue_reports.router, prefix="/api")
app.include_router(transport_routes.router, prefix="/api")
app.include_router(photos.router, prefix="/api")
app.include_router(saints.router, prefix="/api")
app.include_router(util.router)

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


@app.on_event("startup")
def startup():
    from app.models import bulletin_extraction  # noqa: F401 — 테이블 등록
    from app.models import member_interest  # noqa: F401 — 회원 관심분과
    from app.models import construction  # noqa: F401 — 성당 건축 공사 단계·일지
    from app.models import saint  # noqa: F401 — 가톨릭 성인 사전 (세례명 → 축일)
    create_tables()
    _migrate_add_columns()
    _alembic_upgrade_to_head()  # alembic 신규 변경 자동 적용 (도입 후)
    _seed_initial_data()


def _alembic_upgrade_to_head() -> None:
    """alembic upgrade head 를 startup 에서 자동 실행 (단일 진입점 정책).
    실패해도 app 기동을 막지 않음 — _migrate_add_columns 가 baseline 보장."""
    try:
        import os
        from alembic.config import Config
        from alembic import command
        cfg_path = os.path.join(os.path.dirname(__file__), "alembic.ini")
        if not os.path.exists(cfg_path):
            return
        cfg = Config(cfg_path)
        command.upgrade(cfg, "head")
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning("alembic upgrade 실패 (무시): %s", exc)


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
            ("interest_prompt_completed", "BOOLEAN DEFAULT FALSE NOT NULL"),
            ("notify_kakao", "BOOLEAN DEFAULT FALSE NOT NULL"),
            # 영명축일 (월·일 별도 INT, 둘 다 NULL 허용. v1.5.141)
            ("name_day_month", "INTEGER"),
            ("name_day_day", "INTEGER"),
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

        # posts.linked_event_id — 캘린더 이벤트 카드 연동 (시나리오 A)
        try:
            conn.execute(text(
                "ALTER TABLE posts ADD COLUMN IF NOT EXISTS linked_event_id INTEGER "
                "REFERENCES events(id) ON DELETE CASCADE"
            ))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_posts_linked_event_id ON posts(linked_event_id)"
            ))
        except Exception:
            pass

        # boards 접근 제어 + 관리자 컬럼
        for ddl in [
            "ALTER TABLE boards ADD COLUMN IF NOT EXISTS members_only_write BOOLEAN DEFAULT TRUE",
            "ALTER TABLE boards ADD COLUMN IF NOT EXISTS members_only_read BOOLEAN DEFAULT FALSE",
            "ALTER TABLE boards ADD COLUMN IF NOT EXISTS moderator_id INTEGER REFERENCES members(id) ON DELETE SET NULL",
            "ALTER TABLE boards ADD COLUMN IF NOT EXISTS members_selected BOOLEAN DEFAULT FALSE",
            # 메뉴 자동 노출 토글 (default TRUE — 새 게시판은 자동, 기존은 별도 UPDATE로 false)
            "ALTER TABLE boards ADD COLUMN IF NOT EXISTS show_in_menu BOOLEAN DEFAULT TRUE",
            # 게시판 형식: 'default'(일반) | 'line'(한 줄 메시지)
            "ALTER TABLE boards ADD COLUMN IF NOT EXISTS kind VARCHAR(20) DEFAULT 'default' NOT NULL",
            # 게시판 목록 표시 컬럼 admin 토글 (v1.5.120)
            "ALTER TABLE boards ADD COLUMN IF NOT EXISTS list_show_number BOOLEAN NOT NULL DEFAULT FALSE",
            "ALTER TABLE boards ADD COLUMN IF NOT EXISTS list_show_author BOOLEAN NOT NULL DEFAULT TRUE",
            "ALTER TABLE boards ADD COLUMN IF NOT EXISTS list_show_date BOOLEAN NOT NULL DEFAULT TRUE",
            "ALTER TABLE boards ADD COLUMN IF NOT EXISTS list_show_views BOOLEAN NOT NULL DEFAULT TRUE",
            "ALTER TABLE boards ADD COLUMN IF NOT EXISTS list_show_likes BOOLEAN NOT NULL DEFAULT FALSE",
            "ALTER TABLE boards ADD COLUMN IF NOT EXISTS list_show_comments BOOLEAN NOT NULL DEFAULT TRUE",
            # 공개 페이지 뷰 토글 노출 여부 (v1.5.138)
            "ALTER TABLE boards ADD COLUMN IF NOT EXISTS show_view_list BOOLEAN NOT NULL DEFAULT TRUE",
            "ALTER TABLE boards ADD COLUMN IF NOT EXISTS show_view_card BOOLEAN NOT NULL DEFAULT TRUE",
            "ALTER TABLE boards ADD COLUMN IF NOT EXISTS show_view_photo BOOLEAN NOT NULL DEFAULT TRUE",
            "ALTER TABLE boards ADD COLUMN IF NOT EXISTS show_search_form BOOLEAN NOT NULL DEFAULT TRUE",
            # 게시글 공유 기능 (v1.5.140)
            "ALTER TABLE boards ADD COLUMN IF NOT EXISTS share_enabled BOOLEAN NOT NULL DEFAULT TRUE",
            "ALTER TABLE boards ADD COLUMN IF NOT EXISTS list_show_shares BOOLEAN NOT NULL DEFAULT FALSE",
            "ALTER TABLE posts ADD COLUMN IF NOT EXISTS share_allowed BOOLEAN NOT NULL DEFAULT FALSE",
            "ALTER TABLE posts ADD COLUMN IF NOT EXISTS share_count INTEGER NOT NULL DEFAULT 0",
            # posts 한 줄 메시지용 메타 필드
            "ALTER TABLE posts ADD COLUMN IF NOT EXISTS intention_kind VARCHAR(20)",
            "ALTER TABLE posts ADD COLUMN IF NOT EXISTS intention_for VARCHAR(200)",
            # 사목지표 본문 (모토 + 상세 설명)
            "ALTER TABLE visions ADD COLUMN IF NOT EXISTS body TEXT",
            # 성당 로고
            "ALTER TABLE parishes ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500)",
            # 분과/단체 대표 이미지 (카드 썸네일용)
            "ALTER TABLE community_groups ADD COLUMN IF NOT EXISTS representative_photo_url VARCHAR(500)",
        ]:
            try:
                conn.execute(text(ddl))
            except Exception:
                pass

        # 게시판 어드민 분류 그룹 (admin/boards 화면 정리용. 공개 페이지엔 영향 없음.)
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS board_admin_groups (
                id SERIAL PRIMARY KEY,
                name VARCHAR(80) NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        try:
            conn.execute(text(
                "ALTER TABLE boards ADD COLUMN IF NOT EXISTS admin_group_id INTEGER "
                "REFERENCES board_admin_groups(id) ON DELETE SET NULL"
            ))
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

        # 회원 관심 분과/단체 — 첫 로그인 온보딩 + 향후 카톡 알림 대상
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS member_community_interests (
                id SERIAL PRIMARY KEY,
                member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
                community_group_id INTEGER NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT NOW() NOT NULL,
                UNIQUE (member_id, community_group_id)
            )
        """))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_member_community_interests_member ON member_community_interests(member_id)"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_member_community_interests_group ON member_community_interests(community_group_id)"
        ))

        # 성당 건축 공사 단계 (마일스톤)
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS construction_phases (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                sort_order INTEGER DEFAULT 0 NOT NULL,
                status VARCHAR(20) DEFAULT 'planned' NOT NULL,
                progress_percent INTEGER DEFAULT 0 NOT NULL,
                started_at DATE,
                completed_at DATE,
                expected_completion_date DATE,
                photo_url VARCHAR(500),
                created_at TIMESTAMP DEFAULT NOW() NOT NULL,
                updated_at TIMESTAMP DEFAULT NOW() NOT NULL
            )
        """))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_construction_phases_sort ON construction_phases(sort_order)"
        ))

        # 공지 사진 첨부 (다중)
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS notice_attachments (
                id SERIAL PRIMARY KEY,
                notice_id INTEGER NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
                file_url VARCHAR(500) NOT NULL,
                original_name VARCHAR(300),
                file_size INTEGER DEFAULT 0,
                sort_order INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW() NOT NULL
            )
        """))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_notice_attachments_notice ON notice_attachments(notice_id)"
        ))

        # 한 줄 게시판 추천(공감) — 회원 1인 1회 토글
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS post_likes (
                id SERIAL PRIMARY KEY,
                post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
                member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT NOW() NOT NULL,
                UNIQUE (post_id, member_id)
            )
        """))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_post_likes_post ON post_likes(post_id)"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_post_likes_member ON post_likes(member_id)"
        ))

        # 성당 건축 한 줄 일지
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS construction_journal (
                id SERIAL PRIMARY KEY,
                entry_date DATE NOT NULL,
                note TEXT NOT NULL,
                photo_url VARCHAR(500),
                created_at TIMESTAMP DEFAULT NOW() NOT NULL,
                updated_at TIMESTAMP DEFAULT NOW() NOT NULL
            )
        """))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_construction_journal_date ON construction_journal(entry_date DESC)"
        ))

        # 가톨릭 성인 사전 — 세례명으로 축일 조회
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS saints (
                id SERIAL PRIMARY KEY,
                korean_name VARCHAR(80) NOT NULL,
                latin_name VARCHAR(120),
                feast_month INTEGER NOT NULL,
                feast_day INTEGER NOT NULL,
                title VARCHAR(80),
                bio_short TEXT,
                patronage VARCHAR(200),
                rank_within_name INTEGER DEFAULT 0 NOT NULL,
                is_active BOOLEAN DEFAULT TRUE NOT NULL,
                created_at TIMESTAMP DEFAULT NOW() NOT NULL,
                updated_at TIMESTAMP DEFAULT NOW() NOT NULL
            )
        """))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_saints_korean_name ON saints(korean_name)"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_saints_feast ON saints(feast_month, feast_day)"
        ))

        # legacy 신부님 사진 테이블 / 컬럼 제거 (parish_staff로 이전됨)
        conn.execute(text("DROP TABLE IF EXISTS pastor_photos"))
        for legacy_col in ("pastor_name", "pastor_appointed", "pastor_message", "pastor_photo_url"):
            try:
                conn.execute(text(f"ALTER TABLE parishes DROP COLUMN IF EXISTS {legacy_col}"))
            except Exception:
                pass

        # parish_pastors: 신부님/수녀님 구분 컬럼
        try:
            conn.execute(text(
                "ALTER TABLE parish_pastors ADD COLUMN IF NOT EXISTS category VARCHAR(20) NOT NULL DEFAULT 'priest'"
            ))
        except Exception:
            pass

        # 본당 가족 (parish_staff)
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS parish_staff (
                id SERIAL PRIMARY KEY,
                role VARCHAR(30) NOT NULL,
                name VARCHAR(100) NOT NULL,
                title VARCHAR(100),
                feast_day VARCHAR(20),
                photo_url VARCHAR(500),
                introduction TEXT,
                career_items TEXT,
                scripture_quote TEXT,
                scripture_reference VARCHAR(100),
                sort_order INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_parish_staff_role ON parish_staff(role)"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_parish_staff_sort ON parish_staff(sort_order)"
        ))

        # 홈 배너 테이블
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS home_banners (
                id SERIAL PRIMARY KEY,
                file_url VARCHAR(500) NOT NULL,
                original_name VARCHAR(300) NOT NULL,
                sort_order INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """))
        # SQLAlchemy create_tables가 먼저 만든 경우 default가 빠질 수 있어 보정
        try:
            conn.execute(text("ALTER TABLE home_banners ALTER COLUMN created_at SET DEFAULT NOW()"))
            conn.execute(text("UPDATE home_banners SET created_at = NOW() WHERE created_at IS NULL"))
        except Exception:
            pass
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_home_banners_sort ON home_banners(sort_order)"
        ))

        # 페이지별 사진 (다중) + 슬라이드쇼 설정
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS page_photos (
                id SERIAL PRIMARY KEY,
                page_slug VARCHAR(50) NOT NULL,
                file_url VARCHAR(500) NOT NULL,
                alt VARCHAR(200),
                sort_order INTEGER DEFAULT 0 NOT NULL,
                created_at TIMESTAMP DEFAULT NOW() NOT NULL,
                updated_at TIMESTAMP DEFAULT NOW() NOT NULL
            )
        """))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_page_photos_slug ON page_photos(page_slug)"
        ))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS page_photo_settings (
                page_slug VARCHAR(50) PRIMARY KEY,
                transition_mode VARCHAR(20) DEFAULT 'fade' NOT NULL,
                interval_seconds INTEGER DEFAULT 5 NOT NULL,
                updated_at TIMESTAMP DEFAULT NOW() NOT NULL
            )
        """))
        conn.execute(text(
            "ALTER TABLE page_photo_settings ADD COLUMN IF NOT EXISTS transition_duration_ms INTEGER DEFAULT 700 NOT NULL"
        ))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS page_photo_slugs (
                id SERIAL PRIMARY KEY,
                slug VARCHAR(50) UNIQUE NOT NULL,
                label VARCHAR(100) NOT NULL,
                public_href VARCHAR(200) NOT NULL,
                description TEXT,
                fallback_url VARCHAR(500),
                sort_order INTEGER DEFAULT 0 NOT NULL,
                created_at TIMESTAMP DEFAULT NOW() NOT NULL,
                updated_at TIMESTAMP DEFAULT NOW() NOT NULL
            )
        """))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_page_photo_slugs_sort ON page_photo_slugs(sort_order)"
        ))

        # parishes 추가 컬럼
        for col, col_type in [
            ("member_count", "INTEGER"),
            ("about_photo_url", "VARCHAR(500)"),
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
        # 메뉴 관리 (Header + Sidebar 통합) — 2026-05-11
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS menu_groups (
                id SERIAL PRIMARY KEY,
                key VARCHAR(50) UNIQUE NOT NULL,
                label VARCHAR(100) NOT NULL,
                subtitle VARCHAR(200),
                icon VARCHAR(20),
                sidebar_image_url VARCHAR(500),
                sidebar_width_px INTEGER DEFAULT 220,
                sort_order INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS menu_items (
                id SERIAL PRIMARY KEY,
                group_id INTEGER NOT NULL REFERENCES menu_groups(id) ON DELETE CASCADE,
                label VARCHAR(100) NOT NULL,
                href VARCHAR(500) NOT NULL,
                is_external BOOLEAN DEFAULT FALSE,
                sort_order INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """))
        # 신규 DB 안전망: legacy 컬럼이 남아있다면 제거
        # - source_type/source_id: 2026-05-11 폐기
        # - label_override: 2026-05-14 폐기 (메뉴 라벨이 사이트 전역 단일 진실 소스가 됨)
        for stmt in [
            "ALTER TABLE menu_items DROP COLUMN IF EXISTS source_type",
            "ALTER TABLE menu_items DROP COLUMN IF EXISTS source_id",
            "ALTER TABLE menu_items DROP COLUMN IF EXISTS label_override",
        ]:
            try:
                conn.execute(text(stmt))
            except Exception:
                pass
        try:
            conn.execute(text(
                "ALTER TABLE menu_groups ADD COLUMN IF NOT EXISTS show_in_header BOOLEAN DEFAULT TRUE"
            ))
        except Exception:
            pass
        try:
            # TRUE면 footer 의 '관련 사이트' 영역에 노출. 헤더와 독립적.
            conn.execute(text(
                "ALTER TABLE menu_groups ADD COLUMN IF NOT EXISTS show_in_footer BOOLEAN NOT NULL DEFAULT FALSE"
            ))
        except Exception:
            pass
        try:
            # 메뉴 항목 대표 사진 (footer 원형 표시 등). NULL=텍스트만 노출.
            conn.execute(text(
                "ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS image_url VARCHAR(500)"
            ))
        except Exception:
            pass
        try:
            # NULL이면 자동 비율(현재 aspect-[5/4]), 값이 있으면 그 px로 고정 + object-cover
            conn.execute(text(
                "ALTER TABLE menu_groups ADD COLUMN IF NOT EXISTS sidebar_height_px INTEGER"
            ))
        except Exception:
            pass
        try:
            # object-position 값. 'center' 디폴트. 9방향 중 하나.
            conn.execute(text(
                "ALTER TABLE menu_groups ADD COLUMN IF NOT EXISTS "
                "sidebar_image_position VARCHAR(20) NOT NULL DEFAULT 'center'"
            ))
        except Exception:
            pass
        try:
            # 헤더 그룹 라벨 클릭 시 이동할 페이지 (NULL=첫 번째 sub item으로)
            conn.execute(text(
                "ALTER TABLE menu_groups ADD COLUMN IF NOT EXISTS "
                "landing_href VARCHAR(500)"
            ))
        except Exception:
            pass
        try:
            conn.execute(text(
                "ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES menu_items(id) ON DELETE CASCADE"
            ))
        except Exception:
            pass
        # 메뉴 연결 종류 + 참조 (3가지: page/board/external) — 2026-05-11
        for stmt in [
            "ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS link_type VARCHAR(20) DEFAULT 'external'",
            "ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS static_page_slug VARCHAR(100)",
            "ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS board_id INTEGER REFERENCES boards(id) ON DELETE CASCADE",
            "ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS external_url VARCHAR(500)",
            # unique 부분 인덱스: source 중복 방지 (NULL은 unique 검사에서 제외됨)
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_menu_items_board_unique ON menu_items (board_id) WHERE board_id IS NOT NULL",
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_menu_items_page_unique ON menu_items (static_page_slug) WHERE static_page_slug IS NOT NULL",
        ]:
            try:
                conn.execute(text(stmt))
            except Exception:
                pass

        # 분과/소속단체 트리 + 슬러그 + 활동·사진 (2026-05-11)
        for stmt in [
            "ALTER TABLE community_groups ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES community_groups(id) ON DELETE CASCADE",
            "ALTER TABLE community_groups ADD COLUMN IF NOT EXISTS slug VARCHAR(100)",
            "ALTER TABLE community_groups ADD COLUMN IF NOT EXISTS activities TEXT",
            "ALTER TABLE community_groups ADD COLUMN IF NOT EXISTS photo_urls TEXT[]",
            "ALTER TABLE community_groups ADD COLUMN IF NOT EXISTS photo_display_mode VARCHAR(20) DEFAULT 'slideshow'",
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_community_groups_slug ON community_groups (slug) WHERE slug IS NOT NULL",
        ]:
            try:
                conn.execute(text(stmt))
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

        # 동적 페이지 테이블 (admin이 코드 없이 생성/편집 — 2026-05-11)
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS dynamic_pages (
                id SERIAL PRIMARY KEY,
                slug VARCHAR(80) UNIQUE NOT NULL,
                title VARCHAR(200) NOT NULL,
                subtitle VARCHAR(300),
                group_label VARCHAR(50),
                layout_kind VARCHAR(30) NOT NULL DEFAULT 'body',
                payload JSONB NOT NULL DEFAULT '{}'::jsonb,
                body_markdown TEXT,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """))
        try:
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_dynamic_pages_slug ON dynamic_pages(slug)"))
        except Exception:
            pass

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

        # 기도문 테이블 — 카테고리별로 영구 보존되는 가톨릭 기도문 모음
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS prayers (
                id SERIAL PRIMARY KEY,
                title VARCHAR(200) NOT NULL,
                category VARCHAR(50) NOT NULL DEFAULT 'daily',
                scripture VARCHAR(300),
                body TEXT NOT NULL,
                author VARCHAR(100),
                is_published BOOLEAN NOT NULL DEFAULT TRUE,
                display_order INTEGER NOT NULL DEFAULT 0,
                is_featured BOOLEAN NOT NULL DEFAULT FALSE,
                background_image_url VARCHAR(500),
                background_repeat BOOLEAN NOT NULL DEFAULT FALSE,
                background_position VARCHAR(20) NOT NULL DEFAULT 'top-left',
                background_blur INTEGER NOT NULL DEFAULT 0,
                background_opacity INTEGER NOT NULL DEFAULT 100,
                background_gradient VARCHAR(10) NOT NULL DEFAULT 'none',
                background_gradient_size INTEGER NOT NULL DEFAULT 100,
                body_font_size_px INTEGER NOT NULL DEFAULT 15,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """))
        # prayers 카테고리·정렬·핀 빠른 조회용 인덱스
        try:
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_prayers_category_order "
                "ON prayers (category, display_order, id)"
            ))
        except Exception:
            pass
        # prayers 컬럼 default 보강 — SQLAlchemy가 먼저 테이블을 만들면
        # 위 CREATE TABLE IF NOT EXISTS가 스킵돼 DEFAULT가 빠진다.
        # 명시적 ALTER로 raw SQL/psql INSERT 시에도 안전하게.
        for stmt in [
            "ALTER TABLE prayers ALTER COLUMN category SET DEFAULT 'daily'",
            "ALTER TABLE prayers ALTER COLUMN is_published SET DEFAULT TRUE",
            "ALTER TABLE prayers ALTER COLUMN display_order SET DEFAULT 0",
            "ALTER TABLE prayers ALTER COLUMN is_featured SET DEFAULT FALSE",
            "ALTER TABLE prayers ALTER COLUMN background_repeat SET DEFAULT FALSE",
            "ALTER TABLE prayers ALTER COLUMN background_position SET DEFAULT 'top-left'",
            "ALTER TABLE prayers ALTER COLUMN background_blur SET DEFAULT 0",
            "ALTER TABLE prayers ALTER COLUMN background_opacity SET DEFAULT 100",
            "ALTER TABLE prayers ALTER COLUMN background_gradient SET DEFAULT 'none'",
            "ALTER TABLE prayers ALTER COLUMN background_gradient_size SET DEFAULT 100",
            "ALTER TABLE prayers ALTER COLUMN body_font_size_px SET DEFAULT 15",
        ]:
            try:
                conn.execute(text(stmt))
            except Exception:
                pass

        # 배너 그룹·이미지 테이블 — 위치(placement)별 슬라이드
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS banner_groups (
                id SERIAL PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                placement VARCHAR(50) NOT NULL DEFAULT 'home_main',
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                sort_order INTEGER NOT NULL DEFAULT 0,
                transition VARCHAR(30) NOT NULL DEFAULT 'fade',
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """))
        try:
            conn.execute(text(
                "ALTER TABLE banner_groups ADD COLUMN IF NOT EXISTS "
                "transition VARCHAR(30) NOT NULL DEFAULT 'fade'"
            ))
        except Exception:
            pass
        try:
            conn.execute(text(
                "ALTER TABLE banner_groups ADD COLUMN IF NOT EXISTS "
                "aspect_ratio VARCHAR(16) NOT NULL DEFAULT '16:9'"
            ))
        except Exception:
            pass
        try:
            conn.execute(text(
                "ALTER TABLE banner_groups ADD COLUMN IF NOT EXISTS "
                "delay_seconds INTEGER NOT NULL DEFAULT 5"
            ))
        except Exception:
            pass
        try:
            conn.execute(text(
                "ALTER TABLE banner_groups ADD COLUMN IF NOT EXISTS "
                "show_caption_overlay BOOLEAN NOT NULL DEFAULT FALSE"
            ))
        except Exception:
            pass
        try:
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_banner_groups_placement_active "
                "ON banner_groups (placement, is_active, sort_order)"
            ))
        except Exception:
            pass
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS banner_images (
                id SERIAL PRIMARY KEY,
                group_id INTEGER NOT NULL REFERENCES banner_groups(id) ON DELETE CASCADE,
                file_url VARCHAR(500) NOT NULL,
                link_url VARCHAR(500),
                alt_text VARCHAR(200) NOT NULL DEFAULT '',
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """))
        try:
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_banner_images_group_sort "
                "ON banner_images (group_id, sort_order)"
            ))
        except Exception:
            pass

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

        # 검색어 카운트 테이블 — 통합 검색 인기 검색어 산출
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS search_term_counts (
                term VARCHAR(100) PRIMARY KEY,
                count INTEGER NOT NULL DEFAULT 0,
                last_searched_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """))
        try:
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_search_term_counts_count "
                "ON search_term_counts (count DESC)"
            ))
        except Exception:
            pass
        # 추천 검색어 site_settings 키 기본값 (admin 편집)
        try:
            conn.execute(text("""
                INSERT INTO site_settings (key, value, label, description, is_secret, group_name)
                VALUES (
                    'RECOMMENDED_SEARCHES',
                    '성모송,사순,묵주기도,평화,성령',
                    '추천 검색어',
                    '검색 결과 페이지 빈 상태에서 칩으로 노출됩니다. 쉼표로 구분하여 입력 (예: 성모송,사순,묵주기도)',
                    FALSE,
                    '사이트'
                )
                ON CONFLICT (key) DO NOTHING
            """))
        except Exception:
            pass
        # 홈 메인 레이아웃 (사진+복음+미사 배치)
        try:
            conn.execute(text("""
                INSERT INTO site_settings (key, value, label, description, is_secret, group_name)
                VALUES (
                    'HOME_HERO_LAYOUT',
                    'wide',
                    '홈 메인 레이아웃',
                    '4종: wide(사진 크게+배너), wide-plain(사진 크게), even(3등분+배너), even-plain(3등분). admin select 로 선택.',
                    FALSE,
                    '사이트'
                )
                ON CONFLICT (key) DO NOTHING
            """))
        except Exception:
            pass

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

        # AI 추출 결과물 → 주보 역추적용 FK. ON DELETE CASCADE 로 주보 삭제 시 결과물 자동 정리.
        for tbl in ["posts", "events", "meditations", "visions"]:
            try:
                conn.execute(text(
                    f"ALTER TABLE {tbl} ADD COLUMN IF NOT EXISTS source_bulletin_id INTEGER "
                    f"REFERENCES bulletins(id) ON DELETE CASCADE"
                ))
            except Exception:
                pass
            # cascade DELETE 시 풀스캔 회피 인덱스
            try:
                conn.execute(text(
                    f"CREATE INDEX IF NOT EXISTS ix_{tbl}_source_bulletin_id "
                    f"ON {tbl}(source_bulletin_id)"
                ))
            except Exception:
                pass

        # AI 추출 → 사목지표 라우팅 추적 (다른 created_*_id 와 일관성)
        try:
            conn.execute(text(
                "ALTER TABLE bulletin_extractions ADD COLUMN IF NOT EXISTS "
                "created_vision_id INTEGER"
            ))
        except Exception:
            pass

        # AI 분석 일시 실패 자동 재시도 카운터 (Bedrock timeout 등 일시 오류용)
        try:
            conn.execute(text(
                "ALTER TABLE bulletins ADD COLUMN IF NOT EXISTS "
                "ai_retry_count INTEGER NOT NULL DEFAULT 0"
            ))
        except Exception:
            pass

        # 갤러리 라우팅 사진의 출처 추적 (SET NULL — 주보 삭제 시 사진 보존, 출처만 NULL)
        try:
            conn.execute(text(
                "ALTER TABLE attachments ADD COLUMN IF NOT EXISTS "
                "source_bulletin_id INTEGER REFERENCES bulletins(id) ON DELETE SET NULL"
            ))
        except Exception:
            pass
        try:
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_attachments_source_bulletin_id "
                "ON attachments(source_bulletin_id)"
            ))
        except Exception:
            pass

        # 묵상 대표 지정 + 배경 이미지 설정
        for col_sql in [
            "ALTER TABLE meditations ADD COLUMN IF NOT EXISTS is_current BOOLEAN NOT NULL DEFAULT FALSE",
            "ALTER TABLE meditations ADD COLUMN IF NOT EXISTS background_image_url VARCHAR(500)",
            "ALTER TABLE meditations ADD COLUMN IF NOT EXISTS background_repeat BOOLEAN NOT NULL DEFAULT FALSE",
            "ALTER TABLE meditations ADD COLUMN IF NOT EXISTS background_position VARCHAR(20) NOT NULL DEFAULT 'top-left'",
            "ALTER TABLE meditations ADD COLUMN IF NOT EXISTS background_blur INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE meditations ADD COLUMN IF NOT EXISTS background_opacity INTEGER NOT NULL DEFAULT 100",
            "ALTER TABLE meditations ADD COLUMN IF NOT EXISTS background_gradient VARCHAR(10) NOT NULL DEFAULT 'none'",
            "ALTER TABLE meditations ADD COLUMN IF NOT EXISTS background_gradient_size INTEGER NOT NULL DEFAULT 100",
            "ALTER TABLE meditations ADD COLUMN IF NOT EXISTS body_font_size_px INTEGER NOT NULL DEFAULT 15",
        ]:
            try:
                conn.execute(text(col_sql))
            except Exception:
                pass

        # 주보 AI 분석 진행 상태 (UI 폴링용)
        for col_sql in [
            "ALTER TABLE bulletins ADD COLUMN IF NOT EXISTS ai_status VARCHAR(20) DEFAULT 'pending'",
            "ALTER TABLE bulletins ADD COLUMN IF NOT EXISTS ai_started_at TIMESTAMP",
            "ALTER TABLE bulletins ADD COLUMN IF NOT EXISTS ai_finished_at TIMESTAMP",
            "ALTER TABLE bulletins ADD COLUMN IF NOT EXISTS ai_error TEXT",
            # 통합검색용: 주보 PDF 본문 추출 텍스트
            "ALTER TABLE bulletins ADD COLUMN IF NOT EXISTS body_text TEXT",
            # 추출 항목 → 라우팅된 대상 ID (result 페이지에서 '수정' 링크 만들기 위함)
            "ALTER TABLE bulletin_extractions ADD COLUMN IF NOT EXISTS created_notice_id INTEGER",
            "ALTER TABLE bulletin_extractions ADD COLUMN IF NOT EXISTS created_event_id INTEGER",
            "ALTER TABLE bulletin_extractions ADD COLUMN IF NOT EXISTS created_meditation_id INTEGER",
        ]:
            try:
                conn.execute(text(col_sql))
            except Exception:
                pass

        # 통합검색 성능: pg_trgm 확장 + GIN trigram 인덱스
        # ILIKE '%키워드%' + similarity() 매칭이 빨라지고 오타·부분 매칭 견딤
        try:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
        except Exception:
            pass
        for idx_sql in [
            "CREATE INDEX IF NOT EXISTS idx_posts_title_trgm  ON posts    USING gin (title   gin_trgm_ops)",
            "CREATE INDEX IF NOT EXISTS idx_posts_content_trgm ON posts    USING gin (content gin_trgm_ops)",
            "CREATE INDEX IF NOT EXISTS idx_notices_title_trgm   ON notices  USING gin (title   gin_trgm_ops)",
            "CREATE INDEX IF NOT EXISTS idx_notices_content_trgm ON notices  USING gin (content gin_trgm_ops)",
            "CREATE INDEX IF NOT EXISTS idx_events_title_trgm  ON events   USING gin (title   gin_trgm_ops)",
            "CREATE INDEX IF NOT EXISTS idx_events_desc_trgm   ON events   USING gin (description gin_trgm_ops)",
            "CREATE INDEX IF NOT EXISTS idx_bulletins_body_trgm ON bulletins USING gin (body_text gin_trgm_ops)",
        ]:
            try:
                conn.execute(text(idx_sql))
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

        # 갤러리 — kind='gallery' 인 게시판은 /gallery/{slug} 로 라우팅됨
        conn.execute(text("""
            INSERT INTO boards (name, slug, is_active, moderator_only_write,
                                members_only_write, members_only_read, members_selected,
                                exclude_from_search, kind)
            VALUES ('전례 사진', 'liturgy', TRUE, TRUE, TRUE, FALSE, FALSE, FALSE, 'gallery')
            ON CONFLICT (slug) DO NOTHING
        """))
        conn.execute(text("""
            INSERT INTO boards (name, slug, is_active, moderator_only_write,
                                members_only_write, members_only_read, members_selected,
                                exclude_from_search, kind)
            VALUES ('행사 사진', 'events', TRUE, TRUE, TRUE, FALSE, FALSE, FALSE, 'gallery')
            ON CONFLICT (slug) DO NOTHING
        """))
        # 기존 환경에서 liturgy·events 가 default 로 잡혀 있던 경우 보정
        try:
            conn.execute(text(
                "UPDATE boards SET kind='gallery' "
                "WHERE slug IN ('liturgy','events') AND kind <> 'gallery'"
            ))
        except Exception:
            pass

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
            ('AUTH_SECRET',           'NextAuth 시크릿',       '세션 암호화 키 (32자 이상 임의 문자열)',             TRUE,  '보안'),
            ('CURRENT_SEASON',        '현재 전례 시기',         '빈 값=꺼짐 / advent · christmas · lent · easter · ordinary · pentecost', FALSE, '스킨'),
            ('SEASON_AUTO_MODE',      '전례 시기 자동 모드',     'true=오늘 날짜로 자동 계산(CURRENT_SEASON 무시), false=수동 선택값 사용', FALSE, '스킨')
            ON CONFLICT (key) DO NOTHING
        """))

        # events.event_kind 컬럼 추가 (행사 | 모임 | null)
        conn.execute(text(
            "ALTER TABLE events ADD COLUMN IF NOT EXISTS event_kind VARCHAR(10)"
        ))

        # 본당 교통 안내 (v1.5.140) — 출발지별 노선 카드. admin이 자유 추가·수정·삭제
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS transport_routes (
                id SERIAL PRIMARY KEY,
                label VARCHAR(80) NOT NULL,
                description TEXT NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_transport_routes_sort ON transport_routes(sort_order)"
        ))
        for ddl in [
            "ALTER TABLE transport_routes ALTER COLUMN created_at SET DEFAULT NOW()",
            "ALTER TABLE transport_routes ALTER COLUMN updated_at SET DEFAULT NOW()",
        ]:
            try:
                conn.execute(text(ddl))
            except Exception:
                pass

        # 장애 신고 (v1.5.139) — 비회원 가능, 페이지 URL 자동 수집, 운영자가 상태 관리
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS issue_reports (
                id SERIAL PRIMARY KEY,
                reporter_member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
                reporter_name VARCHAR(80),
                reporter_email VARCHAR(200),
                content TEXT NOT NULL,
                page_url VARCHAR(500),
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                admin_note TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_issue_reports_status ON issue_reports(status)"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_issue_reports_created_at ON issue_reports(created_at DESC)"
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

        # 페이지 사진 슬러그 초기 시드 (테이블이 비었을 때만)
        from app.models.page_photo import PagePhotoSlug
        if not db.query(PagePhotoSlug).first():
            slug_seed = [
                PagePhotoSlug(slug="saint", label="성 베드로", public_href="/saint",
                              description="/saint 본문 상단 히어로 이미지",
                              fallback_url="/saints/st_peter.jpg", sort_order=0),
                PagePhotoSlug(slug="history", label="본당 연혁", public_href="/history",
                              description="/history 상단 히어로 이미지", sort_order=1),
                PagePhotoSlug(slug="vision", label="사목 지표", public_href="/vision",
                              description="/vision 상단 히어로 이미지", sort_order=2),
                PagePhotoSlug(slug="council", label="사목 위원회", public_href="/council",
                              description="/council 상단 히어로 이미지", sort_order=3),
                PagePhotoSlug(slug="groups", label="공동체", public_href="/groups",
                              description="/groups 상단 히어로 이미지", sort_order=4),
                PagePhotoSlug(slug="pastor", label="주임 신부", public_href="/pastor",
                              description="/pastor 상단 히어로 이미지", sort_order=5),
                PagePhotoSlug(slug="construction", label="공사 일지", public_href="/construction",
                              description="/construction 상단 히어로 이미지 (정점 사진 슬라이드쇼)", sort_order=6),
            ]
            db.add_all(slug_seed)
            db.commit()
        else:
            # 기존 환경: construction slug가 누락된 경우 보강
            from sqlalchemy import select
            if not db.execute(select(PagePhotoSlug).filter_by(slug="construction")).scalar_one_or_none():
                db.add(PagePhotoSlug(
                    slug="construction", label="공사 일지", public_href="/construction",
                    description="/construction 상단 히어로 이미지 (정점 사진 슬라이드쇼)", sort_order=6,
                ))
                db.commit()

        # 성인 사전 초기 데이터 (saints_seed.json — 한국 천주교 보편 전례력 사실 데이터)
        from app.models.saint import Saint
        if not db.query(Saint).first():
            import json as _json
            from pathlib import Path as _Path
            seed_path = _Path(__file__).resolve().parent / "app" / "data" / "saints_seed.json"
            if seed_path.exists():
                with seed_path.open(encoding="utf-8") as f:
                    seeds = _json.load(f)
                # prefix(성/성녀/복자/복녀)는 title 앞에 합쳐 표기, 신분 정보 보존
                title_prefix_map = {"성": None, "성녀": None, "복자": "복자", "복녀": "복녀"}
                objs = []
                for r in seeds:
                    title_parts = []
                    p = r.get("prefix")
                    extra = title_prefix_map.get(p) if p else None
                    if extra:
                        title_parts.append(extra)
                    if r.get("title"):
                        title_parts.append(r["title"])
                    title = ", ".join(title_parts) if title_parts else None
                    objs.append(Saint(
                        korean_name=r["korean_name"],
                        latin_name=r.get("latin_name"),
                        feast_month=r["feast_month"],
                        feast_day=r["feast_day"],
                        title=title,
                    ))
                db.bulk_save_objects(objs)
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

