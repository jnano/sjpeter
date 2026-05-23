"""회원 사이트 내 알림.

- 분과 태깅된 글이 등록되면 관심 회원에게 알림 insert (kind='community')
- 향후 댓글·좋아요·시스템 알림에도 재사용 (kind 확장)
- read_at IS NULL 인 row = 읽지 않은 알림 (헤더 종 카운터)
"""
from sqlalchemy import Column, ForeignKey, Integer, String, Text, TIMESTAMP, text

from app.core.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True)
    member_id = Column(Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False, index=True)
    kind = Column(String(30), nullable=False, server_default=text("'community'"))
    title = Column(String(300), nullable=False)
    body = Column(Text)
    # v1.5.319: SET NULL — 원글이 삭제돼도 알림 row 는 보존 (회원 history)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="SET NULL"))
    event_id = Column(Integer, ForeignKey("events.id", ondelete="SET NULL"))
    # v1.5.320: vision/meditation 도 같은 정책 — 주보 삭제 시 CASCADE 로 사라져도 알림은 보존
    vision_id = Column(Integer, ForeignKey("visions.id", ondelete="SET NULL"))
    meditation_id = Column(Integer, ForeignKey("meditations.id", ondelete="SET NULL"))
    community_group_id = Column(Integer, ForeignKey("community_groups.id", ondelete="SET NULL"))
    read_at = Column(TIMESTAMP)
    created_at = Column(TIMESTAMP, nullable=False, server_default=text("NOW()"))
