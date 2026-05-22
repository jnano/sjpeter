from datetime import datetime
from sqlalchemy import Column, Integer, String, Date, Text, ForeignKey, Boolean, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base


class BulletinExtractedImage(Base):
    """주보 PDF에서 추출한 사진 (관리자가 분류 → 건축 슬라이드/갤러리/무시).

    status: pending(분류 대기) | routed(분류 완료) | ignored(무시)
    routed_to: 분류 결과 메모 (예: "construction", "gallery:liturgy", "ignored")
    """

    __tablename__ = "bulletin_extracted_images"

    id = Column(Integer, primary_key=True, index=True)
    bulletin_id = Column(Integer, ForeignKey("bulletins.id", ondelete="CASCADE"), nullable=False, index=True)
    # client 가 보는 URL (admin guard 라우트). 예: /api/bulletins/extracted-images/{id}/file
    file_url = Column(String(500), nullable=False)
    # 실제 disk 상의 상대 path. 예: private-uploads/bulletin-extracted/{bulletin_id}/img-N.jpg
    # 정적 마운트 (/uploads) 가 닿지 않는 디렉토리 — admin 라우트로만 접근.
    file_path = Column(String(500), nullable=True)
    width = Column(Integer, nullable=False)
    height = Column(Integer, nullable=False)
    page_number = Column(Integer, nullable=False)         # 원본 PDF 페이지 번호 (1부터)
    status = Column(String(20), default="pending", nullable=False)
    routed_to = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    routed_at = Column(DateTime, nullable=True)


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
    # AI 분석 일시 실패 자동 재시도 카운트 (Bedrock timeout 등)
    ai_retry_count = Column(Integer, nullable=False, server_default="0")

    parish = relationship("Parish", backref="bulletins")
