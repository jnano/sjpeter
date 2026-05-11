"""admin이 코드 수정 없이 만들 수 있는 동적 페이지.

URL 패턴: /p/{slug}
레이아웃 종류:
  - body            : 제목 + 본문(마크다운)
  - body_with_hero  : 사진 슬라이드 + 제목 + 본문 (page_photo_slugs와 연동)
  - sections        : 제목 + 본문 + 하단 카드 리스트 (FAQ/연혁 등)
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON, Text
from datetime import datetime

from app.core.database import Base


class DynamicPage(Base):
    __tablename__ = "dynamic_pages"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(80), unique=True, nullable=False, index=True)
    title = Column(String(200), nullable=False)
    subtitle = Column(String(300), nullable=True)
    # PageHeader의 group prop과 동일한 값을 받음 — 사이드바·브레드크럼 결합용
    group_label = Column(String(50), nullable=True)
    # 레이아웃 종류 (body | body_with_hero | sections)
    layout_kind = Column(String(30), default="body", nullable=False)
    # 레이아웃별 콘텐츠. 형식은 layout_kind에 따라 다름.
    payload = Column(JSON, nullable=False, default=dict)
    # 본문(공통). 모든 레이아웃이 사용 — 마크다운.
    body_markdown = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
