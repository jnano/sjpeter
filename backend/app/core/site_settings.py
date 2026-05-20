"""DB 기반 설정 조회 헬퍼. DB 우선, 없으면 .env 폴백. 60초 캐시."""
import time
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

_cache: dict[str, tuple[str, float]] = {}
_CACHE_TTL = 60

# .env 폴백 키 매핑
_ENV_FALLBACK: dict[str, str] = {
    "SITE_URL":              "SITE_URL",
    "SMTP_HOST":             "SMTP_HOST",
    "SMTP_PORT":             "SMTP_PORT",
    "SMTP_USER":             "SMTP_USER",
    "SMTP_PASSWORD":         "SMTP_PASSWORD",
    "SMTP_FROM":             "SMTP_FROM",
    "AWS_ACCESS_KEY_ID":     "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY": "AWS_SECRET_ACCESS_KEY",
    "AWS_REGION":            "AWS_REGION",
}


def get_setting(key: str, default: str = "") -> str:
    """설정값 반환. DB → .env → default 순서."""
    now = time.time()
    if key in _cache:
        value, expires_at = _cache[key]
        if now < expires_at:
            return value

    try:
        from app.core.database import SessionLocal
        from app.models.site_setting import SiteSetting
        db = SessionLocal()
        try:
            row = db.query(SiteSetting).filter(SiteSetting.key == key).first()
            if row and row.value:
                _cache[key] = (row.value, now + _CACHE_TTL)
                return row.value
        finally:
            db.close()
    except Exception as e:
        logger.warning("get_setting DB 조회 실패 (%s): %s", key, e)

    # .env 폴백
    env_key = _ENV_FALLBACK.get(key, key)
    env_val = getattr(settings, env_key, default)
    result = str(env_val) if env_val else default
    if result:
        _cache[key] = (result, now + _CACHE_TTL)
    return result


def invalidate(key: str) -> None:
    """설정 변경 후 캐시 무효화."""
    _cache.pop(key, None)


def invalidate_all() -> None:
    _cache.clear()


def get_parish_name() -> str:
    """본당명 — site_settings.PARISH_NAME → settings.PROJECT_NAME fallback.

    다른 본당 배포 시 setup wizard 에서 PARISH_NAME 을 입력받음.
    UI·메일·메타 태그·푸터 등에서 사용.
    """
    name = (get_setting("PARISH_NAME") or "").strip()
    return name or settings.PROJECT_NAME


def get_parish_name_en() -> str:
    """본당 영문명 — site_settings.PARISH_NAME_EN. 비어 있으면 빈 문자열."""
    return (get_setting("PARISH_NAME_EN") or "").strip()
