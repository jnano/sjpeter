from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class Board(Base):
    __tablename__ = "boards"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(String(300))
    is_active = Column(Boolean, default=True)
    members_only_write = Column(Boolean, default=True)   # True: 회원만 쓰기
    members_only_read = Column(Boolean, default=False)   # True: 회원만 보기
    members_selected = Column(Boolean, default=False)    # True: 지정 회원만 접근
    posts_per_page = Column(Integer, default=20)
    exclude_from_search = Column(Boolean, default=False)
    moderator_id = Column(Integer, ForeignKey("members.id", ondelete="SET NULL"), nullable=True)
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
    view_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    board = relationship("Board", back_populates="posts")
    member = relationship("Member", backref="posts")
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")
    attachments = relationship("Attachment", back_populates="post", cascade="all, delete-orphan")


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    post = relationship("Post", back_populates="comments")
    member = relationship("Member", backref="comments")
