"""분과·단체 태깅 m:n 테이블 — 주보 AI 추출 글에 대상 분과를 태깅.

- PostCommunityTarget: posts ↔ community_groups
- EventCommunityTarget: events ↔ community_groups

복합 PK (post_id+community_group_id) 로 중복 방지. CASCADE 로 부모 삭제 시 자동 정리.
"""
from sqlalchemy import Column, ForeignKey, Integer, TIMESTAMP, text

from app.core.database import Base


class PostCommunityTarget(Base):
    __tablename__ = "post_community_targets"

    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True)
    community_group_id = Column(Integer, ForeignKey("community_groups.id", ondelete="CASCADE"), primary_key=True, index=True)
    created_at = Column(TIMESTAMP, nullable=False, server_default=text("NOW()"))


class EventCommunityTarget(Base):
    __tablename__ = "event_community_targets"

    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), primary_key=True)
    community_group_id = Column(Integer, ForeignKey("community_groups.id", ondelete="CASCADE"), primary_key=True, index=True)
    created_at = Column(TIMESTAMP, nullable=False, server_default=text("NOW()"))
