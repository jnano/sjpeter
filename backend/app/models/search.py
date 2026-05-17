from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Index
from app.core.database import Base


class SearchTermCount(Base):
    """통합검색 키워드 빈도 집계 — 인기 검색어 위젯·로깅용."""
    __tablename__ = "search_term_counts"

    term = Column(String(100), primary_key=True)
    count = Column(Integer, nullable=False, server_default="0")
    last_searched_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # count DESC — 인기 순 조회 가속
    __table_args__ = (
        Index("ix_search_term_counts_count", count.desc()),
    )
