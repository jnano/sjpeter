from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class EventBoardMapping(Base):
    __tablename__ = "event_board_mappings"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(50), unique=True, nullable=False, index=True)
    board_id = Column(Integer, ForeignKey("boards.id", ondelete="SET NULL"), nullable=True)
    use_calendar = Column(Boolean, nullable=False, default=False)

    board = relationship("Board")
