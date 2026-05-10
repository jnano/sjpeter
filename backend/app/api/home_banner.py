"""홈 페이지 배너 이미지 관리 API.

- 공개: GET /api/home-banners/ (활성 배너 sort_order 오름차순)
- 관리자: POST/DELETE/PUT 순서 재배치
"""
import os
import uuid
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import asc
from sqlalchemy.orm import Session

from app.core.auth import get_current_admin
from app.core.config import settings
from app.core.database import get_db
from app.models.admin import Admin
from app.models.home_banner import HomeBanner

router = APIRouter(prefix="/home-banners", tags=["home-banners"])

ALLOWED_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
SUBDIR = "home_banners"


class BannerOut(BaseModel):
    id: int
    file_url: str
    original_name: str
    sort_order: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ReorderIn(BaseModel):
    ids: List[int]  # 새 순서대로 정렬된 id 배열


@router.get("/", response_model=List[BannerOut])
def list_banners(db: Session = Depends(get_db)):
    """공개: 활성화된 배너를 sort_order 오름차순으로 반환."""
    return (
        db.query(HomeBanner)
        .filter(HomeBanner.is_active.is_(True))
        .order_by(asc(HomeBanner.sort_order), asc(HomeBanner.id))
        .all()
    )


@router.get("/all", response_model=List[BannerOut])
def list_all_banners(
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    """관리자: 비활성 포함 전체 목록."""
    return (
        db.query(HomeBanner)
        .order_by(asc(HomeBanner.sort_order), asc(HomeBanner.id))
        .all()
    )


@router.post("/", response_model=List[BannerOut], status_code=201)
async def upload_banners(
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    """관리자: 다중 파일 업로드 (드래그앤드롭 지원)."""
    if not files:
        raise HTTPException(status_code=400, detail="파일이 없습니다.")

    save_dir = os.path.join(settings.UPLOAD_DIR, SUBDIR)
    os.makedirs(save_dir, exist_ok=True)

    # 현재 최대 sort_order
    max_order = db.query(HomeBanner).order_by(HomeBanner.sort_order.desc()).first()
    next_order = (max_order.sort_order + 1) if max_order else 0

    saved: List[HomeBanner] = []
    for upload in files:
        original = upload.filename or "banner"
        ext = os.path.splitext(original)[1].lower()
        if ext not in ALLOWED_EXTS:
            raise HTTPException(status_code=400, detail=f"허용되지 않는 파일 형식: {ext}")

        content = await upload.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail=f"파일 크기는 10MB 이하여야 합니다: {original}")

        stored = f"{uuid.uuid4().hex}{ext}"
        path = os.path.join(save_dir, stored)
        with open(path, "wb") as f:
            f.write(content)

        banner = HomeBanner(
            file_url=f"/uploads/{SUBDIR}/{stored}",
            original_name=original,
            sort_order=next_order,
            is_active=True,
        )
        db.add(banner)
        saved.append(banner)
        next_order += 1

    db.commit()
    for b in saved:
        db.refresh(b)
    return saved


@router.put("/reorder", response_model=List[BannerOut])
def reorder_banners(
    body: ReorderIn,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    """관리자: ids 배열의 순서대로 sort_order 재할당."""
    banners = {b.id: b for b in db.query(HomeBanner).filter(HomeBanner.id.in_(body.ids)).all()}
    if len(banners) != len(body.ids):
        raise HTTPException(status_code=400, detail="존재하지 않는 배너 id가 포함되어 있습니다.")
    for order, bid in enumerate(body.ids):
        banners[bid].sort_order = order
    db.commit()
    return (
        db.query(HomeBanner)
        .order_by(asc(HomeBanner.sort_order), asc(HomeBanner.id))
        .all()
    )


@router.patch("/{banner_id}/toggle", response_model=BannerOut)
def toggle_banner(
    banner_id: int,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    """관리자: 활성/비활성 토글."""
    banner = db.query(HomeBanner).filter(HomeBanner.id == banner_id).first()
    if not banner:
        raise HTTPException(status_code=404, detail="배너를 찾을 수 없습니다.")
    banner.is_active = not banner.is_active
    db.commit()
    db.refresh(banner)
    return banner


@router.delete("/{banner_id}", status_code=204)
def delete_banner(
    banner_id: int,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    """관리자: DB 레코드 + 실제 파일 삭제."""
    banner = db.query(HomeBanner).filter(HomeBanner.id == banner_id).first()
    if not banner:
        raise HTTPException(status_code=404, detail="배너를 찾을 수 없습니다.")

    # 파일 삭제 (실패해도 DB는 지움)
    try:
        rel = banner.file_url.lstrip("/").replace("uploads/", "", 1)
        path = os.path.join(settings.UPLOAD_DIR, rel)
        if os.path.exists(path):
            os.remove(path)
    except Exception:
        pass

    db.delete(banner)
    db.commit()
