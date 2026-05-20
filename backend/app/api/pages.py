"""동적 페이지 API.

admin이 코드 수정 없이 페이지를 만들 수 있게 함. URL: /p/{slug}.
공개 GET은 활성 페이지만, admin은 전체.
"""

import re
from typing import Optional, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import asc
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.core.auth import get_current_admin
from app.core.dynamic_vars import VARIABLE_DOCS, render
from app.models.admin import Admin
from app.models.dynamic_page import DynamicPage

router = APIRouter(prefix="/pages", tags=["pages"])

# layout_kind 종류:
#  body            — markdown 본문 (간단한 글 페이지)
#  body_with_hero  — markdown 본문 + 상단 히어로 이미지
#  sections        — markdown 본문 + payload.sections[] 카드 섹션들
#  html            — body_markdown 자리에 raw HTML 저장. /p/{slug} 가 PageHeader/SectionLayout
#                    wrapper 없이 그대로 dangerouslySetInnerHTML 로 출력 (자유 레이아웃).
LAYOUT_KINDS = ("body", "body_with_hero", "sections", "html")
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9\-]*$")  # 영문 소문자·숫자·하이픈만


class PageIn(BaseModel):
    slug: str = Field(min_length=1, max_length=80)
    title: str = Field(min_length=1, max_length=200)
    subtitle: Optional[str] = Field(default=None, max_length=300)
    group_label: Optional[str] = Field(default=None, max_length=50)
    layout_kind: str = "body"
    payload: dict[str, Any] = Field(default_factory=dict)
    body_markdown: Optional[str] = None
    is_active: bool = True


class PageOut(BaseModel):
    id: int
    slug: str
    title: str
    subtitle: Optional[str] = None
    group_label: Optional[str] = None
    layout_kind: str
    payload: dict[str, Any] = Field(default_factory=dict)
    body_markdown: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


def _validate(body: PageIn) -> None:
    if body.layout_kind not in LAYOUT_KINDS:
        raise HTTPException(status_code=400, detail=f"layout_kind는 {LAYOUT_KINDS} 중 하나여야 합니다.")
    if not SLUG_RE.match(body.slug):
        raise HTTPException(status_code=400, detail="slug은 영문 소문자·숫자·하이픈만 사용할 수 있습니다.")


# ─── Public ──────────────────────────────────────────────

@router.get("/by-slug/{slug}", response_model=PageOut)
def get_page(slug: str, db: Session = Depends(get_db)):
    p = db.query(DynamicPage).filter(
        DynamicPage.slug == slug,
        DynamicPage.is_active == True,  # noqa: E712
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="페이지를 찾을 수 없습니다.")
    # {{ PARISH_NAME }} 등 변수 치환 — 본당 정보·오늘 날짜로 채움
    out = PageOut.model_validate(p)
    out.title = render(out.title, db) or out.title
    out.subtitle = render(out.subtitle, db)
    out.body_markdown = render(out.body_markdown, db)
    return out


@router.get("/variables")
def list_variables():
    """admin 편집기에서 사용 가능한 변수 목록 안내. 인증 불필요."""
    return VARIABLE_DOCS


@router.get("/public", response_model=list[PageOut])
def list_public_pages(db: Session = Depends(get_db)):
    """공개 페이지 목록 (메뉴 등록 시 admin 선택지로도 사용)."""
    pages = (
        db.query(DynamicPage)
        .filter(DynamicPage.is_active == True)  # noqa: E712
        .order_by(asc(DynamicPage.title))
        .all()
    )
    return [PageOut.model_validate(p) for p in pages]


# ─── Admin ───────────────────────────────────────────────

@router.get("/admin/all", response_model=list[PageOut])
def list_all_pages(db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    pages = db.query(DynamicPage).order_by(asc(DynamicPage.id)).all()
    return [PageOut.model_validate(p) for p in pages]


@router.get("/admin/{page_id}", response_model=PageOut)
def get_admin_page(page_id: int, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    p = db.query(DynamicPage).filter(DynamicPage.id == page_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="페이지를 찾을 수 없습니다.")
    return PageOut.model_validate(p)


@router.post("", response_model=PageOut)
def create_page(body: PageIn, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    _validate(body)
    if db.query(DynamicPage).filter(DynamicPage.slug == body.slug).first():
        raise HTTPException(status_code=400, detail=f"slug '{body.slug}'은 이미 사용 중입니다.")
    p = DynamicPage(**body.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return PageOut.model_validate(p)


@router.put("/{page_id}", response_model=PageOut)
def update_page(page_id: int, body: PageIn, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    _validate(body)
    p = db.query(DynamicPage).filter(DynamicPage.id == page_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="페이지를 찾을 수 없습니다.")
    # slug 변경 시 중복 확인
    if body.slug != p.slug and db.query(DynamicPage).filter(
        DynamicPage.slug == body.slug, DynamicPage.id != page_id
    ).first():
        raise HTTPException(status_code=400, detail=f"slug '{body.slug}'은 이미 사용 중입니다.")
    for k, v in body.model_dump().items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return PageOut.model_validate(p)


@router.delete("/{page_id}")
def delete_page(page_id: int, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    p = db.query(DynamicPage).filter(DynamicPage.id == page_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="페이지를 찾을 수 없습니다.")
    db.delete(p)
    db.commit()
    return {"ok": True}
