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
    created_at = Column(DateTime, default=datetime.utcnow)

    post = relationship("Post", back_populates="attachments")
