import os
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Body
from sqlalchemy.orm import Session
from sqlalchemy import asc, text
from pydantic import BaseModel

from app.core.database import get_db
from app.core.auth import get_current_admin
from app.models.admin import Admin
from app.models.menu import MenuGroup, MenuItem
from app.models.board import Board
from app.core.static_pages import STATIC_PAGES, STATIC_PAGE_SLUGS, get_label_for_slug

router = APIRouter(prefix="/menus", tags=["menus"])


def _compute_href(item: MenuItem, db: Session) -> str:
    """link_type에 따라 href를 도출. 매 응답 시 호출하여 fresh URL 보장 (slug 변경 대응)."""
    if item.link_type == "board" and item.board_id:
        b = db.query(Board).filter(Board.id == item.board_id).first()
        return f"/boards/{b.slug}" if b else item.href or ""
    if item.link_type == "external":
        return item.external_url or item.href or ""
    if item.link_type == "page":
        return item.static_page_slug or item.href or ""
    return item.href or ""


def _compute_label(item: MenuItem, db: Session) -> str:
    """label_override=True면 admin 저장값. False면 source에서 자동."""
    if item.label_override or not item.label or item.label.strip() == "":
        if item.label and item.label.strip():
            return item.label
    # auto 라벨
    if item.link_type == "board" and item.board_id:
        b = db.query(Board).filter(Board.id == item.board_id).first()
        if b:
            return b.name
    if item.link_type == "page" and item.static_page_slug:
        lab = get_label_for_slug(item.static_page_slug)
        if lab:
            return lab
    return item.label or ""


# ─── Schemas ──────────────────────────────────────────────

class MenuItemIn(BaseModel):
    label: str
    label_override: bool = True
    sort_order: int = 0
    is_active: bool = True
    parent_id: Optional[int] = None
    # 연결 종류 + 종류별 참조
    link_type: str = "external"  # 'page' | 'board' | 'external'
    static_page_slug: Optional[str] = None
    board_id: Optional[int] = None
    external_url: Optional[str] = None


class MenuItemOut(BaseModel):
    id: int
    group_id: int
    parent_id: Optional[int] = None
    label: str
    label_override: bool = True
    sort_order: int = 0
    is_active: bool = True
    link_type: str = "external"
    static_page_slug: Optional[str] = None
    board_id: Optional[int] = None
    external_url: Optional[str] = None
    # 호환성 응답 필드 (자동 계산)
    href: str = ""
    is_external: bool = False
    children: list["MenuItemOut"] = []

    class Config:
        from_attributes = True


MenuItemOut.model_rebuild()


def _validate_and_apply_link(body: "MenuItemIn", db: Session, item_id: Optional[int] = None) -> dict:
    """link_type ↔ 참조 필드 정합성 검증 + 유일성 체크 + 저장에 쓸 dict 반환.

    item_id가 주어지면 update 모드 — 자기 자신은 유일성 검사에서 제외.
    """
    lt = (body.link_type or "external").strip()
    if lt not in ("page", "board", "external"):
        raise HTTPException(status_code=400, detail="link_type은 page/board/external 중 하나여야 합니다.")

    # link_type에 따른 참조 필드 정리
    static_slug = None
    board_id = None
    external_url = None
    href = ""

    if lt == "page":
        if not body.static_page_slug:
            raise HTTPException(status_code=400, detail="page 연결은 static_page_slug가 필요합니다.")
        static_slug = body.static_page_slug.strip()
        # 화이트리스트 OR 동적 경로(/groups/{slug}, /boards/{slug} 등) 자유 입력 허용
        # 단, 외부 URL은 거부 — 그건 external 타입
        if static_slug.startswith("http://") or static_slug.startswith("https://"):
            raise HTTPException(status_code=400, detail="외부 URL은 external 타입으로 등록하세요.")
        if not static_slug.startswith("/"):
            raise HTTPException(status_code=400, detail="내부 페이지 경로는 '/'로 시작해야 합니다.")
        # 유일성: 같은 slug를 가진 다른 menu_item이 없어야 함
        q = db.query(MenuItem).filter(MenuItem.static_page_slug == static_slug)
        if item_id is not None:
            q = q.filter(MenuItem.id != item_id)
        if q.first():
            raise HTTPException(status_code=400, detail=f"이미 '{static_slug}'에 연결된 메뉴 항목이 있습니다.")
        href = static_slug

    elif lt == "board":
        if not body.board_id:
            raise HTTPException(status_code=400, detail="board 연결은 board_id가 필요합니다.")
        b = db.query(Board).filter(Board.id == body.board_id).first()
        if not b:
            raise HTTPException(status_code=404, detail="해당 게시판을 찾을 수 없습니다.")
        board_id = b.id
        q = db.query(MenuItem).filter(MenuItem.board_id == board_id)
        if item_id is not None:
            q = q.filter(MenuItem.id != item_id)
        if q.first():
            raise HTTPException(status_code=400, detail=f"'{b.name}' 게시판은 이미 다른 메뉴 항목에 연결되어 있습니다.")
        href = f"/boards/{b.slug}"

    else:  # external
        if not body.external_url:
            raise HTTPException(status_code=400, detail="external 연결은 external_url이 필요합니다.")
        external_url = body.external_url.strip()
        # external은 중복 허용 (같은 외부 사이트를 여러 위치에서 가리킬 수 있음)
        href = external_url

    return {
        "label": body.label,
        "label_override": body.label_override,
        "sort_order": body.sort_order,
        "is_active": body.is_active,
        "parent_id": body.parent_id,
        "link_type": lt,
        "static_page_slug": static_slug,
        "board_id": board_id,
        "external_url": external_url,
        "href": href,
        "is_external": lt == "external",
    }


