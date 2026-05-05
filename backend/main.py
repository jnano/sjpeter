from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api import bulletins, notices, auth, members, boards, parish, gospel
from app.core.config import settings
from app.core.database import create_tables
import os

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(bulletins.router, prefix="/api")
app.include_router(notices.router, prefix="/api")
app.include_router(members.router, prefix="/api")
app.include_router(boards.router)  # prefix 포함됨
app.include_router(parish.router, prefix="/api")
app.include_router(gospel.router, prefix="/api")

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
            ("hashed_password", "VARCHAR(200)"),
            ("social_provider", "VARCHAR(20)"),
            ("social_id", "VARCHAR(200)"),
            ("avatar_url", "VARCHAR(500)"),
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

        # boards 검색 제외 컬럼
        try:
            conn.execute(text(
                "ALTER TABLE boards ADD COLUMN IF NOT EXISTS exclude_from_search BOOLEAN DEFAULT FALSE"
            ))
        except Exception:
            pass

        # boards 접근 제어 + 관리자 컬럼
        for ddl in [
            "ALTER TABLE boards ADD COLUMN IF NOT EXISTS members_only_read BOOLEAN DEFAULT FALSE",
            "ALTER TABLE boards ADD COLUMN IF NOT EXISTS moderator_id INTEGER REFERENCES members(id) ON DELETE SET NULL",
        ]:
            try:
                conn.execute(text(ddl))
            except Exception:
                pass

        conn.commit()


def _seed_initial_data():
    from app.core.database import SessionLocal
    from app.models.parish import Parish
    from app.models.admin import Admin
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
    finally:
        db.close()


@app.get("/api/health")
def health():
    return {"status": "ok", "project": settings.PROJECT_NAME}
