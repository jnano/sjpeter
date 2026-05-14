import logging
import smtplib
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.core.auth import get_current_admin
from app.core.site_settings import invalidate, get_setting
from app.models.site_setting import SiteSetting
from app.models.admin import Admin

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin/settings", tags=["settings"])

# ── 내부용 (Next.js 서버 → 백엔드, localhost 전용) ──────────
internal_router = APIRouter(tags=["internal"])

_INTERNAL_KEYS = [
    "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET",
    "KAKAO_CLIENT_ID", "KAKAO_CLIENT_SECRET",
    "AUTH_SECRET",
]
_PUBLIC_KEYS = ["KAKAO_MAP_KEY", "SITE_URL", "CURRENT_SEASON", "HOME_HERO_LAYOUT"]


@internal_router.get("/api/internal/config")
def internal_config(request: Request, db: Session = Depends(get_db)):
    """Next.js 서버에서만 호출 — localhost IP만 허용."""
    client = request.client.host if request.client else ""
    if client not in ("127.0.0.1", "::1", "localhost"):
        raise HTTPException(status_code=403, detail="Internal endpoint")

    result: dict[str, str] = {}
    for key in _INTERNAL_KEYS:
        row = db.query(SiteSetting).filter(SiteSetting.key == key).first()
        if row and row.value:
            result[key] = row.value
    return result


@internal_router.get("/api/public/site-config")
def public_config(db: Session = Depends(get_db)):
    """비밀이 아닌 공개 설정 반환 (프론트엔드 클라이언트 사용)."""
    result: dict[str, str] = {}
    for key in _PUBLIC_KEYS:
        val = get_setting(key)
        if val:
            result[key] = val
    return result

_MASKED = "••••••••"


class SettingOut(BaseModel):
    key: str
    value: Optional[str]      # 비밀값은 마스킹 또는 None
    label: str
    description: Optional[str]
    is_secret: bool
    is_set: bool              # 비밀값이 실제로 저장되어 있는지 여부
    group_name: str


class SettingUpdate(BaseModel):
    value: Optional[str] = None


def _to_out(row: SiteSetting) -> SettingOut:
    if row.is_secret:
        return SettingOut(
            key=row.key,
            value=None,
            label=row.label,
            description=row.description,
            is_secret=True,
            is_set=bool(row.value),
            group_name=row.group_name,
        )
    return SettingOut(
        key=row.key,
        value=row.value or "",
        label=row.label,
        description=row.description,
        is_secret=False,
        is_set=bool(row.value),
        group_name=row.group_name,
    )


@router.get("", response_model=list[SettingOut])
def list_settings(db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    rows = db.query(SiteSetting).order_by(SiteSetting.group_name, SiteSetting.key).all()
    return [_to_out(r) for r in rows]


@router.patch("/{key}", response_model=SettingOut)
def update_setting(
    key: str,
    body: SettingUpdate,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    row = db.query(SiteSetting).filter(SiteSetting.key == key).first()
    if not row:
        raise HTTPException(status_code=404, detail="설정 항목을 찾을 수 없습니다.")

    # 비밀값: 빈 문자열이나 None이면 기존값 유지
    if row.is_secret and not body.value:
        return _to_out(row)

    row.value = body.value
    db.commit()
    db.refresh(row)
    invalidate(key)
    return _to_out(row)


@router.post("/test-smtp")
def test_smtp(db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    """현재 저장된 SMTP 설정으로 연결 테스트."""
    from app.core.site_settings import get_setting
    host = get_setting("SMTP_HOST", "smtp.gmail.com")
    port = int(get_setting("SMTP_PORT", "587"))
    user = get_setting("SMTP_USER")
    password = get_setting("SMTP_PASSWORD")

    if not user or not password:
        raise HTTPException(status_code=400, detail="SMTP_USER와 SMTP_PASSWORD가 설정되지 않았습니다.")

    try:
        with smtplib.SMTP(host, port, timeout=10) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.login(user, password)
        return {"ok": True, "message": f"{host}:{port} 연결 및 로그인 성공"}
    except smtplib.SMTPAuthenticationError:
        raise HTTPException(status_code=400, detail="SMTP 인증 실패. 사용자명/비밀번호를 확인하세요.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"SMTP 연결 실패: {e}")
