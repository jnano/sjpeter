"""홈 페이지 블록 빌더 API.

공개:
- GET  /api/home/blocks                    : 활성 블록 sort_order 순 (공개 렌더용)

관리자:
- GET    /api/home/blocks/admin/all        : 모든 블록 (비활성 포함)
- POST   /api/home/blocks                  : 새 블록 추가
- PATCH  /api/home/blocks/{block_id}       : 블록 수정 (kind·payload·is_active)
- DELETE /api/home/blocks/{block_id}       : 블록 삭제
- PUT    /api/home/blocks/reorder          : 순서 재배치 (ids: int[])
"""
from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import asc
from sqlalchemy.orm import Session

from app.core.admin_log import get_admin_identifier, log_action
from app.core.auth import get_current_admin
from app.core.database import get_db
from app.models.admin import Admin
from app.models.home_block import HomeBlock

router = APIRouter(prefix="/home", tags=["home"])

# 지원되는 블록 종류 — 새 블록 종류 추가 시 여기에 등록 + frontend 렌더러 추가.
ALLOWED_KINDS = (
    "hero",          # 메인 3단 (사진·복음·미사·선택 배너). payload.layout='wide|wide-plain|even|even-plain'
    "quick_links",   # 빠른 메뉴 (성당 안내·분과·주보 등). payload.items=[{href,label,icon}]
    "meditation",    # 묵상 엔딩 크레딧.
    "construction",  # 성전 건축 위젯.
    "board_tabs",    # 공지·행사 탭.
    "gallery",       # 사진 슬라이더.
    "banner",        # 배너 (placement 지정). payload.placement='home_middle' 등
    "quote",         # 마무리 인용. payload.text='...', payload.source='...'
)


class BlockIn(BaseModel):
    kind: str
    is_active: bool = True
    payload: dict[str, Any] = Field(default_factory=dict)


class BlockUpdate(BaseModel):
    kind: Optional[str] = None
    is_active: Optional[bool] = None
    payload: Optional[dict[str, Any]] = None


class BlockOut(BaseModel):
    id: int
    kind: str
    sort_order: int
    is_active: bool
    payload: dict[str, Any] = Field(default_factory=dict)

    class Config:
        from_attributes = True


class ReorderIn(BaseModel):
    ids: list[int]


def _validate_kind(kind: str) -> str:
    if kind not in ALLOWED_KINDS:
        raise HTTPException(
            status_code=400,
            detail=f"kind 는 {ALLOWED_KINDS} 중 하나여야 합니다.",
        )
    return kind


# ── 공개 ────────────────────────────────────────────────

@router.get("/blocks", response_model=list[BlockOut])
def list_active_blocks(db: Session = Depends(get_db)):
    """활성 블록을 sort_order 순으로 반환 — 공개 홈 렌더링용."""
    rows = (
        db.query(HomeBlock)
        .filter(HomeBlock.is_active == True)  # noqa: E712
        .order_by(asc(HomeBlock.sort_order), asc(HomeBlock.id))
        .all()
    )
    return [BlockOut.model_validate(r) for r in rows]


# ── 관리자 ───────────────────────────────────────────────

@router.get("/blocks/admin/all", response_model=list[BlockOut])
def list_all_blocks(db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    rows = db.query(HomeBlock).order_by(asc(HomeBlock.sort_order), asc(HomeBlock.id)).all()
    return [BlockOut.model_validate(r) for r in rows]


@router.post("/blocks", response_model=BlockOut, status_code=201)
def create_block(body: BlockIn, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    _validate_kind(body.kind)
    # 새 블록은 항상 맨 마지막 — 현재 블록 수를 sort_order 로
    next_order = db.query(HomeBlock).count()
    block = HomeBlock(
        kind=body.kind,
        sort_order=next_order,
        is_active=body.is_active,
        payload=body.payload,
    )
    db.add(block)
    db.commit()
    db.refresh(block)
    log_action(db, get_admin_identifier(admin), "create_home_block", "home_block", block.id, body.kind)
    return BlockOut.model_validate(block)


@router.patch("/blocks/{block_id}", response_model=BlockOut)
def update_block(
    block_id: int,
    body: BlockUpdate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    block = db.query(HomeBlock).filter(HomeBlock.id == block_id).first()
    if not block:
        raise HTTPException(status_code=404, detail="블록을 찾을 수 없습니다.")
    provided = body.model_fields_set
    if "kind" in provided and body.kind is not None:
        _validate_kind(body.kind)
        block.kind = body.kind
    if "is_active" in provided and body.is_active is not None:
        block.is_active = body.is_active
    if "payload" in provided and body.payload is not None:
        block.payload = body.payload
    db.commit()
    db.refresh(block)
    log_action(db, get_admin_identifier(admin), "update_home_block", "home_block", block.id, block.kind)
    return BlockOut.model_validate(block)


@router.delete("/blocks/{block_id}", status_code=204)
def delete_block(block_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    block = db.query(HomeBlock).filter(HomeBlock.id == block_id).first()
    if not block:
        raise HTTPException(status_code=404, detail="블록을 찾을 수 없습니다.")
    snapshot = block.kind
    db.delete(block)
    db.commit()
    log_action(db, get_admin_identifier(admin), "delete_home_block", "home_block", block_id, snapshot)
    return None


@router.put("/blocks/reorder")
def reorder_blocks(
    body: ReorderIn = Body(...),
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """순서 재배치 — body.ids 의 순서대로 sort_order 0..N-1 부여."""
    for i, block_id in enumerate(body.ids):
        db.query(HomeBlock).filter(HomeBlock.id == block_id).update({"sort_order": i})
    db.commit()
    log_action(
        db, get_admin_identifier(admin), "reorder_home_blocks", "home_block", None,
        f"순서: {','.join(map(str, body.ids))}",
    )
    return {"ok": True}
