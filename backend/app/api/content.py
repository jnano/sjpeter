import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc, or_, and_
from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
from app.core.database import get_db
from app.core.auth import get_current_admin
from app.core.config import settings
from app.models.content import HistoryItem, Vision, CommunityGroup, StaticPage, Meditation, CouncilMember, Prayer
from app.models.admin import Admin

_PHOTO_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
_PHOTO_MAX = 10 * 1024 * 1024

router = APIRouter(prefix="/content", tags=["content"])


# ─── History ───────────────────────────────────────────────

class HistoryItemIn(BaseModel):
    year: int
    event: str
    detail: Optional[str] = None
    highlight: bool = False
    is_current: bool = False
    sort_order: int = 0


class HistoryItemOut(BaseModel):
    id: int
    year: int
    event: str
    detail: Optional[str]
    highlight: bool
    is_current: bool
    sort_order: int

    class Config:
        from_attributes = True


@router.get("/history", response_model=list[HistoryItemOut])
def list_history(db: Session = Depends(get_db)):
    return db.query(HistoryItem).order_by(HistoryItem.year.desc(), HistoryItem.sort_order).all()


@router.post("/history", response_model=HistoryItemOut)
def create_history(body: HistoryItemIn, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    item = HistoryItem(**body.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/history/{item_id}", response_model=HistoryItemOut)
def update_history(item_id: int, body: HistoryItemIn, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    item = db.query(HistoryItem).filter(HistoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="항목을 찾을 수 없습니다.")
    for k, v in body.model_dump().items():
        setattr(item, k, v)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/history/{item_id}")
def delete_history(item_id: int, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    item = db.query(HistoryItem).filter(HistoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="항목을 찾을 수 없습니다.")
    db.delete(item)
    db.commit()
    return {"ok": True}


# ─── Vision ────────────────────────────────────────────────

class VisionIn(BaseModel):
    year: int
    motto: str
    body: Optional[str] = None
    is_current: bool = False


class VisionOut(BaseModel):
    id: int
    year: int
    motto: str
    body: Optional[str] = None
    is_current: bool

    class Config:
        from_attributes = True


@router.get("/visions", response_model=list[VisionOut])
def list_visions(db: Session = Depends(get_db)):
    return db.query(Vision).order_by(Vision.year.desc()).all()


@router.post("/visions", response_model=VisionOut)
def create_vision(body: VisionIn, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    vision = Vision(**body.model_dump())
    db.add(vision)
    db.commit()
    db.refresh(vision)
    return vision


@router.put("/visions/{vision_id}", response_model=VisionOut)
def update_vision(vision_id: int, body: VisionIn, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    vision = db.query(Vision).filter(Vision.id == vision_id).first()
    if not vision:
        raise HTTPException(status_code=404, detail="항목을 찾을 수 없습니다.")
    for k, v in body.model_dump().items():
        setattr(vision, k, v)
    db.commit()
    db.refresh(vision)
    return vision


@router.delete("/visions/{vision_id}")
def delete_vision(vision_id: int, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    vision = db.query(Vision).filter(Vision.id == vision_id).first()
    if not vision:
        raise HTTPException(status_code=404, detail="항목을 찾을 수 없습니다.")
    db.delete(vision)
    db.commit()
    return {"ok": True}


# ─── Community Groups ───────────────────────────────────────

class CommunityGroupIn(BaseModel):
    name: str
    description: Optional[str] = None
    activity_time: Optional[str] = None
    link_url: Optional[str] = None
    board_slug: Optional[str] = None
    sort_order: int = 0
    parent_id: Optional[int] = None
    slug: Optional[str] = None
    activities: Optional[str] = None
    photo_display_mode: Optional[str] = "slideshow"


class CommunityGroupOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    activity_time: Optional[str]
    link_url: Optional[str]
    board_slug: Optional[str]
    sort_order: int
    parent_id: Optional[int] = None
    slug: Optional[str] = None
    activities: Optional[str] = None
    photo_urls: Optional[list[str]] = None
    photo_display_mode: Optional[str] = "slideshow"
    representative_photo_url: Optional[str] = None  # 카드 썸네일 (원형 이미지)

    class Config:
        from_attributes = True


@router.get("/community", response_model=list[CommunityGroupOut])
def list_community(db: Session = Depends(get_db)):
    return db.query(CommunityGroup).order_by(CommunityGroup.sort_order, CommunityGroup.id).all()


@router.get("/community/slug/{slug}", response_model=CommunityGroupOut)
def get_community_by_slug(slug: str, db: Session = Depends(get_db)):
    group = db.query(CommunityGroup).filter(CommunityGroup.slug == slug).first()
    if not group:
        raise HTTPException(status_code=404, detail="분과를 찾을 수 없습니다.")
    return group


@router.post("/community", response_model=CommunityGroupOut)
def create_community(body: CommunityGroupIn, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    if body.slug:
        existing = db.query(CommunityGroup).filter(CommunityGroup.slug == body.slug).first()
        if existing:
            raise HTTPException(status_code=400, detail="이미 사용 중인 슬러그입니다.")
    group = CommunityGroup(**body.model_dump())
    db.add(group)
    db.commit()
    db.refresh(group)
    return group


@router.put("/community/{group_id}", response_model=CommunityGroupOut)
def update_community(group_id: int, body: CommunityGroupIn, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    group = db.query(CommunityGroup).filter(CommunityGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="항목을 찾을 수 없습니다.")
    if body.slug and body.slug != group.slug:
        existing = db.query(CommunityGroup).filter(CommunityGroup.slug == body.slug, CommunityGroup.id != group_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="이미 사용 중인 슬러그입니다.")
    if body.parent_id == group_id:
        raise HTTPException(status_code=400, detail="자기 자신을 부모로 지정할 수 없습니다.")
    for k, v in body.model_dump().items():
        setattr(group, k, v)
    db.commit()
    db.refresh(group)
    return group


@router.delete("/community/{group_id}")
def delete_community(group_id: int, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    group = db.query(CommunityGroup).filter(CommunityGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="항목을 찾을 수 없습니다.")
    db.delete(group)
    db.commit()
    return {"ok": True}


@router.post("/community/{group_id}/representative-photo", response_model=CommunityGroupOut)
def upload_community_representative_photo(
    group_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    """단일 대표 이미지(카드 썸네일) 업로드. 기존 대표사진이 있으면 교체 + 파일 정리."""
    group = db.query(CommunityGroup).filter(CommunityGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="항목을 찾을 수 없습니다.")
    ext = os.path.splitext(file.filename or "")[1].lower() or ".jpg"
    if ext not in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
        raise HTTPException(status_code=400, detail="이미지 파일만 업로드 가능합니다.")
    folder = f"uploads/community/{group_id}"
    os.makedirs(folder, exist_ok=True)
    fname = f"rep_{uuid.uuid4().hex}{ext}"
    path = os.path.join(folder, fname)
    with open(path, "wb") as f:
        f.write(file.file.read())
    # 기존 대표사진 파일 정리
    old = group.representative_photo_url
    if old and old.startswith("/uploads/"):
        old_path = old.lstrip("/")
        try:
            if os.path.isfile(old_path):
                os.remove(old_path)
        except Exception:
            pass
    group.representative_photo_url = f"/{path}"
    db.commit()
    db.refresh(group)
    return group


@router.delete("/community/{group_id}/representative-photo", response_model=CommunityGroupOut)
def delete_community_representative_photo(
    group_id: int,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    group = db.query(CommunityGroup).filter(CommunityGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="항목을 찾을 수 없습니다.")
    old = group.representative_photo_url
    if old and old.startswith("/uploads/"):
        old_path = old.lstrip("/")
        try:
            if os.path.isfile(old_path):
                os.remove(old_path)
        except Exception:
            pass
    group.representative_photo_url = None
    db.commit()
    db.refresh(group)
    return group


@router.post("/community/{group_id}/photos", response_model=CommunityGroupOut)
def upload_community_photo(
    group_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    group = db.query(CommunityGroup).filter(CommunityGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="항목을 찾을 수 없습니다.")
    ext = os.path.splitext(file.filename or "")[1].lower() or ".jpg"
    if ext not in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
        raise HTTPException(status_code=400, detail="이미지 파일만 업로드 가능합니다.")
    folder = f"uploads/community/{group_id}"
    os.makedirs(folder, exist_ok=True)
    fname = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(folder, fname)
    with open(path, "wb") as f:
        f.write(file.file.read())
    url = f"/{path}"
    urls = list(group.photo_urls or [])
    urls.append(url)
    group.photo_urls = urls
    db.commit()
    db.refresh(group)
    return group


@router.delete("/community/{group_id}/photos")
def delete_community_photo(
    group_id: int,
    url: str,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    group = db.query(CommunityGroup).filter(CommunityGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="항목을 찾을 수 없습니다.")
    urls = list(group.photo_urls or [])
    if url in urls:
        urls.remove(url)
        group.photo_urls = urls
        db.commit()
        # 물리 파일 정리 (best-effort)
        path = url.lstrip("/")
        if os.path.isfile(path):
            try:
                os.remove(path)
            except Exception:
                pass
    return {"ok": True}


# ─── Static Pages ─────────────────────────────────────────

class StaticPageOut(BaseModel):
    slug: str
    title: str
    subtitle: Optional[str]
    body: Optional[str]

    class Config:
        from_attributes = True


class StaticPageIn(BaseModel):
    title: str
    subtitle: Optional[str] = None
    body: Optional[str] = None


@router.get("/pages", response_model=list[StaticPageOut])
def list_static_pages(db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    return db.query(StaticPage).order_by(StaticPage.slug).all()


@router.get("/pages/{slug}", response_model=StaticPageOut)
def get_static_page(slug: str, db: Session = Depends(get_db)):
    page = db.query(StaticPage).filter_by(slug=slug).first()
    if not page:
        raise HTTPException(status_code=404, detail="페이지를 찾을 수 없습니다.")
    return page


@router.put("/pages/{slug}", response_model=StaticPageOut)
def update_static_page(slug: str, body: StaticPageIn, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    page = db.query(StaticPage).filter_by(slug=slug).first()
    if not page:
        raise HTTPException(status_code=404, detail="페이지를 찾을 수 없습니다.")
    page.title = body.title
    page.subtitle = body.subtitle
    page.body = body.body
    db.commit()
    db.refresh(page)
    return page


# ─── Meditation ────────────────────────────────────────────

_VALID_BG_POSITIONS = {
    "top-left", "top-center", "top-right",
    "bottom-left", "bottom-center", "bottom-right",
}
_VALID_BG_GRADIENTS = {"none", "top", "bottom", "left", "right"}


class MeditationIn(BaseModel):
    title: str
    scripture: Optional[str] = None
    body: str
    author: Optional[str] = None
    published_date: date
    is_published: bool = True


class MeditationOut(BaseModel):
    id: int
    title: str
    scripture: Optional[str]
    body: str
    author: Optional[str]
    published_date: date
    is_published: bool
    is_current: bool = False
    background_image_url: Optional[str] = None
    background_repeat: bool = False
    background_position: str = "top-left"
    background_blur: int = 0
    background_opacity: int = 100
    background_gradient: str = "none"
    background_gradient_size: int = 100
    body_font_size_px: int = 15
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MeditationListOut(BaseModel):
    items: list[MeditationOut]
    total: int


class MeditationBackgroundIn(BaseModel):
    """배경·표시 옵션 업데이트 (이미지 URL 제외 — 업로드 엔드포인트로 처리)."""
    background_repeat: bool = False
    background_position: str = "top-left"
    background_blur: int = 0
    background_opacity: int = 100
    background_gradient: str = "none"
    background_gradient_size: int = 100
    body_font_size_px: int = 15


@router.get("/meditations/current", response_model=Optional[MeditationOut])
def get_current_meditation(db: Session = Depends(get_db)):
    """공개용 대표 묵상.

    - is_current=TRUE 인 항목이 있으면 그것을 반환
    - 없으면 발행일이 가장 최신인 공개 묵상을 반환 (백업 동작)
    """
    item = (
        db.query(Meditation)
        .filter(Meditation.is_published == True, Meditation.is_current == True)
        .order_by(desc(Meditation.id))
        .first()
    )
    if item:
        return item
    return (
        db.query(Meditation)
        .filter(Meditation.is_published == True)
        .order_by(desc(Meditation.published_date), desc(Meditation.id))
        .first()
    )


@router.get("/meditations", response_model=MeditationListOut)
def list_meditations(
    page: int = 1,
    limit: int = 12,
    q: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Meditation).filter(Meditation.is_published == True)
    if q:
        # 공백 무시 + 4컬럼 ILIKE 부분일치
        kw = q.strip()
        if kw:
            pattern = f"%{kw}%"
            query = query.filter(
                or_(
                    Meditation.title.ilike(pattern),
                    Meditation.body.ilike(pattern),
                    Meditation.scripture.ilike(pattern),
                    Meditation.author.ilike(pattern),
                )
            )
    total = query.count()
    items = (
        query.order_by(desc(Meditation.published_date), desc(Meditation.id))
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return {"items": items, "total": total}


class MeditationNeighborOut(BaseModel):
    id: int
    title: str


class MeditationNeighborsOut(BaseModel):
    prev: Optional[MeditationNeighborOut] = None  # 화살표 ← (목록상 앞 항목 = 더 최근 글)
    next: Optional[MeditationNeighborOut] = None  # 화살표 → (목록상 뒤 항목 = 더 옛날 글)


@router.get("/meditations/{item_id}/neighbors", response_model=MeditationNeighborsOut)
def get_meditation_neighbors(item_id: int, db: Session = Depends(get_db)):
    """현재 묵상의 목록 인접 항목.

    목록은 published_date DESC, id DESC 순으로 정렬되므로:
    - prev (←, 목록 위) = 더 최근 발행 글
    - next (→, 목록 아래) = 더 옛날 발행 글
    """
    current = (
        db.query(Meditation)
        .filter(Meditation.id == item_id, Meditation.is_published == True)
        .first()
    )
    if not current:
        raise HTTPException(status_code=404, detail="묵상을 찾을 수 없습니다.")

    prev = (
        db.query(Meditation)
        .filter(
            Meditation.is_published == True,
            or_(
                Meditation.published_date > current.published_date,
                and_(
                    Meditation.published_date == current.published_date,
                    Meditation.id > current.id,
                ),
            ),
        )
        .order_by(asc(Meditation.published_date), asc(Meditation.id))
        .first()
    )

    next_item = (
        db.query(Meditation)
        .filter(
            Meditation.is_published == True,
            or_(
                Meditation.published_date < current.published_date,
                and_(
                    Meditation.published_date == current.published_date,
                    Meditation.id < current.id,
                ),
            ),
        )
        .order_by(desc(Meditation.published_date), desc(Meditation.id))
        .first()
    )

    return {
        "prev": {"id": prev.id, "title": prev.title} if prev else None,
        "next": {"id": next_item.id, "title": next_item.title} if next_item else None,
    }


@router.get("/meditations/admin", response_model=MeditationListOut)
def list_meditations_admin(page: int = 1, limit: int = 20, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    total = db.query(Meditation).count()
    items = (
        db.query(Meditation)
        .order_by(desc(Meditation.published_date), desc(Meditation.id))
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return {"items": items, "total": total}


@router.get("/meditations/{item_id}", response_model=MeditationOut)
def get_meditation(item_id: int, db: Session = Depends(get_db)):
    """공개 단일 묵상 조회 (아카이브 상세용).

    이 라우트는 /current, /admin 같은 정적 경로 뒤에 등록되어야 한다 — 그래야
    "/meditations/current" 요청이 item_id=current 로 매칭되어 422 에러가 나지 않음.
    """
    item = (
        db.query(Meditation)
        .filter(Meditation.id == item_id, Meditation.is_published == True)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="묵상 글을 찾을 수 없습니다.")
    return item


@router.post("/meditations", response_model=MeditationOut, status_code=201)
def create_meditation(body: MeditationIn, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    item = Meditation(**body.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/meditations/{item_id}", response_model=MeditationOut)
def update_meditation(item_id: int, body: MeditationIn, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    item = db.query(Meditation).filter(Meditation.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="묵상을 찾을 수 없습니다.")
    for k, v in body.model_dump().items():
        setattr(item, k, v)
    db.commit()
    db.refresh(item)
    return item


@router.post("/meditations/{item_id}/set-current", response_model=MeditationOut)
def set_current_meditation(
    item_id: int,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    """이 묵상을 대표로 지정. 기존 is_current=TRUE 항목은 자동 해제."""
    item = db.query(Meditation).filter(Meditation.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="묵상을 찾을 수 없습니다.")
    # 같은 시점에 단 하나만 대표
    db.query(Meditation).filter(
        Meditation.id != item_id, Meditation.is_current == True,
    ).update({Meditation.is_current: False}, synchronize_session=False)
    item.is_current = True
    db.commit()
    db.refresh(item)
    return item


@router.post("/meditations/clear-current", status_code=204)
def clear_current_meditation(
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    """대표 지정 해제 — 모든 is_current 를 FALSE 로. 이후 자동으로 최신이 노출됨."""
    db.query(Meditation).filter(Meditation.is_current == True).update(
        {Meditation.is_current: False}, synchronize_session=False,
    )
    db.commit()
    return None


@router.put("/meditations/{item_id}/background", response_model=MeditationOut)
def update_meditation_background_options(
    item_id: int,
    body: MeditationBackgroundIn,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    """배경 반복·시작점·흐림 옵션만 갱신 (이미지 파일은 별도 업로드 엔드포인트)."""
    item = db.query(Meditation).filter(Meditation.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="묵상을 찾을 수 없습니다.")
    if body.background_position not in _VALID_BG_POSITIONS:
        raise HTTPException(status_code=400, detail="잘못된 배경 위치 값입니다.")
    if body.background_gradient not in _VALID_BG_GRADIENTS:
        raise HTTPException(status_code=400, detail="잘못된 그라데이션 값입니다.")
    blur = max(0, min(40, int(body.background_blur)))
    opacity = max(0, min(100, int(body.background_opacity)))
    gradient_size = max(10, min(100, int(body.background_gradient_size)))
    font_size = max(12, min(32, int(body.body_font_size_px)))
    item.background_repeat = body.background_repeat
    item.background_position = body.background_position
    item.background_blur = blur
    item.background_opacity = opacity
    item.background_gradient = body.background_gradient
    item.background_gradient_size = gradient_size
    item.body_font_size_px = font_size
    db.commit()
    db.refresh(item)
    return item


@router.post("/meditations/{item_id}/background-image", response_model=MeditationOut)
def upload_meditation_background(
    item_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    """배경 이미지 파일 업로드. 기존 파일이 있으면 덮어쓰지 않고 새 파일을 둔다."""
    from app.core.config import settings as app_settings
    import os, uuid

    item = db.query(Meditation).filter(Meditation.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="묵상을 찾을 수 없습니다.")
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="이미지 파일만 업로드할 수 있습니다.")

    ext = os.path.splitext(file.filename or "bg")[1].lower() or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    save_dir = os.path.join(app_settings.UPLOAD_DIR, "meditation-bg")
    os.makedirs(save_dir, exist_ok=True)
    save_path = os.path.join(save_dir, filename)
    with open(save_path, "wb") as f:
        f.write(file.file.read())

    item.background_image_url = f"/uploads/meditation-bg/{filename}"
    db.commit()
    db.refresh(item)
    return item


@router.delete("/meditations/{item_id}/background-image", response_model=MeditationOut)
def delete_meditation_background(
    item_id: int,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    """배경 이미지 제거 (DB 의 URL 만 비움 — 파일은 정리하지 않음)."""
    item = db.query(Meditation).filter(Meditation.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="묵상을 찾을 수 없습니다.")
    item.background_image_url = None
    db.commit()
    db.refresh(item)
    return item


@router.delete("/meditations/{item_id}", status_code=204)
def delete_meditation(item_id: int, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    item = db.query(Meditation).filter(Meditation.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="묵상을 찾을 수 없습니다.")
    db.delete(item)
    db.commit()


# ─── Prayer ─────────────────────────────────────────────────

PRAYER_CATEGORIES = ["daily", "mass", "rosary", "liturgy_season", "special", "memorial", "parish"]


class PrayerIn(BaseModel):
    title: str
    category: str = "daily"
    scripture: Optional[str] = None
    body: str
    author: Optional[str] = None
    is_published: bool = True
    display_order: int = 0
    is_featured: bool = False


class PrayerOut(BaseModel):
    id: int
    title: str
    category: str
    scripture: Optional[str]
    body: str
    author: Optional[str]
    is_published: bool
    display_order: int
    is_featured: bool
    background_image_url: Optional[str] = None
    background_repeat: bool = False
    background_position: str = "top-left"
    background_blur: int = 0
    background_opacity: int = 100
    background_gradient: str = "none"
    background_gradient_size: int = 100
    body_font_size_px: int = 15
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PrayerListOut(BaseModel):
    items: list[PrayerOut]
    total: int


class PrayerBackgroundIn(BaseModel):
    background_repeat: bool = False
    background_position: str = "top-left"
    background_blur: int = 0
    background_opacity: int = 100
    background_gradient: str = "none"
    background_gradient_size: int = 100
    body_font_size_px: int = 15


def _validate_prayer_category(cat: str) -> str:
    if cat not in PRAYER_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"카테고리는 {PRAYER_CATEGORIES} 중 하나여야 합니다.")
    return cat


@router.get("/prayers", response_model=PrayerListOut)
def list_prayers(
    page: int = 1,
    limit: int = 20,
    category: Optional[str] = None,
    q: Optional[str] = None,
    featured_only: bool = False,
    db: Session = Depends(get_db),
):
    query = db.query(Prayer).filter(Prayer.is_published == True)
    if category:
        if category not in PRAYER_CATEGORIES:
            raise HTTPException(status_code=400, detail="유효하지 않은 카테고리입니다.")
        query = query.filter(Prayer.category == category)
    if featured_only:
        query = query.filter(Prayer.is_featured == True)
    if q:
        kw = q.strip()
        if kw:
            pattern = f"%{kw}%"
            query = query.filter(
                or_(
                    Prayer.title.ilike(pattern),
                    Prayer.body.ilike(pattern),
                    Prayer.scripture.ilike(pattern),
                    Prayer.author.ilike(pattern),
                )
            )
    total = query.count()
    # 정렬: featured 먼저, 그 다음 display_order ASC, id DESC (최신 등록 순)
    items = (
        query.order_by(desc(Prayer.is_featured), asc(Prayer.display_order), desc(Prayer.id))
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return {"items": items, "total": total}


class PrayerNeighborOut(BaseModel):
    id: int
    title: str


class PrayerNeighborsOut(BaseModel):
    prev: Optional[PrayerNeighborOut] = None
    next: Optional[PrayerNeighborOut] = None


@router.get("/prayers/{item_id}/neighbors", response_model=PrayerNeighborsOut)
def get_prayer_neighbors(item_id: int, db: Session = Depends(get_db)):
    """같은 카테고리 내 인접 항목 (display_order ASC, id DESC 정렬 기준)."""
    current = db.query(Prayer).filter(Prayer.id == item_id, Prayer.is_published == True).first()
    if not current:
        raise HTTPException(status_code=404, detail="기도문을 찾을 수 없습니다.")

    # prev: 같은 카테고리, 목록상 앞 (display_order 작거나 같은 order에서 id 큼)
    prev = (
        db.query(Prayer)
        .filter(
            Prayer.is_published == True,
            Prayer.category == current.category,
            or_(
                Prayer.display_order < current.display_order,
                and_(Prayer.display_order == current.display_order, Prayer.id > current.id),
            ),
        )
        .order_by(desc(Prayer.display_order), asc(Prayer.id))
        .first()
    )
    # next: 같은 카테고리, 목록상 뒤
    next_item = (
        db.query(Prayer)
        .filter(
            Prayer.is_published == True,
            Prayer.category == current.category,
            or_(
                Prayer.display_order > current.display_order,
                and_(Prayer.display_order == current.display_order, Prayer.id < current.id),
            ),
        )
        .order_by(asc(Prayer.display_order), desc(Prayer.id))
        .first()
    )
    return {
        "prev": {"id": prev.id, "title": prev.title} if prev else None,
        "next": {"id": next_item.id, "title": next_item.title} if next_item else None,
    }


@router.get("/prayers/admin", response_model=PrayerListOut)
def list_prayers_admin(
    page: int = 1,
    limit: int = 50,
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    query = db.query(Prayer)
    if category:
        query = query.filter(Prayer.category == category)
    total = query.count()
    items = (
        query.order_by(asc(Prayer.category), asc(Prayer.display_order), desc(Prayer.id))
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return {"items": items, "total": total}


@router.get("/prayers/{item_id}", response_model=PrayerOut)
def get_prayer(item_id: int, db: Session = Depends(get_db)):
    """공개 단일 기도문 조회. /admin, /{id}/neighbors 라우트 뒤에 등록되어야 한다."""
    item = db.query(Prayer).filter(Prayer.id == item_id, Prayer.is_published == True).first()
    if not item:
        raise HTTPException(status_code=404, detail="기도문을 찾을 수 없습니다.")
    return item


@router.post("/prayers", response_model=PrayerOut, status_code=201)
def create_prayer(body: PrayerIn, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    _validate_prayer_category(body.category)
    item = Prayer(**body.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/prayers/{item_id}", response_model=PrayerOut)
def update_prayer(item_id: int, body: PrayerIn, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    _validate_prayer_category(body.category)
    item = db.query(Prayer).filter(Prayer.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="기도문을 찾을 수 없습니다.")
    for k, v in body.model_dump().items():
        setattr(item, k, v)
    db.commit()
    db.refresh(item)
    return item


@router.put("/prayers/{item_id}/background", response_model=PrayerOut)
def update_prayer_background(item_id: int, body: PrayerBackgroundIn, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    item = db.query(Prayer).filter(Prayer.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="기도문을 찾을 수 없습니다.")
    if body.background_position not in _VALID_BG_POSITIONS:
        raise HTTPException(status_code=400, detail="유효하지 않은 배경 위치입니다.")
    if body.background_gradient not in _VALID_BG_GRADIENTS:
        raise HTTPException(status_code=400, detail="유효하지 않은 그라데이션 값입니다.")
    item.background_repeat = body.background_repeat
    item.background_position = body.background_position
    item.background_blur = max(0, min(40, body.background_blur))
    item.background_opacity = max(0, min(100, body.background_opacity))
    item.background_gradient = body.background_gradient
    item.background_gradient_size = max(10, min(100, body.background_gradient_size))
    item.body_font_size_px = max(12, min(32, body.body_font_size_px))
    db.commit()
    db.refresh(item)
    return item


@router.post("/prayers/{item_id}/background-image", response_model=PrayerOut)
def upload_prayer_background(
    item_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    from app.core.config import settings as app_settings
    item = db.query(Prayer).filter(Prayer.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="기도문을 찾을 수 없습니다.")
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="이미지 파일만 업로드할 수 있습니다.")
    ext = os.path.splitext(file.filename or "bg")[1].lower() or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    save_dir = os.path.join(app_settings.UPLOAD_DIR, "prayer-bg")
    os.makedirs(save_dir, exist_ok=True)
    with open(os.path.join(save_dir, filename), "wb") as f:
        f.write(file.file.read())
    item.background_image_url = f"/uploads/prayer-bg/{filename}"
    db.commit()
    db.refresh(item)
    return item


@router.delete("/prayers/{item_id}/background-image", response_model=PrayerOut)
def delete_prayer_background(item_id: int, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    item = db.query(Prayer).filter(Prayer.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="기도문을 찾을 수 없습니다.")
    item.background_image_url = None
    db.commit()
    db.refresh(item)
    return item


@router.delete("/prayers/{item_id}", status_code=204)
def delete_prayer(item_id: int, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    item = db.query(Prayer).filter(Prayer.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="기도문을 찾을 수 없습니다.")
    db.delete(item)
    db.commit()


# ─── Council Members ────────────────────────────────────────

class CouncilMemberIn(BaseModel):
    name: str
    role: str
    category: str
    photo_url: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True


class CouncilMemberOut(BaseModel):
    id: int
    name: str
    role: str
    category: str
    photo_url: Optional[str]
    sort_order: int
    is_active: bool

    class Config:
        from_attributes = True


@router.get("/council", response_model=list[CouncilMemberOut])
def list_council(db: Session = Depends(get_db)):
    return (
        db.query(CouncilMember)
        .filter(CouncilMember.is_active == True)  # noqa: E712
        .order_by(CouncilMember.sort_order, CouncilMember.id)
        .all()
    )


@router.get("/council/admin", response_model=list[CouncilMemberOut])
def list_council_admin(db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    return db.query(CouncilMember).order_by(CouncilMember.sort_order, CouncilMember.id).all()


@router.post("/council", response_model=CouncilMemberOut, status_code=201)
def create_council_member(body: CouncilMemberIn, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    member = CouncilMember(**body.model_dump())
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


@router.post("/council/{member_id}/photo", response_model=CouncilMemberOut)
async def upload_council_photo(
    member_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    member = db.query(CouncilMember).filter(CouncilMember.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in _PHOTO_EXTS:
        raise HTTPException(status_code=400, detail="jpg/png/webp 파일만 업로드 가능합니다.")
    content = await file.read()
    if len(content) > _PHOTO_MAX:
        raise HTTPException(status_code=400, detail="파일 크기는 10MB 이하여야 합니다.")
    filename = f"council_{uuid.uuid4().hex}{ext}"
    path = os.path.join(settings.UPLOAD_DIR, filename)
    with open(path, "wb") as f:
        f.write(content)
    member.photo_url = f"/uploads/{filename}"
    db.commit()
    db.refresh(member)
    return member


@router.put("/council/{member_id}", response_model=CouncilMemberOut)
def update_council_member(member_id: int, body: CouncilMemberIn, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    member = db.query(CouncilMember).filter(CouncilMember.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")
    for k, v in body.model_dump().items():
        setattr(member, k, v)
    db.commit()
    db.refresh(member)
    return member


@router.delete("/council/{member_id}", status_code=204)
def delete_council_member(member_id: int, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    member = db.query(CouncilMember).filter(CouncilMember.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")
    db.delete(member)
    db.commit()
