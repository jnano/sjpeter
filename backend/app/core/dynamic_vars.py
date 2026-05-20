"""동적 페이지 변수 치환 헬퍼.

admin/pages 의 HTML/markdown 본문이나 title/subtitle 에서 `{{ VAR_NAME }}` 형태의
placeholder 를 본당 정보·날짜 등 현재 값으로 자동 치환한다.

다른 본당이 같은 HTML 을 받아도 본당명·주소가 자기 본당 값으로 자동 채워지도록 의도된 기능.
"""
import re
from datetime import date
from typing import Iterable

from sqlalchemy.orm import Session

from app.core.site_settings import get_setting
from app.models.parish import Parish

# {{ VAR_NAME }} 또는 {{VAR_NAME}} — 영문 대문자·숫자·언더스코어. 모르는 키는 그대로 둠.
_PATTERN = re.compile(r"\{\{\s*([A-Z][A-Z0-9_]*)\s*\}\}")


def _build_vars(db: Session) -> dict[str, str]:
    """현재 본당 정보·날짜로 채운 변수 dict."""
    parish: Parish | None = db.query(Parish).order_by(Parish.id).first()
    today = date.today()
    return {
        # 본당 정보 — parishes 테이블 (single source)
        "PARISH_NAME": (parish.name if parish and parish.name else "").strip(),
        "PARISH_NAME_EN": (get_setting("PARISH_NAME_EN") or "").strip(),
        "PARISH_ADDRESS": (parish.address if parish and parish.address else "").strip(),
        "PARISH_PHONE": (parish.phone if parish and parish.phone else "").strip(),
        "PARISH_FAX": (parish.fax if parish and getattr(parish, "fax", None) else "").strip(),
        "DIOCESE": (parish.diocese if parish and parish.diocese else "").strip(),
        # 사이트
        "SITE_URL": (get_setting("SITE_URL") or "").strip(),
        # 날짜 — 페이지가 fresh 모드라 매 요청마다 갱신
        "CURRENT_YEAR": str(today.year),
        "TODAY": today.isoformat(),
    }


# admin UI 안내용 — 키·설명. 위 _build_vars 와 동기 유지.
VARIABLE_DOCS: list[dict[str, str]] = [
    {"key": "PARISH_NAME", "desc": "본당 이름 (예: 세종성베드로성당)"},
    {"key": "PARISH_NAME_EN", "desc": "본당 영문명 (예: St. Peter's Cathedral)"},
    {"key": "PARISH_ADDRESS", "desc": "본당 주소"},
    {"key": "PARISH_PHONE", "desc": "본당 전화번호"},
    {"key": "PARISH_FAX", "desc": "본당 팩스번호"},
    {"key": "DIOCESE", "desc": "소속 교구"},
    {"key": "SITE_URL", "desc": "사이트 URL"},
    {"key": "CURRENT_YEAR", "desc": "현재 연도 (예: 2026)"},
    {"key": "TODAY", "desc": "오늘 날짜 (YYYY-MM-DD)"},
]


def render(text: str | None, db: Session) -> str | None:
    """텍스트 안 {{ VAR }} 들을 현재 값으로 치환. 모르는 키는 그대로 둠 (silent)."""
    if not text:
        return text
    vars_ = _build_vars(db)
    return _PATTERN.sub(lambda m: vars_.get(m.group(1), m.group(0)), text)


def render_fields(obj, fields: Iterable[str], db: Session) -> None:
    """ORM 객체의 여러 필드를 in-place 치환. SQLAlchemy 객체는 commit 전에만 호출하지 말 것
    (그냥 응답용 dict 변환 직전에 호출)."""
    for f in fields:
        setattr(obj, f, render(getattr(obj, f, None), db))
