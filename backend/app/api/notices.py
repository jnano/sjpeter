"""공지사항 API — 어댑터.

데이터는 board.slug='notice' 의 posts 테이블에 저장되고, 본 API 는 그것을
기존 NoticeOut 응답 형식으로 변환해 노출한다(호출자 호환성 유지).
이전 notices 테이블은 v1.5.69 마이그레이션 후 archive 로만 둠.
"""
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
from app.models.admin import Admin
from app.models.board import Board, Post
from app.models.attachment import Attachment

router = APIRouter(prefix="/notices", tags=["notices"])

NOTICE_SLUG = "notice"
ALLOWED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
SUBDIR = "notice_attachments"


# ── 스키마 (기존 호출자 호환) ──────────────────────────────

class NoticeIn(BaseModel):
    title: str
    content: Optional[str] = None
    is_pinned: bool = False
    created_at: Optional[datetime] = None


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


class NoticePagedOut(BaseModel):
    pinned: list[NoticeOut]
    items: list[NoticeOut]
    total: int
    page: int
    size: int


# ── 헬퍼 ──────────────────────────────────────────────────

def _notice_board_id(db: Session) -> int:
    b = db.query(Board).filter(Board.slug == NOTICE_SLUG).first()
    if not b:
        raise HTTPException(status_code=500, detail="공지사항 게시판이 초기화되지 않았습니다.")
    return b.id


def _to_attachment_out(att: Attachment) -> NoticeAttachmentOut:
    return NoticeAttachmentOut(
        id=att.id,
        file_url=att.file_url,
        original_name=att.original_name,
        file_size=att.file_size or 0,
        sort_order=0,  # Attachment 에는 sort_order 컬럼이 없음
        created_at=att.created_at,
    )


def _to_notice_out(post: Post) -> NoticeOut:
    return NoticeOut(
        id=post.id,
        title=post.title,
        content=post.content,
        is_pinned=bool(getattr(post, "is_pinned", False)),
        is_ai_generated=(post.member_id is None),  # admin/AI 생성은 member_id=None
        created_at=post.created_at,
        attachments=[_to_attachment_out(a) for a in (post.attachments or [])],
    )


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


# ── 조회 ──────────────────────────────────────────────────

@router.get("/", response_model=list[NoticeOut])
def list_notices(db: Session = Depends(get_db)):
    board_id = _notice_board_id(db)
    posts = (
        db.query(Post)
        .options(joinedload(Post.attachments))
        .filter(Post.board_id == board_id, Post.is_published == True)
        .order_by(desc(Post.is_pinned), desc(Post.created_at))
        .all()
    )
    return [_to_notice_out(p) for p in posts]


@router.get("/paged", response_model=NoticePagedOut)
def list_notices_paged(
    page: int = 1,
    size: int = 20,
    db: Session = Depends(get_db),
):
    """핀 공지는 항상 전체 반환, 일반 공지만 페이지네이션."""
    page = max(1, page)
    size = max(1, min(100, size))
    board_id = _notice_board_id(db)

    pinned = (
        db.query(Post)
        .options(joinedload(Post.attachments))
        .filter(Post.board_id == board_id, Post.is_published == True, Post.is_pinned == True)
        .order_by(desc(Post.created_at))
        .all()
    )
    base = db.query(Post).filter(
        Post.board_id == board_id,
        Post.is_published == True,
        Post.is_pinned == False,
    )
    total = base.count()
    items = (
        base.options(joinedload(Post.attachments))
        .order_by(desc(Post.created_at))
        .offset((page - 1) * size)
        .limit(size)
        .all()
    )
    return NoticePagedOut(
        pinned=[_to_notice_out(p) for p in pinned],
        items=[_to_notice_out(p) for p in items],
        total=total,
        page=page,
        size=size,
    )


