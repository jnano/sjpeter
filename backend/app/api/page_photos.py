"""페이지(슬러그)별 히어로 영역 다중 사진 + 슬라이드쇼 설정 API.

엔드포인트:
- GET    /api/page-photos/{slug}            : 공개. 사진 목록 + 설정 반환
- POST   /api/page-photos/{slug}/upload     : 관리자. 사진 업로드(추가)
- PATCH  /api/page-photos/{photo_id}        : 관리자. alt·순서 수정
- DELETE /api/page-photos/{photo_id}        : 관리자. 사진 삭제
- PUT    /api/page-photos/{slug}/settings   : 관리자. 전환 방식·타이머 저장
- POST   /api/page-photos/{slug}/reorder    : 관리자. 순서 일괄 재정렬
"""

import os
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.admin_log import get_admin_identifier, log_action
from app.core.auth import get_current_admin
from app.core.config import settings
from app.core.database import get_db
from app.models.admin import Admin
from app.models.page_photo import PagePhoto, PagePhotoSetting, PagePhotoSlug

router = APIRouter(prefix="/page-photos", tags=["page-photos"])

PHOTO_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
PHOTO_MAX_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_TRANSITION = {
    "none", "fade", "slide", "slide-up", "slide-down",
    "zoom-in", "zoom-out", "ken-burns", "blur",
}
DEFAULT_INTERVAL = 5
DEFAULT_DURATION_MS = 700


# ──────────────────────────── 스키마 ────────────────────────────

_ALLOWED_IMAGE_POSITIONS = {
    "top left", "top", "top right",
    "left", "center", "right",
    "bottom left", "bottom", "bottom right",
}


class PagePhotoOut(BaseModel):
    id: int
    page_slug: str
    file_url: str
    alt: Optional[str]
    sort_order: int
    image_position: str
    created_at: datetime

    class Config:
        from_attributes = True


class PagePhotoSettingOut(BaseModel):
    page_slug: str
    transition_mode: str
    interval_seconds: int
    transition_duration_ms: int

    class Config:
        from_attributes = True


class PagePhotoBundle(BaseModel):
    """공개 GET 응답: 사진 + 설정을 한 번에 반환."""
    photos: list[PagePhotoOut]
    settings: PagePhotoSettingOut


class PagePhotoUpdate(BaseModel):
    alt: Optional[str] = None
    sort_order: Optional[int] = None
    image_position: Optional[str] = None


class PagePhotoSettingUpdate(BaseModel):
    transition_mode: str
    interval_seconds: int = Field(..., ge=1, le=60)
    transition_duration_ms: int = Field(..., ge=100, le=5000)


class ReorderBody(BaseModel):
    photo_ids: list[int]  # 새 순서대로 나열


# ──────────────────────────── 슬러그 스키마 ────────────────────────────

class PagePhotoSlugOut(BaseModel):
    id: int
    slug: str
    label: str
    public_href: str
    description: Optional[str]
    fallback_url: Optional[str]
    sort_order: int

    class Config:
        from_attributes = True


class PagePhotoSlugCreate(BaseModel):
    slug: str = Field(..., min_length=1, max_length=50, pattern=r"^[a-z0-9][a-z0-9-]*$")
    label: str = Field(..., min_length=1, max_length=100)
    public_href: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    fallback_url: Optional[str] = None
    sort_order: int = 0


class PagePhotoSlugUpdate(BaseModel):
    label: Optional[str] = Field(None, min_length=1, max_length=100)
    public_href: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    fallback_url: Optional[str] = None
    sort_order: Optional[int] = None


# ──────────────────────────── 헬퍼 ────────────────────────────

def _get_or_create_settings(db: Session, slug: str) -> PagePhotoSetting:
    setting = db.query(PagePhotoSetting).filter_by(page_slug=slug).first()
    if not setting:
        setting = PagePhotoSetting(
            page_slug=slug,
            transition_mode="fade",
            interval_seconds=DEFAULT_INTERVAL,
            transition_duration_ms=DEFAULT_DURATION_MS,
        )
        db.add(setting)
        db.commit()
        db.refresh(setting)
    return setting