def _build_item_out(item: MenuItem, db: Session) -> MenuItemOut:
    """MenuItem → MenuItemOut, href/is_external/label 자동 계산."""
    out = MenuItemOut.model_validate(item)
    out.href = _compute_href(item, db)
    out.is_external = item.link_type == "external"
    out.label = _compute_label(item, db)
    return out


def _to_tree(items: list[MenuItem], db: Session) -> list[MenuItemOut]:
    """평평한 menu_item 리스트를 parent_id 트리로 변환 + href/label 자동 계산."""
    by_id: dict[int, MenuItemOut] = {it.id: _build_item_out(it, db) for it in items}
    for out in by_id.values():
        out.children = []
    roots: list[MenuItemOut] = []
    for it in items:
        if it.parent_id and it.parent_id in by_id:
            by_id[it.parent_id].children.append(by_id[it.id])
        else:
            roots.append(by_id[it.id])
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


# ─── 메타: admin UI용 옵션 데이터 ─────────────────────────

@router.get("/static-pages")
def list_static_pages(_: Admin = Depends(get_current_admin)):
    """admin 메뉴 편집기에서 'page' 연결 시 드롭다운에 표시할 화이트리스트."""
    return STATIC_PAGES


@router.get("/boards-list")
def list_boards_for_menu(db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    """admin 메뉴 편집기에서 'board' 연결 시 드롭다운에 표시할 게시판 목록.

    각 게시판이 이미 다른 menu_item에 연결되어 있는지(linked_item_id)도 함께 알려줌.
    """
    boards = db.query(Board).filter(Board.is_active == True).order_by(Board.sort_order, Board.id).all()  # noqa: E712
    linked = {
        b_id: mid
        for (b_id, mid) in db.execute(
            text("SELECT board_id, MIN(id) FROM menu_items WHERE board_id IS NOT NULL GROUP BY board_id")
        ).fetchall()
    }
    return [
        {
            "id": b.id,
            "slug": b.slug,
            "name": b.name,
            "linked_item_id": linked.get(b.id),
        }
        for b in boards
    ]


# ─── Public: 활성 항목만 ──────────────────────────────────

@router.get("/public", response_model=list[MenuGroupOut])
def list_public_menus(db: Session = Depends(get_db)):
    groups =(
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
        out.items = _to_tree(items, db)
        result.append(out)
    return result


# ─── Admin: 모든 항목 (비활성 포함) ───────────────────────

@router.get("/admin/all", response_model=list[MenuGroupOut])
def list_admin_menus(db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    groups =db.query(MenuGroup).order_by(asc(MenuGroup.sort_order), asc(MenuGroup.id)).all()
    result = []
    for g in groups:
        items = (
            db.query(MenuItem)
            .filter(MenuItem.group_id == g.id)
            .order_by(asc(MenuItem.sort_order), asc(MenuItem.id))
            .all()
        )
        out = MenuGroupOut.model_validate(g)
        out.items = _to_tree(items, db)
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
    data = _validate_and_apply_link(body, db)
    # 새 항목은 같은 parent의 마지막에 — 형제 수를 sort_order로
    sibling_count = (
        db.query(MenuItem)
        .filter(MenuItem.group_id == group_id, MenuItem.parent_id == data["parent_id"])
        .count()
    )
    data["sort_order"] = sibling_count
    item = MenuItem(group_id=group_id, **data)
    db.add(item)
    db.commit()
    _renumber_items(db, group_id)
    db.refresh(item)
    return _build_item_out(item, db)


@router.put("/items/{item_id}", response_model=MenuItemOut)
def update_item(item_id: int, body: MenuItemIn, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="항목을 찾을 수 없습니다.")
    data = _validate_and_apply_link(body, db, item_id=item_id)
    # sort_order는 reorder 엔드포인트가 담당 — update에서는 건드리지 않음
    data.pop("sort_order", None)
    for k, v in data.items():
        setattr(item, k, v)
    db.commit()
    db.refresh(item)
    return _build_item_out(item, db)


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
