import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
from app.core.database import get_db
from app.core.auth import get_current_admin
from app.core.config import settings
from app.models.content import HistoryItem, Vision, CommunityGroup, StaticPage, Meditation, CouncilMember
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
    is_current: bool = False


class VisionOut(BaseModel):
    id: int
    year: int
    motto: str
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
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MeditationListOut(BaseModel):
    items: list[MeditationOut]
    total: int


@router.get("/meditations/current", response_model=Optional[MeditationOut])
def get_current_meditation(db: Session = Depends(get_db)):
    item = (
        db.query(Meditation)
        .filter(Meditation.is_published == True)
        .order_by(desc(Meditation.published_date), desc(Meditation.id))
        .first()
    )
    return item


@router.get("/meditations", response_model=MeditationListOut)
def list_meditations(page: int = 1, limit: int = 12, db: Session = Depends(get_db)):
    q = db.query(Meditation).filter(Meditation.is_published == True)
    total = q.count()
    items = (
        q.order_by(desc(Meditation.published_date), desc(Meditation.id))
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return {"items": items, "total": total}


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


@router.delete("/meditations/{item_id}", status_code=204)
def delete_meditation(item_id: int, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    item = db.query(Meditation).filter(Meditation.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="묵상을 찾을 수 없습니다.")
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
