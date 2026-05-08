from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
from app.core.database import get_db
from app.core.auth import get_current_admin
from app.core.admin_log import log_action, get_admin_identifier
from app.models.admin import Admin

router = APIRouter(prefix="/events", tags=["events"])


class EventIn(BaseModel):
    title: str
    description: Optional[str] = None
    event_date: date
    end_date: Optional[date] = None
    start_time: Optional[str] = None
    location: Optional[str] = None
    category: str = "general"
    is_public: bool = True


class EventOut(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    event_date: date
    end_date: Optional[date] = None
    start_time: Optional[str] = None
    location: Optional[str] = None
    category: str
    is_public: bool
    status: str = "예정"


class EventStatusIn(BaseModel):
    status: str  # 예정 | 기록대기 | 기록됨


def _row_to_dict(row) -> dict:
    return {
        "id": row.id,
        "title": row.title,
        "description": row.description,
        "event_date": row.event_date,
        "end_date": row.end_date,
        "start_time": row.start_time,
        "location": row.location,
        "category": row.category,
        "is_public": row.is_public,
        "status": row.status if hasattr(row, "status") else "예정",
    }


def _auto_transition(db: Session):
    """지난 행사 중 '예정' 상태인 것을 '기록대기'로 자동 전환."""
    db.execute(text(
        "UPDATE events SET status = '기록대기' "
        "WHERE event_date < CURRENT_DATE AND status = '예정'"
    ))
    db.commit()


@router.get("/", response_model=list[EventOut])
def list_events(year: int, month: int, db: Session = Depends(get_db)):
    """해당 연월의 공개 행사 목록 (자동 상태 전환 포함)."""
    _auto_transition(db)
    rows = db.execute(text(
        "SELECT * FROM events WHERE is_public = TRUE "
        "AND EXTRACT(YEAR FROM event_date) = :year "
        "AND EXTRACT(MONTH FROM event_date) = :month "
        "ORDER BY event_date, start_time"
    ), {"year": year, "month": month}).fetchall()
    return [_row_to_dict(r) for r in rows]


@router.post("/", response_model=EventOut, status_code=201)
def create_event(body: EventIn, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    initial_status = "기록대기" if body.event_date < date.today() else "예정"
    row = db.execute(text(
        "INSERT INTO events (title, description, event_date, end_date, start_time, location, category, is_public, status) "
        "VALUES (:title, :desc, :edate, :eend, :stime, :loc, :cat, :pub, :status) RETURNING *"
    ), {
        "title": body.title, "desc": body.description, "edate": body.event_date,
        "eend": body.end_date, "stime": body.start_time, "loc": body.location,
        "cat": body.category, "pub": body.is_public, "status": initial_status,
    }).fetchone()
    db.commit()
    log_action(db, get_admin_identifier(admin), "create_event", "event", row.id, body.title)
    return _row_to_dict(row)


@router.put("/{event_id}", response_model=EventOut)
def update_event(event_id: int, body: EventIn, db: Session = Depends(get_db), _=Depends(get_current_admin)):
    row = db.execute(text(
        "UPDATE events SET title=:title, description=:desc, event_date=:edate, end_date=:eend, "
        "start_time=:stime, location=:loc, category=:cat, is_public=:pub, updated_at=NOW() "
        "WHERE id=:id RETURNING *"
    ), {
        "title": body.title, "desc": body.description, "edate": body.event_date,
        "eend": body.end_date, "stime": body.start_time, "loc": body.location,
        "cat": body.category, "pub": body.is_public, "id": event_id,
    }).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="행사를 찾을 수 없습니다.")
    db.commit()
    return _row_to_dict(row)


@router.patch("/{event_id}/status", response_model=EventOut)
def update_event_status(
    event_id: int,
    body: EventStatusIn,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    if body.status not in ("예정", "기록대기", "기록됨"):
        raise HTTPException(status_code=400, detail="유효하지 않은 상태값입니다.")
    row = db.execute(text(
        "UPDATE events SET status=:status, updated_at=NOW() WHERE id=:id RETURNING *"
    ), {"status": body.status, "id": event_id}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="행사를 찾을 수 없습니다.")
    db.commit()
    log_action(db, get_admin_identifier(admin), "update_event_status", "event", event_id, body.status)
    return _row_to_dict(row)


@router.delete("/{event_id}", status_code=204)
def delete_event(event_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    result = db.execute(text("DELETE FROM events WHERE id=:id"), {"id": event_id})
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="행사를 찾을 수 없습니다.")
    db.commit()
    log_action(db, get_admin_identifier(admin), "delete_event", "event", event_id)
