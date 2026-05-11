from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from datetime import datetime
from app.core.database import Base


class MenuGroup(Base):
    __tablename__ = "menu_groups"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(50), unique=True, nullable=False)        # 내부 식별자
    label = Column(String(100), nullable=False)                  # 표시 라벨
    subtitle = Column(String(200))                               # dropdown 보조 텍스트
    icon = Column(String(20))                                    # 이모지
    sidebar_image_url = Column(String(500))                      # 사이드바 상단 이미지
    sidebar_width_px = Column(Integer, default=220)              # 사이드바 폭
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    show_in_header = Column(Boolean, default=True)               # FALSE면 헤더 dropdown 안 나옴 (사이드바 전용)
    created_at = Column(DateTime, default=datetime.utcnow)


class MenuItem(Base):
    __tablename__ = "menu_items"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("menu_groups.id", ondelete="CASCADE"), nullable=False)
    label = Column(String(100), nullable=False)
    href = Column(String(500), nullable=False)
    is_external = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    source_type = Column(String(30), default="manual")           # 'manual' 만 사용 중 (향후 확장)
    source_id = Column(String(100))                              # auto 항목 출처 id
    created_at = Column(DateTime, default=datetime.utcnow)
