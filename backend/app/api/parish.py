import json
import os
import uuid
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db
from app.core.auth import get_current_admin
from app.core.config import settings
from app.models.parish import Parish, PastorPhoto
from app.models.admin import Admin

PHOTO_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
PHOTO_MAX_SIZE = 10 * 1024 * 1024  # 10 MB

router = APIRouter(prefix="/parish", tags=["parish"])


class MassEntry(BaseModel):
    day: str
    time: str
    note: str = ""


class MassSchedule(BaseModel):
    entries: list[MassEntry] = []
    note: str = ""


class ParishUpdate(BaseModel):
    name: Optional[str] = None
    diocese: Optional[str] = None
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    phone: Optional[str] = None
    fax: Optional[str] = None
    cafe_url: Optional[str] = None
    band_url: Optional[str] = None
    description: Optional[str] = None
    member_count: Optional[int] = None
    founded_at: Optional[date] = None
    pastor_name: Optional[str] = None
    pastor_appointed: Optional[str] = None
    pastor_message: Optional[str] = None
    mass_schedule: Optional[MassSchedule] = None


class PastorPhotoOut(BaseModel):
    id: int
    url: str
    is_selected: bool
    uploaded_at: datetime

    class Config:
        from_attributes = True


class ParishOut(BaseModel):
    id: int
    name: str
    diocese: Optional[str]
    address: Optional[str]
    lat: Optional[float]
    lng: Optional[float]
    phone: Optional[str]
    fax: Optional[str]
    cafe_url: Optional[str]
    band_url: Optional[str]
    description: Optional[str]
    member_count: Optional[int]
    founded_at: Optional[date]
    pastor_name: Optional[str]
    pastor_appointed: Optional[str]
    pastor_message: Optional[str]
    pastor_photo_url: Optional[str]
    mass_schedule: Optional[MassSchedule]

    class Config:
        from_attributes = True


def _get_parish(db: Session) -> Parish:
    parish = db.query(Parish).first()
    if not parish:
        raise HTTPException(status_code=500, detail="성당 정보가 초기화되지 않았습니다.")
    return parish


def _parish_to_out(parish: Parish, selected_photo_url: Optional[str] = None) -> ParishOut:
    schedule = None
    if parish.mass_schedule:
        try:
            schedule = MassSchedule(**json.loads(parish.mass_schedule))
        except Exception:
            pass
    return ParishOut(
        id=parish.id,
        name=parish.name,
        diocese=parish.diocese,
        address=parish.address,
        lat=parish.lat,
        lng=parish.lng,
        phone=parish.phone,
        fax=parish.fax,
        cafe_url=parish.cafe_url,
        band_url=parish.band_url,
        description=parish.description,
        member_count=parish.member_count,
        founded_at=parish.founded_at,
        pastor_name=parish.pastor_name,
        pastor_appointed=parish.pastor_appointed,
        pastor_message=parish.pastor_message,
        pastor_photo_url=selected_photo_url or parish.pastor_photo_url,
        mass_schedule=schedule,
    )


@router.get("/", response_model=ParishOut)
def get_parish(db: Session = Depends(get_db)):
    parish = _get_parish(db)
    selected = db.query(PastorPhoto).filter_by(is_selected=True).first()
    return _parish_to_out(parish, selected.url if selected else None)


@router.put("/", response_model=ParishOut)
def update_parish(
    body: ParishUpdate,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    parish = _get_parish(db)
    data = body.model_dump(exclude_unset=True)

    if "mass_schedule" in data and data["mass_schedule"] is not None:
        parish.mass_schedule = json.dumps(data.pop("mass_schedule"), ensure_ascii=False)
    elif "mass_schedule" in data:
        data.pop("mass_schedule")

    for k, v in data.items():
        setattr(parish, k, v)

    db.commit()
    db.refresh(parish)
    selected = db.query(PastorPhoto).filter_by(is_selected=True).first()
    return _parish_to_out(parish, selected.url if selected else None)


# ──────────────────────────── 신부님 사진 관리 ────────────────────────────

@router.get("/photos", response_model=list[PastorPhotoOut])
def list_photos(db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    return db.query(PastorPhoto).order_by(PastorPhoto.uploaded_at.desc()).all()


@router.post("/photos/upload", response_model=PastorPhotoOut)
async def upload_photo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in PHOTO_IMAGE_EXTS:
        raise HTTPException(status_code=400, detail="이미지 파일만 업로드할 수 있습니다.")

    data = await file.read()
    if len(data) > PHOTO_MAX_SIZE:
        raise HTTPException(status_code=400, detail="파일 크기는 10MB 이하여야 합니다.")

    photo_dir = os.path.join(settings.UPLOAD_DIR, "pastor_photos")
    os.makedirs(photo_dir, exist_ok=True)

    filename = f"{uuid.uuid4().hex}{ext}"
    with open(os.path.join(photo_dir, filename), "wb") as f:
        f.write(data)

    photo = PastorPhoto(url=f"/uploads/pastor_photos/{filename}", is_selected=False)
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return photo


@router.patch("/photos/{photo_id}/select", response_model=PastorPhotoOut)
def select_photo(
    photo_id: int,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    photo = db.query(PastorPhoto).filter_by(id=photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="사진을 찾을 수 없습니다.")

    db.query(PastorPhoto).update({"is_selected": False})
    photo.is_selected = True
    db.commit()
    db.refresh(photo)
    return photo


@router.delete("/photos/{photo_id}")
def delete_photo(
    photo_id: int,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    photo = db.query(PastorPhoto).filter_by(id=photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="사진을 찾을 수 없습니다.")

    file_path = os.path.join(settings.UPLOAD_DIR, photo.url.removeprefix("/uploads/"))
    if os.path.exists(file_path):
        os.remove(file_path)

    db.delete(photo)
    db.commit()
    return {"ok": True}
