import json
import os
import uuid
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db
from app.core.admin_log import get_admin_identifier, log_action
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
    name_en: Optional[str] = None  # parishes 컬럼 아님 → site_settings.PARISH_NAME_EN 으로 라우팅
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
    # 수호 성인 (v1.5.406)
    patron_name: Optional[str] = None
    patron_feast_day: Optional[str] = None
    patron_intro: Optional[str] = None
    patron_quote: Optional[str] = None
    patron_quote_ref: Optional[str] = None
    patron_image_url: Optional[str] = None
    # /about Welcome·About 섹션 (v1.5.423)
    about_welcome_eyebrow: Optional[str] = None
    about_welcome_h1: Optional[str] = None
    about_welcome_h2: Optional[str] = None
    about_welcome_body: Optional[str] = None
    about_welcome_signature: Optional[str] = None
    about_intro_eyebrow: Optional[str] = None
    about_intro_heading: Optional[str] = None


class ParishOut(BaseModel):
    id: int
    name: str
    name_en: Optional[str] = None  # site_settings.PARISH_NAME_EN 에서 채움 (parishes 컬럼 아님)
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
    # 수호 성인 (v1.5.406)
    patron_name: Optional[str] = None
    patron_feast_day: Optional[str] = None
    patron_intro: Optional[str] = None
    patron_quote: Optional[str] = None
    patron_quote_ref: Optional[str] = None
    patron_image_url: Optional[str] = None
    # /about Welcome·About 섹션 (v1.5.423)
    about_welcome_eyebrow: Optional[str] = None
    about_welcome_h1: Optional[str] = None
    about_welcome_h2: Optional[str] = None
    about_welcome_body: Optional[str] = None
    about_welcome_signature: Optional[str] = None
    about_intro_eyebrow: Optional[str] = None
    about_intro_heading: Optional[str] = None

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
    from app.core.site_settings import get_parish_name_en
    return ParishOut(
        id=parish.id,
        name=parish.name,
        name_en=get_parish_name_en() or None,
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
        patron_name=parish.patron_name,
        patron_feast_day=parish.patron_feast_day,
        patron_intro=parish.patron_intro,
        patron_quote=parish.patron_quote,
        patron_quote_ref=parish.patron_quote_ref,
        patron_image_url=parish.patron_image_url,
        about_welcome_eyebrow=parish.about_welcome_eyebrow,
        about_welcome_h1=parish.about_welcome_h1,
        about_welcome_h2=parish.about_welcome_h2,
        about_welcome_body=parish.about_welcome_body,
        about_welcome_signature=parish.about_welcome_signature,
        about_intro_eyebrow=parish.about_intro_eyebrow,
        about_intro_heading=parish.about_intro_heading,
    )


@router.get("/", response_model=ParishOut)
def get_parish(db: Session = Depends(get_db)):
    parish = _get_parish(db)
    return _parish_to_out(parish)


