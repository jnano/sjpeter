from sqlalchemy import Column, Integer, String, Date, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship, backref
from datetime import datetime
from app.core.database import Base


class BulletinExtraction(Base):
    __tablename__ = "bulletin_extractions"

    id = Column(Integer, primary_key=True, index=True)
    bulletin_id = Column(Integer, ForeignKey("bulletins.id", ondelete="CASCADE"), nullable=False)

    title = Column(String(300), nullable=False)
    content = Column(Text)
    group_name = Column(String(100))       # "안나회", "레지오" 등
    event_date = Column(Date, nullable=True)
    location = Column(String(200), nullable=True)
    event_type = Column(String(50))        # "순례", "모임", "행사" 등

    fingerprint = Column(String(64), index=True)   # 중복 감지용 해시

    status = Column(String(20), default="pending")  # pending / approved / rejected
    target_board_id = Column(Integer, ForeignKey("boards.id"), nullable=True)
    created_post_id = Column(Integer, nullable=True)        # 게시글 id (임시저장 또는 승인 후)
    created_notice_id = Column(Integer, nullable=True)      # 공지로 등록됐을 때 notices.id
    created_event_id = Column(Integer, nullable=True)       # 캘린더로 등록됐을 때 events.id
    created_meditation_id = Column(Integer, nullable=True)  # 묵상으로 등록됐을 때 meditations.id

    created_at = Column(DateTime, default=datetime.utcnow)

    # passive_deletes=True: DB 의 ON DELETE CASCADE 가 처리하므로 ORM 은 자식 NULL set 시도 금지.
    bulletin = relationship(
        "Bulletin",
        backref=backref("extractions", passive_deletes=True),
    )
