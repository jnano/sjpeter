import os
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Body
from sqlalchemy.orm import Session
from sqlalchemy import asc
from pydantic import BaseModel

from app.core.database import get_db
from app.core.auth import get_current_admin
from app.models.admin import Admin
from app.models.menu import MenuGroup, MenuItem
from app.models.content import CommunityGroup
from app.models.board import Board

router = APIRouter(prefix="/menus", tags=["menus"])


def _sync_boards_menu(db: Session) -> None:
    """show_in_menu=True인 board들을 menu_items에 자동 동기화.

    - 신규 board → 'board' 그룹에 menu_item 자동 추가 (없으면 첫 그룹)
    - show_in_menu=False 또는 board 삭제 → 대응 menu_item is_active=False
    - 라벨은 admin이 수정했을 가능성 있으니 최초 생성 시에만 board.name 사용
    - href는 slug 변경 시 자동 갱신 (URL은 자동으로 따라가야 함)
    """
    default_group = (
        db.query(MenuGroup).filter(MenuGroup.key == "board").first()
        or db.query(MenuGroup).order_by(MenuGroup.sort_order, MenuGroup.id).first()
    )
    if not default_group:
        return

    visible_boards = db.query(Board).filter(Board.show_in_menu == True, Board.is_active == True).all()  # noqa: E712
    visible_slugs = {b.slug for b in visible_boards}

    # 기존 auto:boards menu_items
    existing = {
        it.source_id: it
        for it in db.query(MenuItem).filter(MenuItem.source_type == "auto:boards").all()
    }

    # 새 board → menu_item 추가, 기존은 href만 갱신
    for b in visible_boards:
        if b.slug in existing:
            it = existing[b.slug]
            new_href = f"/boards/{b.slug}"
            if it.href != new_href:
                it.href = new_href  # slug 변경 따라가기
            if not it.is_active:
                it.is_active = True
        else:
            db.add(MenuItem(
                group_id=default_group.id,
                label=b.name,
                href=f"/boards/{b.slug}",
                source_type="auto:boards",
                source_id=b.slug,
                sort_order=999,
                is_active=True,
            ))

    # 숨김 처리된 board → menu_item 비활성
    for slug, it in existing.items():
        if slug not in visible_slugs:
            it.is_active = False

    db.commit()


def _sync_groups_children(db: Session) -> None:
    """'분과와 단체' menu_item 자식들을 community_groups(top-level + slug)에서 자동 동기화.

    - 신규 분과 → 자식 menu_item 자동 추가
    - 분과 slug 변경/삭제 → 대응 item is_active=False (admin 결정 보존)
    - 라벨은 admin이 한 번이라도 수정했으면 보존 (현재는 신규일 때만 분과명 그대로)
    """
    parent = db.query(MenuItem).filter(MenuItem.href == "/groups", MenuItem.parent_id.is_(None)).first()
    if not parent:
        return  # /groups 항목이 없으면 sync 안 함
    community = db.query(CommunityGroup).filter(
        CommunityGroup.parent_id.is_(None),
        CommunityGroup.slug.isnot(None),
    ).order_by(CommunityGroup.sort_order, CommunityGroup.id).all()

    existing_by_slug = {
        it.source_id: it
        for it in db.query(MenuItem).filter(
            MenuItem.parent_id == parent.id,
            MenuItem.source_type == "auto:groups",
        ).all()
    }

    seen_slugs = set()
    for i, cg in enumerate(community):
        seen_slugs.add(cg.slug)
        if cg.slug in existing_by_slug:
            it = existing_by_slug[cg.slug]
            if not it.is_active:
                it.is_active = True  # 다시 등장하면 활성화
            # 정렬 순서만 유지 (라벨은 admin이 수정했을 수 있으니 건드리지 않음)
            it.sort_order = i + 1  # 0은 '전체 보기' 자리
        else:
            db.add(MenuItem(
                group_id=parent.group_id,
                parent_id=parent.id,
                label=cg.name,
                href=f"/groups/{cg.slug}",
                source_type="auto:groups",
                source_id=cg.slug,
                sort_order=i + 1,
                is_active=True,
            ))

    # 삭제된 분과 → 자동 비활성
    for slug, it in existing_by_slug.items():
        if slug not in seen_slugs:
            it.is_active = False

    db.commit()


# ─── Schemas ──────────────────────────────────────────────

class MenuItemIn(BaseModel):
    label: str
    href: str
    is_external: bool = False
    sort_order: int = 0
    is_active: bool = True
    source_type: str = "manual"
    source_id: Optional[str] = None
    parent_id: Optional[int] = None


