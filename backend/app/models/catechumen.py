from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, Date, Boolean
from app.core.database import Base

# 실제 테이블 생성은 main.py startup 의 raw SQL CREATE TABLE IF NOT EXISTS 가 담당.
# 이 모델은 ORM 참조·문서화용 (프로젝트 혼용 스타일 — archive.py 와 동일).


class CatechumenClass(Base):
    """예비자교리 차수 (제N차). 모집 → 교육 → 세례성사 의 생애주기를 한 행으로 담음.

    상태는 날짜로 자동 판단 (공개 카드 단계에서):
    - start_date ~ baptism_at 사이  → 교육중
    - apply_open=True               → 입교신청 접수중
    """
    __tablename__ = "catechumen_classes"

    id = Column(Integer, primary_key=True, index=True)
    round_no = Column(Integer)                       # 차수 번호 (제N차/제N회)
    start_date = Column(Date)                        # 교육 시작일 (→ "N주차" 계산)
    baptism_at = Column(DateTime)                    # 세례성사 일시 (→ "N일 남음" 계산 + 카드 하단)
    apply_open = Column(Boolean, nullable=False, server_default="false")  # 입교신청 접수중
    apply_start_date = Column(Date)                  # 다음/이번 과정 시작 예정일 (카드2 하단)
    apply_note = Column(Text)                        # 입교 안내 문구
    note = Column(Text)                              # 기타 메모
    sort_order = Column(Integer, nullable=False, server_default="0")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CatechumenMember(Base):
    """차수 참여자. 회원이면 member_id 연결, 아직 회원이 아닌 예비신자는 이름만으로 명단 기록."""
    __tablename__ = "catechumen_members"

    id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, nullable=False, index=True)   # → catechumen_classes(id) ON DELETE CASCADE
    member_id = Column(Integer, index=True)                  # → members(id) ON DELETE SET NULL (nullable)
    name = Column(String(100))                               # 이름 (비회원·표시용)
    baptismal_name = Column(String(100))                     # 세례명
    baptized_at = Column(Date)                               # 개인 세례일 (비면 차수 baptism_at 사용)
    sort_order = Column(Integer, nullable=False, server_default="0")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CatechumenPhoto(Base):
    """차수별·종류별 사진. category 로 앨범 그룹핑 (입교/교육/미사참여/회식/졸업/세례성사/견진성사 등)."""
    __tablename__ = "catechumen_photos"

    id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, nullable=False, index=True)   # → catechumen_classes(id) ON DELETE CASCADE
    category = Column(String(50), nullable=False)            # 사진 종류
    file_url = Column(String(500), nullable=False)
    alt = Column(String(200))
    sort_order = Column(Integer, nullable=False, server_default="0")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CatechumenApplication(Base):
    """입교신청 (회원 전용). 신청 시 모집중(apply_open) 차수에 자동 연결.
    status: 접수 → 연락완료 → 등록완료 (또는 취소). 등록완료 시 admin 이 차수 참여자로 전환."""
    __tablename__ = "catechumen_applications"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, nullable=False, index=True)  # → members(id) ON DELETE CASCADE
    class_id = Column(Integer, index=True)                   # → catechumen_classes(id) ON DELETE SET NULL (nullable)
    name = Column(String(100))                               # 실명 (회원정보 prefill)
    phone = Column(String(30))                               # 연락처
    baptismal_name_wish = Column(String(100))                # 세례명 희망
    message = Column(Text)                                   # 신청 동기·문의
    status = Column(String(20), nullable=False, server_default="접수")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
