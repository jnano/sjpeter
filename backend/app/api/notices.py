"""공지사항 API — 어댑터.

데이터는 board.slug='notice' 의 posts 테이블에 저장되고, 본 API 는 그것을
기존 NoticeOut 응답 형식으로 변환해 노출한다(호출자 호환성 유지).
이전 notices 테이블은 v1.5.69 마이그레이션 후 archive 로만 둠.
"""
import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, or_
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.core.database import get_db
from app.core.auth import get_current_admin, optional_bearer_scheme
from app.core.admin_log import log_action, get_admin_identifier
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
    # 게시판 설정 컬럼 표시용 — 작성자·조회수·댓글·좋아요·공유
    author: Optional[str] = None  # 작성 회원 닉네임. None = 관리자/본당
    view_count: int = 0
    comment_count: int = 0
    like_count: int = 0
    share_count: int = 0
    expires_at: Optional[datetime] = None  # 만료일 — 운영자 화면에서만 표시


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
        author=(getattr(post.member, "nickname", None) if post.member else None),
        view_count=getattr(post, "view_count", 0) or 0,
        comment_count=len(post.comments or []),
        like_count=len(post.likes or []),
        share_count=getattr(post, "share_count", 0) or 0,
        expires_at=getattr(post, "expires_at", None),
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
        .filter(
            Post.board_id == board_id, Post.is_published == True,
            # 만료일 지난 글은 숨김. 단 상단 고정(is_pinned) 글은 만료 제외 → 항상 노출
            or_(Post.is_pinned == True, Post.expires_at.is_(None), Post.expires_at > datetime.utcnow()),
        )
        .order_by(desc(Post.is_pinned), desc(Post.created_at))
        .all()
    )
    return [_to_notice_out(p) for p in posts]


@router.get("/paged", response_model=NoticePagedOut)
def list_notices_paged(
    request: Request,
    page: int = 1,
    size: int = 0,   # 0 이면 게시판 설정(posts_per_page) 사용
    q: str = "",     # 제목·본문 검색
    archived: bool = False,  # True 면 만료된 지난 공지만(고정·미만료 제외) — 운영자 이상 전용
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_bearer_scheme),
    db: Session = Depends(get_db),
):
    """핀 공지는 항상 전체 반환, 일반 공지만 페이지네이션. size=0 이면 게시판 설정 따름.
    archived=True 면 '지난 공지' 아카이브 — 만료된 일반 공지만, 고정 공지는 없음. 운영자 이상만 접근."""
    if archived:
        # 운영자 이상(슈퍼관리자 또는 is_admin 회원)만 — 아니면 401/403 raise
        get_current_admin(request, credentials, db)
    page = max(1, page)
    board = db.query(Board).filter(Board.slug == NOTICE_SLUG).first()
    if not board:
        raise HTTPException(status_code=500, detail="공지사항 게시판이 초기화되지 않았습니다.")
    board_id = board.id
    if size <= 0:
        size = max(1, board.posts_per_page or 20)
    size = max(1, min(100, size))
    qx = (q or "").strip()
    search_cond = or_(Post.title.ilike(f"%{qx}%"), Post.content.ilike(f"%{qx}%")) if qx else None
    now = datetime.utcnow()

    if archived:
        # 지난 공지: 만료된 일반 공지만 (고정·미만료 제외)
        pinned = []
        base = db.query(Post).filter(
            Post.board_id == board_id, Post.is_published == True, Post.is_pinned == False,
            Post.expires_at.isnot(None), Post.expires_at <= now,
        )
    else:
        pinned_q = db.query(Post).options(joinedload(Post.attachments)).filter(
            Post.board_id == board_id, Post.is_published == True, Post.is_pinned == True,
        )
        if search_cond is not None:
            pinned_q = pinned_q.filter(search_cond)
        pinned = pinned_q.order_by(desc(Post.created_at)).all()
        # 일반 공지(비고정)만 페이지네이션 + 만료 필터. 고정(pinned)은 위에서 항상 전체 반환 → 만료 제외.
        base = db.query(Post).filter(
            Post.board_id == board_id,
            Post.is_published == True,
            Post.is_pinned == False,
            or_(Post.expires_at.is_(None), Post.expires_at > now),
        )
    if search_cond is not None:
        base = base.filter(search_cond)
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


@router.get("/admin", response_model=list[NoticeOut])
def list_notices_admin(
    status: str = "active",  # active(노출 중) | expired(만료됨) | all(전체)
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """관리자 공지 조회 — 만료 공지 관리용. status 로 노출중/만료됨/전체 필터."""
    board_id = _notice_board_id(db)
    now = datetime.utcnow()
    base = db.query(Post).options(joinedload(Post.attachments)).filter(
        Post.board_id == board_id, Post.is_published == True,
    )
    if status == "expired":
        # 만료된 일반 공지만 (고정은 만료 제외이므로 빠짐)
        base = base.filter(Post.is_pinned == False, Post.expires_at.isnot(None), Post.expires_at <= now)
    elif status == "active":
        base = base.filter(or_(Post.is_pinned == True, Post.expires_at.is_(None), Post.expires_at > now))
    # status == "all": 추가 필터 없음
    posts = base.order_by(desc(Post.is_pinned), desc(Post.created_at)).all()
    return [_to_notice_out(p) for p in posts]


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
    admin: Admin = Depends(get_current_admin),
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
    log_action(db, get_admin_identifier(admin), "create_notice", "notice", post.id, body.title)
    return _to_notice_out(post)


@router.put("/{notice_id}", response_model=NoticeOut)
def update_notice(
    notice_id: int,
    body: NoticeIn,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
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
    log_action(db, get_admin_identifier(admin), "update_notice", "notice", post.id, body.title)
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
    admin: Admin = Depends(get_current_admin),
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
    snapshot = post.title
    for att in post.attachments:
        _remove_file(att.file_url)
    db.delete(post)
    db.commit()
    log_action(db, get_admin_identifier(admin), "delete_notice", "notice", notice_id, snapshot)
    return None


# ── 첨부 ──────────────────────────────────────────────────

@router.post("/{notice_id}/attachments", response_model=List[NoticeAttachmentOut], status_code=201)
async def upload_notice_attachments(
    notice_id: int,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
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
    log_action(db, get_admin_identifier(admin), "upload_notice_attachment", "notice", notice_id, f"{len(saved)}건 업로드")
    return [_to_attachment_out(a) for a in saved]


@router.delete("/{notice_id}/attachments/{attachment_id}", status_code=204)
def delete_notice_attachment(
    notice_id: int,
    attachment_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
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
    snapshot = att.original_name or att.file_url
    _remove_file(att.file_url)
    db.delete(att)
    db.commit()
    log_action(db, get_admin_identifier(admin), "delete_notice_attachment", "notice", notice_id, snapshot)
    return None
