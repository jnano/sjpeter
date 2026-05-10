from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
from app.core.database import Base


class PagePhoto(Base):
    """페이지(슬러그)별 히어로 영역 사진. 한 페이지에 여러 장 등록 가능."""

    __tablename__ = "page_photos"

    id = Column(Integer, primary_key=True, index=True)
    page_slug = Column(String(50), nullable=False, index=True)
    file_url = Column(String(500), nullable=False)
    alt = Column(String(200), nullable=True)
    sort_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class PagePhotoSetting(Base):
    """페이지별 슬라이드쇼 설정. 슬러그가 PK."""

    __tablename__ = "page_photo_settings"

    page_slug = Column(String(50), primary_key=True)
    transition_mode = Column(String(20), default="fade", nullable=False)  # fade | slide | none
    interval_seconds = Column(Integer, default=5, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
