from sqlalchemy import Column, Integer, String, Date, Text, Float
from app.core.database import Base


class Parish(Base):
    __tablename__ = "parishes"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(100), unique=True, nullable=False)  # 본당 식별자 (URL safe)
    name = Column(String(200), nullable=False)               # 본당 이름 (예: 세종성베드로성당)
    diocese = Column(String(100))                            # 교구 (예: 대전교구)
    address = Column(String(300))
    lat = Column(Float, nullable=True)   # 위도 (예: 36.5040)
    lng = Column(Float, nullable=True)   # 경도 (예: 127.2494)
    phone = Column(String(20))
    founded_at = Column(Date)
    description = Column(Text)
    member_count = Column(Integer, nullable=True)            # 신자 수
    about_photo_url = Column(String(500))  # /about 페이지 안내 옆 사진
    logo_url = Column(String(500))         # 헤더·푸터·메타 로고
    mass_schedule = Column(Text)  # JSON 문자열로 저장
    fax = Column(String(20))
    cafe_url = Column(String(500))
    band_url = Column(String(500))
