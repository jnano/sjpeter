from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    original_name = Column(String(500), nullable=False)   # 원본 파일명
    stored_name = Column(String(500), nullable=False)     # UUID 파일명
    file_url = Column(String(500), nullable=False)        # /uploads/attachments/...
    file_size = Column(Integer, default=0)                # bytes
    is_image = Column(Boolean, default=False)
    # 주보 PDF 에서 추출되어 갤러리로 라우팅된 사진의 출처. 주보 삭제 시 NULL (사진은 보존, 출처만 사라짐).
    source_bulletin_id = Column(Integer, ForeignKey("bulletins.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    post = relationship("Post", back_populates="attachments")
