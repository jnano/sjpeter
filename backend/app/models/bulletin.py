from sqlalchemy import Column, Integer, String, Date, Text, ForeignKey, Boolean, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base


class Bulletin(Base):
    __tablename__ = "bulletins"

    id = Column(Integer, primary_key=True, index=True)
    parish_id = Column(Integer, ForeignKey("parishes.id"), nullable=False)
    issue_number = Column(Integer)                    # 623호
    published_date = Column(Date, nullable=False)
    liturgical_season = Column(String(100))           # "부활 제5주일"
    gospel_reference = Column(String(200))            # "요한 15,1-8"
    pdf_url = Column(String(500))
    ai_summary = Column(Text)                         # Claude Haiku 추출 요약
    is_published = Column(Boolean, default=True)

    # AI 분석 진행 상태 (UI 폴링용)
    # 'pending'(업로드만), 'processing'(분석 중), 'done'(완료), 'failed'(오류)
    ai_status = Column(String(20), default="pending")
    ai_started_at = Column(DateTime)
    ai_finished_at = Column(DateTime)
    ai_error = Column(Text)

    # 통합검색용 PDF 본문 추출 텍스트
    body_text = Column(Text)

    parish = relationship("Parish", backref="bulletins")
