from sqlalchemy import Column, Integer, DateTime, ForeignKey, UniqueConstraint
from datetime import datetime
from app.core.database import Base


class MemberCommunityInterest(Base):
    """회원이 선택한 관심 분과/단체. 단체 선택 시 부모 분과는 서버에서 자동 포함."""
    __tablename__ = "member_community_interests"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False, index=True)
    community_group_id = Column(Integer, ForeignKey("community_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("member_id", "community_group_id", name="uq_member_community_interest"),
    )
