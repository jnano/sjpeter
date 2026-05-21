import logging
import smtplib
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.core.auth import get_current_admin, get_current_super_admin
from app.core.site_settings import invalidate, get_setting
from app.core.liturgical import compute_current_season
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
_PUBLIC_KEYS = ["KAKAO_MAP_KEY", "SITE_URL", "CURRENT_SEASON", "HOME_HERO_LAYOUT", "HOME_THEME", "SEASON_AUTO_MODE", "PARISH_NAME", "PARISH_NAME_EN"]


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
    """비밀이 아닌 공개 설정 반환 (프론트엔드 클라이언트 사용).

    SEASON_AUTO_MODE='true' 이면 CURRENT_SEASON을 오늘 날짜로 자동 계산해
    수동 저장값보다 우선 적용 (admin 수동 선택은 자동 모드 꺼야 적용됨).
    """
    result: dict[str, str] = {}
    for key in _PUBLIC_KEYS:
        val = get_setting(key)
        if val:
            result[key] = val

    # 자동 모드면 CURRENT_SEASON을 오늘 시기로 덮어쓰기
    auto = (result.get("SEASON_AUTO_MODE", "") or "").strip().lower() == "true"
    if auto:
        result["CURRENT_SEASON"] = compute_current_season(date.today())

    return result


@internal_router.get("/api/public/feature-flags")
def feature_flags():
    """각 외부 서비스 키 설정 여부 — secret 값은 노출하지 않고 활성/비활성만 반환.

    다른 본당 배포 시 admin UI 가 키 입력 전까지 비활성 상태로 안내하기 위해 사용.
    """
    def has(k: str) -> bool:
        return bool((get_setting(k) or "").strip())

    return {
        "ai_enabled": has("AWS_ACCESS_KEY_ID") and has("AWS_SECRET_ACCESS_KEY") and has("AWS_REGION"),
        "smtp_enabled": has("SMTP_USER") and has("SMTP_PASSWORD"),
        "google_oauth_enabled": has("GOOGLE_CLIENT_ID") and has("GOOGLE_CLIENT_SECRET"),
        "kakao_oauth_enabled": has("KAKAO_CLIENT_ID") and has("KAKAO_CLIENT_SECRET"),
        "kakao_map_enabled": has("KAKAO_MAP_KEY"),
    }


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


# admin/settings UI 에서 가려야 할 키 — parishes 테이블이 single source 라 여기서 중복 관리하면 어긋남 유발.
# 시드·mirror 는 그대로 두되 admin UI 에는 노출 안 함.
_HIDDEN_KEYS = {"PARISH_NAME", "PARISH_NAME_EN"}


@router.get("", response_model=list[SettingOut])
def list_settings(db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    rows = (
        db.query(SiteSetting)
        .filter(~SiteSetting.key.in_(_HIDDEN_KEYS))
        .order_by(SiteSetting.group_name, SiteSetting.key)
        .all()
    )
    return [_to_out(r) for r in rows]


@router.patch("/{key}", response_model=SettingOut)
def update_setting(
    key: str,
    body: SettingUpdate,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_super_admin),
):
    """설정값 저장 — 없는 키는 새로 생성(upsert). 비밀값 빈 입력은 기존값 유지."""
    row = db.query(SiteSetting).filter(SiteSetting.key == key).first()
    if not row:
        # 신규 키 — NOT NULL 컬럼(label, group_name, is_secret) default 채우고 row 생성
        secret_markers = ("SECRET", "PASSWORD", "TOKEN", "KEY", "APIKEY")
        is_secret = any(m in key.upper() for m in secret_markers)
        row = SiteSetting(
            key=key,
            value=body.value or "",
            label=key,            # 임시 label, admin 에서 수정 가능
            group_name="기타",
            is_secret=is_secret,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        invalidate(key)
        return _to_out(row)

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