@router.get("/{notice_id}", response_model=NoticeOut)
def get_notice(notice_id: int, db: Session = Depends(get_db)):
    board_id = _notice_board_id(db)
    post = (
        db.query(Post)
        .options(joinedload(Post.attachments))
        .filter(Post.id == notice_id, Post.board_id == board_id)
        .first()
    )
    if not post:
        raise HTTPException(status_code=404, detail="공지를 찾을 수 없습니다.")
    return _to_notice_out(post)


# ── 변경 (admin) ──────────────────────────────────────────

@router.post("/", response_model=NoticeOut, status_code=201)
def create_notice(
    body: NoticeIn,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    board_id = _notice_board_id(db)
    post = Post(
        board_id=board_id,
        member_id=None,
        title=body.title,
        content=body.content or "",
        is_published=True,
        is_pinned=body.is_pinned,
        view_count=0,
        created_at=body.created_at or datetime.utcnow(),
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return _to_notice_out(post)


@router.put("/{notice_id}", response_model=NoticeOut)
def update_notice(
    notice_id: int,
    body: NoticeIn,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    board_id = _notice_board_id(db)
    post = db.query(Post).filter(Post.id == notice_id, Post.board_id == board_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="공지를 찾을 수 없습니다.")
    post.title = body.title
    if body.content is not None:
        post.content = body.content
    post.is_pinned = body.is_pinned
    if body.created_at is not None:
        post.created_at = body.created_at
    db.commit()
    db.refresh(post)
    # attachments 재조회
    post = (
        db.query(Post)
        .options(joinedload(Post.attachments))
        .filter(Post.id == notice_id)
        .first()
    )
    return _to_notice_out(post)


@router.delete("/{notice_id}", status_code=204)
def delete_notice(
    notice_id: int,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    board_id = _notice_board_id(db)
    post = (
        db.query(Post)
        .options(joinedload(Post.attachments))
        .filter(Post.id == notice_id, Post.board_id == board_id)
        .first()
    )
    if not post:
        raise HTTPException(status_code=404, detail="공지를 찾을 수 없습니다.")
    for att in post.attachments:
        _remove_file(att.file_url)
    db.delete(post)
    db.commit()
    return None


# ── 첨부 ──────────────────────────────────────────────────

@router.post("/{notice_id}/attachments", response_model=List[NoticeAttachmentOut], status_code=201)
async def upload_notice_attachments(
    notice_id: int,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    """공지에 사진 다중 업로드. board.slug='notice' posts 에 Attachment 추가."""
    board_id = _notice_board_id(db)
    post = db.query(Post).filter(Post.id == notice_id, Post.board_id == board_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="공지를 찾을 수 없습니다.")
    if not files:
        raise HTTPException(status_code=400, detail="파일이 없습니다.")

    save_dir = os.path.join(settings.UPLOAD_DIR, SUBDIR)
    os.makedirs(save_dir, exist_ok=True)

    saved: List[Attachment] = []
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
        att = Attachment(
            post_id=post.id,
            file_url=f"/uploads/{SUBDIR}/{stored}",
            original_name=original,
            stored_name=stored,
            file_size=len(content),
            is_image=True,
        )
        db.add(att)
        saved.append(att)

    db.commit()
    for a in saved:
        db.refresh(a)
    return [_to_attachment_out(a) for a in saved]


@router.delete("/{notice_id}/attachments/{attachment_id}", status_code=204)
def delete_notice_attachment(
    notice_id: int,
    attachment_id: int,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    board_id = _notice_board_id(db)
    post = db.query(Post).filter(Post.id == notice_id, Post.board_id == board_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="공지를 찾을 수 없습니다.")
    att = (
        db.query(Attachment)
        .filter(Attachment.id == attachment_id, Attachment.post_id == post.id)
        .first()
    )
    if not att:
        raise HTTPException(status_code=404, detail="첨부를 찾을 수 없습니다.")
    _remove_file(att.file_url)
    db.delete(att)
    db.commit()
    return None
