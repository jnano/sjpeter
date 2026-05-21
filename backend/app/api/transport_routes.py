"""교통 안내 — /info 페이지의 출발지별 노선 카드 API.

- GET    /api/transport-routes        — 공개 (정렬된 목록)
- POST   /api/transport-routes        — 운영자
- PATCH  /api/transport-routes/{id}   — 운영자
- DELETE /api/transport-routes/{id}   — 운영자
- POST   /api/transport-routes/reorder — 운영자 (id 배열 순서대로 sort_order 재설정)
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.admin_log import get_admin_identifier, log_action
from app.core.database import get_db
from app.core.auth import get_current_admin
from app.models.transport_route import TransportRoute

router = APIRouter(prefix="/transport-routes", tags=["transport_routes"])


class TransportRouteIn(BaseModel):
    label: str
    description: str


class TransportRouteUpdate(BaseModel):
    label: Optional[str] = None
    description: Optional[str] = None


class TransportRouteOut(BaseModel):
    id: int
    label: str
    description: str
    sort_order: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReorderBody(BaseModel):
    ids: list[int]


@router.get("", response_model=list[TransportRouteOut])
def list_routes(db: Session = Depends(get_db)):
    return (
        db.query(TransportRoute)
        .order_by(TransportRoute.sort_order, TransportRoute.id)
        .all()
    )


@router.post("", response_model=TransportRouteOut, status_code=201)
def create_route(body: TransportRouteIn, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    label = body.label.strip()
    description = body.description.strip()
    if not label or not description:
        raise HTTPException(status_code=400, detail="라벨과 설명을 모두 입력해 주세요.")
    last = db.query(TransportRoute).order_by(TransportRoute.sort_order.desc()).first()
    next_order = (last.sort_order + 1) if last else 0
    row = TransportRoute(label=label, description=description, sort_order=next_order)
    db.add(row)
    db.commit()
    db.refresh(row)
    log_action(db, get_admin_identifier(admin), "create_transport_route", "transport_route", row.id, label)
    return row


@router.patch("/{route_id}", response_model=TransportRouteOut)
def update_route(route_id: int, body: TransportRouteUpdate, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    row = _get_or_404(route_id, db)
    if body.label is not None:
        label = body.label.strip()
        if not label:
            raise HTTPException(status_code=400, detail="라벨을 입력해 주세요.")
        row.label = label
    if body.description is not None:
        description = body.description.strip()
        if not description:
            raise HTTPException(status_code=400, detail="설명을 입력해 주세요.")
        row.description = description
    db.commit()
    db.refresh(row)
    log_action(db, get_admin_identifier(admin), "update_transport_route", "transport_route", row.id, row.label)
    return row


@router.delete("/{route_id}", status_code=204)
def delete_route(route_id: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    row = _get_or_404(route_id, db)
    snapshot = row.label
    db.delete(row)
    db.commit()
    log_action(db, get_admin_identifier(admin), "delete_transport_route", "transport_route", route_id, snapshot)


@router.post("/reorder", response_model=list[TransportRouteOut])
def reorder_routes(body: ReorderBody, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    rows = db.query(TransportRoute).filter(TransportRoute.id.in_(body.ids)).all()
    by_id = {r.id: r for r in rows}
    for idx, rid in enumerate(body.ids):
        if rid in by_id:
            by_id[rid].sort_order = idx
    db.commit()
    log_action(db, get_admin_identifier(admin), "reorder_transport_routes", "transport_route", None, f"순서: {','.join(map(str, body.ids))}")
    return (
        db.query(TransportRoute)
        .order_by(TransportRoute.sort_order, TransportRoute.id)
        .all()
    )


def _get_or_404(route_id: int, db: Session) -> TransportRoute:
    row = db.query(TransportRoute).filter(TransportRoute.id == route_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="교통 노선을 찾을 수 없습니다.")
    return row
