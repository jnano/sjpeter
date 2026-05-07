from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db
from app.core.auth import get_current_admin
from app.models.content import HistoryItem, Vision, CommunityGroup, StaticPage
from app.models.admin import Admin

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
    sort_order: int = 0


class CommunityGroupOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    activity_time: Optional[str]
    link_url: Optional[str]
    sort_order: int

    class Config:
        from_attributes = True


@router.get("/community", response_model=list[CommunityGroupOut])
def list_community(db: Session = Depends(get_db)):
    return db.query(CommunityGroup).order_by(CommunityGroup.sort_order, CommunityGroup.id).all()


@router.post("/community", response_model=CommunityGroupOut)
def create_community(body: CommunityGroupIn, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
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
