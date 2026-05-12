from sqlalchemy import Column, Integer, String, Boolean, DateTime
from datetime import datetime
from app.core.database import Base


class Member(Base):
    __tablename__ = "members"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(200), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=True)               # 본명 (이름)
    nickname = Column(String(50), nullable=False)               # 세례명
    hashed_password = Column(String(200), nullable=True)   # 소셜 가입자는 null

    phone = Column(String(20), nullable=True)               # 전화번호 (알림톡 등)
    receive_notification = Column(Boolean, default=False)   # 카카오 채널 알림 수신 동의
    social_provider = Column(String(20), nullable=True)    # "google" | "kakao"
    social_id = Column(String(200), nullable=True, index=True)
    avatar_url = Column(String(500), nullable=True)

    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)   # 위임 관리자 여부
    is_email_verified = Column(Boolean, default=False)
    interest_prompt_completed = Column(Boolean, default=False, nullable=False)  # 관심분과 온보딩 응답 여부
    notify_kakao = Column(Boolean, default=False, nullable=False)               # 카톡 알림 수신 동의 (글로벌)
    created_at = Column(DateTime, default=datetime.utcnow)
