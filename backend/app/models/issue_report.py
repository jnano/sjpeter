from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class IssueReport(Base):
    """장애 신고. 비회원·회원 모두 등록 가능.
    status: 'pending'(접수) | 'in_progress'(처리중) | 'done'(완료).
    회원이 등록 시 reporter_member_id 채움, 비회원이면 reporter_name/email 직접 입력."""
    __tablename__ = "issue_reports"

    id = Column(Integer, primary_key=True, index=True)
    reporter_member_id = Column(Integer, ForeignKey("members.id", ondelete="SET NULL"), nullable=True)
    reporter_name = Column(String(80), nullable=True)
    reporter_email = Column(String(200), nullable=True)
    content = Column(Text, nullable=False)
    page_url = Column(String(500), nullable=True)  # 신고 발생 페이지 URL 자동 수집
    status = Column(String(20), nullable=False, default="pending", index=True)
    admin_note = Column(Text, nullable=True)  # 운영자 처리 메모
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    reporter = relationship("Member", foreign_keys=[reporter_member_id])
