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
    }


@router.get("/", response_model=list[EventOut])
def list_events(year: int, month: int, db: Session = Depends(get_db)):
    """해당 연월의 공개 행사 목록."""
    rows = db.execute(text(
        "SELECT * FROM events WHERE is_public = TRUE "
        "AND EXTRACT(YEAR FROM event_date) = :year "
        "AND EXTRACT(MONTH FROM event_date) = :month "
        "ORDER BY event_date, start_time"
    ), {"year": year, "month": month}).fetchall()
    return [_row_to_dict(r) for r in rows]


@router.post("/", response_model=EventOut, status_code=201)
def create_event(body: EventIn, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    row = db.execute(text(
        "INSERT INTO events (title, description, event_date, end_date, start_time, location, category, is_public) "
        "VALUES (:title, :desc, :edate, :eend, :stime, :loc, :cat, :pub) RETURNING *"
    ), {
        "title": body.title, "desc": body.description, "edate": body.event_date,
        "eend": body.end_date, "stime": body.start_time, "loc": body.location,
        "cat": body.category, "pub": body.is_public,
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


@router.delete("/{event_id}", status_code=204)
def delete_event(event_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    result = db.execute(text("DELETE FROM events WHERE id=:id"), {"id": event_id})
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="행사를 찾을 수 없습니다.")
    db.commit()
    log_action(db, get_admin_identifier(admin), "delete_event", "event", event_id)
