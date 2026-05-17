from sqlalchemy import Column, Integer, String, Text, DateTime
from datetime import datetime
from app.core.database import Base


class TransportRoute(Base):
    """본당 교통 안내 — 출발지별 대중교통 노선.
    /info 페이지의 '교통 안내' 카드 그리드를 채우는 데이터. admin/parish/info에서 CRUD."""
    __tablename__ = "transport_routes"

    id = Column(Integer, primary_key=True, index=True)
    label = Column(String(80), nullable=False)         # 출발지 라벨 (예: "도담동에서 오실 때")
    description = Column(Text, nullable=False)         # 노선 설명 (다행 텍스트)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
