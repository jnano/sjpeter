from sqlalchemy import Column, Integer, BigInteger, String, Text, DateTime, Date, Boolean
from datetime import datetime
from app.core.database import Base


class ConstructionPhase(Base):
    """성당 건축 공사 단계 마일스톤. admin이 자유롭게 단계를 등록·관리."""
    __tablename__ = "construction_phases"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)          # 예: "기초공사", "골조", "외장마감"
    description = Column(Text, nullable=True)           # 단계 설명
    sort_order = Column(Integer, default=0, nullable=False)
    status = Column(String(20), default="planned", nullable=False)  # planned | in_progress | completed
    progress_percent = Column(Integer, default=0, nullable=False)   # 0-100
    started_at = Column(Date, nullable=True)            # 착수일
    completed_at = Column(Date, nullable=True)          # 완료일
    expected_completion_date = Column(Date, nullable=True)  # 예상 완료일
    photo_url = Column(String(500), nullable=True)      # 단계 대표 사진
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class ConstructionJournalEntry(Base):
    """성당 건축 한 줄 일지. 주 1회 등 짧은 진행 기록."""
    __tablename__ = "construction_journal"

    id = Column(Integer, primary_key=True, index=True)
    entry_date = Column(Date, nullable=False)
    note = Column(Text, nullable=False)
    photo_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class ConstructionFund(Base):
    """성전 건축 헌금 모금 현황. 단일 행(id=1) — admin이 모금액을 수동 갱신.

    실시간 결제 연동이 아니라 관리자가 누적 모금액을 직접 입력하는 방식.
    금액은 원 단위라 BigInteger 사용 (수십억 대비).
    """
    __tablename__ = "construction_fund"

    id = Column(Integer, primary_key=True, index=True)
    goal_amount = Column(BigInteger, default=0, nullable=False)    # 목표액(원)
    raised_amount = Column(BigInteger, default=0, nullable=False)  # 누적 모금액(원)
    donor_count = Column(Integer, default=0, nullable=False)       # 후원자 수(가구·인원)
    account_info = Column(Text, nullable=True)                     # 후원 계좌 안내
    note = Column(Text, nullable=True)                             # 추가 안내 문구
    is_active = Column(Boolean, default=False, nullable=False)     # 헌금 현황 섹션 노출 여부
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
