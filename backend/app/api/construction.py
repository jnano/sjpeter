"""성당 건축 공사 단계·일지 API.

- 단계(phases): 공개 GET / 관리자 POST·PUT·DELETE·사진 업로드·순서 변경
- 일지(journal): 공개 GET / 관리자 POST·PUT·DELETE
- summary: 홈 위젯용 현재 진행 단계 + 전체 진행률
"""
import os
import uuid
from datetime import datetime, date
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import asc, desc
from sqlalchemy.orm import Session

from app.core.admin_log import get_admin_identifier, log_action
from app.core.auth import get_current_admin
from app.core.config import settings
from app.core.database import get_db
from app.models.admin import Admin
from app.models.construction import ConstructionPhase, ConstructionJournalEntry

router = APIRouter(prefix="/construction", tags=["construction"])

ALLOWED_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
SUBDIR = "construction"
VALID_STATUSES = {"planned", "in_progress", "completed"}


# ─── Schemas ───────────────────────────────────────────

class PhaseIn(BaseModel):
    name: str
    description: Optional[str] = None
    sort_order: int = 0
    status: str = "planned"
    progress_percent: int = 0
    started_at: Optional[date] = None
    completed_at: Optional[date] = None
    expected_completion_date: Optional[date] = None


class PhaseOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    sort_order: int
    status: str
    progress_percent: int
    started_at: Optional[date] = None
    completed_at: Optional[date] = None
    expected_completion_date: Optional[date] = None
    photo_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class JournalIn(BaseModel):
    entry_date: date
    note: str


class JournalOut(BaseModel):
    id: int
    entry_date: date
    note: str
    photo_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SummaryOut(BaseModel):
    """홈 위젯용 — 현재 진행 단계 + 전체 진행률 + 최근 일지 1건."""
    current_phase: Optional[PhaseOut] = None
    overall_percent: int = 0
    total_phases: int = 0
    completed_phases: int = 0
    latest_journal: Optional[JournalOut] = None


def _validate_phase(body: PhaseIn) -> None:
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="단계 이름은 필수입니다.")
    if body.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"status는 {VALID_STATUSES} 중 하나여야 합니다.")
    if not (0 <= body.progress_percent <= 100):
        raise HTTPException(status_code=400, detail="progress_percent는 0~100 사이여야 합니다.")


def _save_photo(upload: UploadFile, content: bytes) -> str:
    """업로드 파일을 저장하고 URL을 반환."""
    original = upload.filename or "photo"
    ext = os.path.splitext(original)[1].lower()
    if ext not in ALLOWED_EXTS:
        raise HTTPException(status_code=400, detail=f"허용되지 않는 파일 형식: {ext}")
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="파일 크기는 10MB 이하여야 합니다.")
    save_dir = os.path.join(settings.UPLOAD_DIR, SUBDIR)
    os.makedirs(save_dir, exist_ok=True)
    stored = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(save_dir, stored)
    with open(path, "wb") as f:
        f.write(content)
    return f"/uploads/{SUBDIR}/{stored}"


def _delete_photo_file(photo_url: Optional[str]) -> None:
    if not photo_url:
        return
    try:
        rel = photo_url.lstrip("/").replace("uploads/", "", 1)
        path = os.path.join(settings.UPLOAD_DIR, rel)
        if os.path.isfile(path):
            os.remove(path)
    except Exception:
        pass


# ─── Phases ────────────────────────────────────────────

@router.get("/phases", response_model=List[PhaseOut])
def list_phases(db: Session = Depends(get_db)):
    return (
        db.query(ConstructionPhase)
        .order_by(asc(ConstructionPhase.sort_order), asc(ConstructionPhase.id))
        .all()
    )


