import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc, or_, and_
from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import date, datetime
from app.core.admin_log import get_admin_identifier, log_action
from app.core.database import get_db
from app.core.auth import get_current_admin
from app.core.config import settings
from app.models.content import HistoryItem, Vision, CommunityGroup, StaticPage, Meditation, CouncilMember, Prayer
from app.models.menu import MenuItem
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
def create_history(body: HistoryItemIn, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    item = HistoryItem(**body.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    log_action(db, get_admin_identifier(admin), "create_history", "history", item.id, getattr(item, "title", None) or getattr(item, "event_date", None))
    return item


@router.put("/history/{item_id}", response_model=HistoryItemOut)
def update_history(item_id: int, body: HistoryItemIn, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    item = db.query(HistoryItem).filter(HistoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="항목을 찾을 수 없습니다.")
    for k, v in body.model_dump().items():
        setattr(item, k, v)
    db.commit()
    db.refresh(item)
    log_action(db, get_admin_identifier(admin), "update_history", "history", item.id, getattr(item, "title", None) or str(getattr(item, "event_date", "")))
    return item


@router.delete("/history/{item_id}")
def delete_history(item_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    item = db.query(HistoryItem).filter(HistoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="항목을 찾을 수 없습니다.")
    snapshot = getattr(item, "title", None) or str(getattr(item, "event_date", ""))
    db.delete(item)
    db.commit()
    log_action(db, get_admin_identifier(admin), "delete_history", "history", item_id, snapshot)
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
def create_vision(
    body: VisionIn,
    notify: bool = Query(False, description="등록 시 수신 동의 회원에게 이메일·사이트 알림 발송"),
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    vision = Vision(**body.model_dump())
    db.add(vision)
    db.commit()
    db.refresh(vision)
    log_action(db, get_admin_identifier(admin), "create_vision", "vision", vision.id, f"{vision.year}: {vision.motto}")
    if notify:
        from app.core.content_notify import fanout_content_notification
        try:
            fanout_content_notification(
                db, kind="vision",
                title=f"{vision.year}년 사목지표: {vision.motto}",
                body_preview=vision.body,
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).error("vision 알림 발송 실패: %s", e)
    return vision


@router.put("/visions/{vision_id}", response_model=VisionOut)
def update_vision(vision_id: int, body: VisionIn, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    vision = db.query(Vision).filter(Vision.id == vision_id).first()
    if not vision:
        raise HTTPException(status_code=404, detail="항목을 찾을 수 없습니다.")
    for k, v in body.model_dump().items():
        setattr(vision, k, v)
    db.commit()
    db.refresh(vision)
    log_action(db, get_admin_identifier(admin), "update_vision", "vision", vision.id, f"{vision.year}: {vision.motto}")
    return vision


@router.delete("/visions/{vision_id}")
def delete_vision(vision_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    vision = db.query(Vision).filter(Vision.id == vision_id).first()
    if not vision:
        raise HTTPException(status_code=404, detail="항목을 찾을 수 없습니다.")
    snapshot = f"{vision.year}: {vision.motto}"
    db.delete(vision)
    db.commit()
    log_action(db, get_admin_identifier(admin), "delete_vision", "vision", vision_id, snapshot)
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

    @field_validator("slug", "link_url", "board_slug", "description", "activity_time", "activities", mode="before")
    @classmethod
    def _empty_to_none(cls, v):
        """빈 문자열을 None 으로 정규화. slug 는 unique index 가 있어 빈 문자열이 여러 행에 못 들어감 (UniqueViolation 회피).
        다른 nullable 필드도 같은 정책으로 일관 처리 — frontend 가 빈 string 보내든 null 보내든 동일하게 저장."""
        if isinstance(v, str) and not v.strip():
            return None
        return v


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
    # 분과(parent_id IS NULL) 의 순서는 /admin/menus 의 menu_items.sort_order 가 단일 출처.
    # menu_items.static_page_slug = '/groups/' || community_groups.slug 로 매칭.
    # 소속 단체(parent_id NOT NULL) 는 자체 sort_order 유지.
    groups = db.query(CommunityGroup).all()

    parent_slugs = [g.slug for g in groups if g.parent_id is None and g.slug]
    menu_orders: dict[str, int] = {}
    if parent_slugs:
        rows = (
            db.query(MenuItem.static_page_slug, MenuItem.sort_order)
            .filter(
                MenuItem.link_type == "page",
                MenuItem.static_page_slug.in_([f"/groups/{s}" for s in parent_slugs]),
            )
            .all()
        )
        for slug, order in rows:
            menu_orders[slug.removeprefix("/groups/")] = order

    def effective_sort(g: CommunityGroup) -> int:
        if g.parent_id is None and g.slug and g.slug in menu_orders:
            return menu_orders[g.slug]
        return g.sort_order

    groups.sort(key=lambda g: (effective_sort(g), g.id))

    # 프론트엔드(어드민·공개)들이 응답의 sort_order 로 재정렬하므로
    # 분과의 sort_order 를 메뉴 기반 effective 값으로 덮어서 반환.
    result = []
    for g in groups:
        out = CommunityGroupOut.model_validate(g)
        if g.parent_id is None:
            out.sort_order = effective_sort(g)
        result.append(out)
    return result


class CommunityPostCountOut(BaseModel):
    id: int
    name: str
    slug: Optional[str]
    parent_id: Optional[int]
    count: int


@router.get("/community/post-counts", response_model=list[CommunityPostCountOut])
def community_post_counts(db: Session = Depends(get_db)):
    """각 분과·단체로 태깅된 posts + events 의 합산 카운트. 태그 클라우드용.

    count = post_community_targets + event_community_targets — 같은 글이 양쪽에 들어가는 일 없음
    (posts/events 는 서로 다른 콘텐츠 종류라 disjoint).
    """
    from sqlalchemy import text as _text
    rows = db.execute(_text(
        "SELECT cg.id, cg.name, cg.slug, cg.parent_id, "
        "       COALESCE(pc.cnt, 0) + COALESCE(ec.cnt, 0) AS cnt "
        "FROM community_groups cg "
        "LEFT JOIN (SELECT community_group_id, COUNT(*) AS cnt FROM post_community_targets GROUP BY community_group_id) pc "
        "  ON pc.community_group_id = cg.id "
        "LEFT JOIN (SELECT community_group_id, COUNT(*) AS cnt FROM event_community_targets GROUP BY community_group_id) ec "
        "  ON ec.community_group_id = cg.id "
        "ORDER BY cnt DESC, cg.sort_order, cg.id"
    )).fetchall()
    return [
        CommunityPostCountOut(id=r.id, name=r.name, slug=r.slug, parent_id=r.parent_id, count=int(r.cnt))
        for r in rows
    ]


class CommunityTaggedItemOut(BaseModel):
    kind: str             # 'post' | 'event'
    id: int
    title: str
    excerpt: Optional[str] = None
    item_date: Optional[date] = None  # event_date 또는 post.created_at::date
    href: str
    is_pinned: bool = False
    temporal_kind: Optional[str] = None


@router.get("/community/{slug}/tagged-items", response_model=list[CommunityTaggedItemOut])
def community_tagged_items(
    slug: str,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """특정 분과로 태깅된 posts + events 모아보기 (날짜 desc).

    부모/자식 양방향 확장은 적용하지 않음 — 클릭한 그 분과 자체의 태깅만 표시.
    (확장은 알림 발송에서만 사용. 모아보기는 정확히 그 분과 글만 보여주는 게 의미 명확.)
    """
    from sqlalchemy import text as _text
    grp = db.execute(_text("SELECT id, name FROM community_groups WHERE slug = :slug"), {"slug": slug}).first()
    if not grp:
        raise HTTPException(status_code=404, detail="분과·단체를 찾을 수 없습니다.")
    gid = grp.id
    posts = db.execute(_text(
        "SELECT p.id, p.title, p.content, p.created_at::date AS d, p.is_pinned, p.temporal_kind, b.slug AS board_slug "
        "FROM posts p "
        "JOIN post_community_targets t ON t.post_id = p.id "
        "JOIN boards b ON b.id = p.board_id "
        "WHERE t.community_group_id = :gid AND p.is_published = TRUE "
        "ORDER BY p.is_pinned DESC, p.created_at DESC "
        "LIMIT :lim"
    ), {"gid": gid, "lim": limit}).fetchall()
    events = db.execute(_text(
        "SELECT e.id, e.title, e.description, e.event_date AS d, e.temporal_kind "
        "FROM events e "
        "JOIN event_community_targets t ON t.event_id = e.id "
        "WHERE t.community_group_id = :gid AND e.is_public = TRUE "
        "ORDER BY e.event_date DESC "
        "LIMIT :lim"
    ), {"gid": gid, "lim": limit}).fetchall()

    items: list[CommunityTaggedItemOut] = []
    for p in posts:
        items.append(CommunityTaggedItemOut(
            kind="post", id=p.id, title=p.title,
            excerpt=(p.content[:120] if p.content else None),
            item_date=p.d, href=f"/boards/{p.board_slug}/{p.id}",
            is_pinned=bool(p.is_pinned), temporal_kind=p.temporal_kind,
        ))
    for e in events:
        items.append(CommunityTaggedItemOut(
            kind="event", id=e.id, title=e.title,
            excerpt=(e.description[:120] if e.description else None),
            item_date=e.d, href="/calendar",
            temporal_kind=e.temporal_kind,
        ))
    # 핀 + 날짜 desc 통합 정렬 — pinned post 먼저, 그 다음 날짜 내림차순
    from datetime import date as _date
    items.sort(key=lambda x: (
        not x.is_pinned,
        -(x.item_date.toordinal() if x.item_date else _date.min.toordinal()),
    ))
    return items[:limit]


@router.get("/community/slug/{slug}", response_model=CommunityGroupOut)
def get_community_by_slug(slug: str, db: Session = Depends(get_db)):
    group = db.query(CommunityGroup).filter(CommunityGroup.slug == slug).first()
    if not group:
        raise HTTPException(status_code=404, detail="분과를 찾을 수 없습니다.")
    return group


@router.post("/community", response_model=CommunityGroupOut)
def create_community(body: CommunityGroupIn, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    if body.slug:
        existing = db.query(CommunityGroup).filter(CommunityGroup.slug == body.slug).first()
        if existing:
            raise HTTPException(status_code=400, detail="이미 사용 중인 슬러그입니다.")
    group = CommunityGroup(**body.model_dump())
    db.add(group)
    db.commit()
    db.refresh(group)
    log_action(db, get_admin_identifier(admin), "create_community_group", "community_group", group.id, group.name)
    return group


@router.put("/community/{group_id}", response_model=CommunityGroupOut)
def update_community(group_id: int, body: CommunityGroupIn, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
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
    log_action(db, get_admin_identifier(admin), "update_community_group", "community_group", group.id, group.name)
    return group


@router.delete("/community/{group_id}")
def delete_community(group_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    group = db.query(CommunityGroup).filter(CommunityGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="항목을 찾을 수 없습니다.")
    snapshot = group.name
    db.delete(group)
    db.commit()
    log_action(db, get_admin_identifier(admin), "delete_community_group", "community_group", group_id, snapshot)
    return {"ok": True}


@router.post("/community/{group_id}/representative-photo", response_model=CommunityGroupOut)
def upload_community_representative_photo(
    group_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
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
    log_action(db, get_admin_identifier(admin), "upload_community_rep_photo", "community_group", group.id, group.name)
    return group


@router.delete("/community/{group_id}/representative-photo", response_model=CommunityGroupOut)
def delete_community_representative_photo(
    group_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
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
    log_action(db, get_admin_identifier(admin), "delete_community_rep_photo", "community_group", group.id, group.name)
    return group


@router.post("/community/{group_id}/photos", response_model=CommunityGroupOut)
def upload_community_photo(
    group_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
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
    log_action(db, get_admin_identifier(admin), "upload_community_photo", "community_group", group.id, group.name)
    return group


@router.delete("/community/{group_id}/photos")
def delete_community_photo(
    group_id: int,
    url: str,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
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
        log_action(db, get_admin_identifier(admin), "delete_community_photo", "community_group", group.id, group.name)
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
def list_static_pages(db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    return db.query(StaticPage).order_by(StaticPage.slug).all()


@router.get("/pages/{slug}", response_model=StaticPageOut)
def get_static_page(slug: str, db: Session = Depends(get_db)):
    page = db.query(StaticPage).filter_by(slug=slug).first()
    if not page:
        raise HTTPException(status_code=404, detail="페이지를 찾을 수 없습니다.")
    return page


@router.put("/pages/{slug}", response_model=StaticPageOut)
def update_static_page(slug: str, body: StaticPageIn, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    page = db.query(StaticPage).filter_by(slug=slug).first()
    if not page:
        raise HTTPException(status_code=404, detail="페이지를 찾을 수 없습니다.")
    page.title = body.title
    page.subtitle = body.subtitle
    page.body = body.body
    db.commit()
    db.refresh(page)
    log_action(db, get_admin_identifier(admin), "update_static_page", "static_page", None, f"{slug}: {body.title}")
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
def list_meditations_admin(page: int = 1, limit: int = 20, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
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
def create_meditation(
    body: MeditationIn,
    notify: bool = Query(False, description="등록 시 수신 동의 회원에게 이메일·사이트 알림 발송"),
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    item = Meditation(**body.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    log_action(db, get_admin_identifier(admin), "create_meditation", "meditation", item.id, body.title)
    if notify:
        from app.core.content_notify import fanout_content_notification
        try:
            fanout_content_notification(
                db, kind="meditation",
                title=item.title,
                body_preview=item.body,
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).error("meditation 알림 발송 실패: %s", e)
    return item


@router.put("/meditations/{item_id}", response_model=MeditationOut)
def update_meditation(item_id: int, body: MeditationIn, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    item = db.query(Meditation).filter(Meditation.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="묵상을 찾을 수 없습니다.")
    for k, v in body.model_dump().items():
        setattr(item, k, v)
    db.commit()
    db.refresh(item)
    log_action(db, get_admin_identifier(admin), "update_meditation", "meditation", item.id, body.title)
    return item


@router.post("/meditations/{item_id}/set-current", response_model=MeditationOut)
def set_current_meditation(
    item_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
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
    log_action(db, get_admin_identifier(admin), "set_current_meditation", "meditation", item.id, item.title)
    return item


@router.post("/meditations/clear-current", status_code=204)
def clear_current_meditation(
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """대표 지정 해제 — 모든 is_current 를 FALSE 로. 이후 자동으로 최신이 노출됨."""
    db.query(Meditation).filter(Meditation.is_current == True).update(
        {Meditation.is_current: False}, synchronize_session=False,
    )
    db.commit()
    log_action(db, get_admin_identifier(admin), "clear_current_meditation", "meditation", None, None)
    return None


@router.put("/meditations/{item_id}/background", response_model=MeditationOut)
def update_meditation_background_options(
    item_id: int,
    body: MeditationBackgroundIn,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
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
    log_action(db, get_admin_identifier(admin), "update_meditation_bg_options", "meditation", item.id, item.title)
    return item


@router.post("/meditations/{item_id}/background-image", response_model=MeditationOut)
def upload_meditation_background(
    item_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
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
    log_action(db, get_admin_identifier(admin), "upload_meditation_bg", "meditation", item.id, item.title)
    return item


@router.delete("/meditations/{item_id}/background-image", response_model=MeditationOut)
def delete_meditation_background(
    item_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """배경 이미지 제거 (DB 의 URL 만 비움 — 파일은 정리하지 않음)."""
    item = db.query(Meditation).filter(Meditation.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="묵상을 찾을 수 없습니다.")
    item.background_image_url = None
    db.commit()
    db.refresh(item)
    log_action(db, get_admin_identifier(admin), "delete_meditation_bg", "meditation", item.id, item.title)
    return item


@router.delete("/meditations/{item_id}", status_code=204)
def delete_meditation(item_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    item = db.query(Meditation).filter(Meditation.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="묵상을 찾을 수 없습니다.")
    snapshot = item.title
    db.delete(item)
    db.commit()
    log_action(db, get_admin_identifier(admin), "delete_meditation", "meditation", item_id, snapshot)


# ─── Prayer ─────────────────────────────────────────────────

PRAYER_CATEGORIES = ["memorize", "daily", "mass", "rosary", "liturgy_season", "special", "memorial", "parish"]


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
    admin: Admin = Depends(get_current_admin),
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
def create_prayer(body: PrayerIn, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    _validate_prayer_category(body.category)
    item = Prayer(**body.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    log_action(db, get_admin_identifier(admin), "create_prayer", "prayer", item.id, body.title)
    return item


@router.put("/prayers/{item_id}", response_model=PrayerOut)
def update_prayer(item_id: int, body: PrayerIn, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    _validate_prayer_category(body.category)
    item = db.query(Prayer).filter(Prayer.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="기도문을 찾을 수 없습니다.")
    for k, v in body.model_dump().items():
        setattr(item, k, v)
    db.commit()
    db.refresh(item)
    log_action(db, get_admin_identifier(admin), "update_prayer", "prayer", item.id, body.title)
    return item


@router.put("/prayers/{item_id}/background", response_model=PrayerOut)
def update_prayer_background(item_id: int, body: PrayerBackgroundIn, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
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
    log_action(db, get_admin_identifier(admin), "update_prayer_bg", "prayer", item.id, item.title)
    return item


@router.post("/prayers/{item_id}/background-image", response_model=PrayerOut)
def upload_prayer_background(
    item_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
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
    log_action(db, get_admin_identifier(admin), "upload_prayer_bg", "prayer", item.id, item.title)
    return item


@router.delete("/prayers/{item_id}/background-image", response_model=PrayerOut)
def delete_prayer_background(item_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    item = db.query(Prayer).filter(Prayer.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="기도문을 찾을 수 없습니다.")
    item.background_image_url = None
    db.commit()
    db.refresh(item)
    log_action(db, get_admin_identifier(admin), "delete_prayer_bg", "prayer", item.id, item.title)
    return item


@router.delete("/prayers/{item_id}", status_code=204)
def delete_prayer(item_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    item = db.query(Prayer).filter(Prayer.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="기도문을 찾을 수 없습니다.")
    snapshot = item.title
    db.delete(item)
    db.commit()
    log_action(db, get_admin_identifier(admin), "delete_prayer", "prayer", item_id, snapshot)


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
def list_council_admin(db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    return db.query(CouncilMember).order_by(CouncilMember.sort_order, CouncilMember.id).all()


@router.post("/council", response_model=CouncilMemberOut, status_code=201)
def create_council_member(body: CouncilMemberIn, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    member = CouncilMember(**body.model_dump())
    db.add(member)
    db.commit()
    db.refresh(member)
    log_action(db, get_admin_identifier(admin), "create_council_member", "council_member", member.id, f"{member.role}/{member.name}")
    return member


@router.post("/council/{member_id}/photo", response_model=CouncilMemberOut)
async def upload_council_photo(
    member_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
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
    log_action(db, get_admin_identifier(admin), "upload_council_photo", "council_member", member.id, member.name)
    return member


@router.put("/council/{member_id}", response_model=CouncilMemberOut)
def update_council_member(member_id: int, body: CouncilMemberIn, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    member = db.query(CouncilMember).filter(CouncilMember.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")
    for k, v in body.model_dump().items():
        setattr(member, k, v)
    db.commit()
    db.refresh(member)
    log_action(db, get_admin_identifier(admin), "update_council_member", "council_member", member.id, f"{member.role}/{member.name}")
    return member


@router.delete("/council/{member_id}", status_code=204)
def delete_council_member(member_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    member = db.query(CouncilMember).filter(CouncilMember.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")
    snapshot = f"{member.role}/{member.name}"
    db.delete(member)
    db.commit()
    log_action(db, get_admin_identifier(admin), "delete_council_member", "council_member", member_id, snapshot)
