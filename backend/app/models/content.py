from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime
from datetime import datetime
from app.core.database import Base


class HistoryItem(Base):
    __tablename__ = "history_items"

    id = Column(Integer, primary_key=True, index=True)
    year = Column(Integer, nullable=False)
    event = Column(String(300), nullable=False)
    detail = Column(Text)
    highlight = Column(Boolean, default=False)
    is_current = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)


class Vision(Base):
    __tablename__ = "visions"

    id = Column(Integer, primary_key=True, index=True)
    year = Column(Integer, nullable=False)
    motto = Column(String(300), nullable=False)
    is_current = Column(Boolean, default=False)


class CommunityGroup(Base):
    __tablename__ = "community_groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    activity_time = Column(String(200))
    link_url = Column(String(500), nullable=True)
    sort_order = Column(Integer, default=0)


class StaticPage(Base):
    """관리자가 내용을 직접 편집하는 정적 페이지 (slug로 식별)."""
    __tablename__ = "static_pages"

    slug = Column(String(100), primary_key=True)   # 예: "saint", "council"
    title = Column(String(200), nullable=False)
    subtitle = Column(String(300), nullable=True)
    body = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
