from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from app.core.database import Base


class ParishStaff(Base):
    """본당 가족 (주임신부·보좌신부·수녀·사무장 등 현재 staff)."""
    __tablename__ = "parish_staff"

    id = Column(Integer, primary_key=True, index=True)
    role = Column(String(30), nullable=False, index=True)        # 주임신부 | 보좌신부 | 수녀 | 사무장
    name = Column(String(100), nullable=False)                   # 김찬용 베드로 신부님
    title = Column(String(100))                                  # 주임 신부님 / 보좌 신부님 / 수녀님 / 사무장님
    feast_day = Column(String(20))                               # "6.29" / "12.13"
    photo_url = Column(String(500))
    introduction = Column(Text)                                  # 첫 줄 소개
    career_items = Column(Text)                                  # 약력 (개행으로 구분)
    scripture_quote = Column(Text)                               # "너도 가서 그렇게 하여라."
    scripture_reference = Column(String(100))                    # "(루카 10, 37)"
    sort_order = Column(Integer, default=0, index=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
