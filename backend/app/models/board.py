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
    moderator_only_write = Column(Boolean, default=False)   # True: 게시판 관리자만 쓰기
    posts_per_page = Column(Integer, default=12)
    exclude_from_search = Column(Boolean, default=False)
    show_in_menu = Column(Boolean, default=True)            # True: 헤더 메뉴에 자동 노출
    moderator_id = Column(Integer, ForeignKey("members.id", ondelete="SET NULL"), nullable=True)
    kind = Column(String(20), default="default", nullable=False)  # 'default' | 'line' (한 줄 메시지)
    created_at = Column(DateTime, default=datetime.utcnow)

    posts = relationship("Post", back_populates="board", cascade="all, delete-orphan")
    moderator = relationship("Member", foreign_keys=[moderator_id])
    allowed_member_rows = relationship("BoardAllowedMember", back_populates="board", cascade="all, delete-orphan")


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
    view_count = Column(Integer, default=0)
    # 한 줄 게시판(kind='line')용 메타 — 일반 게시판은 null
    intention_kind = Column(String(20), nullable=True)   # '위령' | '감사' | '청원' | '기타' 등
    intention_for = Column(String(200), nullable=True)    # 대상·의도 자유 텍스트
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
