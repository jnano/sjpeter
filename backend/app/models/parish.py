from sqlalchemy import Column, Integer, String, Date, Text, Float
from app.core.database import Base


class Parish(Base):
    __tablename__ = "parishes"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(100), unique=True, nullable=False)  # 본당 식별자 (URL safe)
    name = Column(String(200), nullable=False)               # 본당 이름
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
    # 본당 수호 성인 (/patron 페이지) — patron.html 시안 데이터 (v1.5.406)
    patron_name = Column(String(200))            # 예: "성 베드로 사도"
    patron_feast_day = Column(String(100))       # 예: "6월 29일"
    patron_intro = Column(Text)                  # 생애·소개 (줄 단위)
    patron_quote = Column(Text)                  # 메인 인용문
    patron_quote_ref = Column(String(200))       # 인용 출처 (예: "마태 16,18")
    patron_image_url = Column(String(500))       # 성인 사진/일러스트