def _ensure_image_file(file: UploadFile, data: bytes) -> str:
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in PHOTO_IMAGE_EXTS:
        raise HTTPException(status_code=400, detail="이미지 파일만 업로드할 수 있습니다.")
    if len(data) > PHOTO_MAX_SIZE:
        raise HTTPException(status_code=400, detail="파일 크기는 10MB 이하여야 합니다.")
    return ext


# ──────────────────────────── 슬러그 CRUD ────────────────────────────
# 주의: 동적 /{slug} 라우트보다 먼저 정의되어야 한다.

@router.get("/slugs", response_model=list[PagePhotoSlugOut])
def list_slugs(db: Session = Depends(get_db)):
    return (
        db.query(PagePhotoSlug)
        .order_by(PagePhotoSlug.sort_order.asc(), PagePhotoSlug.id.asc())
        .all()
    )


@router.post("/slugs", response_model=PagePhotoSlugOut)
def create_slug(
    body: PagePhotoSlugCreate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    if db.query(PagePhotoSlug).filter_by(slug=body.slug).first():
        raise HTTPException(status_code=409, detail="이미 사용 중인 슬러그입니다.")
    if body.slug == "slugs":
        raise HTTPException(status_code=400, detail="'slugs'는 예약된 이름입니다.")
    item = PagePhotoSlug(**body.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    log_action(db, get_admin_identifier(admin), "create_page_photo_slug", "page_photo_slug", item.id, body.slug)
    return item


@router.patch("/slugs/{slug_id}", response_model=PagePhotoSlugOut)
def update_slug(
    slug_id: int,
    body: PagePhotoSlugUpdate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    item = db.query(PagePhotoSlug).filter_by(id=slug_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="슬러그를 찾을 수 없습니다.")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(item, k, v)
    db.commit()
    db.refresh(item)
    log_action(db, get_admin_identifier(admin), "update_page_photo_slug", "page_photo_slug", item.id, item.slug)
    return item


@router.delete("/slugs/{slug_id}")
def delete_slug(
    slug_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    item = db.query(PagePhotoSlug).filter_by(id=slug_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="슬러그를 찾을 수 없습니다.")
    snapshot = item.slug

    # 해당 슬러그의 모든 사진 파일 + DB 행 + 설정 정리
    photos = db.query(PagePhoto).filter_by(page_slug=item.slug).all()
    for p in photos:
        _remove_uploaded_file(p.file_url)
        db.delete(p)
    setting = db.query(PagePhotoSetting).filter_by(page_slug=item.slug).first()
    if setting:
        db.delete(setting)

    db.delete(item)
    db.commit()
    log_action(db, get_admin_identifier(admin), "delete_page_photo_slug", "page_photo_slug", slug_id, snapshot)
    return {"ok": True}


# ──────────────────────────── 사진 헬퍼 ────────────────────────────

def _remove_uploaded_file(file_url: str) -> None:
    if not file_url.startswith("/uploads/page_photos/"):
        return
    path = os.path.join(settings.UPLOAD_DIR, file_url.removeprefix("/uploads/"))
    if os.path.exists(path):
        try:
            os.remove(path)
        except OSError:
            pass


# ──────────────────────────── 공개 API ────────────────────────────

@router.get("/{slug}", response_model=PagePhotoBundle)
def get_page_photos(slug: str, db: Session = Depends(get_db)):
    photos = (
        db.query(PagePhoto)
        .filter_by(page_slug=slug)
        .order_by(PagePhoto.sort_order.asc(), PagePhoto.id.asc())
        .all()
    )
    setting = _get_or_create_settings(db, slug)
    return PagePhotoBundle(photos=photos, settings=setting)


# ──────────────────────────── 관리자 API ────────────────────────────

@router.post("/{slug}/upload", response_model=PagePhotoOut)
async def upload_page_photo(
    slug: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    data = await file.read()
    ext = _ensure_image_file(file, data)

    photo_dir = os.path.join(settings.UPLOAD_DIR, "page_photos")
    os.makedirs(photo_dir, exist_ok=True)

    filename = f"{uuid.uuid4().hex}{ext}"
    with open(os.path.join(photo_dir, filename), "wb") as f:
        f.write(data)

    # 새 사진은 가장 마지막 순서로
    last_order = (
        db.query(PagePhoto)
        .filter_by(page_slug=slug)
        .order_by(PagePhoto.sort_order.desc())
        .first()
    )
    next_order = (last_order.sort_order + 1) if last_order else 0

    photo = PagePhoto(
        page_slug=slug,
        file_url=f"/uploads/page_photos/{filename}",
        alt=None,
        sort_order=next_order,
    )
    db.add(photo)
    # 설정 행이 없으면 함께 생성
    _get_or_create_settings(db, slug)
    db.commit()
    db.refresh(photo)
    log_action(db, get_admin_identifier(admin), "upload_page_photo", "page_photo", photo.id, f"slug={slug}")
    return photo


@router.patch("/{photo_id}", response_model=PagePhotoOut)
def update_page_photo(
    photo_id: int,
    body: PagePhotoUpdate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    photo = db.query(PagePhoto).filter_by(id=photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="사진을 찾을 수 없습니다.")
    data = body.model_dump(exclude_unset=True)
    if "image_position" in data and data["image_position"] not in _ALLOWED_IMAGE_POSITIONS:
        raise HTTPException(status_code=400, detail=f"허용되지 않는 이미지 위치 값입니다: {data['image_position']}")
    for k, v in data.items():
        setattr(photo, k, v)
    db.commit()
    db.refresh(photo)
    log_action(db, get_admin_identifier(admin), "update_page_photo", "page_photo", photo.id, f"slug={photo.page_slug}")
    return photo


@router.delete("/{photo_id}")
def delete_page_photo(
    photo_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    photo = db.query(PagePhoto).filter_by(id=photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="사진을 찾을 수 없습니다.")
    snapshot = f"slug={photo.page_slug}"
    _remove_uploaded_file(photo.file_url)
    db.delete(photo)
    db.commit()
    log_action(db, get_admin_identifier(admin), "delete_page_photo", "page_photo", photo_id, snapshot)
    return {"ok": True}


@router.put("/{slug}/settings", response_model=PagePhotoSettingOut)
def update_page_photo_settings(
    slug: str,
    body: PagePhotoSettingUpdate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    if body.transition_mode not in ALLOWED_TRANSITION:
        raise HTTPException(status_code=400, detail=f"허용되지 않는 전환 방식입니다: {body.transition_mode}")
    setting = _get_or_create_settings(db, slug)
    setting.transition_mode = body.transition_mode
    setting.interval_seconds = body.interval_seconds
    setting.transition_duration_ms = body.transition_duration_ms
    db.commit()
    db.refresh(setting)
    log_action(db, get_admin_identifier(admin), "update_page_photo_settings", "page_photo_setting", setting.id, f"slug={slug},mode={body.transition_mode}")
    return setting


@router.post("/{slug}/reorder", response_model=list[PagePhotoOut])
def reorder_page_photos(
    slug: str,
    body: ReorderBody,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    photos = db.query(PagePhoto).filter_by(page_slug=slug).all()
    by_id = {p.id: p for p in photos}
    for idx, pid in enumerate(body.photo_ids):
        if pid in by_id:
            by_id[pid].sort_order = idx
    db.commit()
    log_action(db, get_admin_identifier(admin), "reorder_page_photos", "page_photo", None, f"slug={slug}, 순서: {','.join(map(str, body.photo_ids))}")
    return (
        db.query(PagePhoto)
        .filter_by(page_slug=slug)
        .order_by(PagePhoto.sort_order.asc(), PagePhoto.id.asc())
        .all()
    )
