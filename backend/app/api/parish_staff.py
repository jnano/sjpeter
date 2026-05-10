"""본당 가족 (parish staff) API.

공개:
- GET /api/parish-staff/ — 활성 staff 전체 (role 그룹순 + sort_order)

관리자:
- POST /api/parish-staff/ — 등록
- PUT /api/parish-staff/{id} — 수정
- POST /api/parish-staff/{id}/photo — 사진 업로드
- DELETE /api/parish-staff/{id} — 삭제
- PUT /api/parish-staff/reorder — 순서 재배치
"""
import os
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import asc
from sqlalchemy.orm import Session

from app.core.auth import get_current_admin
from app.core.config import settings
from app.core.database import get_db
from app.models.admin import Admin
from app.models.parish_staff import ParishStaff

router = APIRouter(prefix="/parish-staff", tags=["parish-staff"])

ALLOWED_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
SUBDIR = "staff"

# role 그룹 정렬 우선순위 (낮을수록 먼저 표시)
ROLE_ORDER = {"주임신부": 1, "보좌신부": 2, "수녀": 3, "사무장": 4}


class StaffIn(BaseModel):
    role: str
    name: str
    title: Optional[str] = None
    feast_day: Optional[str] = None
    introduction: Optional[str] = None
    career_items: Optional[str] = None
    scripture_quote: Optional[str] = None
    scripture_reference: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True


class StaffOut(BaseModel):
    id: int
    role: str
    name: str
    title: Optional[str]
    feast_day: Optional[str]
    photo_url: Optional[str]
    introduction: Optional[str]
    career_items: Optional[str]
    scripture_quote: Optional[str]
    scripture_reference: Optional[str]
    sort_order: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ReorderIn(BaseModel):
    ids: List[int]


def _sort_key(s: ParishStaff) -> tuple[int, int, int]:
    return (ROLE_ORDER.get(s.role, 99), s.sort_order, s.id)


@router.get("/", response_model=List[StaffOut])
def list_staff(db: Session = Depends(get_db)):
    rows = db.query(ParishStaff).filter(ParishStaff.is_active.is_(True)).all()
    return sorted(rows, key=_sort_key)


@router.get("/all", response_model=List[StaffOut])
def list_all_staff(db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    rows = db.query(ParishStaff).all()
    return sorted(rows, key=_sort_key)


@router.post("/", response_model=StaffOut, status_code=201)
def create_staff(
    body: StaffIn,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    staff = ParishStaff(**body.model_dump())
    db.add(staff)
    db.commit()
    db.refresh(staff)
    return staff


@router.put("/reorder", response_model=List[StaffOut])
def reorder_staff(
    body: ReorderIn,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    rows = {s.id: s for s in db.query(ParishStaff).filter(ParishStaff.id.in_(body.ids)).all()}
    if len(rows) != len(body.ids):
        raise HTTPException(status_code=400, detail="존재하지 않는 id 포함")
    for order, sid in enumerate(body.ids):
        rows[sid].sort_order = order
    db.commit()
    all_rows = db.query(ParishStaff).all()
    return sorted(all_rows, key=_sort_key)


@router.put("/{staff_id}", response_model=StaffOut)
def update_staff(
    staff_id: int,
    body: StaffIn,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    staff = db.query(ParishStaff).filter(ParishStaff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="찾을 수 없습니다.")
    for k, v in body.model_dump().items():
        setattr(staff, k, v)
    db.commit()
    db.refresh(staff)
    return staff


@router.post("/{staff_id}/photo", response_model=StaffOut)
async def upload_photo(
    staff_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    staff = db.query(ParishStaff).filter(ParishStaff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="찾을 수 없습니다.")
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTS:
        raise HTTPException(status_code=400, detail=f"허용되지 않는 형식: {ext}")
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="파일 크기는 5MB 이하여야 합니다.")
    save_dir = os.path.join(settings.UPLOAD_DIR, SUBDIR)
    os.makedirs(save_dir, exist_ok=True)
    stored = f"{uuid.uuid4().hex}{ext}"
    with open(os.path.join(save_dir, stored), "wb") as f:
        f.write(content)
    # 기존 사진 파일 정리
    if staff.photo_url:
        try:
            old_rel = staff.photo_url.lstrip("/").replace("uploads/", "", 1)
            old_path = os.path.join(settings.UPLOAD_DIR, old_rel)
            if os.path.exists(old_path):
                os.remove(old_path)
        except Exception:
            pass
    staff.photo_url = f"/uploads/{SUBDIR}/{stored}"
    db.commit()
    db.refresh(staff)
    return staff


@router.delete("/{staff_id}/photo", response_model=StaffOut)
def delete_photo(
    staff_id: int,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    """등록된 사진만 삭제 (staff 레코드는 유지)."""
    staff = db.query(ParishStaff).filter(ParishStaff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="찾을 수 없습니다.")
    if staff.photo_url:
        try:
            rel = staff.photo_url.lstrip("/").replace("uploads/", "", 1)
            path = os.path.join(settings.UPLOAD_DIR, rel)
            if os.path.exists(path):
                os.remove(path)
        except Exception:
            pass
    staff.photo_url = None
    db.commit()
    db.refresh(staff)
    return staff


@router.delete("/{staff_id}", status_code=204)
def delete_staff(
    staff_id: int,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    staff = db.query(ParishStaff).filter(ParishStaff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="찾을 수 없습니다.")
    if staff.photo_url:
        try:
            rel = staff.photo_url.lstrip("/").replace("uploads/", "", 1)
            path = os.path.join(settings.UPLOAD_DIR, rel)
            if os.path.exists(path):
                os.remove(path)
        except Exception:
            pass
    db.delete(staff)
    db.commit()
