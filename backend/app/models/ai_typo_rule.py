"""AI 추출 오타 사전 — admin CRUD."""
from datetime import datetime

from sqlalchemy import Column, Integer, String, Text, DateTime

from app.core.database import Base


class AiTypoRule(Base):
    __tablename__ = "ai_typo_rules"

    id = Column(Integer, primary_key=True)
    wrong = Column(String(200), nullable=False, unique=True)
    replacement = Column(String(200), nullable=False)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
