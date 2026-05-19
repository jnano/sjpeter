from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, Index
from datetime import datetime
from app.core.database import Base


class Saint(Base):
    """가톨릭 성인 — 세례명으로 축일 조회용 사전."""
    __tablename__ = "saints"

    id = Column(Integer, primary_key=True, index=True)
    # 한글 세례명 (예: "베드로", "마리아"). 동명 성인 다수 가능
    korean_name = Column(String(80), nullable=False, index=True)
    # 라틴/원어 표기 (예: "Petrus", "Maria"). 있으면 표시, 선택
    latin_name = Column(String(120), nullable=True)
    # 축일 (양력 기준 월·일)
    feast_month = Column(Integer, nullable=False)
    feast_day = Column(Integer, nullable=False)
    # 신분/구분 (예: "사도", "순교자", "동정녀", "교회 박사", "동정 마리아")
    title = Column(String(80), nullable=True)
    # 짧은 생애 요약 (2~3문장)
    bio_short = Column(Text, nullable=True)
    # 수호 영역 (예: "어부", "환자", "한국 천주교회")
    patronage = Column(String(200), nullable=True)
    # 한 세례명에 여러 성인이 있을 때 추천 순위 (낮을수록 상단)
    rank_within_name = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


Index("ix_saints_feast", Saint.feast_month, Saint.feast_day)
