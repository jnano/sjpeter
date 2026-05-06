from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
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