class MenuItemOut(MenuItemIn):
    id: int
    group_id: int
    children: list["MenuItemOut"] = []

    class Config:
        from_attributes = True


MenuItemOut.model_rebuild()


def _to_tree(items: list[MenuItem]) -> list[MenuItemOut]:
    """평평한 menu_item 리스트를 parent_id 트리로 변환."""
    by_id: dict[int, MenuItemOut] = {it.id: MenuItemOut.model_validate(it) for it in items}
    # children 초기화
    for out in by_id.values():
        out.children = []
    roots: list[MenuItemOut] = []
    for it in items:
        if it.parent_id and it.parent_id in by_id:
            by_id[it.parent_id].children.append(by_id[it.id])
        else:
            roots.append(by_id[it.id])
    # 자식들 정렬
    def sort_recursive(nodes: list[MenuItemOut]) -> None:
        nodes.sort(key=lambda n: (n.sort_order, n.id))
        for n in nodes:
            sort_recursive(n.children)
    sort_recursive(roots)
    return roots


class MenuGroupIn(BaseModel):
    key: str
    label: str
    subtitle: Optional[str] = None
    icon: Optional[str] = None
    sidebar_image_url: Optional[str] = None
    sidebar_width_px: int = 220
    sort_order: int = 0
    is_active: bool = True
    show_in_header: bool = True


class MenuGroupOut(MenuGroupIn):
    id: int
    items: list[MenuItemOut] = []

    class Config:
        from_attributes = True


# ─── Public: 활성 항목만 ──────────────────────────────────

@router.get("/public", response_model=list[MenuGroupOut])
def list_public_menus(db: Session = Depends(get_db)):
    _sync_groups_children(db)
    _sync_boards_menu(db)
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
        out.items = _to_tree(items)
        result.append(out)
    return result


# ─── Admin: 모든 항목 (비활성 포함) ───────────────────────

@router.get("/admin/all", response_model=list[MenuGroupOut])
def list_admin_menus(db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    _sync_groups_children(db)
    _sync_boards_menu(db)
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
        out.items = _to_tree(items)
        result.append(out)
    return result


# ─── Group CRUD ──────────────────────────────────────────

class ReorderIn(BaseModel):
    ids: list[int]


def _renumber_groups(db: Session) -> None:
    """모든 그룹의 sort_order를 0,1,2,...로 재정규화."""
    rows = db.query(MenuGroup).order_by(MenuGroup.sort_order, MenuGroup.id).all()
    for i, g in enumerate(rows):
        if g.sort_order != i:
            g.sort_order = i
    db.commit()


def _renumber_items(db: Session, group_id: int) -> None:
    """그룹 내 같은 parent의 형제끼리 sort_order 0,1,2,...로 재정규화."""
    # parent 별로 그룹화
    items = db.query(MenuItem).filter(MenuItem.group_id == group_id).order_by(MenuItem.sort_order, MenuItem.id).all()
    by_parent: dict[Optional[int], list[MenuItem]] = {}
    for it in items:
        by_parent.setdefault(it.parent_id, []).append(it)
    for siblings in by_parent.values():
        for i, it in enumerate(siblings):
            if it.sort_order != i:
                it.sort_order = i
    db.commit()


@router.post("/groups", response_model=MenuGroupOut)
def create_group(body: MenuGroupIn, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    if db.query(MenuGroup).filter(MenuGroup.key == body.key).first():
        raise HTTPException(status_code=400, detail="이미 사용 중인 그룹 key입니다.")
    # 새 그룹은 항상 마지막에 — 기존 그룹 수를 sort_order로
    body_data = body.model_dump()
    body_data["sort_order"] = db.query(MenuGroup).count()
    g = MenuGroup(**body_data)
    db.add(g)
    db.commit()
    _renumber_groups(db)
    db.refresh(g)
    return MenuGroupOut.model_validate(g)


# /groups/reorder는 /groups/{group_id}보다 먼저 정의해야 FastAPI 라우트 매칭 우선순위에서 잡힘
@router.put("/groups/reorder")
def reorder_groups(body: ReorderIn, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    for i, gid in enumerate(body.ids):
        db.query(MenuGroup).filter(MenuGroup.id == gid).update({"sort_order": i})
    db.commit()
    _renumber_groups(db)
    return {"ok": True}


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
    _renumber_groups(db)
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
def reorder_items(group_id: int, body: ReorderIn, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    for i, item_id in enumerate(body.ids):
        db.query(MenuItem).filter(MenuItem.id == item_id, MenuItem.group_id == group_id).update({"sort_order": i})
    db.commit()
    _renumber_items(db, group_id)
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
