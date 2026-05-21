"""홈 페이지 블록 — 홈을 admin 이 자유롭게 조립하기 위한 단위.

각 블록은 한 종류(kind) 의 위젯을 하나 표현. sort_order 순으로 홈에 세로로 쌓여 렌더.
payload 는 블록 종류별 옵션 (예: hero 의 layout, banner 의 placement, quote 의 본문).
"""
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy.dialects.postgresql import JSONB

from app.core.database import Base


class HomeBlock(Base):
    __tablename__ = "home_blocks"

    id = Column(Integer, primary_key=True, index=True)
    # 블록 종류 — 'hero' | 'quick_links' | 'meditation' | 'construction' |
    #            'board_tabs' | 'gallery' | 'banner' | 'quote'
    kind = Column(String(40), nullable=False, index=True)
    sort_order = Column(Integer, nullable=False, default=0, index=True)
    is_active = Column(Boolean, nullable=False, default=True)
    payload = Column(JSONB, nullable=False, default=dict)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
