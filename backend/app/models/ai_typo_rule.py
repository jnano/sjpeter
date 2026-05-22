"""AI 추출 오타 사전 — admin CRUD."""
from datetime import datetime

from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.dialects.postgresql import ARRAY

from app.core.database import Base


class AiTypoRule(Base):
    __tablename__ = "ai_typo_rules"

    id = Column(Integer, primary_key=True)
    wrong = Column(String(200), nullable=False, unique=True)
    replacement = Column(String(200), nullable=False)
    note = Column(Text, nullable=True)
    # 제외 컨텍스트 — 같은 줄에 이 prefix 가 wrong 보다 앞에 있으면 해당 occurrence 만 치환 skip.
    # 예: wrong='전입가경', exclude_prefixes=['장소:'] → "장소: 전입가경" 은 그대로.
    exclude_prefixes = Column(ARRAY(Text), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
