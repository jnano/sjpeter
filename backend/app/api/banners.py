"""배너 그룹·이미지 관리 API.

공개:
- GET  /api/banners/by-placement/{placement}    : 활성 그룹 + 이미지 반환

관리자:
- GET    /api/banners/groups                    : 전체 그룹 (관리용)
- POST   /api/banners/groups                    : 그룹 생성
- PATCH  /api/banners/groups/{group_id}         : 그룹 수정 (name·placement·is_active·sort_order)
- DELETE /api/banners/groups/{group_id}         : 그룹 삭제 (이미지 CASCADE)
- POST   /api/banners/groups/{group_id}/images  : 이미지 업로드(추가)
- PATCH  /api/banners/images/{image_id}         : 이미지 수정 (link_url·alt_text·sort_order)
- DELETE /api/banners/images/{image_id}         : 이미지 삭제
"""
import os
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.core.auth import get_current_admin
from app.core.config import settings
from app.core.database import get_db
from app.models.admin import Admin
from app.models.banner import BannerGroup, BannerImage

router = APIRouter(prefix="/banners", tags=["banners"])

ALLOWED_PLACEMENTS = {"home_main"}
ALLOWED_TRANSITIONS = {
    "none", "fade", "slide", "slide-up", "slide-down",
    "zoom-in", "zoom-out", "ken-burns", "blur",
}
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_SIZE = 10 * 1024 * 1024  # 10 MB


# ── 스키마 ──────────────────────────────────────────────────

class BannerImageOut(BaseModel):
    id: int
    file_url: str
    link_url: Optional[str]
    alt_text: str
    sort_order: int

    class Config:
        from_attributes = True


class BannerGroupOut(BaseModel):
    id: int
    name: str
    placement: str
    is_active: bool
    sort_order: int
    transition: str
    created_at: datetime
    updated_at: datetime
    images: list[BannerImageOut]

    class Config:
        from_attributes = True


class GroupCreate(BaseModel):
    name: str
    placement: str = "home_main"
    is_active: bool = True
    sort_order: int = 0
    transition: str = "fade"


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    placement: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None
    transition: Optional[str] = None


class ImageUpdate(BaseModel):
    link_url: Optional[str] = None
    alt_text: Optional[str] = None
    sort_order: Optional[int] = None


# ── 헬퍼 ────────────────────────────────────────────────────

def _validate_placement(value: str) -> str:
    if value not in ALLOWED_PLACEMENTS:
        raise HTTPException(
            status_code=400,
            detail=f"placement 는 {sorted(ALLOWED_PLACEMENTS)} 중 하나여야 합니다.",
        )
    return value


def _validate_transition(value: str) -> str:
    if value not in ALLOWED_TRANSITIONS:
        raise HTTPException(
            status_code=400,
            detail=f"transition 은 {sorted(ALLOWED_TRANSITIONS)} 중 하나여야 합니다.",
        )
    return value


