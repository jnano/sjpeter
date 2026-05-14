from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, Date, ForeignKey
from sqlalchemy.dialects.postgresql import ARRAY
from datetime import datetime
from app.core.database import Base


class HistoryItem(Base):
    __tablename__ = "history_items"

    id = Column(Integer, primary_key=True, index=True)
    year = Column(Integer, nullable=False)
    event = Column(String(300), nullable=False)
    detail = Column(Text)
    highlight = Column(Boolean, default=False)
    is_current = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)


class Vision(Base):
    __tablename__ = "visions"

    id = Column(Integer, primary_key=True, index=True)
    year = Column(Integer, nullable=False)
    motto = Column(String(300), nullable=False)        # 한 줄 슬로건
    body = Column(Text, nullable=True)                  # 상세 본문 (선택, 줄바꿈 보존)
    is_current = Column(Boolean, default=False)


class CommunityGroup(Base):
    __tablename__ = "community_groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    activity_time = Column(String(200))
    link_url = Column(String(500), nullable=True)   # deprecated — board_slug 사용
    board_slug = Column(String(100), nullable=True)  # 연결 게시판 slug
    sort_order = Column(Integer, default=0)
    # 분과(parent_id=NULL) ↔ 소속단체(parent_id=분과 id) 트리
    parent_id = Column(Integer, ForeignKey("community_groups.id", ondelete="CASCADE"), nullable=True)
    slug = Column(String(100), nullable=True, unique=True)   # /groups/{slug} URL
    activities = Column(Text)            # 주요 활동 — 한 줄에 한 항목
    photo_urls = Column(ARRAY(Text))     # 분과 사진 URL 리스트
    photo_display_mode = Column(String(20), default="slideshow")  # 'slideshow' | 'grid'
    representative_photo_url = Column(String(500), nullable=True)  # 카드 썸네일용 단일 대표 이미지


class StaticPage(Base):
    """관리자가 내용을 직접 편집하는 정적 페이지 (slug로 식별)."""
    __tablename__ = "static_pages"

    slug = Column(String(100), primary_key=True)   # 예: "saint", "council"
    title = Column(String(200), nullable=False)
    subtitle = Column(String(300), nullable=True)
    body = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CouncilMember(Base):
    """사목평의회 구성원 — 이름, 직책, 카테고리, 사진."""
    __tablename__ = "council_members"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    role = Column(String(200), nullable=False)        # 직책 (예: 회장, 재정부회장)
    category = Column(String(100), nullable=False)    # 회장단 / 분과대표 / 구역장대표
    photo_url = Column(String(500), nullable=True)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)


class Prayer(Base):
    """가톨릭 기도문 — 카테고리별로 정리되어 영구 보존되는 기도문 모음.
    묵상과 달리 시간성이 없고, 카테고리 안에서 display_order 순서로 노출."""
    __tablename__ = "prayers"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    # 카테고리 키: daily / mass / rosary / liturgy_season / special / memorial / parish
    category = Column(String(50), nullable=False, default="daily")
    scripture = Column(String(300), nullable=True)
    body = Column(Text, nullable=False)
    author = Column(String(100), nullable=True)
    is_published = Column(Boolean, default=True, nullable=False)
    # 카테고리 내 정렬 순서 (낮을수록 위)
    display_order = Column(Integer, default=0, nullable=False)
    # 본당 자체 기도 등 메인 페이지 상단에 핀 노출
    is_featured = Column(Boolean, default=False, nullable=False)
    # 배경 이미지·표시 옵션 (묵상과 동일 구조 — MeditationCard 재활용)
    background_image_url = Column(String(500), nullable=True)
    background_repeat = Column(Boolean, default=False, nullable=False)
    background_position = Column(String(20), default="top-left", nullable=False)
    background_blur = Column(Integer, default=0, nullable=False)
    background_opacity = Column(Integer, default=100, nullable=False)
    background_gradient = Column(String(10), default="none", nullable=False)
    background_gradient_size = Column(Integer, default=100, nullable=False)
    body_font_size_px = Column(Integer, default=15, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Meditation(Base):
    """작은 묵상 — 새 글 저장 시 이전 글은 자동으로 아카이브됨."""
    __tablename__ = "meditations"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    scripture = Column(String(300), nullable=True)   # 성경 구절 (예: 요한 3,16)
    body = Column(Text, nullable=False)
    author = Column(String(100), nullable=True)      # 작성자 이름 (선택)
    published_date = Column(Date, nullable=False)    # 발행일
    is_published = Column(Boolean, default=True)
    # 대표 묵상 지정 (TRUE 인 항목이 홈/공개 페이지에 우선 노출. 없으면 최신)
    is_current = Column(Boolean, default=False, nullable=False)
    # 배경 이미지 설정 (대표 묵상에서만 의미를 가짐)
    background_image_url = Column(String(500), nullable=True)
    background_repeat = Column(Boolean, default=False, nullable=False)
    # 'top-left'·'top-center'·'top-right'·'bottom-left'·'bottom-center'·'bottom-right'
    # (반복일 때는 무시됨)
    background_position = Column(String(20), default="top-left", nullable=False)
    background_blur = Column(Integer, default=0, nullable=False)       # 0~40 px
    background_opacity = Column(Integer, default=100, nullable=False)  # 0~100 (배경 이미지 불투명도)
    # 'none' | 'top' | 'bottom' | 'left' | 'right' — 배경이 한쪽에서 진해지고 반대쪽으로 페이드
    background_gradient = Column(String(10), default="none", nullable=False)
    # 그라데이션 페이드 범위 (% ). 100=박스 전체, 작을수록 좁은 영역만 페이드
    background_gradient_size = Column(Integer, default=100, nullable=False)
    # 본문 폰트 크기 (px). 14 ~ 28 권장.
    body_font_size_px = Column(Integer, default=15, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
