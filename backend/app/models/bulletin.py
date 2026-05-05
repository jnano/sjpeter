from sqlalchemy import Column, Integer, String, Date, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base


class Bulletin(Base):
    __tablename__ = "bulletins"

    id = Column(Integer, primary_key=True, index=True)
    parish_id = Column(Integer, ForeignKey("parishes.id"), nullable=False)
    issue_number = Column(Integer)                    # 623호
    published_date = Column(Date, nullable=False)
    liturgical_season = Column(String(100))           # "부활 제5주일"
    gospel_reference = Column(String(200))            # "요한 15,1-8"
    pdf_url = Column(String(500))
    ai_summary = Column(Text)                         # Claude Haiku 추출 요약
    is_published = Column(Boolean, default=True)

    parish = relationship("Parish", backref="bulletins")
