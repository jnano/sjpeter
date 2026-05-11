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
    parent_id = Column(Integer, ForeignKey("menu_items.id", ondelete="CASCADE"), nullable=True)
    label = Column(String(100), nullable=False)
    label_override = Column(Boolean, default=True)               # True: admin이 수동 입력, False: source에서 자동
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # 연결 종류 (3가지 중 하나)
    link_type = Column(String(20), default="external")           # 'page' | 'board' | 'external'

    # 종류별 참조 (셋 중 하나만 채워짐)
    static_page_slug = Column(String(100), nullable=True)        # 'page'일 때 — STATIC_PAGES 화이트리스트의 slug
    board_id = Column(Integer, ForeignKey("boards.id", ondelete="CASCADE"), nullable=True)
    external_url = Column(String(500), nullable=True)

    # href: 응답 시 _compute_href로 매번 도출 — 저장은 캐시 용도
    href = Column(String(500), nullable=False)
    is_external = Column(Boolean, default=False)                 # link_type='external'과 동기 (응답 호환)
