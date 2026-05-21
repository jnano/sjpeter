from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class BannerGroup(Base):
    """배너 그룹 — 슬라이드 단위 묶음.

    placement 키별로 활성화된(is_active) 그룹 중 sort_order 최소값을
    그 위치에 노출. 그룹 안 이미지가 1장이면 정적, 2장 이상이면 슬라이더.
    """
    __tablename__ = "banner_groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    # 변수 치환에서 {{ BANNER:slug }} 로 참조하기 위한 안정 키. unique·nullable.
    # placement 보다 자유로워 일회성 시즌 배너도 임의 slug 로 dynamic page 에 꽂을 수 있음.
    slug = Column(String(80), nullable=True, unique=True, index=True)
    # 미리 정의된 위치 키. 현재: "home_main". 향후 확장 시 enum 늘려도 됨.
    placement = Column(String(50), nullable=False, default="home_main")
    is_active = Column(Boolean, nullable=False, default=True)
    sort_order = Column(Integer, nullable=False, default=0)
    # 전환 효과: none / fade / slide / slide-up / slide-down /
    #          zoom-in / zoom-out / ken-burns / blur
    transition = Column(String(30), nullable=False, default="fade")
    # 가로:세로 비율 — "16:9", "4:3", "1:1", "4:1", "3:1", "21:9", "3:2"
    aspect_ratio = Column(String(16), nullable=False, default="16:9")
    # 자동 슬라이드 간격(초). 2~30 범위
    delay_seconds = Column(Integer, nullable=False, default=5)
    # true면 이미지 위에 alt_text를 자막 오버레이로 표시
    show_caption_overlay = Column(Boolean, nullable=False, default=False)
    # 노출 기간 — NULL 은 무제한. start_at 이전·end_at 이후엔 by-placement 응답에서 자동 제외.
    # 활성 여부는 (is_active=True) AND (now BETWEEN start_at AND end_at) 으로 판정.
    start_at = Column(DateTime, nullable=True)
    end_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    images = relationship(
        "BannerImage",
        back_populates="group",
        cascade="all, delete-orphan",
        order_by="BannerImage.sort_order, BannerImage.id",
    )


class BannerImage(Base):
    """배너 그룹 안 개별 이미지 — 슬라이드 한 컷.

    link_url 이 있으면 이미지가 a 태그로 감싸져 클릭 시 이동.
    """
    __tablename__ = "banner_images"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("banner_groups.id", ondelete="CASCADE"), nullable=False)
    file_url = Column(String(500), nullable=False)        # /uploads/banners/xxx.png
    link_url = Column(String(500), nullable=True)         # 클릭 시 이동 URL (선택)
    alt_text = Column(String(200), nullable=False, default="")
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    group = relationship("BannerGroup", back_populates="images")
