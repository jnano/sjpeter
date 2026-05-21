from sqlalchemy import Column, Integer, String, Text, DateTime
from datetime import datetime
from app.core.database import Base


class PagePhotoSlug(Base):
    """페이지 사진 슬러그 등록부. /admin/page-photos에서 관리."""

    __tablename__ = "page_photo_slugs"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(50), unique=True, nullable=False, index=True)
    label = Column(String(100), nullable=False)
    public_href = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    fallback_url = Column(String(500), nullable=True)
    sort_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class PagePhoto(Base):
    """페이지(슬러그)별 히어로 영역 사진. 한 페이지에 여러 장 등록 가능."""

    __tablename__ = "page_photos"

    id = Column(Integer, primary_key=True, index=True)
    page_slug = Column(String(50), nullable=False, index=True)
    file_url = Column(String(500), nullable=False)
    alt = Column(String(200), nullable=True)
    sort_order = Column(Integer, default=0, nullable=False)
    # object-position 값. admin/menus 의 9방향 그리드와 동일한 문자열 집합:
    # "top left" | "top" | "top right" | "left" | "center" | "right" |
    # "bottom left" | "bottom" | "bottom right"
    image_position = Column(String(20), default="center", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class PagePhotoSetting(Base):
    """페이지별 슬라이드쇼 설정. 슬러그가 PK."""

    __tablename__ = "page_photo_settings"

    page_slug = Column(String(50), primary_key=True)
    # fade | slide | slide-up | slide-down | zoom-in | zoom-out | ken-burns | blur | none
    transition_mode = Column(String(20), default="fade", nullable=False)
    interval_seconds = Column(Integer, default=5, nullable=False)
    transition_duration_ms = Column(Integer, default=700, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
