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

router = APIRouter(tags=["setup"])


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

    # 7. parishes 첫 row 의 name 도 동기화 — admin/parish/info 페이지의 기본값으로 사용됨
    db.execute(
        text(
            "UPDATE parishes SET name = :name WHERE id = (SELECT id FROM parishes ORDER BY id LIMIT 1)"
        ),
        {"name": body.parish_name.strip()},
    )

    db.commit()

    return SetupInitResponse(ok=True, message="첫 관리자 계정과 본당 정보가 등록되었습니다.")
