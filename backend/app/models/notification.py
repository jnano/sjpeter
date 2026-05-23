"""회원 사이트 내 알림 + 발송 배치(모니터링).

- 분과 태깅된 글이 등록되면 관심 회원에게 알림 insert (kind='community')
- 향후 댓글·좋아요·시스템 알림에도 재사용 (kind 확장)
- read_at IS NULL 인 row = 읽지 않은 알림 (헤더 종 카운터)
- v1.5.327: fanout 1회 = NotificationBatch 1 row. notifications.batch_id 로 연결.
"""
from sqlalchemy import ARRAY, Column, ForeignKey, Integer, String, Text, TIMESTAMP, text

from app.core.database import Base


class NotificationBatch(Base):
    """알림 발송 batch 집계 — 누구에게 몇 번 보냈는지·실패 사유 추적."""
    __tablename__ = "notification_batches"

    id = Column(Integer, primary_key=True)
    kind = Column(String(30), nullable=False)
    title = Column(String(300), nullable=False)
    source_post_id = Column(Integer, ForeignKey("posts.id", ondelete="SET NULL"))
    source_event_id = Column(Integer, ForeignKey("events.id", ondelete="SET NULL"))
    source_vision_id = Column(Integer, ForeignKey("visions.id", ondelete="SET NULL"))
    source_meditation_id = Column(Integer, ForeignKey("meditations.id", ondelete="SET NULL"))
    source_extraction_id = Column(Integer)  # FK 없음 — extraction 이 archived 되어도 batch 기록 유지
    community_group_ids = Column(ARRAY(Integer), nullable=False, server_default="{}")
    admin_username = Column(String(100))
    target_count = Column(Integer, nullable=False, server_default=text("0"))
    site_sent = Column(Integer, nullable=False, server_default=text("0"))
    email_sent = Column(Integer, nullable=False, server_default=text("0"))
    kakao_sent = Column(Integer, nullable=False, server_default=text("0"))
    failed_reason = Column(String(100))  # 'no_group' | 'no_subscribers' | NULL
    created_at = Column(TIMESTAMP, nullable=False, server_default=text("NOW()"))


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
    # v1.5.327: 발송 batch 연결 — 모니터링 페이지에서 batch 단위 조회용
    batch_id = Column(Integer, ForeignKey("notification_batches.id", ondelete="SET NULL"))
    read_at = Column(TIMESTAMP)
    created_at = Column(TIMESTAMP, nullable=False, server_default=text("NOW()"))
