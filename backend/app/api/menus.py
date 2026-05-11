import os
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import asc
from pydantic import BaseModel

from app.core.database import get_db
from app.core.auth import get_current_admin
from app.models.admin import Admin
from app.models.menu import MenuGroup, MenuItem

router = APIRouter(prefix="/menus", tags=["menus"])


# ─── Schemas ──────────────────────────────────────────────

class MenuItemIn(BaseModel):
    label: str
    href: str
    is_external: bool = False
    sort_order: int = 0
    is_active: bool = True
    source_type: str = "manual"
    source_id: Optional[str] = None


class MenuItemOut(MenuItemIn):
    id: int
    group_id: int

    class Config:
        from_attributes = True


class MenuGroupIn(BaseModel):
    key: str
    label: str
    subtitle: Optional[str] = None
    icon: Optional[str] = None
    sidebar_image_url: Optional[str] = None
    sidebar_width_px: int = 220
    sort_order: int = 0
    is_active: bool = True


class MenuGroupOut(MenuGroupIn):
    id: int
    items: list[MenuItemOut] = []

    class Config:
        from_attributes = True


# ─── Public: 활성 항목만 ──────────────────────────────────

@router.get("/public", response_model=list[MenuGroupOut])
def list_public_menus(db: Session = Depends(get_db)):
    groups = (
        db.query(MenuGroup)
        .filter(MenuGroup.is_active == True)  # noqa: E712
        .order_by(asc(MenuGroup.sort_order), asc(MenuGroup.id))
        .all()
    )
    result = []
    for g in groups:
        items = (
            db.query(MenuItem)
            .filter(MenuItem.group_id == g.id, MenuItem.is_active == True)  # noqa: E712
            .order_by(asc(MenuItem.sort_order), asc(MenuItem.id))
            .all()
        )
        out = MenuGroupOut.model_validate(g)
        out.items = [MenuItemOut.model_validate(i) for i in items]
        result.append(out)
    return result


# ─── Admin: 모든 항목 (비활성 포함) ───────────────────────

@router.get("/admin/all", response_model=list[MenuGroupOut])
def list_admin_menus(db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    groups = db.query(MenuGroup).order_by(asc(MenuGroup.sort_order), asc(MenuGroup.id)).all()
    result = []
    for g in groups:
        items = (
            db.query(MenuItem)
            .filter(MenuItem.group_id == g.id)
            .order_by(asc(MenuItem.sort_order), asc(MenuItem.id))
            .all()
        )
        out = MenuGroupOut.model_validate(g)
        out.items = [MenuItemOut.model_validate(i) for i in items]
        result.append(out)
    return result


# ─── Group CRUD ──────────────────────────────────────────

@router.post("/groups", response_model=MenuGroupOut)
def create_group(body: MenuGroupIn, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    if db.query(MenuGroup).filter(MenuGroup.key == body.key).first():
        raise HTTPException(status_code=400, detail="이미 사용 중인 그룹 key입니다.")
    g = MenuGroup(**body.model_dump())
    db.add(g)
    db.commit()
    db.refresh(g)
    return MenuGroupOut.model_validate(g)


@router.put("/groups/{group_id}", response_model=MenuGroupOut)
def update_group(group_id: int, body: MenuGroupIn, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    g = db.query(MenuGroup).filter(MenuGroup.id == group_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="그룹을 찾을 수 없습니다.")
    if body.key != g.key and db.query(MenuGroup).filter(MenuGroup.key == body.key, MenuGroup.id != group_id).first():
        raise HTTPException(status_code=400, detail="이미 사용 중인 그룹 key입니다.")
    for k, v in body.model_dump().items():
        setattr(g, k, v)
    db.commit()
    db.refresh(g)
    return MenuGroupOut.model_validate(g)


@router.delete("/groups/{group_id}")
def delete_group(group_id: int, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    g = db.query(MenuGroup).filter(MenuGroup.id == group_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="그룹을 찾을 수 없습니다.")
    db.delete(g)
    db.commit()
    return {"ok": True}


@router.put("/groups/reorder")
def reorder_groups(ids: list[int], db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    for i, gid in enumerate(ids):
        db.query(MenuGroup).filter(MenuGroup.id == gid).update({"sort_order": i})
    db.commit()
    return {"ok": True}


# ─── Item CRUD ───────────────────────────────────────────

@router.post("/groups/{group_id}/items", response_model=MenuItemOut)
def create_item(group_id: int, body: MenuItemIn, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    if not db.query(MenuGroup).filter(MenuGroup.id == group_id).first():
        raise HTTPException(status_code=404, detail="그룹을 찾을 수 없습니다.")
    item = MenuItem(group_id=group_id, **body.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return MenuItemOut.model_validate(item)


@router.put("/items/{item_id}", response_model=MenuItemOut)
def update_item(item_id: int, body: MenuItemIn, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="항목을 찾을 수 없습니다.")
    for k, v in body.model_dump().items():
        setattr(item, k, v)
    db.commit()
    db.refresh(item)
    return MenuItemOut.model_validate(item)


@router.put("/items/{item_id}/move")
def move_item(item_id: int, group_id: int, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    """항목을 다른 그룹으로 이동."""
    item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="항목을 찾을 수 없습니다.")
    if not db.query(MenuGroup).filter(MenuGroup.id == group_id).first():
        raise HTTPException(status_code=404, detail="대상 그룹을 찾을 수 없습니다.")
    item.group_id = group_id
    db.commit()
    return {"ok": True}


@router.delete("/items/{item_id}")
def delete_item(item_id: int, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="항목을 찾을 수 없습니다.")
    db.delete(item)
    db.commit()
    return {"ok": True}


@router.put("/groups/{group_id}/items/reorder")
def reorder_items(group_id: int, ids: list[int], db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    for i, item_id in enumerate(ids):
        db.query(MenuItem).filter(MenuItem.id == item_id, MenuItem.group_id == group_id).update({"sort_order": i})
    db.commit()
    return {"ok": True}


# ─── 사이드바 이미지 업로드 ───────────────────────────────

@router.post("/groups/{group_id}/sidebar-image", response_model=MenuGroupOut)
def upload_sidebar_image(
    group_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    g = db.query(MenuGroup).filter(MenuGroup.id == group_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="그룹을 찾을 수 없습니다.")
    ext = os.path.splitext(file.filename or "")[1].lower() or ".jpg"
    if ext not in (".jpg", ".jpeg", ".png", ".webp"):
        raise HTTPException(status_code=400, detail="이미지 파일만 업로드 가능합니다.")
    folder = "uploads/menu_groups"
    os.makedirs(folder, exist_ok=True)
    fname = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(folder, fname)
    with open(path, "wb") as f:
        f.write(file.file.read())
    g.sidebar_image_url = f"/{path}"
    db.commit()
    db.refresh(g)
    return MenuGroupOut.model_validate(g)


@router.delete("/groups/{group_id}/sidebar-image")
def delete_sidebar_image(group_id: int, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    g = db.query(MenuGroup).filter(MenuGroup.id == group_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="그룹을 찾을 수 없습니다.")
    if g.sidebar_image_url:
        path = g.sidebar_image_url.lstrip("/")
        if os.path.isfile(path):
            try:
                os.remove(path)
            except Exception:
                pass
    g.sidebar_image_url = None
    db.commit()
    return {"ok": True}
