import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.core.database import get_db
from app.core.auth import get_current_admin
from app.core.config import settings
from app.models.notice import Notice, NoticeAttachment
from app.models.parish import Parish
from app.models.admin import Admin

router = APIRouter(prefix="/notices", tags=["notices"])

ALLOWED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
SUBDIR = "notice_attachments"


class NoticeIn(BaseModel):
    title: str
    content: Optional[str] = None
    is_pinned: bool = False
    created_at: Optional[datetime] = None  # 지정 시 그 날짜로 저장. None이면 현재 시각 자동 적용.


class NoticeAttachmentOut(BaseModel):
    id: int
    file_url: str
    original_name: Optional[str] = None
    file_size: int = 0
    sort_order: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


class NoticeOut(BaseModel):
    id: int
    title: str
    content: Optional[str]
    is_pinned: bool
    is_ai_generated: bool = False
    created_at: datetime
    attachments: List[NoticeAttachmentOut] = []

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
        .options(joinedload(Notice.attachments))
        .order_by(desc(Notice.is_pinned), desc(Notice.created_at))
        .all()
    )


class NoticePagedOut(BaseModel):
    pinned: list[NoticeOut]    # 핀 공지는 페이지와 무관하게 모두 반환
    items: list[NoticeOut]     # 현재 페이지의 일반 공지
    total: int                 # 일반 공지 전체 개수 (페이지네이션용)
    page: int
    size: int


@router.get("/paged", response_model=NoticePagedOut)
def list_notices_paged(
    page: int = 1,
    size: int = 20,
    db: Session = Depends(get_db),
):
    """핀 공지는 항상 전체 반환, 일반 공지만 페이지네이션."""
    page = max(1, page)
    size = max(1, min(100, size))

    pinned = (
        db.query(Notice)
        .options(joinedload(Notice.attachments))
        .filter(Notice.is_pinned == True)
        .order_by(desc(Notice.created_at))
        .all()
    )

    base = db.query(Notice).filter(Notice.is_pinned == False)
    total = base.count()
    items = (
        base.options(joinedload(Notice.attachments))
        .order_by(desc(Notice.created_at))
        .offset((page - 1) * size)
        .limit(size)
        .all()
    )
    return NoticePagedOut(pinned=pinned, items=items, total=total, page=page, size=size)


@router.get("/{notice_id}", response_model=NoticeOut)
def get_notice(notice_id: int, db: Session = Depends(get_db)):
    notice = (
        db.query(Notice)
        .options(joinedload(Notice.attachments))
        .filter(Notice.id == notice_id)
        .first()
    )
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
    notice = (
        db.query(Notice)
        .options(joinedload(Notice.attachments))
        .filter(Notice.id == notice_id)
        .first()
    )
    if not notice:
        raise HTTPException(status_code=404, detail="공지를 찾을 수 없습니다.")
    # 파일 시스템에서 첨부 파일 제거
    for att in notice.attachments:
        _remove_file(att.file_url)
    db.delete(notice)
    db.commit()


# ── 첨부 (사진) ─────────────────────────────────────

def _remove_file(file_url: Optional[str]) -> None:
    if not file_url:
        return
    try:
        rel = file_url.lstrip("/").replace("uploads/", "", 1)
        path = os.path.join(settings.UPLOAD_DIR, rel)
        if os.path.isfile(path):
            os.remove(path)
    except Exception:
        pass


@router.post("/{notice_id}/attachments", response_model=List[NoticeAttachmentOut], status_code=201)
async def upload_notice_attachments(
    notice_id: int,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    """공지에 사진을 다중 업로드. 기존 사진은 유지되고 끝에 추가됨."""
    notice = db.query(Notice).filter(Notice.id == notice_id).first()
    if not notice:
        raise HTTPException(status_code=404, detail="공지를 찾을 수 없습니다.")
    if not files:
        raise HTTPException(status_code=400, detail="파일이 없습니다.")

    save_dir = os.path.join(settings.UPLOAD_DIR, SUBDIR)
    os.makedirs(save_dir, exist_ok=True)

    max_existing = (
        db.query(NoticeAttachment.sort_order)
        .filter(NoticeAttachment.notice_id == notice_id)
        .order_by(NoticeAttachment.sort_order.desc())
        .first()
    )
    next_order = (max_existing[0] + 1) if max_existing else 0

    saved: List[NoticeAttachment] = []
    for upload in files:
        original = upload.filename or "image"
        ext = os.path.splitext(original)[1].lower()
        if ext not in ALLOWED_IMAGE_EXTS:
            raise HTTPException(status_code=400, detail=f"이미지 파일만 업로드할 수 있습니다: {ext}")
        content = await upload.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail=f"파일 크기는 10MB 이하여야 합니다: {original}")
        stored = f"{uuid.uuid4().hex}{ext}"
        path = os.path.join(save_dir, stored)
        with open(path, "wb") as f:
            f.write(content)
        att = NoticeAttachment(
            notice_id=notice_id,
            file_url=f"/uploads/{SUBDIR}/{stored}",
            original_name=original,
            file_size=len(content),
            sort_order=next_order,
        )
        db.add(att)
        saved.append(att)
        next_order += 1

    db.commit()
    for a in saved:
        db.refresh(a)
    return saved


@router.delete("/{notice_id}/attachments/{attachment_id}", status_code=204)
def delete_notice_attachment(
    notice_id: int,
    attachment_id: int,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    att = (
        db.query(NoticeAttachment)
        .filter(NoticeAttachment.id == attachment_id, NoticeAttachment.notice_id == notice_id)
        .first()
    )
    if not att:
        raise HTTPException(status_code=404, detail="첨부를 찾을 수 없습니다.")
    _remove_file(att.file_url)
    db.delete(att)
    db.commit()
    return None
