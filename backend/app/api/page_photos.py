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

from app.core.auth import get_current_admin
from app.core.config import settings
from app.core.database import get_db
from app.models.admin import Admin
from app.models.page_photo import PagePhoto, PagePhotoSetting

router = APIRouter(prefix="/page-photos", tags=["page-photos"])

PHOTO_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
PHOTO_MAX_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_TRANSITION = {"fade", "slide", "none"}
DEFAULT_INTERVAL = 5


# ──────────────────────────── 스키마 ────────────────────────────

class PagePhotoOut(BaseModel):
    id: int
    page_slug: str
    file_url: str
    alt: Optional[str]
    sort_order: int
    created_at: datetime

    class Config:
        from_attributes = True


class PagePhotoSettingOut(BaseModel):
    page_slug: str
    transition_mode: str
    interval_seconds: int

    class Config:
        from_attributes = True


class PagePhotoBundle(BaseModel):
    """공개 GET 응답: 사진 + 설정을 한 번에 반환."""
    photos: list[PagePhotoOut]
    settings: PagePhotoSettingOut


class PagePhotoUpdate(BaseModel):
    alt: Optional[str] = None
    sort_order: Optional[int] = None


class PagePhotoSettingUpdate(BaseModel):
    transition_mode: str = Field(..., pattern="^(fade|slide|none)$")
    interval_seconds: int = Field(..., ge=1, le=60)


class ReorderBody(BaseModel):
    photo_ids: list[int]  # 새 순서대로 나열


# ──────────────────────────── 헬퍼 ────────────────────────────

def _get_or_create_settings(db: Session, slug: str) -> PagePhotoSetting:
    setting = db.query(PagePhotoSetting).filter_by(page_slug=slug).first()
    if not setting:
        setting = PagePhotoSetting(
            page_slug=slug,
            transition_mode="fade",
            interval_seconds=DEFAULT_INTERVAL,
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
    _: Admin = Depends(get_current_admin),
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
    return photo


@router.patch("/{photo_id}", response_model=PagePhotoOut)
def update_page_photo(
    photo_id: int,
    body: PagePhotoUpdate,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    photo = db.query(PagePhoto).filter_by(id=photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="사진을 찾을 수 없습니다.")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(photo, k, v)
    db.commit()
    db.refresh(photo)
    return photo


@router.delete("/{photo_id}")
def delete_page_photo(
    photo_id: int,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    photo = db.query(PagePhoto).filter_by(id=photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="사진을 찾을 수 없습니다.")
    _remove_uploaded_file(photo.file_url)
    db.delete(photo)
    db.commit()
    return {"ok": True}


@router.put("/{slug}/settings", response_model=PagePhotoSettingOut)
def update_page_photo_settings(
    slug: str,
    body: PagePhotoSettingUpdate,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    setting = _get_or_create_settings(db, slug)
    setting.transition_mode = body.transition_mode
    setting.interval_seconds = body.interval_seconds
    db.commit()
    db.refresh(setting)
    return setting


@router.post("/{slug}/reorder", response_model=list[PagePhotoOut])
def reorder_page_photos(
    slug: str,
    body: ReorderBody,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    photos = db.query(PagePhoto).filter_by(page_slug=slug).all()
    by_id = {p.id: p for p in photos}
    for idx, pid in enumerate(body.photo_ids):
        if pid in by_id:
            by_id[pid].sort_order = idx
    db.commit()
    return (
        db.query(PagePhoto)
        .filter_by(page_slug=slug)
        .order_by(PagePhoto.sort_order.asc(), PagePhoto.id.asc())
        .all()
    )
