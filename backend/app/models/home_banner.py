from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from app.core.database import Base


class HomeBanner(Base):
    """홈 페이지 메인 영역에 표시되는 배너 이미지."""
    __tablename__ = "home_banners"

    id = Column(Integer, primary_key=True, index=True)
    file_url = Column(String(500), nullable=False)
    original_name = Column(String(300), nullable=False)
    sort_order = Column(Integer, default=0, index=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
