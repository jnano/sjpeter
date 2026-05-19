"""가톨릭 성인 사전 API — 세례명으로 축일 조회.

공개:
- GET /api/saints/                          — 검색·필터·페이지네이션
- GET /api/saints/suggest?q=                — 자동완성용 한글명 prefix 매칭
- GET /api/saints/by-name/{korean_name}     — 동명 성인 모두
- GET /api/saints/by-feast?month=&day=      — 특정 축일의 성인 목록
- GET /api/saints/{saint_id}                — 상세

관리자:
- POST   /api/saints/                       — 등록
- PUT    /api/saints/{saint_id}             — 수정
- DELETE /api/saints/{saint_id}             — 삭제
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import asc, or_
from sqlalchemy.orm import Session

from app.core.auth import get_current_admin
from app.core.database import get_db
from app.models.admin import Admin
from app.models.saint import Saint

router = APIRouter(prefix="/saints", tags=["saints"])


class SaintIn(BaseModel):
    korean_name: str = Field(..., min_length=1, max_length=80)
    latin_name: Optional[str] = Field(None, max_length=120)
    feast_month: int = Field(..., ge=1, le=12)
    feast_day: int = Field(..., ge=1, le=31)
    title: Optional[str] = Field(None, max_length=80)
    bio_short: Optional[str] = None
    patronage: Optional[str] = Field(None, max_length=200)
    rank_within_name: int = 0
    is_active: bool = True


class SaintOut(BaseModel):
    id: int
    korean_name: str
    latin_name: Optional[str]
    feast_month: int
    feast_day: int
    title: Optional[str]
    bio_short: Optional[str]
    patronage: Optional[str]
    rank_within_name: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class SaintListOut(BaseModel):
    items: List[SaintOut]
    total: int
    page: int
    limit: int


def _base_query(db: Session, *, include_inactive: bool = False):
    q = db.query(Saint)
    if not include_inactive:
        q = q.filter(Saint.is_active.is_(True))
    return q


@router.get("/", response_model=SaintListOut)
def list_saints(
    q: Optional[str] = Query(None, description="한글명/라틴명 부분 일치"),
    month: Optional[int] = Query(None, ge=1, le=12),
    day: Optional[int] = Query(None, ge=1, le=31),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    query = _base_query(db)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(or_(Saint.korean_name.ilike(like), Saint.latin_name.ilike(like)))
    if month is not None:
        query = query.filter(Saint.feast_month == month)
    if day is not None:
        query = query.filter(Saint.feast_day == day)
    total = query.count()
    items = (
        query.order_by(asc(Saint.korean_name), asc(Saint.feast_month), asc(Saint.feast_day), asc(Saint.id))
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return SaintListOut(items=items, total=total, page=page, limit=limit)


@router.get("/suggest", response_model=List[str])
def suggest_names(
    q: str = Query(..., min_length=1, max_length=40),
    limit: int = Query(10, ge=1, le=30),
    db: Session = Depends(get_db),
):
    """입력 prefix와 일치하는 distinct 한글 세례명 자동완성 후보."""
    like = f"{q.strip()}%"
    rows = (
        db.query(Saint.korean_name)
        .filter(Saint.is_active.is_(True), Saint.korean_name.ilike(like))
        .distinct()
        .order_by(asc(Saint.korean_name))
        .limit(limit)
        .all()
    )
    return [r[0] for r in rows]


@router.get("/by-name/{korean_name}", response_model=List[SaintOut])
def by_name(korean_name: str, db: Session = Depends(get_db)):
    """동일 세례명 성인 전부 (예: '베드로' → 사도·교부·순교자 등)."""
    return (
        _base_query(db)
        .filter(Saint.korean_name == korean_name)
        .order_by(asc(Saint.rank_within_name), asc(Saint.feast_month), asc(Saint.feast_day), asc(Saint.id))
        .all()
    )


@router.get("/by-feast", response_model=List[SaintOut])
def by_feast(
    month: int = Query(..., ge=1, le=12),
    day: Optional[int] = Query(None, ge=1, le=31),
    db: Session = Depends(get_db),
):
    """특정 월/일에 축일이 있는 성인 목록 (day 생략 시 그 달 전체)."""
    q = _base_query(db).filter(Saint.feast_month == month)
    if day is not None:
        q = q.filter(Saint.feast_day == day)
    return q.order_by(asc(Saint.feast_day), asc(Saint.korean_name), asc(Saint.id)).all()


@router.get("/{saint_id}", response_model=SaintOut)
def get_saint(saint_id: int, db: Session = Depends(get_db)):
    s = db.query(Saint).filter(Saint.id == saint_id, Saint.is_active.is_(True)).first()
    if not s:
        raise HTTPException(status_code=404, detail="찾을 수 없습니다.")
    return s


@router.post("/", response_model=SaintOut, status_code=201)
def create_saint(
    body: SaintIn,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    s = Saint(**body.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.put("/{saint_id}", response_model=SaintOut)
def update_saint(
    saint_id: int,
    body: SaintIn,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    s = db.query(Saint).filter(Saint.id == saint_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="찾을 수 없습니다.")
    for k, v in body.model_dump().items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return s


@router.delete("/{saint_id}", status_code=204)
def delete_saint(
    saint_id: int,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    s = db.query(Saint).filter(Saint.id == saint_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="찾을 수 없습니다.")
    db.delete(s)
    db.commit()