@router.put("/", response_model=ParishOut)
def update_parish(
    body: ParishUpdate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    parish = _get_parish(db)
    data = body.model_dump(exclude_unset=True)

    # 영문명은 parishes 컬럼이 아니라 site_settings.PARISH_NAME_EN 이 single source.
    # setattr 대상에서 분리해 아래에서 site_settings 로 직접 라우팅한다.
    name_en_changed = "name_en" in data
    name_en_value = data.pop("name_en", None)

    if "mass_schedule" in data and data["mass_schedule"] is not None:
        parish.mass_schedule = json.dumps(data.pop("mass_schedule"), ensure_ascii=False)
    elif "mass_schedule" in data:
        data.pop("mass_schedule")

    name_changed = "name" in data
    for k, v in data.items():
        setattr(parish, k, v)

    db.commit()
    db.refresh(parish)

    # A안 single source: parishes.name 이 master. 변경 시 site_settings.PARISH_NAME 을
    # 자동 mirror — 이메일 발신자 fallback 등 site_settings 를 참조하는 기존 코드와 호환 유지.
    # 단방향이라 사용자가 admin/settings 에서 PARISH_NAME 을 따로 변경할 일은 없음 (UI 숨김).
    if name_changed:
        from sqlalchemy import text as _text
        from app.core.site_settings import invalidate as _invalidate
        db.execute(_text(
            "INSERT INTO site_settings (key, value, label, description, is_secret, group_name) "
            "VALUES ('PARISH_NAME', :v, '본당 이름', 'parishes.name 의 자동 mirror — admin/parish/info 에서 변경하세요.', FALSE, '사이트') "
            "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value"
        ), {"v": (parish.name or "").strip()})
        db.commit()
        _invalidate("PARISH_NAME")

    # 영문명: parishes 미러가 아니라 site_settings.PARISH_NAME_EN 자체가 source — 직접 갱신.
    if name_en_changed:
        from sqlalchemy import text as _text
        from app.core.site_settings import invalidate as _invalidate
        db.execute(_text(
            "INSERT INTO site_settings (key, value, label, description, is_secret, group_name) "
            "VALUES ('PARISH_NAME_EN', :v, '본당 영문명', '선택. 헤더·이메일·footer 영문 표기에 사용 — admin/parish/info 에서 변경하세요.', FALSE, '사이트') "
            "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value"
        ), {"v": (name_en_value or "").strip()})
        db.commit()
        _invalidate("PARISH_NAME_EN")

    log_action(db, get_admin_identifier(admin), "update_parish", "parish", parish.id, ",".join(data.keys()))
    return _parish_to_out(parish)


# ──────────────────────────── 성당 소개 사진 (/about) ────────────────────────────

@router.post("/about-photo/upload", response_model=ParishOut)
async def upload_about_photo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
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
    log_action(db, get_admin_identifier(admin), "upload_about_photo", "parish", parish.id, filename)

    return _parish_to_out(parish)


@router.delete("/about-photo", response_model=ParishOut)
def delete_about_photo(
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
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
    log_action(db, get_admin_identifier(admin), "delete_about_photo", "parish", parish.id, None)
    return _parish_to_out(parish)


# ──────────────────────────── 수호 성인 사진 (/patron) ────────────────────────────
# v1.5.406 — patron 페이지 신설. about-photo 와 같은 패턴.

@router.post("/patron-photo/upload", response_model=ParishOut)
async def upload_patron_photo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in PHOTO_IMAGE_EXTS:
        raise HTTPException(status_code=400, detail="이미지 파일만 업로드할 수 있습니다.")

    data = await file.read()
    if len(data) > PHOTO_MAX_SIZE:
        raise HTTPException(status_code=400, detail="파일 크기는 10MB 이하여야 합니다.")

    photo_dir = os.path.join(settings.UPLOAD_DIR, "patron_photos")
    os.makedirs(photo_dir, exist_ok=True)

    filename = f"{uuid.uuid4().hex}{ext}"
    with open(os.path.join(photo_dir, filename), "wb") as f:
        f.write(data)

    parish = _get_parish(db)
    if parish.patron_image_url and parish.patron_image_url.startswith("/uploads/patron_photos/"):
        old_path = os.path.join(settings.UPLOAD_DIR, parish.patron_image_url.removeprefix("/uploads/"))
        if os.path.exists(old_path):
            try:
                os.remove(old_path)
            except OSError:
                pass

    parish.patron_image_url = f"/uploads/patron_photos/{filename}"
    db.commit()
    db.refresh(parish)
    log_action(db, get_admin_identifier(admin), "upload_patron_photo", "parish", parish.id, filename)

    return _parish_to_out(parish)


@router.delete("/patron-photo", response_model=ParishOut)
def delete_patron_photo(
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    parish = _get_parish(db)
    if parish.patron_image_url and parish.patron_image_url.startswith("/uploads/patron_photos/"):
        old_path = os.path.join(settings.UPLOAD_DIR, parish.patron_image_url.removeprefix("/uploads/"))
        if os.path.exists(old_path):
            try:
                os.remove(old_path)
            except OSError:
                pass

    parish.patron_image_url = None
    db.commit()
    db.refresh(parish)
    log_action(db, get_admin_identifier(admin), "delete_patron_photo", "parish", parish.id, None)

    return _parish_to_out(parish)


# ──────────────────────────── 성당 로고 ────────────────────────────

@router.post("/logo/upload", response_model=ParishOut)
async def upload_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
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
    log_action(db, get_admin_identifier(admin), "upload_logo", "parish", parish.id, filename)
    return _parish_to_out(parish)


@router.delete("/logo", response_model=ParishOut)
def delete_logo(
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
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
    log_action(db, get_admin_identifier(admin), "delete_logo", "parish", parish.id, None)
    return _parish_to_out(parish)
