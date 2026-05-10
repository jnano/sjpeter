from sqlalchemy import Column, String, Text, Boolean
from app.core.database import Base


class SiteSetting(Base):
    __tablename__ = "site_settings"

    key = Column(String(100), primary_key=True)
    value = Column(Text, nullable=True)
    label = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    is_secret = Column(Boolean, nullable=False, default=False)
    group_name = Column(String(50), nullable=False, default="기타")
