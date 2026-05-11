from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, Date, ForeignKey
from sqlalchemy.dialects.postgresql import ARRAY
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
    link_url = Column(String(500), nullable=True)   # deprecated — board_slug 사용
    board_slug = Column(String(100), nullable=True)  # 연결 게시판 slug
    sort_order = Column(Integer, default=0)
    # 분과(parent_id=NULL) ↔ 소속단체(parent_id=분과 id) 트리
    parent_id = Column(Integer, ForeignKey("community_groups.id", ondelete="CASCADE"), nullable=True)
    slug = Column(String(100), nullable=True, unique=True)   # /groups/{slug} URL
    activities = Column(Text)            # 주요 활동 — 한 줄에 한 항목
    photo_urls = Column(ARRAY(Text))     # 분과 사진 URL 리스트


class StaticPage(Base):
    """관리자가 내용을 직접 편집하는 정적 페이지 (slug로 식별)."""
    __tablename__ = "static_pages"

    slug = Column(String(100), primary_key=True)   # 예: "saint", "council"
    title = Column(String(200), nullable=False)
    subtitle = Column(String(300), nullable=True)
    body = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CouncilMember(Base):
    """사목평의회 구성원 — 이름, 직책, 카테고리, 사진."""
    __tablename__ = "council_members"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    role = Column(String(200), nullable=False)        # 직책 (예: 회장, 재정부회장)
    category = Column(String(100), nullable=False)    # 회장단 / 분과대표 / 구역장대표
    photo_url = Column(String(500), nullable=True)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)


class Meditation(Base):
    """작은 묵상 — 새 글 저장 시 이전 글은 자동으로 아카이브됨."""
    __tablename__ = "meditations"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    scripture = Column(String(300), nullable=True)   # 성경 구절 (예: 요한 3,16)
    body = Column(Text, nullable=False)
    author = Column(String(100), nullable=True)      # 작성자 이름 (선택)
    published_date = Column(Date, nullable=False)    # 발행일
    is_published = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
