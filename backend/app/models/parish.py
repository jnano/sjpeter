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
    # /about 페이지 Welcome · About 섹션 텍스트 (v1.5.423) — admin/parish/info 에서 편집.
    # 빈 값이면 기존 정적 문구로 폴백한다.
    about_welcome_eyebrow = Column(String(200))     # "환영합니다 · Welcome"
    about_welcome_h1 = Column(String(200))          # h2 첫 줄 일반 "모든 분께,"
    about_welcome_h2 = Column(String(200))          # h2 둘째 줄 italic em "주님의 평화가 함께하시기를."
    about_welcome_body = Column(Text)               # 본문 단락
    about_welcome_signature = Column(String(200))   # 서명 (본당명 뒤에 붙는 라벨, 예: "사목회 일동")
    about_intro_eyebrow = Column(String(200))       # "About · 우리 성당"
    about_intro_heading = Column(Text)              # 전체 헤딩 (본당명 포함 자유 입력)