@router.post("/phases", response_model=PhaseOut, status_code=201)
def create_phase(
    body: PhaseIn,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    _validate_phase(body)
    phase = ConstructionPhase(**body.model_dump())
    db.add(phase)
    db.commit()
    db.refresh(phase)
    log_action(db, get_admin_identifier(admin), "create_construction_phase", "construction_phase", phase.id, body.title)
    return phase


@router.put("/phases/{phase_id}", response_model=PhaseOut)
def update_phase(
    phase_id: int,
    body: PhaseIn,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    _validate_phase(body)
    phase = db.query(ConstructionPhase).filter(ConstructionPhase.id == phase_id).first()
    if not phase:
        raise HTTPException(status_code=404, detail="단계를 찾을 수 없습니다.")
    for k, v in body.model_dump().items():
        setattr(phase, k, v)
    db.commit()
    db.refresh(phase)
    log_action(db, get_admin_identifier(admin), "update_construction_phase", "construction_phase", phase.id, phase.name)
    return phase


@router.delete("/phases/{phase_id}", status_code=204)
def delete_phase(
    phase_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    phase = db.query(ConstructionPhase).filter(ConstructionPhase.id == phase_id).first()
    if not phase:
        raise HTTPException(status_code=404, detail="단계를 찾을 수 없습니다.")
    snapshot = phase.name
    _delete_photo_file(phase.photo_url)
    db.delete(phase)
    db.commit()
    log_action(db, get_admin_identifier(admin), "delete_construction_phase", "construction_phase", phase_id, snapshot)
    return None


@router.post("/phases/{phase_id}/photo", response_model=PhaseOut)
async def upload_phase_photo(
    phase_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    phase = db.query(ConstructionPhase).filter(ConstructionPhase.id == phase_id).first()
    if not phase:
        raise HTTPException(status_code=404, detail="단계를 찾을 수 없습니다.")
    content = await file.read()
    new_url = _save_photo(file, content)
    _delete_photo_file(phase.photo_url)
    phase.photo_url = new_url
    db.commit()
    db.refresh(phase)
    log_action(db, get_admin_identifier(admin), "upload_construction_phase_photo", "construction_phase", phase.id, phase.name)
    return phase


# ─── Journal ───────────────────────────────────────────

@router.get("/journal", response_model=List[JournalOut])
def list_journal(
    db: Session = Depends(get_db),
    limit: int = 50,
):
    limit = max(1, min(limit, 200))
    return (
        db.query(ConstructionJournalEntry)
        .order_by(desc(ConstructionJournalEntry.entry_date), desc(ConstructionJournalEntry.id))
        .limit(limit)
        .all()
    )


@router.post("/journal", response_model=JournalOut, status_code=201)
def create_journal(
    body: JournalIn,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    if not body.note.strip():
        raise HTTPException(status_code=400, detail="일지 내용은 필수입니다.")
    entry = ConstructionJournalEntry(entry_date=body.entry_date, note=body.note.strip())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    log_action(db, get_admin_identifier(admin), "create_construction_journal", "construction_journal", entry.id, str(entry.entry_date))
    return entry


@router.put("/journal/{entry_id}", response_model=JournalOut)
def update_journal(
    entry_id: int,
    body: JournalIn,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    if not body.note.strip():
        raise HTTPException(status_code=400, detail="일지 내용은 필수입니다.")
    entry = db.query(ConstructionJournalEntry).filter(ConstructionJournalEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="일지를 찾을 수 없습니다.")
    entry.entry_date = body.entry_date
    entry.note = body.note.strip()
    db.commit()
    db.refresh(entry)
    log_action(db, get_admin_identifier(admin), "update_construction_journal", "construction_journal", entry.id, str(entry.entry_date))
    return entry


@router.delete("/journal/{entry_id}", status_code=204)
def delete_journal(
    entry_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    entry = db.query(ConstructionJournalEntry).filter(ConstructionJournalEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="일지를 찾을 수 없습니다.")
    snapshot = str(entry.entry_date)
    _delete_photo_file(entry.photo_url)
    db.delete(entry)
    db.commit()
    log_action(db, get_admin_identifier(admin), "delete_construction_journal", "construction_journal", entry_id, snapshot)
    return None


@router.post("/journal/{entry_id}/photo", response_model=JournalOut)
async def upload_journal_photo(
    entry_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    entry = db.query(ConstructionJournalEntry).filter(ConstructionJournalEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="일지를 찾을 수 없습니다.")
    content = await file.read()
    new_url = _save_photo(file, content)
    _delete_photo_file(entry.photo_url)
    entry.photo_url = new_url
    db.commit()
    db.refresh(entry)
    log_action(db, get_admin_identifier(admin), "upload_construction_journal_photo", "construction_journal", entry.id, str(entry.entry_date))
    return entry


# ─── Summary (홈 위젯) ─────────────────────────────────

@router.get("/summary", response_model=SummaryOut)
def get_summary(db: Session = Depends(get_db)):
    phases = (
        db.query(ConstructionPhase)
        .order_by(asc(ConstructionPhase.sort_order), asc(ConstructionPhase.id))
        .all()
    )
    total = len(phases)
    completed = sum(1 for p in phases if p.status == "completed")
    # 전체 진행률 — 각 단계 progress_percent 평균
    overall = int(sum(p.progress_percent for p in phases) / total) if total else 0
    # 현재 진행 단계: 가장 먼저 in_progress, 없으면 완료되지 않은 첫 단계
    current = next((p for p in phases if p.status == "in_progress"), None)
    if not current:
        current = next((p for p in phases if p.status != "completed"), None)
    latest = (
        db.query(ConstructionJournalEntry)
        .order_by(desc(ConstructionJournalEntry.entry_date), desc(ConstructionJournalEntry.id))
        .first()
    )
    return SummaryOut(
        current_phase=current,
        overall_percent=overall,
        total_phases=total,
        completed_phases=completed,
        latest_journal=latest,
    )
