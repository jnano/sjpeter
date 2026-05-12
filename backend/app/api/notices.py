from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.core.database import get_db
from app.core.auth import get_current_admin
from app.models.notice import Notice
from app.models.parish import Parish
from app.models.admin import Admin

router = APIRouter(prefix="/notices", tags=["notices"])


class NoticeIn(BaseModel):
    title: str
    content: Optional[str] = None
    is_pinned: bool = False
    created_at: Optional[datetime] = None  # 지정 시 그 날짜로 저장. None이면 현재 시각 자동 적용.


class NoticeOut(BaseModel):
    id: int
    title: str
    content: Optional[str]
    is_pinned: bool
    is_ai_generated: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


def _get_parish(db: Session) -> Parish:
    parish = db.query(Parish).first()
    if not parish:
        raise HTTPException(status_code=500, detail="성당 정보가 초기화되지 않았습니다.")
    return parish


@router.get("/", response_model=list[NoticeOut])
def list_notices(db: Session = Depends(get_db)):
    return (
        db.query(Notice)
        .order_by(desc(Notice.is_pinned), desc(Notice.created_at))
        .all()
    )


@router.get("/{notice_id}", response_model=NoticeOut)
def get_notice(notice_id: int, db: Session = Depends(get_db)):
    notice = db.query(Notice).filter(Notice.id == notice_id).first()
    if not notice:
        raise HTTPException(status_code=404, detail="공지를 찾을 수 없습니다.")
    return notice


@router.post("/", response_model=NoticeOut, status_code=201)
def create_notice(
    body: NoticeIn,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    parish = _get_parish(db)
    data = body.model_dump()
    # 명시되지 않으면 모델 default(datetime.utcnow)에 위임
    if data.get("created_at") is None:
        data.pop("created_at", None)
    notice = Notice(parish_id=parish.id, **data)
    db.add(notice)
    db.commit()
    db.refresh(notice)
    return notice


@router.put("/{notice_id}", response_model=NoticeOut)
def update_notice(
    notice_id: int,
    body: NoticeIn,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    notice = db.query(Notice).filter(Notice.id == notice_id).first()
    if not notice:
        raise HTTPException(status_code=404, detail="공지를 찾을 수 없습니다.")
    data = body.model_dump()
    # 빈 값(None)이면 기존 날짜 유지. 명시한 경우만 변경.
    if data.get("created_at") is None:
        data.pop("created_at", None)
    for k, v in data.items():
        setattr(notice, k, v)
    db.commit()
    db.refresh(notice)
    return notice


@router.delete("/{notice_id}", status_code=204)
def delete_notice(
    notice_id: int,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    notice = db.query(Notice).filter(Notice.id == notice_id).first()
    if not notice:
        raise HTTPException(status_code=404, detail="공지를 찾을 수 없습니다.")
    db.delete(notice)
    db.commit()
