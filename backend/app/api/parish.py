import json
import os
import uuid
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db
from app.core.auth import get_current_admin
from app.core.config import settings
from app.models.parish import Parish
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
    mass_schedule: Optional[MassSchedule] = None


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
    logo_url: Optional[str] = None
    member_count: Optional[int]
    founded_at: Optional[date]
    about_photo_url: Optional[str]
    mass_schedule: Optional[MassSchedule]

    class Config:
        from_attributes = True


def _get_parish(db: Session) -> Parish:
    parish = db.query(Parish).first()
    if not parish:
        raise HTTPException(status_code=500, detail="성당 정보가 초기화되지 않았습니다.")
    return parish


def _parish_to_out(parish: Parish) -> ParishOut:
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
        about_photo_url=parish.about_photo_url,
        logo_url=parish.logo_url,
        mass_schedule=schedule,
    )


@router.get("/", response_model=ParishOut)
def get_parish(db: Session = Depends(get_db)):
    parish = _get_parish(db)
    return _parish_to_out(parish)


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
    return _parish_to_out(parish)


# ──────────────────────────── 성당 소개 사진 (/about) ────────────────────────────

@router.post("/about-photo/upload", response_model=ParishOut)
async def upload_about_photo(
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

    photo_dir = os.path.join(settings.UPLOAD_DIR, "about_photos")
    os.makedirs(photo_dir, exist_ok=True)

    filename = f"{uuid.uuid4().hex}{ext}"
    with open(os.path.join(photo_dir, filename), "wb") as f:
        f.write(data)

    parish = _get_parish(db)
    # 기존 about 사진이 업로드 디렉터리에 있으면 정리
    if parish.about_photo_url and parish.about_photo_url.startswith("/uploads/about_photos/"):
        old_path = os.path.join(settings.UPLOAD_DIR, parish.about_photo_url.removeprefix("/uploads/"))
        if os.path.exists(old_path):
            try:
                os.remove(old_path)
            except OSError:
                pass

    parish.about_photo_url = f"/uploads/about_photos/{filename}"
    db.commit()
    db.refresh(parish)

    return _parish_to_out(parish)


@router.delete("/about-photo", response_model=ParishOut)
def delete_about_photo(
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    parish = _get_parish(db)
    if parish.about_photo_url and parish.about_photo_url.startswith("/uploads/about_photos/"):
        old_path = os.path.join(settings.UPLOAD_DIR, parish.about_photo_url.removeprefix("/uploads/"))
        if os.path.exists(old_path):
            try:
                os.remove(old_path)
            except OSError:
                pass

    parish.about_photo_url = None
    db.commit()
    db.refresh(parish)

    return _parish_to_out(parish)


# ──────────────────────────── 성당 로고 ────────────────────────────

@router.post("/logo/upload", response_model=ParishOut)
async def upload_logo(
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

    logo_dir = os.path.join(settings.UPLOAD_DIR, "logos")
    os.makedirs(logo_dir, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{ext}"
    with open(os.path.join(logo_dir, filename), "wb") as f:
        f.write(data)

    parish = _get_parish(db)
    if parish.logo_url and parish.logo_url.startswith("/uploads/logos/"):
        old_path = os.path.join(settings.UPLOAD_DIR, parish.logo_url.removeprefix("/uploads/"))
        if os.path.exists(old_path):
            try:
                os.remove(old_path)
            except OSError:
                pass

    parish.logo_url = f"/uploads/logos/{filename}"
    db.commit()
    db.refresh(parish)
    return _parish_to_out(parish)


@router.delete("/logo", response_model=ParishOut)
def delete_logo(
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    parish = _get_parish(db)
    if parish.logo_url and parish.logo_url.startswith("/uploads/logos/"):
        old_path = os.path.join(settings.UPLOAD_DIR, parish.logo_url.removeprefix("/uploads/"))
        if os.path.exists(old_path):
            try:
                os.remove(old_path)
            except OSError:
                pass
    parish.logo_url = None
    db.commit()
    db.refresh(parish)
    return _parish_to_out(parish)
