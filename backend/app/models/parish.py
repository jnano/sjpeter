from sqlalchemy import Column, Integer, String, Date, Text, Float, Boolean, DateTime
from datetime import datetime
from app.core.database import Base


class Parish(Base):
    __tablename__ = "parishes"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(100), unique=True, nullable=False)  # "sejong-peter"
    name = Column(String(200), nullable=False)               # "세종성베드로성당"
    diocese = Column(String(100))                            # "대전교구"
    address = Column(String(300))
    lat = Column(Float, nullable=True)   # 위도 (예: 36.5040)
    lng = Column(Float, nullable=True)   # 경도 (예: 127.2494)
    phone = Column(String(20))
    founded_at = Column(Date)
    description = Column(Text)
    member_count = Column(Integer, nullable=True)            # 신자 수
    pastor_name = Column(String(100))
    pastor_appointed = Column(String(100))                   # 부임 시기 (예: 2023년 3월)
    pastor_message = Column(Text)
    pastor_photo_url = Column(String(500))
    about_photo_url = Column(String(500))  # /about 페이지 안내 옆 사진
    mass_schedule = Column(Text)  # JSON 문자열로 저장
    fax = Column(String(20))
    cafe_url = Column(String(500))
    band_url = Column(String(500))


class PastorPhoto(Base):
    __tablename__ = "pastor_photos"

    id = Column(Integer, primary_key=True, index=True)
    url = Column(String(500), nullable=False)
    is_selected = Column(Boolean, default=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
