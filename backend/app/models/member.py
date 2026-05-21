from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from datetime import datetime
from app.core.database import Base


class EmailVerificationToken(Base):
    """이메일 인증 토큰 — 회원가입·이메일 변경 시 발급."""
    __tablename__ = "email_verification_tokens"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(200), unique=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class PasswordResetToken(Base):
    """비밀번호 재설정 토큰."""
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(200), unique=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


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
    is_admin = Column(Boolean, default=False)   # 운영자 여부 (UI 라벨은 "운영자", DB 컬럼명은 호환 유지)
    is_email_verified = Column(Boolean, default=False)
    interest_prompt_completed = Column(Boolean, default=False, nullable=False)  # 관심분과 온보딩 응답 여부
    notify_kakao = Column(Boolean, default=False, nullable=False)               # 카톡 알림 수신 동의 (글로벌)
    # 영명축일 (세례명 성인의 축일) — 월·일 모두 입력해야 의미. 둘 다 NULL 허용 (선택 사항).
    name_day_month = Column(Integer, nullable=True)
    name_day_day = Column(Integer, nullable=True)
    # v1.5.269: 마지막 로그인 시각 (auth.py 로그인 성공 시 갱신)
    last_login_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
