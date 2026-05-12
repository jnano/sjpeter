from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class Notice(Base):
    __tablename__ = "notices"

    id = Column(Integer, primary_key=True, index=True)
    parish_id = Column(Integer, ForeignKey("parishes.id"), nullable=False)
    title = Column(String(300), nullable=False)
    content = Column(Text)
    is_pinned = Column(Boolean, default=False)
    is_ai_generated = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    parish = relationship("Parish", backref="notices")
    attachments = relationship(
        "NoticeAttachment",
        back_populates="notice",
        cascade="all, delete-orphan",
        order_by="NoticeAttachment.sort_order",
    )


class NoticeAttachment(Base):
    """공지 사진 첨부 (다중)."""
    __tablename__ = "notice_attachments"

    id = Column(Integer, primary_key=True, index=True)
    notice_id = Column(Integer, ForeignKey("notices.id", ondelete="CASCADE"), nullable=False, index=True)
    file_url = Column(String(500), nullable=False)
    original_name = Column(String(300))
    file_size = Column(Integer, default=0)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    notice = relationship("Notice", back_populates="attachments")
