from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship, backref
from datetime import datetime
from app.core.database import Base


class Board(Base):
    __tablename__ = "boards"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(String(300))
    is_active = Column(Boolean, default=True)
    members_only_write = Column(Boolean, default=True)      # True: 회원만 쓰기
    members_only_read = Column(Boolean, default=False)      # True: 회원만 보기
    members_selected = Column(Boolean, default=False)       # True: 지정 회원만 접근
    moderator_only_write = Column(Boolean, default=False)   # True: 게시판 운영자 이상만 쓰기 (admin · 운영자 · 게시판 운영자)
    posts_per_page = Column(Integer, default=12)
    exclude_from_search = Column(Boolean, default=False)
    show_in_menu = Column(Boolean, default=True)            # True: 헤더 메뉴에 자동 노출
    moderator_id = Column(Integer, ForeignKey("members.id", ondelete="SET NULL"), nullable=True)
    # 어드민 분류 그룹 (admin/boards 화면 정렬·묶음용. NULL=미분류). 공개 페이지엔 영향 없음.
    admin_group_id = Column(Integer, ForeignKey("board_admin_groups.id", ondelete="SET NULL"), nullable=True)
    kind = Column(String(20), default="default", nullable=False)  # 'default' | 'line' (한 줄 메시지)
    # 게시판 목록 표시 컬럼 토글 (admin 제어, v1.5.120)
    list_show_number = Column(Boolean, nullable=False, default=False)
    list_show_author = Column(Boolean, nullable=False, default=True)
    list_show_date = Column(Boolean, nullable=False, default=True)
    list_show_views = Column(Boolean, nullable=False, default=True)
    list_show_likes = Column(Boolean, nullable=False, default=False)
    list_show_comments = Column(Boolean, nullable=False, default=True)
    list_show_shares = Column(Boolean, nullable=False, default=False)
    # 공개 페이지 뷰 토글 노출 여부 — admin이 게시판별로 어떤 뷰 버튼을 보일지 선택.
    # 모두 false면 list 폴백. 1개만 true면 토글 자체 숨김. URL ?view=X가 false인 뷰면 활성 뷰로 폴백.
    show_view_list = Column(Boolean, nullable=False, default=True)
    show_view_card = Column(Boolean, nullable=False, default=True)
    show_view_photo = Column(Boolean, nullable=False, default=True)
    # 공개 페이지 검색폼(input + 검색 버튼) 노출 여부 — admin이 게시판별로 끄면 form 자체가 사라짐.
    show_search_form = Column(Boolean, nullable=False, default=True)
    # 게시글 공유 기능 사용 여부 — false면 글에 share_allowed=true여도 공유 버튼 노출 안 됨.
    share_enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    posts = relationship("Post", back_populates="board", cascade="all, delete-orphan")
    moderator = relationship("Member", foreign_keys=[moderator_id])
    allowed_member_rows = relationship("BoardAllowedMember", back_populates="board", cascade="all, delete-orphan")
    admin_group = relationship("BoardAdminGroup", foreign_keys=[admin_group_id])


class BoardAdminGroup(Base):
    """게시판 어드민 분류 그룹. /admin/boards 화면에서 게시판을 묶는 용도. 공개 페이지엔 미반영."""
    __tablename__ = "board_admin_groups"

    id = Column(Integer, primary_key=True)
    name = Column(String(80), nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class BoardAllowedMember(Base):
    __tablename__ = "board_allowed_members"
    __table_args__ = (UniqueConstraint("board_id", "member_id"),)

    id = Column(Integer, primary_key=True)
    board_id = Column(Integer, ForeignKey("boards.id", ondelete="CASCADE"), nullable=False)
    member_id = Column(Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False)

    board = relationship("Board", back_populates="allowed_member_rows")
    member = relationship("Member")


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    board_id = Column(Integer, ForeignKey("boards.id"), nullable=False)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=True)  # AI 생성 게시글은 null
    title = Column(String(300), nullable=False)
    content = Column(Text, nullable=False)
    is_published = Column(Boolean, default=True)  # False: 임시저장 (AI 자동 생성)
    is_pinned = Column(Boolean, default=False, nullable=False)  # 게시판 상단 고정
    # 자유 입력 카테고리. 값이 있으면 목록에서 칩으로 필터 가능.
    category = Column(String(50), nullable=True)
    view_count = Column(Integer, default=0)
    # 작성자가 공유 허용 시 true. 게시판 share_enabled=true와 함께일 때만 공유 버튼 노출.
    share_allowed = Column(Boolean, nullable=False, default=False)
    # 공유 버튼 클릭 시 +1. 중복 방지 없음 (외부 공유 행위라 여러 번 의미 있음).
    share_count = Column(Integer, nullable=False, default=0)
    # 한 줄 게시판(kind='line')용 메타 — 일반 게시판은 null
    intention_kind = Column(String(20), nullable=True)   # '위령' | '감사' | '청원' | '기타' 등
    intention_for = Column(String(200), nullable=True)    # 대상·의도 자유 텍스트
    # 캘린더 이벤트와 연동된 카드 게시글: 본문은 짧은 링크만 보유, 원본은 events.{id}
    # events 삭제 시 cascade 로 카드 자동 제거 (DB 중복 회피 정책)
    linked_event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=True, index=True)
    # AI 추출 결과물일 경우 원본 주보 id. 주보 삭제 시 cascade.
    source_bulletin_id = Column(Integer, ForeignKey("bulletins.id", ondelete="CASCADE"), nullable=True, index=True)
    # 시점 분류 — future|timeless|past|unknown. 알림 발송 게이트 (future|timeless 만 OK).
    temporal_kind = Column(String(10), nullable=False, server_default="unknown")
    # v1.5.336: 주보 AI 추출 라우팅 개편 — 중요도·만료 (자잘한 안내 묻힘 회피)
    importance = Column(String(10), nullable=False, server_default="normal")  # high|normal|low
    expires_at = Column(DateTime, nullable=True)  # 만료일. 지나면 목록에서 자동 숨김
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    board = relationship("Board", back_populates="posts")
    member = relationship("Member", backref="posts")
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")
    attachments = relationship("Attachment", back_populates="post", cascade="all, delete-orphan")
    likes = relationship("PostLike", back_populates="post", cascade="all, delete-orphan")


class PostLike(Base):
    """게시글 추천 (한 줄 게시판의 '함께 기도합니다' 등). 회원 1인당 1회 제한."""
    __tablename__ = "post_likes"
    __table_args__ = (UniqueConstraint("post_id", "member_id"),)

    id = Column(Integer, primary_key=True)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    member_id = Column(Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    post = relationship("Post", back_populates="likes")
    member = relationship("Member")


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    parent_id = Column(Integer, ForeignKey("comments.id", ondelete="CASCADE"), nullable=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    post = relationship("Post", back_populates="comments")
    member = relationship("Member", backref="comments")
    replies = relationship("Comment", backref=backref("parent", remote_side="Comment.id"), cascade="all, delete-orphan", foreign_keys="Comment.parent_id")
