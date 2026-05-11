import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, or_, func, text
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.core.database import get_db
from app.core.auth import get_current_admin, get_current_member, get_current_author, get_optional_member
from app.core.config import settings
from app.models.board import Board, Post, Comment, BoardAllowedMember
from app.models.attachment import Attachment
from app.models.member import Member
from app.models.admin import Admin
from app.models.event_board_mapping import EventBoardMapping

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
ALLOWED_EXTS = IMAGE_EXTS | {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".hwp", ".zip", ".txt"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

router = APIRouter(tags=["boards"])


# ── 스키마 ────────────────────────────────────────────────

class ModeratorOut(BaseModel):
    id: int
    nickname: str
    email: str = ""
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True


class BoardIn(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    members_only_write: bool = True
    members_only_read: bool = False
    members_selected: bool = False
    moderator_only_write: bool = False
    posts_per_page: int = 12
    exclude_from_search: bool = False
    show_in_menu: bool = True
    moderator_id: Optional[int] = None


class BoardUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    members_only_write: Optional[bool] = None
    members_only_read: Optional[bool] = None
    members_selected: Optional[bool] = None
    moderator_only_write: Optional[bool] = None
    is_active: Optional[bool] = None
    posts_per_page: Optional[int] = None
    exclude_from_search: Optional[bool] = None
    show_in_menu: Optional[bool] = None
    moderator_id: Optional[int] = None


class AllowedMemberOut(BaseModel):
    id: int
    nickname: str
    email: str
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True


class BoardOut(BaseModel):
    id: int
    name: str
    slug: str
    description: Optional[str]
    is_active: bool
    members_only_write: bool
    members_only_read: bool = False
    members_selected: bool = False
    moderator_only_write: bool = False
    posts_per_page: int = 12
    post_count: int = 0
    exclude_from_search: bool = False
    show_in_menu: bool = True
    moderator: Optional[ModeratorOut] = None
    moderator_id: Optional[int] = None
    allowed_members: list[AllowedMemberOut] = []

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
    parent_id: Optional[int] = None


class CommentOut(BaseModel):
    id: int
    content: str
    created_at: datetime
    member: AuthorOut
    parent_id: Optional[int] = None
    replies: list["CommentOut"] = []

    class Config:
        from_attributes = True


CommentOut.model_rebuild()


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
    member: Optional[AuthorOut] = None

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


class ContentSearchItem(BaseModel):
    type: str          # "history" | "vision" | "community"
    label: str         # 배지에 표시할 분류명
    title: str
    excerpt: str
    url: str           # 이동할 페이지 URL


class SearchOut(BaseModel):
    results: list[SearchResultItem]
    content_results: list[ContentSearchItem]
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


class DraftOut(BaseModel):
    id: int
    title: str
    content: str
    created_at: datetime
    board: PostBoardInfo

    class Config:
        from_attributes = True


class DraftMoveBody(BaseModel):
    board_slug: str


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
    from app.models.content import HistoryItem, Vision, CommunityGroup
    from app.models.notice import Notice

    q = q.strip()
    if not q:
        return SearchOut(results=[], content_results=[], total=0, page=page, limit=limit)

    keyword = f"%{q}%"

    # ── 게시글 검색 (paginated) ───────────────────────────
    base_query = (
        db.query(Post)
        .join(Board, Post.board_id == Board.id)
        .options(joinedload(Post.member), joinedload(Post.board))
        .filter(Board.is_active == True)
        .filter(Board.exclude_from_search == False)
        .filter(Post.is_published == True)
        .filter(or_(Post.title.ilike(keyword), Post.content.ilike(keyword)))
        .order_by(desc(Post.created_at))
    )
    total = base_query.count()
    posts = base_query.offset((max(1, page) - 1) * limit).limit(limit).all()

    post_ids = [p.id for p in posts]
    comment_counts = dict(
        db.query(Comment.post_id, func.count(Comment.id))
        .filter(Comment.post_id.in_(post_ids))
        .group_by(Comment.post_id)
        .all()
    ) if post_ids else {}
    results = []
    for p in posts:
        results.append(SearchResultItem(
            id=p.id,
            title=p.title,
            excerpt=_make_excerpt(p.content, q),
            view_count=p.view_count,
            created_at=p.created_at,
            comment_count=comment_counts.get(p.id, 0),
            board=BoardSummary.model_validate(p.board),
            member=AuthorOut.model_validate(p.member) if p.member else None,
        ))

    # ── 콘텐츠 페이지 검색 (전체 반환, 페이지네이션 없음) ─
    content_results: list[ContentSearchItem] = []

    # 공지사항 (notices 별도 테이블) — 핀 우선·최신순
    for n in (
        db.query(Notice)
        .filter(or_(Notice.title.ilike(keyword), Notice.content.ilike(keyword)))
        .order_by(desc(Notice.is_pinned), desc(Notice.created_at))
        .all()
    ):
        excerpt = _make_excerpt(n.content or "", q) if n.content else ""
        content_results.append(ContentSearchItem(
            type="notice", label="공지사항",
            title=n.title,
            excerpt=excerpt,
            url=f"/boards/notice/{n.id}",
        ))

    for h in db.query(HistoryItem).filter(
        or_(HistoryItem.event.ilike(keyword), HistoryItem.detail.ilike(keyword))
    ).order_by(HistoryItem.sort_order).all():
        excerpt = _make_excerpt(h.detail or "", q) if h.detail else f"{h.year}년"
        content_results.append(ContentSearchItem(
            type="history", label="연혁",
            title=f"{h.year}년 — {h.event}",
            excerpt=excerpt,
            url="/history",
        ))

    for v in db.query(Vision).filter(Vision.motto.ilike(keyword)).order_by(Vision.year.desc()).all():
        content_results.append(ContentSearchItem(
            type="vision", label="사목지표",
            title=v.motto,
            excerpt=f"{v.year}년 사목지표",
            url="/vision",
        ))

    for g in db.query(CommunityGroup).filter(
        or_(CommunityGroup.name.ilike(keyword), CommunityGroup.description.ilike(keyword))
    ).order_by(CommunityGroup.sort_order).all():
        content_results.append(ContentSearchItem(
            type="community", label="단체/분과",
            title=g.name,
            excerpt=g.description or "",
            url=g.link_url or "/community",
        ))

    # ── 댓글 검색 ──────────────────────────────────────────
    comment_rows = (
        db.query(Comment)
        .join(Post, Comment.post_id == Post.id)
        .join(Board, Post.board_id == Board.id)
        .options(joinedload(Comment.post).joinedload(Post.board))
        .filter(Board.is_active == True)
        .filter(Board.exclude_from_search == False)
        .filter(Board.members_only_read == False)
        .filter(Comment.content.ilike(keyword))
        .order_by(desc(Comment.created_at))
        .limit(20)
        .all()
    )
    for c in comment_rows:
        content_results.append(ContentSearchItem(
            type="comment", label="댓글",
            title=c.post.title,
            excerpt=_make_excerpt(c.content, q),
            url=f"/boards/{c.post.board.slug}/{c.post_id}",
        ))

    return SearchOut(results=results, content_results=content_results, total=total, page=page, limit=limit)


# ── 게시판 ────────────────────────────────────────────────

@router.get("/api/boards", response_model=list[BoardOut])
def list_boards(include_inactive: bool = False, db: Session = Depends(get_db)):
    query = db.query(Board).options(joinedload(Board.moderator))
    if not include_inactive:
        # 공개 목록: 비활성·내부 전용 게시판(exclude_from_search) 제외
        query = query.filter(Board.is_active == True, Board.exclude_from_search == False)
    boards = query.all()

    # 게시글 수를 단일 쿼리로 집계 (N+1 방지)
    board_ids = [b.id for b in boards]
    count_filter = [Post.board_id.in_(board_ids)]
    if not include_inactive:
        count_filter.append(Post.is_published == True)
    counts_q = (
        db.query(Post.board_id, func.count(Post.id))
        .filter(*count_filter)
        .group_by(Post.board_id)
        .all()
    )
    count_map = {board_id: cnt for board_id, cnt in counts_q}

    result = []
    for b in boards:
        out = BoardOut.model_validate(b)
        out.post_count = count_map.get(b.id, 0)
        result.append(out)
    return result


def _board_out(board: Board, db: Session) -> BoardOut:
    count = db.query(Post).filter(Post.board_id == board.id).count()
    out = BoardOut.model_validate(board)
    out.post_count = count
    out.allowed_members = [
        AllowedMemberOut.model_validate(bam.member)
        for bam in db.query(BoardAllowedMember)
            .options(joinedload(BoardAllowedMember.member))
            .filter(BoardAllowedMember.board_id == board.id)
            .all()
    ]
    return out


class AllowedMemberIn(BaseModel):
    member_id: int


def _check_selected_access(board: Board, viewer: Optional[Member], db: Session):
    if not board.members_selected:
        return
    if not viewer:
        raise HTTPException(status_code=403, detail="접근 권한이 있는 회원만 볼 수 있는 게시판입니다.")
    exists = db.query(BoardAllowedMember).filter(
        BoardAllowedMember.board_id == board.id,
        BoardAllowedMember.member_id == viewer.id,
    ).first()
    if not exists:
        raise HTTPException(status_code=403, detail="접근 권한이 없는 게시판입니다.")


# ── 임시저장 게시글 관리 (관리자 전용) ──────────────────────

@router.get("/api/boards/drafts/count")
def get_draft_count(db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    count = db.query(Post).filter(Post.is_published == False).count()
    return {"count": count}


@router.get("/api/boards/drafts", response_model=list[DraftOut])
def list_drafts(db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    return (
        db.query(Post)
        .options(joinedload(Post.board))
        .filter(Post.is_published == False)
        .order_by(desc(Post.created_at))
        .all()
    )


@router.post("/api/boards/drafts/{post_id}/publish", response_model=DraftOut)
def publish_draft(post_id: int, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    post = db.query(Post).options(joinedload(Post.board)).filter(Post.id == post_id, Post.is_published == False).first()
    if not post:
        raise HTTPException(status_code=404, detail="임시저장 게시글을 찾을 수 없습니다.")
    post.is_published = True
    db.commit()
    return db.query(Post).options(joinedload(Post.board)).filter(Post.id == post_id).first()


@router.patch("/api/boards/drafts/{post_id}/move", response_model=DraftOut)
def move_draft(post_id: int, body: DraftMoveBody, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    post = db.query(Post).filter(Post.id == post_id, Post.is_published == False).first()
    if not post:
        raise HTTPException(status_code=404, detail="임시저장 게시글을 찾을 수 없습니다.")
    board = db.query(Board).filter(Board.slug == body.board_slug, Board.is_active == True).first()
    if not board:
        raise HTTPException(status_code=404, detail="게시판을 찾을 수 없습니다.")
    post.board_id = board.id
    db.commit()
    return db.query(Post).options(joinedload(Post.board)).filter(Post.id == post_id).first()


@router.delete("/api/boards/drafts/{post_id}", status_code=204)
def delete_draft(post_id: int, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    post = db.query(Post).filter(Post.id == post_id, Post.is_published == False).first()
    if not post:
        raise HTTPException(status_code=404, detail="임시저장 게시글을 찾을 수 없습니다.")
    db.delete(post)
    db.commit()


class PublishMultiBody(BaseModel):
    additional_board_slugs: list[str] = []
    add_calendar: bool = False


@router.post("/api/boards/drafts/{post_id}/publish-multi")
def publish_draft_multi(
    post_id: int,
    body: PublishMultiBody,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    post = db.query(Post).options(joinedload(Post.board)).filter(
        Post.id == post_id, Post.is_published == False
    ).first()
    if not post:
        raise HTTPException(status_code=404, detail="임시저장 게시글을 찾을 수 없습니다.")

    # 원본 게시
    post.is_published = True

    # 추가 게시판에 복사본 생성
    for slug in body.additional_board_slugs:
        board = db.query(Board).filter(Board.slug == slug, Board.is_active == True).first()
        if not board or board.id == post.board_id:
            continue
        copy = Post(
            board_id=board.id,
            member_id=post.member_id,
            title=post.title,
            content=post.content,
            is_published=True,
        )
        db.add(copy)

    # 행사일정에 등록
    if body.add_calendar:
        db.execute(
            text(
                "INSERT INTO events (title, description, event_date, location, category, is_public) "
                "VALUES (:title, :desc, :edate, :loc, :cat, TRUE)"
            ),
            {
                "title": post.title,
                "desc": post.content or None,
                "edate": None,
                "loc": None,
                "cat": "general",
            },
        )

    db.commit()
    return {"ok": True}


# ── 이벤트 유형 → 게시판 매핑 관리 (관리자 전용) ──────────────

class MappingOut(BaseModel):
    event_type: str
    board_id: Optional[int] = None
    board_name: Optional[str] = None
    board_slug: Optional[str] = None
    use_calendar: bool = False


class MappingUpdate(BaseModel):
    board_id: Optional[int] = None
    use_calendar: bool = False


def _mapping_to_out(m: EventBoardMapping) -> MappingOut:
    return MappingOut(
        event_type=m.event_type,
        board_id=m.board_id,
        board_name=m.board.name if m.board else None,
        board_slug=m.board.slug if m.board else None,
        use_calendar=m.use_calendar,
    )


@router.get("/api/boards/event-mapping", response_model=list[MappingOut])
def list_event_mappings(db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    mappings = (
        db.query(EventBoardMapping)
        .options(joinedload(EventBoardMapping.board))
        .order_by(EventBoardMapping.id)
        .all()
    )
    return [_mapping_to_out(m) for m in mappings]


@router.patch("/api/boards/event-mapping/{event_type}", response_model=MappingOut)
def update_event_mapping(
    event_type: str,
    body: MappingUpdate,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    mapping = db.query(EventBoardMapping).filter(EventBoardMapping.event_type == event_type).first()
    if not mapping:
        raise HTTPException(status_code=404, detail="매핑을 찾을 수 없습니다.")
    if body.use_calendar:
        mapping.board_id = None
        mapping.use_calendar = True
    else:
        if body.board_id is not None:
            board = db.query(Board).filter(Board.id == body.board_id, Board.is_active == True).first()
            if not board:
                raise HTTPException(status_code=404, detail="게시판을 찾을 수 없습니다.")
        mapping.board_id = body.board_id
        mapping.use_calendar = False
    db.commit()
    db.refresh(mapping)
    return _mapping_to_out(mapping)


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
    return _board_out(board, db)


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
    board = db.query(Board).options(joinedload(Board.moderator)).filter(Board.slug == slug).first()
    return _board_out(board, db)


@router.get("/api/boards/{slug}/allowed-members", response_model=list[AllowedMemberOut])
def list_allowed_members(slug: str, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    board = db.query(Board).filter(Board.slug == slug).first()
    if not board:
        raise HTTPException(status_code=404)
    rows = (db.query(BoardAllowedMember)
            .options(joinedload(BoardAllowedMember.member))
            .filter(BoardAllowedMember.board_id == board.id).all())
    return [AllowedMemberOut.model_validate(r.member) for r in rows]


@router.post("/api/boards/{slug}/allowed-members", status_code=201)
def add_allowed_member(slug: str, body: AllowedMemberIn, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    board = db.query(Board).filter(Board.slug == slug).first()
    if not board:
        raise HTTPException(status_code=404)
    if not db.query(Member).filter(Member.id == body.member_id).first():
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")
    exists = db.query(BoardAllowedMember).filter(
        BoardAllowedMember.board_id == board.id,
        BoardAllowedMember.member_id == body.member_id,
    ).first()
    if not exists:
        db.add(BoardAllowedMember(board_id=board.id, member_id=body.member_id))
        db.commit()
    return {"ok": True}


@router.delete("/api/boards/{slug}/allowed-members/{member_id}", status_code=204)
def remove_allowed_member(slug: str, member_id: int, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    board = db.query(Board).filter(Board.slug == slug).first()
    if not board:
        raise HTTPException(status_code=404)
    row = db.query(BoardAllowedMember).filter(
        BoardAllowedMember.board_id == board.id,
        BoardAllowedMember.member_id == member_id,
    ).first()
    if row:
        db.delete(row)
        db.commit()


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
    _check_selected_access(board, viewer, db)
    per_page = max(1, board.posts_per_page)
    skip = (max(1, page) - 1) * per_page
    total = db.query(Post).filter(Post.board_id == board.id, Post.is_published == True).count()
    posts = (
        db.query(Post)
        .options(joinedload(Post.member), joinedload(Post.attachments))
        .filter(Post.board_id == board.id, Post.is_published == True)
        .order_by(desc(Post.created_at))
        .offset(skip).limit(per_page).all()
    )
    post_ids = [p.id for p in posts]
    comment_counts = dict(
        db.query(Comment.post_id, func.count(Comment.id))
        .filter(Comment.post_id.in_(post_ids))
        .group_by(Comment.post_id)
        .all()
    ) if post_ids else {}
    result = []
    for p in posts:
        s = PostSummary.model_validate(p)
        s.comment_count = comment_counts.get(p.id, 0)
        first_img = next((a for a in p.attachments if a.is_image), None)
        s.thumbnail_url = first_img.file_url if first_img else None
        result.append(s)
    return PostListOut(posts=result, total=total, posts_per_page=per_page)


@router.post("/api/boards/{slug}/posts", response_model=PostOut, status_code=201)
def create_post(
    slug: str,
    body: PostIn,
    db: Session = Depends(get_db),
    current: Optional[Member] = Depends(get_current_author),
):
    board = _get_board_or_404(slug, db)
    if board.moderator_only_write and (
        current is None or (board.moderator_id != current.id and not current.is_admin)
    ):
        raise HTTPException(status_code=403, detail="게시판 관리자만 글을 작성할 수 있습니다.")
    post = Post(board_id=board.id, member_id=current.id if current else None, **body.model_dump())
    db.add(post)
    db.commit()
    db.refresh(post)
    return (
        db.query(Post)
        .options(joinedload(Post.member), joinedload(Post.attachments))
        .filter(Post.id == post.id)
        .first()
    )


@router.get("/api/boards/{slug}/posts/{post_id}", response_model=PostOut)
def get_post(slug: str, post_id: int, db: Session = Depends(get_db), viewer: Optional[Member] = Depends(get_optional_member)):
    board = _get_board_or_404(slug, db)
    if board.members_only_read and not viewer:
        raise HTTPException(status_code=403, detail="회원만 볼 수 있는 게시판입니다.")
    _check_selected_access(board, viewer, db)
    post = _get_post_or_404(slug, post_id, db)
    post.view_count += 1
    db.commit()
    post_obj = (
        db.query(Post)
        .options(
            joinedload(Post.member),
            joinedload(Post.comments).joinedload(Comment.member),
            joinedload(Post.comments).joinedload(Comment.replies).joinedload(Comment.member),
            joinedload(Post.attachments),
            joinedload(Post.board),
        )
        .filter(Post.id == post_id)
        .first()
    )
    # 최상위 댓글(parent_id=None)만 PostOut에 포함; 대댓글은 replies에 있음
    if post_obj:
        post_obj.comments = [c for c in post_obj.comments if c.parent_id is None]
    return post_obj


@router.put("/api/boards/{slug}/posts/{post_id}", response_model=PostOut)
def update_post(
    slug: str,
    post_id: int,
    body: PostIn,
    db: Session = Depends(get_db),
    current: Optional[Member] = Depends(get_current_author),
):
    board = _get_board_or_404(slug, db)
    post = _get_post_or_404(slug, post_id, db)
    if current and post.member_id != current.id and board.moderator_id != current.id:
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
    current: Optional[Member] = Depends(get_current_author),
):
    board = _get_board_or_404(slug, db)
    post = _get_post_or_404(slug, post_id, db)
    if current and post.member_id != current.id and board.moderator_id != current.id:
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
    if body.parent_id:
        parent = db.query(Comment).filter(Comment.id == body.parent_id, Comment.post_id == post_id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="부모 댓글을 찾을 수 없습니다.")
    comment = Comment(post_id=post_id, member_id=current.id, content=body.content, parent_id=body.parent_id)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return db.query(Comment).options(joinedload(Comment.member)).filter(Comment.id == comment.id).first()


@router.put("/api/boards/{slug}/posts/{post_id}/comments/{comment_id}", response_model=CommentOut)
def update_comment(
    slug: str,
    post_id: int,
    comment_id: int,
    body: CommentIn,
    db: Session = Depends(get_db),
    current: Member = Depends(get_current_member),
):
    comment = db.query(Comment).filter(Comment.id == comment_id, Comment.post_id == post_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다.")
    if comment.member_id != current.id:
        raise HTTPException(status_code=403, detail="본인 댓글만 수정할 수 있습니다.")
    if not body.content.strip():
        raise HTTPException(status_code=400, detail="댓글 내용을 입력해 주세요.")
    comment.content = body.content.strip()
    db.commit()
    return db.query(Comment).options(joinedload(Comment.member)).filter(Comment.id == comment_id).first()


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
    post_ids = [p.id for p in posts]
    comment_counts = dict(
        db.query(Comment.post_id, func.count(Comment.id))
        .filter(Comment.post_id.in_(post_ids))
        .group_by(Comment.post_id)
        .all()
    ) if post_ids else {}
    result = []
    for p in posts:
        result.append(MyPostOut(
            id=p.id,
            title=p.title,
            view_count=p.view_count,
            created_at=p.created_at,
            comment_count=comment_counts.get(p.id, 0),
            board=BoardSummary(id=p.board.id, name=p.board.name, slug=p.board.slug),
        ))
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
    current: Optional[Member] = Depends(get_current_author),
):
    post = _get_post_or_404(slug, post_id, db)
    if current and post.member_id != current.id:
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
    current: Optional[Member] = Depends(get_current_author),
):
    post = _get_post_or_404(slug, post_id, db)
    if current and post.member_id != current.id:
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
