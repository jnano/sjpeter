from sqlalchemy import Column, Integer, String, Boolean, DateTime
from datetime import datetime
from app.core.database import Base


class Member(Base):
    __tablename__ = "members"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(200), unique=True, nullable=False, index=True)
    nickname = Column(String(50), unique=True, nullable=False)
    hashed_password = Column(String(200), nullable=True)   # 소셜 가입자는 null

    social_provider = Column(String(20), nullable=True)    # "google" | "kakao"
    social_id = Column(String(200), nullable=True, index=True)
    avatar_url = Column(String(500), nullable=True)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
