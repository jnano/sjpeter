from sqlalchemy import Boolean, Column, Integer, String, Date, Text, DateTime, ForeignKey, text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import relationship, backref
from datetime import datetime
from app.core.database import Base


class BulletinExtraction(Base):
    __tablename__ = "bulletin_extractions"

    id = Column(Integer, primary_key=True, index=True)
    bulletin_id = Column(Integer, ForeignKey("bulletins.id", ondelete="CASCADE"), nullable=False)

    title = Column(String(300), nullable=False)
    content = Column(Text)
    group_name = Column(String(100))       # "안나회", "레지오" 등 (단일, 호환)
    # 복수 분과/단체 후보 — m:n 매핑의 입력. 검토 UI 에서 community_groups 와 매칭.
    group_candidates = Column(ARRAY(Text), nullable=True)
    event_date = Column(Date, nullable=True)
    location = Column(String(200), nullable=True)
    event_type = Column(String(50))        # "순례", "모임", "행사" 등

    # 묵상(event_type="묵상") 전용 — AI 가 분리 추출한 묵상 필드. 승인 시 meditations 로 매핑.
    scripture = Column(String(300), nullable=True)  # 성경 구절 출처 (예: "마태 25,31-46")
    practice = Column(Text, nullable=True)          # 이번 주 실천 (한 줄에 하나, \n 구분)
    pull_quote = Column(Text, nullable=True)        # 강조 인용구

    # 시점 분류 — future|timeless|past|unknown. 알림 발송 게이트 입력.
    temporal_kind = Column(String(10), nullable=False, server_default="unknown")
    temporal_reason = Column(Text, nullable=True)  # AI 판단 사유 (관리자 검토에 표시)

    # v1.5.336: AI 추출 라우팅 개편 — 자잘한 안내가 공지 묻는 문제 해결.
    importance = Column(String(10), nullable=False, server_default="normal")  # high|normal|low
    expires_at = Column(DateTime, nullable=True)  # 만료일. event_date+1일 또는 7일 후 default

    fingerprint = Column(String(64), index=True)   # 중복 감지용 해시

    status = Column(String(20), default="pending")  # pending / approved / rejected
    target_board_id = Column(Integer, ForeignKey("boards.id"), nullable=True)
    created_post_id = Column(Integer, nullable=True)        # 게시글 id (임시저장 또는 승인 후)
    created_notice_id = Column(Integer, nullable=True)      # 공지로 등록됐을 때 notices.id
    created_event_id = Column(Integer, nullable=True)       # 캘린더로 등록됐을 때 events.id
    created_meditation_id = Column(Integer, nullable=True)  # 묵상으로 등록됐을 때 meditations.id
    created_vision_id = Column(Integer, nullable=True)      # 본당 사목지표로 등록됐을 때 visions.id

    # nullable=False + server_default: raw SQL INSERT·마이그레이션 경로에서도 DB 가 NOW() 로 채움.
    # default(ORM) 만 있으면 ORM 외 INSERT 시 NULL 이 되어 ExtractionOut 직렬화가 500 을 낸다.
    created_at = Column(DateTime, nullable=False, server_default=text("NOW()"), default=datetime.utcnow)

    # passive_deletes=True: DB 의 ON DELETE CASCADE 가 처리하므로 ORM 은 자식 NULL set 시도 금지.
    bulletin = relationship(
        "Bulletin",
        backref=backref("extractions", passive_deletes=True),
    )
