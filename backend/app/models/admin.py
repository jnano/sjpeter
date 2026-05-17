from sqlalchemy import Column, Integer, String, DateTime, Text
from datetime import datetime
from app.core.database import Base


class Admin(Base):
    __tablename__ = "admins"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False)
    hashed_password = Column(String(200), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class AdminLog(Base):
    """관리자 활동 로그 (로그인·CUD 작업 등)."""
    __tablename__ = "admin_logs"

    id = Column(Integer, primary_key=True, index=True)
    admin_identifier = Column(String(200), nullable=False)  # username 또는 email
    action = Column(String(100), nullable=False)
    target_type = Column(String(50), nullable=True)
    target_id = Column(Integer, nullable=True)
    detail = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
