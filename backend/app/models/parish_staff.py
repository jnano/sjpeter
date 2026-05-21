from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Date
from app.core.database import Base


class ParishPastor(Base):
    """역대 사목자 (주임신부 · 보좌신부 · 수녀 등 — 현재 사목자와 별개 아카이브)."""
    __tablename__ = "parish_pastors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    title = Column(String(100), nullable=False, server_default="주임신부")
    appointed_at = Column(Date)
    resigned_at = Column(Date)
    photo_url = Column(String(500))
    bio = Column(Text)
    sort_order = Column(Integer, nullable=False, server_default="0")
    created_at = Column(DateTime, default=datetime.utcnow)
    category = Column(String(20), nullable=False, server_default="priest")  # priest | sister 등


class ParishPriest(Base):
    """본당 출신 사제 (사제 서품을 받은 본당 출신 신부)."""
    __tablename__ = "parish_priests"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    baptism_date = Column(Date)
    ordained_date = Column(Date, nullable=False)
    role = Column(String(200))
    photo_url = Column(String(500))
    bio = Column(Text)
    sort_order = Column(Integer, nullable=False, server_default="0")
    created_at = Column(DateTime, default=datetime.utcnow)


class ParishStaff(Base):
    """현재 사목자 (주임신부·보좌신부·수녀·사무장 등)."""
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
