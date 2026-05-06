from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from app.api import bulletins, notices, auth, members, boards, parish, gospel, content
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
app.include_router(content.router, prefix="/api")

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
            "ALTER TABLE boards ADD COLUMN IF NOT EXISTS members_only_write BOOLEAN DEFAULT TRUE",
            "ALTER TABLE boards ADD COLUMN IF NOT EXISTS members_only_read BOOLEAN DEFAULT FALSE",
            "ALTER TABLE boards ADD COLUMN IF NOT EXISTS moderator_id INTEGER REFERENCES members(id) ON DELETE SET NULL",
        ]:
            try:
                conn.execute(text(ddl))
            except Exception:
                pass

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
                sort_order INTEGER DEFAULT 0
            )
        """))

        conn.commit()


def _seed_initial_data():
    from app.core.database import SessionLocal
    from app.models.parish import Parish
    from app.models.admin import Admin
    from app.models.content import HistoryItem, Vision, CommunityGroup
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

