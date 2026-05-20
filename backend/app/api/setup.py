"""첫 실행 setup wizard 엔드포인트.

admins 테이블이 비어 있으면 (= 첫 설치) setup 페이지로 강제 리다이렉트되도록
프론트엔드가 GET /api/setup/status 를 통해 상태를 확인한다.
POST /api/setup/init 은 admins 가 비어 있을 때만 동작 — 첫 슈퍼관리자 + 본당 정보 입력.
"""
import re
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.auth import hash_password
from app.core.database import get_db
from app.models.admin import Admin
from app.models.board import Board

router = APIRouter(tags=["setup"])


# 첫 setup 직후 자동 생성될 기본 게시판.
# 다른 본당이 빈 사이트가 아니라 첫 인상이 있는 사이트로 시작하도록 함.
# admin 이 마음에 들지 않으면 /admin/boards 에서 자유롭게 삭제·이름 변경 가능.
DEFAULT_BOARDS: list[dict] = [
    {
        "name": "자유게시판",
        "slug": "free",
        "description": "본당 신자들이 자유롭게 글을 쓰는 공간",
        "kind": "default",
        "members_only_write": True,
    },
    {
        "name": "사진 갤러리",
        "slug": "gallery",
        "description": "본당 행사·일상 사진 모음",
        "kind": "default",
        "members_only_write": True,
    },
    {
        "name": "기도 청원",
        "slug": "prayer-line",
        "description": "한 줄로 청원·감사·위령 기도를 나누는 공간",
        "kind": "line",
        "members_only_write": True,
    },
    {
        "name": "묵상 나눔",
        "slug": "meditation-board",
        "description": "말씀과 일상의 묵상을 함께 나누는 공간",
        "kind": "default",
        "members_only_write": True,
    },
]


def _seed_default_boards(db: Session) -> int:
    """기본 게시판 4종 시드. slug 단위 idempotent — 같은 slug 가 이미 있으면 건너뜀.

    backend startup 의 _migrate_add_columns 가 시스템 게시판 (notice/ai-extract/liturgy/events)
    을 먼저 시드하므로 Board.count() 기반 조건은 부적절하다. slug 단위로 비교한다.

    반환: 새로 생성된 게시판 수 (0~4). 모두 이미 있으면 0.
    """
    created = 0
    for spec in DEFAULT_BOARDS:
        existing = db.query(Board).filter(Board.slug == spec["slug"]).first()
        if existing:
            continue
        db.add(Board(
            name=spec["name"],
            slug=spec["slug"],
            description=spec["description"],
            kind=spec["kind"],
            members_only_write=spec["members_only_write"],
            is_active=True,
            show_in_menu=True,
        ))
        created += 1
    return created


class SetupStatus(BaseModel):
    setup_completed: bool
    admin_count: int
    parish_name: str
    site_url: str


class SetupInitRequest(BaseModel):
    admin_username: str = Field(min_length=4, max_length=50)
    admin_password: str = Field(min_length=8, max_length=200)
    parish_name: str = Field(min_length=1, max_length=200)
    parish_name_en: str = Field(default="", max_length=200)
    parish_address: str = Field(default="", max_length=300)
    parish_phone: str = Field(default="", max_length=50)
    site_url: str = Field(min_length=1, max_length=500)


class SetupInitResponse(BaseModel):
    ok: bool
    message: str


def _get_setting_value(db: Session, key: str) -> str:
    row = db.execute(
        text("SELECT value FROM site_settings WHERE key = :k"),
        {"k": key},
    ).first()
    return (row[0] or "") if row else ""


@router.get("/api/setup/status", response_model=SetupStatus)
def setup_status(db: Session = Depends(get_db)):
    """setup 완료 여부를 반환. 인증 불필요 — 프론트엔드 layout 가드에서 사용."""
    admin_count = db.query(Admin).count()
    return SetupStatus(
        setup_completed=admin_count > 0,
        admin_count=admin_count,
        parish_name=_get_setting_value(db, "PARISH_NAME"),
        site_url=_get_setting_value(db, "SITE_URL"),
    )


@router.post("/api/setup/init", response_model=SetupInitResponse, status_code=201)
def setup_init(body: SetupInitRequest, db: Session = Depends(get_db)):
    """첫 슈퍼관리자 계정 + 본당 정보 1회 등록.

    admins 테이블이 비어 있을 때만 동작. 두 번째 호출은 403.
    """
    # 1. admins 가 이미 존재하면 거부 (실수 또는 악의적 재호출 방어)
    if db.query(Admin).count() > 0:
        raise HTTPException(
            status_code=403,
            detail="setup 이 이미 완료되었습니다. 관리자 계정이 존재합니다.",
        )

    # 2. username 형식 검사 (영문·숫자·언더스코어)
    if not re.fullmatch(r"[A-Za-z0-9_]{4,50}", body.admin_username):
        raise HTTPException(
            status_code=400,
            detail="아이디는 영문·숫자·언더스코어 4~50자여야 합니다.",
        )

    # 3. 비밀번호 강도 검사 (최소 8자 + 영문 + 숫자)
    pw = body.admin_password
    if not (re.search(r"[A-Za-z]", pw) and re.search(r"\d", pw)):
        raise HTTPException(
            status_code=400,
            detail="비밀번호는 영문과 숫자를 모두 포함해야 합니다.",
        )

    # 4. site_url 형식 검사 (http/https 시작)
    if not re.match(r"^https?://", body.site_url):
        raise HTTPException(
            status_code=400,
            detail="사이트 URL 은 http:// 또는 https:// 로 시작해야 합니다.",
        )

    # 5. admin 계정 생성
    admin = Admin(
        username=body.admin_username,
        hashed_password=hash_password(body.admin_password),
    )
    db.add(admin)

    # 6. site_settings UPSERT (PARISH_NAME, PARISH_NAME_EN, SITE_URL)
    for key, value in [
        ("PARISH_NAME", body.parish_name.strip()),
        ("PARISH_NAME_EN", body.parish_name_en.strip()),
        ("SITE_URL", body.site_url.strip().rstrip("/")),
    ]:
        db.execute(
            text(
                "UPDATE site_settings SET value = :v WHERE key = :k"
            ),
            {"v": value, "k": key},
        )

    # 7. parishes 첫 row 동기화 — admin/parish/info 페이지의 기본값. parishes.name 이 master.
    db.execute(
        text(
            "UPDATE parishes SET name = :name, address = :addr, phone = :phone "
            "WHERE id = (SELECT id FROM parishes ORDER BY id LIMIT 1)"
        ),
        {
            "name": body.parish_name.strip(),
            "addr": body.parish_address.strip(),
            "phone": body.parish_phone.strip(),
        },
    )

    # 8. 기본 게시판 자동 생성 (boards 가 비어 있을 때만 — 다른 본당의 첫 시작 인상)
    seeded = _seed_default_boards(db)

    db.commit()

    msg = "첫 관리자 계정과 본당 정보가 등록되었습니다."
    if seeded:
        msg += f" 기본 게시판 {seeded}개를 자동 생성했습니다."
    return SetupInitResponse(ok=True, message=msg)
