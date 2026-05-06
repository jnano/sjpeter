import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, or_
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.core.database import get_db
from app.core.auth import get_current_admin, get_current_member, get_optional_member
from app.core.config import settings
from app.models.board import Board, Post, Comment
from app.models.attachment import Attachment
from app.models.member import Member
from app.models.admin import Admin

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
ALLOWED_EXTS = IMAGE_EXTS | {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".hwp", ".zip", ".txt"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

router = APIRouter(tags=["boards"])


# ── 스키마 ────────────────────────────────────────────────

class ModeratorOut(BaseModel):
    id: int
    nickname: str
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True


class BoardIn(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    members_only_write: bool = True
    members_only_read: bool = False
    posts_per_page: int = 20
    exclude_from_search: bool = False
    moderator_id: Optional[int] = None


class BoardUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    members_only_write: Optional[bool] = None
    members_only_read: Optional[bool] = None
    is_active: Optional[bool] = None
    posts_per_page: Optional[int] = None
    exclude_from_search: Optional[bool] = None
    moderator_id: Optional[int] = None


class BoardOut(BaseModel):
    id: int
    name: str
    slug: str
    description: Optional[str]
    is_active: bool
    members_only_write: bool
    members_only_read: bool = False
    posts_per_page: int = 20
    post_count: int = 0
    exclude_from_search: bool = False
    moderator: Optional[ModeratorOut] = None

    class Config:
        from_attributes = True


class PostIn(BaseModel):
    title: str
    content: str


class AuthorOut(BaseModel):
    id: int
    nickname: str
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True


class CommentIn(BaseModel):
    content: str


class CommentOut(BaseModel):
    id: int
    content: str
    created_at: datetime
    member: AuthorOut

    class Config:
        from_attributes = True


class AttachmentOut(BaseModel):
    id: int
    original_name: str
    file_url: str
    file_size: int
    is_image: bool
    created_at: datetime

    class Config:
        from_attributes = True


class PostBoardInfo(BaseModel):
    id: int
    name: str
    slug: str
    moderator_id: Optional[int] = None

    class Config:
        from_attributes = True


class PostOut(BaseModel):
    id: int
    title: str
    content: str
    view_count: int
    created_at: datetime
    updated_at: datetime
    member: Optional[AuthorOut] = None
    comments: list[CommentOut] = []
    attachments: list[AttachmentOut] = []
    board: Optional[PostBoardInfo] = None

    class Config:
        from_attributes = True


class PostSummary(BaseModel):
    id: int
    title: str
    view_count: int
    created_at: datetime
    comment_count: int = 0
    thumbnail_url: Optional[str] = None
    member: AuthorOut

    class Config:
        from_attributes = True


class PostListOut(BaseModel):
    posts: list[PostSummary]
    total: int
    posts_per_page: int


class BoardSummary(BaseModel):
    id: int
    name: str
    slug: str

    class Config:
        from_attributes = True


class MyPostOut(BaseModel):
    id: int
    title: str
    view_count: int
    created_at: datetime
    comment_count: int = 0
    board: BoardSummary

    class Config:
        from_attributes = True


class SearchResultItem(BaseModel):
    id: int
    title: str
    excerpt: str
    view_count: int
    created_at: datetime
    comment_count: int = 0
    board: BoardSummary
    member: Optional[AuthorOut] = None

    class Config:
        from_attributes = True


class SearchOut(BaseModel):
    results: list[SearchResultItem]
    total: int
    page: int
    limit: int


class MyCommentOut(BaseModel):
    id: int
    content: str
    created_at: datetime
    post_id: int
    post_title: str = ""
    board_slug: str = ""

    class Config:
        from_attributes = True


# ── 검색 ────────────────────────────────────────────────

EXCERPT_LEN = 120


def _make_excerpt(content: str, keyword: str) -> str:
    lower = content.lower()
    idx = lower.find(keyword.lower())
    if idx == -1:
        return content[:EXCERPT_LEN] + ("..." if len(content) > EXCERPT_LEN else "")
    start = max(0, idx - 30)
    end = min(len(content), start + EXCERPT_LEN)
    prefix = "..." if start > 0 else ""
    suffix = "..." if end < len(content) else ""
    return prefix + content[start:end] + suffix


@router.get("/api/search", response_model=SearchOut)
def search_posts(q: str = "", page: int = 1, limit: int = 10, db: Session = Depends(get_db)):
    q = q.strip()
    if not q:
        return SearchOut(results=[], total=0, page=page, limit=limit)

    keyword = f"%{q}%"
    base_query = (
        db.query(Post)
        .join(Board, Post.board_id == Board.id)
        .options(joinedload(Post.member), joinedload(Post.board))
        .filter(Board.is_active == True)
        .filter(Board.exclude_from_search == False)
        .filter(or_(Post.title.ilike(keyword), Post.content.ilike(keyword)))
        .order_by(desc(Post.created_at))
    )
    total = base_query.count()
    posts = base_query.offset((max(1, page) - 1) * limit).limit(limit).all()

    results = []
    for p in posts:
        comment_count = db.query(Comment).filter(Comment.post_id == p.id).count()
        results.append(SearchResultItem(
            id=p.id,
            title=p.title,
            excerpt=_make_excerpt(p.content, q),
            view_count=p.view_count,
            created_at=p.created_at,
            comment_count=comment_count,
            board=BoardSummary.model_validate(p.board),
            member=AuthorOut.model_validate(p.member) if p.member else None,
        ))
    return SearchOut(results=results, total=total, page=page, limit=limit)


# ── 게시판 ────────────────────────────────────────────────

@router.get("/api/boards", response_model=list[BoardOut])
def list_boards(include_inactive: bool = False, db: Session = Depends(get_db)):
    query = db.query(Board).options(joinedload(Board.moderator))
    if not include_inactive:
        query = query.filter(Board.is_active == True)
    boards = query.all()
    result = []
    for b in boards:
        count = db.query(Post).filter(Post.board_id == b.id).count()
        out = BoardOut.model_validate(b)
        out.post_count = count
        result.append(out)
    return result


@router.get("/api/boards/{slug}", response_model=BoardOut)
def get_board(slug: str, db: Session = Depends(get_db)):
    board = (
        db.query(Board)
        .options(joinedload(Board.moderator))
        .filter(Board.slug == slug, Board.is_active == True)
        .first()
    )
    if not board:
        raise HTTPException(status_code=404, detail="게시판을 찾을 수 없습니다.")
    count = db.query(Post).filter(Post.board_id == board.id).count()
    out = BoardOut.model_validate(board)
    out.post_count = count
    return out


@router.post("/api/boards", response_model=BoardOut, status_code=201)
def create_board(body: BoardIn, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    if db.query(Board).filter(Board.slug == body.slug).first():
        raise HTTPException(status_code=400, detail="이미 사용 중인 슬러그입니다.")
    board = Board(**body.model_dump())
    db.add(board)
    db.commit()
    db.refresh(board)
    out = BoardOut.model_validate(board)
    out.post_count = 0
    return out


@router.put("/api/boards/{slug}", response_model=BoardOut)
def update_board(slug: str, body: BoardUpdate, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    board = db.query(Board).filter(Board.slug == slug).first()
    if not board:
        raise HTTPException(status_code=404, detail="게시판을 찾을 수 없습니다.")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(board, k, v)
    db.commit()
    board = (
        db.query(Board)
        .options(joinedload(Board.moderator))
        .filter(Board.slug == slug)
        .first()
    )
    count = db.query(Post).filter(Post.board_id == board.id).count()
    out = BoardOut.model_validate(board)
    out.post_count = count
    return out


@router.delete("/api/boards/{slug}", status_code=204)
def delete_board(slug: str, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    board = db.query(Board).filter(Board.slug == slug).first()
    if not board:
        raise HTTPException(status_code=404, detail="게시판을 찾을 수 없습니다.")
    db.delete(board)
    db.commit()


# ── 게시글 ────────────────────────────────────────────────

@router.get("/api/boards/{slug}/posts", response_model=PostListOut)
def list_posts(slug: str, page: int = 1, db: Session = Depends(get_db), viewer: Optional[Member] = Depends(get_optional_member)):
    board = _get_board_or_404(slug, db)
    if board.members_only_read and not viewer:
        raise HTTPException(status_code=403, detail="회원만 볼 수 있는 게시판입니다.")
    per_page = max(1, board.posts_per_page)
    skip = (max(1, page) - 1) * per_page
    total = db.query(Post).filter(Post.board_id == board.id).count()
    posts = (
        db.query(Post)
        .options(joinedload(Post.member), joinedload(Post.attachments))
        .filter(Post.board_id == board.id)
        .order_by(desc(Post.created_at))
        .offset(skip).limit(per_page).all()
    )
    result = []
    for p in posts:
        s = PostSummary.model_validate(p)
        s.comment_count = db.query(Comment).filter(Comment.post_id == p.id).count()
        first_img = next((a for a in p.attachments if a.is_image), None)
        s.thumbnail_url = first_img.file_url if first_img else None
        result.append(s)
    return PostListOut(posts=result, total=total, posts_per_page=per_page)


@router.post("/api/boards/{slug}/posts", response_model=PostOut, status_code=201)
def create_post(
    slug: str,
    body: PostIn,
    db: Session = Depends(get_db),
    current: Member = Depends(get_current_member),
):
    board = _get_board_or_404(slug, db)
    post = Post(board_id=board.id, member_id=current.id, **body.model_dump())
    db.add(post)
    db.commit()
    db.refresh(post)
    return (
        db.query(Post)
        .options(joinedload(Post.member), joinedload(Post.comments).joinedload(Comment.member), joinedload(Post.attachments))
        .filter(Post.id == post.id)
        .first()
    )


@router.get("/api/boards/{slug}/posts/{post_id}", response_model=PostOut)
def get_post(slug: str, post_id: int, db: Session = Depends(get_db), viewer: Optional[Member] = Depends(get_optional_member)):
    board = _get_board_or_404(slug, db)
    if board.members_only_read and not viewer:
        raise HTTPException(status_code=403, detail="회원만 볼 수 있는 게시판입니다.")
    post = _get_post_or_404(slug, post_id, db)
    post.view_count += 1
    db.commit()
    return (
        db.query(Post)
        .options(
            joinedload(Post.member),
            joinedload(Post.comments).joinedload(Comment.member),
            joinedload(Post.attachments),
            joinedload(Post.board),
        )
        .filter(Post.id == post_id)
        .first()
    )


@router.put("/api/boards/{slug}/posts/{post_id}", response_model=PostOut)
def update_post(
    slug: str,
    post_id: int,
    body: PostIn,
    db: Session = Depends(get_db),
    current: Member = Depends(get_current_member),
):
    board = _get_board_or_404(slug, db)
    post = _get_post_or_404(slug, post_id, db)
    if post.member_id != current.id and board.moderator_id != current.id:
        raise HTTPException(status_code=403, detail="본인 게시글만 수정할 수 있습니다.")
    post.title = body.title
    post.content = body.content
    db.commit()
    return (
        db.query(Post)
        .options(joinedload(Post.member), joinedload(Post.comments).joinedload(Comment.member), joinedload(Post.attachments))
        .filter(Post.id == post_id)
        .first()
    )


@router.delete("/api/boards/{slug}/posts/{post_id}", status_code=204)
def delete_post(
    slug: str,
    post_id: int,
    db: Session = Depends(get_db),
    current: Member = Depends(get_current_member),
):
    board = _get_board_or_404(slug, db)
    post = _get_post_or_404(slug, post_id, db)
    if post.member_id != current.id and board.moderator_id != current.id:
        raise HTTPException(status_code=403, detail="본인 게시글만 삭제할 수 있습니다.")
    db.delete(post)
    db.commit()


# ── 댓글 ──────────────────────────────────────────────────

@router.post("/api/boards/{slug}/posts/{post_id}/comments", response_model=CommentOut, status_code=201)
def create_comment(
    slug: str,
    post_id: int,
    body: CommentIn,
    db: Session = Depends(get_db),
    current: Member = Depends(get_current_member),
):
    _get_post_or_404(slug, post_id, db)
    comment = Comment(post_id=post_id, member_id=current.id, content=body.content)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return db.query(Comment).options(joinedload(Comment.member)).filter(Comment.id == comment.id).first()


@router.delete("/api/boards/{slug}/posts/{post_id}/comments/{comment_id}", status_code=204)
def delete_comment(
    slug: str,
    post_id: int,
    comment_id: int,
    db: Session = Depends(get_db),
    current: Member = Depends(get_current_member),
):
    comment = db.query(Comment).filter(Comment.id == comment_id, Comment.post_id == post_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다.")
    if comment.member_id != current.id:
        raise HTTPException(status_code=403, detail="본인 댓글만 삭제할 수 있습니다.")
    db.delete(comment)
    db.commit()


# ── 내 게시글·댓글 조회 (마이페이지용) ───────────────────

@router.get("/api/members/me/posts", response_model=list[MyPostOut])
def my_posts(db: Session = Depends(get_db), current: Member = Depends(get_current_member)):
    posts = (
        db.query(Post)
        .options(joinedload(Post.board))
        .filter(Post.member_id == current.id)
        .order_by(desc(Post.created_at))
        .all()
    )
    result = []
    for p in posts:
        out = MyPostOut(
            id=p.id,
            title=p.title,
            view_count=p.view_count,
            created_at=p.created_at,
            comment_count=db.query(Comment).filter(Comment.post_id == p.id).count(),
            board=BoardSummary(id=p.board.id, name=p.board.name, slug=p.board.slug),
        )
        result.append(out)
    return result


@router.get("/api/members/me/comments", response_model=list[MyCommentOut])
def my_comments(db: Session = Depends(get_db), current: Member = Depends(get_current_member)):
    comments = (
        db.query(Comment)
        .options(joinedload(Comment.post).joinedload(Post.board))
        .filter(Comment.member_id == current.id)
        .order_by(desc(Comment.created_at))
        .all()
    )
    result = []
    for c in comments:
        result.append(MyCommentOut(
            id=c.id,
            content=c.content,
            created_at=c.created_at,
            post_id=c.post_id,
            post_title=c.post.title if c.post else "",
            board_slug=c.post.board.slug if c.post and c.post.board else "",
        ))
    return result


# ── 첨부파일 ──────────────────────────────────────────────

@router.post("/api/boards/{slug}/posts/{post_id}/attachments", response_model=AttachmentOut, status_code=201)
async def upload_attachment(
    slug: str,
    post_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current: Member = Depends(get_current_member),
):
    post = _get_post_or_404(slug, post_id, db)
    if post.member_id != current.id:
        raise HTTPException(status_code=403, detail="본인 게시글에만 파일을 첨부할 수 있습니다.")

    original = file.filename or "file"
    ext = os.path.splitext(original)[1].lower()
    if ext not in ALLOWED_EXTS:
        raise HTTPException(status_code=400, detail=f"허용되지 않는 파일 형식입니다. ({ext})")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="파일 크기는 10MB 이하여야 합니다.")

    stored = f"{uuid.uuid4().hex}{ext}"
    save_dir = os.path.join(settings.UPLOAD_DIR, "attachments")
    os.makedirs(save_dir, exist_ok=True)
    with open(os.path.join(save_dir, stored), "wb") as f_out:
        f_out.write(content)

    attachment = Attachment(
        post_id=post_id,
        original_name=original,
        stored_name=stored,
        file_url=f"/uploads/attachments/{stored}",
        file_size=len(content),
        is_image=ext in IMAGE_EXTS,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return attachment


@router.delete("/api/boards/{slug}/posts/{post_id}/attachments/{attachment_id}", status_code=204)
def delete_attachment(
    slug: str,
    post_id: int,
    attachment_id: int,
    db: Session = Depends(get_db),
    current: Member = Depends(get_current_member),
):
    post = _get_post_or_404(slug, post_id, db)
    if post.member_id != current.id:
        raise HTTPException(status_code=403, detail="본인 게시글의 파일만 삭제할 수 있습니다.")

    att = db.query(Attachment).filter(Attachment.id == attachment_id, Attachment.post_id == post_id).first()
    if not att:
        raise HTTPException(status_code=404, detail="첨부파일을 찾을 수 없습니다.")

    file_path = os.path.join(att.file_url.lstrip("/"))
    if os.path.exists(file_path):
        os.remove(file_path)

    db.delete(att)
    db.commit()


# ── 내부 헬퍼 ────────────────────────────────────────────

def _get_board_or_404(slug: str, db: Session) -> Board:
    board = db.query(Board).filter(Board.slug == slug, Board.is_active == True).first()
    if not board:
        raise HTTPException(status_code=404, detail="게시판을 찾을 수 없습니다.")
    return board


def _get_post_or_404(slug: str, post_id: int, db: Session) -> Post:
    board = _get_board_or_404(slug, db)
    post = db.query(Post).filter(Post.id == post_id, Post.board_id == board.id).first()
    if not post:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")
    return post