def _save_banner_image(file: UploadFile, data: bytes) -> str:
    ext = os.path.splitext(file.filename or "banner.png")[1].lower()
    if ext not in IMAGE_EXTS:
        raise HTTPException(status_code=400, detail=f"이미지 확장자만 허용됩니다: {sorted(IMAGE_EXTS)}")
    if len(data) > MAX_SIZE:
        raise HTTPException(status_code=400, detail=f"파일이 너무 큽니다 (최대 {MAX_SIZE // (1024*1024)}MB)")
    banner_dir = os.path.join(settings.UPLOAD_DIR, "banners")
    os.makedirs(banner_dir, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{ext}"
    with open(os.path.join(banner_dir, filename), "wb") as f:
        f.write(data)
    return f"/uploads/banners/{filename}"


def _delete_local_file(file_url: Optional[str]) -> None:
    if not file_url or not file_url.startswith("/uploads/"):
        return
    path = os.path.join(settings.UPLOAD_DIR, file_url.removeprefix("/uploads/"))
    try:
        if os.path.exists(path):
            os.remove(path)
    except Exception:
        pass


# ── 공개 ────────────────────────────────────────────────────

@router.get("/by-placement/{placement}", response_model=list[BannerGroupOut])
def list_active_by_placement(placement: str, db: Session = Depends(get_db)):
    """해당 위치에 노출할 활성 그룹 목록 (이미지 포함). sort_order ASC."""
    _validate_placement(placement)
    groups = (
        db.query(BannerGroup)
        .options(joinedload(BannerGroup.images))
        .filter(BannerGroup.placement == placement, BannerGroup.is_active == True)
        .order_by(BannerGroup.sort_order, BannerGroup.id)
        .all()
    )
    # 이미지 없는 그룹은 의미 없으니 필터링
    return [g for g in groups if len(g.images) > 0]


# ── 관리자: 그룹 ───────────────────────────────────────────

@router.get("/groups", response_model=list[BannerGroupOut])
def list_all_groups(db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    return (
        db.query(BannerGroup)
        .options(joinedload(BannerGroup.images))
        .order_by(BannerGroup.placement, BannerGroup.sort_order, BannerGroup.id)
        .all()
    )


@router.post("/groups", response_model=BannerGroupOut, status_code=201)
def create_group(
    body: GroupCreate,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    _validate_placement(body.placement)
    _validate_transition(body.transition)
    group = BannerGroup(
        name=body.name.strip(),
        placement=body.placement,
        is_active=body.is_active,
        sort_order=body.sort_order,
        transition=body.transition,
    )
    db.add(group)
    db.commit()
    db.refresh(group)
    return group


@router.patch("/groups/{group_id}", response_model=BannerGroupOut)
def update_group(
    group_id: int,
    body: GroupUpdate,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    group = db.query(BannerGroup).filter(BannerGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="그룹을 찾을 수 없습니다.")
    if body.name is not None:
        group.name = body.name.strip()
    if body.placement is not None:
        _validate_placement(body.placement)
        group.placement = body.placement
    if body.is_active is not None:
        group.is_active = body.is_active
    if body.sort_order is not None:
        group.sort_order = body.sort_order
    if body.transition is not None:
        _validate_transition(body.transition)
        group.transition = body.transition
    group.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(group)
    return group


@router.delete("/groups/{group_id}", status_code=204)
def delete_group(
    group_id: int,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    group = (
        db.query(BannerGroup)
        .options(joinedload(BannerGroup.images))
        .filter(BannerGroup.id == group_id)
        .first()
    )
    if not group:
        raise HTTPException(status_code=404, detail="그룹을 찾을 수 없습니다.")
    # 로컬 파일 함께 정리 (DB CASCADE 가 행은 지워주지만 파일은 별도)
    for img in group.images:
        _delete_local_file(img.file_url)
    db.delete(group)
    db.commit()
    return None


# ── 관리자: 이미지 ─────────────────────────────────────────

@router.post("/groups/{group_id}/images", response_model=BannerImageOut, status_code=201)
async def upload_banner_image(
    group_id: int,
    file: UploadFile = File(...),
    link_url: Optional[str] = None,
    alt_text: Optional[str] = None,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    group = db.query(BannerGroup).filter(BannerGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="그룹을 찾을 수 없습니다.")

    data = await file.read()
    file_url = _save_banner_image(file, data)

    # 새 이미지는 같은 그룹의 마지막 순서 + 1
    last = (
        db.query(BannerImage)
        .filter(BannerImage.group_id == group_id)
        .order_by(BannerImage.sort_order.desc())
        .first()
    )
    next_order = (last.sort_order + 1) if last else 0

    image = BannerImage(
        group_id=group_id,
        file_url=file_url,
        link_url=(link_url or None),
        alt_text=(alt_text or "").strip(),
        sort_order=next_order,
    )
    db.add(image)
    db.commit()
    db.refresh(image)
    return image


@router.patch("/images/{image_id}", response_model=BannerImageOut)
def update_image(
    image_id: int,
    body: ImageUpdate,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    img = db.query(BannerImage).filter(BannerImage.id == image_id).first()
    if not img:
        raise HTTPException(status_code=404, detail="이미지를 찾을 수 없습니다.")
    if body.link_url is not None:
        img.link_url = body.link_url.strip() or None
    if body.alt_text is not None:
        img.alt_text = body.alt_text.strip()
    if body.sort_order is not None:
        img.sort_order = body.sort_order
    db.commit()
    db.refresh(img)
    return img


@router.delete("/images/{image_id}", status_code=204)
def delete_image(
    image_id: int,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    img = db.query(BannerImage).filter(BannerImage.id == image_id).first()
    if not img:
        raise HTTPException(status_code=404, detail="이미지를 찾을 수 없습니다.")
    _delete_local_file(img.file_url)
    db.delete(img)
    db.commit()
    return None
