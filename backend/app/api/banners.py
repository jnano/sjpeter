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
import re
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.core.auth import get_current_admin
from app.core.config import settings
from app.core.database import get_db
from app.models.admin import Admin
from app.models.banner import BannerGroup, BannerImage

router = APIRouter(prefix="/banners", tags=["banners"])

# placement 는 자유 키 — admin 이 직접 정의 가능 (예: "home_main", "advent_2026", "my_event").
# 형식만 검증: 영문 소문자·숫자·언더스코어·하이픈 1~50자. (URL-safe, 파일명 호환)
_PLACEMENT_PATTERN = re.compile(r"^[a-z0-9_-]{1,50}$")
# slug 는 변수 치환에서 {{ BANNER:slug }} 로 참조됨. 영문 소문자로 시작 + 1~80자.
_SLUG_PATTERN = re.compile(r"^[a-z][a-z0-9_-]{0,79}$")
# 화이트리스트는 제거됐지만 admin UI 에서 빠른 선택을 위해 권장 키만 제안용으로 남겨둠.
SUGGESTED_PLACEMENTS = [
    "home_main", "home_middle", "home_bottom",
    "about_top", "about_bottom",
    "calendar_top",
    "bulletin_top",
    "gallery_top",
]
ALLOWED_TRANSITIONS = {
    "none", "fade", "slide", "slide-up", "slide-down",
    "zoom-in", "zoom-out", "ken-burns", "blur",
}
ALLOWED_ASPECT_RATIOS = {"16:9", "4:3", "1:1", "4:1", "3:1", "21:9", "3:2"}
DELAY_MIN = 2
DELAY_MAX = 30
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
    slug: Optional[str] = None
    placement: str
    is_active: bool
    sort_order: int
    transition: str
    aspect_ratio: str
    delay_seconds: int
    show_caption_overlay: bool
    start_at: Optional[datetime]
    end_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    images: list[BannerImageOut]

    class Config:
        from_attributes = True


class GroupCreate(BaseModel):
    name: str
    slug: Optional[str] = None
    placement: str = "home_main"
    is_active: bool = True
    sort_order: int = 0
    transition: str = "fade"
    aspect_ratio: str = "16:9"
    delay_seconds: int = 5
    show_caption_overlay: bool = False
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    placement: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None
    transition: Optional[str] = None
    aspect_ratio: Optional[str] = None
    delay_seconds: Optional[int] = None
    show_caption_overlay: Optional[bool] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None


class ImageUpdate(BaseModel):
    link_url: Optional[str] = None
    alt_text: Optional[str] = None
    sort_order: Optional[int] = None


# ── 헬퍼 ────────────────────────────────────────────────────

def _validate_placement(value: str) -> str:
    if not _PLACEMENT_PATTERN.match(value):
        raise HTTPException(
            status_code=400,
            detail="placement 는 영문 소문자·숫자·언더스코어(_)·하이픈(-) 1~50자여야 합니다.",
        )
    return value


def _validate_slug(value: Optional[str]) -> Optional[str]:
    """slug 가 None/빈 문자열이면 None 반환 (선택 항목), 값이 있으면 패턴 검증."""
    if value is None:
        return None
    v = value.strip()
    if not v:
        return None
    if not _SLUG_PATTERN.match(v):
        raise HTTPException(
            status_code=400,
            detail="slug 는 영문 소문자로 시작 + 소문자·숫자·언더스코어·하이픈 1~80자여야 합니다.",
        )
    return v


def _check_slug_unique(db: Session, slug: Optional[str], exclude_id: Optional[int] = None) -> None:
    """slug 중복 확인 — NULL 은 검사 안 함 (여러 그룹이 slug 없이 공존 가능)."""
    if not slug:
        return
    q = db.query(BannerGroup).filter(BannerGroup.slug == slug)
    if exclude_id is not None:
        q = q.filter(BannerGroup.id != exclude_id)
    if q.first():
        raise HTTPException(status_code=400, detail=f"slug '{slug}'은 이미 사용 중입니다.")


def _validate_transition(value: str) -> str:
    if value not in ALLOWED_TRANSITIONS:
        raise HTTPException(
            status_code=400,
            detail=f"transition 은 {sorted(ALLOWED_TRANSITIONS)} 중 하나여야 합니다.",
        )
    return value


def _validate_aspect_ratio(value: str) -> str:
    if value not in ALLOWED_ASPECT_RATIOS:
        raise HTTPException(
            status_code=400,
            detail=f"aspect_ratio 는 {sorted(ALLOWED_ASPECT_RATIOS)} 중 하나여야 합니다.",
        )
    return value


def _validate_delay(value: int) -> int:
    if value < DELAY_MIN or value > DELAY_MAX:
        raise HTTPException(
            status_code=400,
            detail=f"delay_seconds 는 {DELAY_MIN}~{DELAY_MAX} 범위여야 합니다.",
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
    """해당 위치에 노출할 활성 그룹 목록 (이미지 포함). sort_order ASC.

    노출 조건: is_active=True AND now ∈ [start_at, end_at]
    (start_at/end_at 이 NULL 이면 그 방향 제한 없음 — 무제한)
    """
    _validate_placement(placement)
    now = datetime.utcnow()
    groups = (
        db.query(BannerGroup)
        .options(joinedload(BannerGroup.images))
        .filter(
            BannerGroup.placement == placement,
            BannerGroup.is_active == True,
            or_(BannerGroup.start_at.is_(None), BannerGroup.start_at <= now),
            or_(BannerGroup.end_at.is_(None), BannerGroup.end_at >= now),
        )
        .order_by(BannerGroup.sort_order, BannerGroup.id)
        .all()
    )
    # 이미지 없는 그룹은 의미 없으니 필터링
    return [g for g in groups if len(g.images) > 0]


@router.get("/placements/suggested")
def list_suggested_placements(_: Admin = Depends(get_current_admin)):
    """admin UI 의 placement 선택용 추천 키 목록. 사용자가 자유 입력도 가능."""
    return {"suggested": SUGGESTED_PLACEMENTS}


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
    _validate_aspect_ratio(body.aspect_ratio)
    _validate_delay(body.delay_seconds)
    slug = _validate_slug(body.slug)
    _check_slug_unique(db, slug)
    group = BannerGroup(
        name=body.name.strip(),
        slug=slug,
        placement=body.placement,
        is_active=body.is_active,
        sort_order=body.sort_order,
        transition=body.transition,
        aspect_ratio=body.aspect_ratio,
        delay_seconds=body.delay_seconds,
        show_caption_overlay=body.show_caption_overlay,
        start_at=body.start_at,
        end_at=body.end_at,
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
    # slug 은 명시적 None (slug 해제) 도 허용 — model_fields_set 으로 set 여부 판정
    _provided_fields = body.model_fields_set
    if "slug" in _provided_fields:
        slug = _validate_slug(body.slug)
        _check_slug_unique(db, slug, exclude_id=group_id)
        group.slug = slug
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
    if body.aspect_ratio is not None:
        _validate_aspect_ratio(body.aspect_ratio)
        group.aspect_ratio = body.aspect_ratio
    if body.delay_seconds is not None:
        _validate_delay(body.delay_seconds)
        group.delay_seconds = body.delay_seconds
    if body.show_caption_overlay is not None:
        group.show_caption_overlay = body.show_caption_overlay
    # start_at·end_at 은 명시적 None (기간 해제) 도 허용 — model_fields_set 으로 set 여부 판정
    _provided = body.model_fields_set
    if "start_at" in _provided:
        group.start_at = body.start_at
    if "end_at" in _provided:
        group.end_at = body.end_at
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
