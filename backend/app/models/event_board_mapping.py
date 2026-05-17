from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Date, Text, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base


class EventBoardMapping(Base):
    __tablename__ = "event_board_mappings"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(50), unique=True, nullable=False, index=True)
    board_id = Column(Integer, ForeignKey("boards.id", ondelete="SET NULL"), nullable=True)
    use_calendar = Column(Boolean, nullable=False, default=False)

    board = relationship("Board")


class Event(Base):
    """events 테이블은 대부분 raw SQL 로 다루지만, FK metadata 등록을 위해 ORM 정의가 필요.
    posts.linked_event_id 와 source_bulletin_id 가 events.id 를 참조하기 때문."""
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(300), nullable=False)
    description = Column(Text)
    event_date = Column(Date, nullable=False)
    end_date = Column(Date)
    start_time = Column(String(10))
    location = Column(String(300))
    category = Column(String(50), default="general")
    is_public = Column(Boolean, default=True)
    status = Column(String(20), nullable=False, default="예정")
    is_ai_generated = Column(Boolean, default=False)
    event_kind = Column(String(10))
    source_bulletin_id = Column(Integer, ForeignKey("bulletins.id", ondelete="CASCADE"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
