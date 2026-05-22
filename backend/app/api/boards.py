import logging
import os
import re
import time
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Request
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, or_, and_, func, text, case
from sqlalchemy.orm.attributes import flag_modified  # noqa: F401  # for future use
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date
from app.core.database import get_db
from app.core.auth import get_current_admin, get_current_member, get_current_author, get_optional_member
from app.core.config import settings
from app.models.board import Board, Post, Comment, BoardAllowedMember, PostLike, BoardAdminGroup
from app.models.attachment import Attachment
from app.models.member import Member
from app.models.admin import Admin
from app.models.event_board_mapping import EventBoardMapping

logger = logging.getLogger(__name__)

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
    kind: str = "default"  # 'default' | 'line'
    # 목록 표시 컬럼 토글 (v1.5.120)
    list_show_number: bool = False
    list_show_author: bool = True
    list_show_date: bool = True
    list_show_views: bool = True
    list_show_likes: bool = False
    list_show_comments: bool = True
    list_show_shares: bool = False
    # 공개 페이지 뷰 토글 노출 여부 (v1.5.138)
    show_view_list: bool = True
    show_view_card: bool = True
    show_view_photo: bool = True
    show_search_form: bool = True
    share_enabled: bool = True


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
    admin_group_id: Optional[int] = None
    kind: Optional[str] = None
    list_show_number: Optional[bool] = None
    list_show_author: Optional[bool] = None
    list_show_date: Optional[bool] = None
    list_show_views: Optional[bool] = None
    list_show_likes: Optional[bool] = None
    list_show_comments: Optional[bool] = None
    show_view_list: Optional[bool] = None
    show_view_card: Optional[bool] = None
    show_view_photo: Optional[bool] = None
    show_search_form: Optional[bool] = None
    list_show_shares: Optional[bool] = None
    share_enabled: Optional[bool] = None


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
    kind: str = "default"
    list_show_number: bool = False
    list_show_author: bool = True
    list_show_date: bool = True
    list_show_views: bool = True
    list_show_likes: bool = False
    list_show_comments: bool = True
    show_view_list: bool = True
    show_view_card: bool = True
    show_view_photo: bool = True
    show_search_form: bool = True
    list_show_shares: bool = False
    share_enabled: bool = True
    moderator: Optional[ModeratorOut] = None
    moderator_id: Optional[int] = None
    admin_group_id: Optional[int] = None
    allowed_members: list[AllowedMemberOut] = []

    class Config:
        from_attributes = True


class PostIn(BaseModel):
    title: str
    content: str = ""               # 한 줄 게시판은 빈 본문 허용
    intention_kind: Optional[str] = None
    intention_for: Optional[str] = None
    category: Optional[str] = None
    share_allowed: bool = False


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
    share_enabled: bool = True

    class Config:
        from_attributes = True


class PostOut(BaseModel):
    id: int
    title: str
    content: str
    view_count: int
    created_at: datetime
    updated_at: datetime
    is_pinned: bool = False
    intention_kind: Optional[str] = None
    intention_for: Optional[str] = None
    category: Optional[str] = None
    like_count: int = 0
    liked_by_me: bool = False
    share_allowed: bool = False
    share_count: int = 0
    member: Optional[AuthorOut] = None
    comments: list[CommentOut] = []
    attachments: list[AttachmentOut] = []
    board: Optional[PostBoardInfo] = None

    class Config:
        from_attributes = True


class PostPinIn(BaseModel):
    is_pinned: bool


_VIDEO_URL_RE = re.compile(
    r"https?://(?:"
    r"(?:www\.)?youtube\.com/(?:watch\?v=|embed/|shorts/)|"
    r"youtu\.be/|"
    r"(?:www\.)?youtube-nocookie\.com/embed/|"
    r"tv\.naver\.com/(?:v|embed)/|"
    r"naver\.me/"
    r")[A-Za-z0-9_-]+",
    re.IGNORECASE,
)


def _has_video(content: Optional[str]) -> bool:
    if not content:
        return False
    return bool(_VIDEO_URL_RE.search(content))


class PostSummary(BaseModel):
    id: int
    title: str
    view_count: int
    created_at: datetime
    comment_count: int = 0
    thumbnail_url: Optional[str] = None
    has_video: bool = False
    is_pinned: bool = False
    intention_kind: Optional[str] = None
    intention_for: Optional[str] = None
    category: Optional[str] = None
    like_count: int = 0
    liked_by_me: bool = False
    share_allowed: bool = False
    share_count: int = 0
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


class DraftEditBody(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None


# ── 검색 ────────────────────────────────────────────────

EXCERPT_LEN = 120


def _make_excerpt(content: str, keyword: str) -> str:
    # 한 줄 excerpt — 줄바꿈은 공백으로 압축
    content = (content or "").replace("\n", " ").replace("\r", " ")
    while "  " in content:
        content = content.replace("  ", " ")
    content = content.strip()
    lower = content.lower()
    idx = lower.find(keyword.lower())
    if idx == -1:
        return content[:EXCERPT_LEN] + ("..." if len(content) > EXCERPT_LEN else "")
    start = max(0, idx - 30)
    end = min(len(content), start + EXCERPT_LEN)
    prefix = "..." if start > 0 else ""
    suffix = "..." if end < len(content) else ""
    return prefix + content[start:end] + suffix


def _build_match_clause(columns: list, terms: list[str]) -> "tuple":
    """공백 무시 ILIKE OR 매칭 SQL 조각 생성.

    columns: SQLAlchemy 컬럼 리스트
    terms: 검색할 정규화된 키워드(동의어 포함). 모두 OR.
    """
    NS = lambda col: func.replace(col, " ", "")  # noqa: E731
    clauses = []
    for term in terms:
        kw = f"%{term}%"
        for col in columns:
            clauses.append(NS(col).ilike(kw))
    return or_(*clauses) if clauses else False


# 통합검색 IP 디바운스 — (ip, term) 마지막 카운트 시각.
# 30초 내 같은 IP·검색어는 중복 카운트 무시. 멀티 워커 환경에선 정확도가
# 살짝 떨어지지만 인기 검색어 집계 의미는 충분히 보호된다.
_SEARCH_COUNT_DEBOUNCE_S = 30
_search_last_count: dict[tuple[str, str], float] = {}


@router.get("/api/search", response_model=SearchOut)
def search_posts(
    request: Request,
    q: str = "",
    page: int = 1,
    limit: int = 10,
    db: Session = Depends(get_db),
):
    """통합검색 (Phase A) — pg_trgm + 가중치 랭킹 + 동의어 확장 + 주보 PDF 본문.

    - 검색어를 동의어 사전으로 확장
    - 공백 무시 ILIKE 매칭 (pg_trgm GIN 인덱스가 가속)
    - 가중치: 제목 매칭 ×3, 본문 매칭 ×1, 핀 공지 ×2, 최근일수록 +
    - 주보 PDF 본문(bulletins.body_text)도 검색 대상
    """
    from app.models.content import (
        HistoryItem,
        Vision,
        CommunityGroup,
        StaticPage,
        CouncilMember,
        Prayer,
        Meditation,
    )
    from app.models.dynamic_page import DynamicPage
    from app.models.construction import ConstructionPhase, ConstructionJournalEntry
    # Notice 모델은 v1.5.69 통합 후 직접 쿼리하지 않음 (Post 검색에 통합됨)
    from app.models.bulletin import Bulletin
    from app.core.search_synonyms import expand

    q = q.strip()
    if not q:
        return SearchOut(results=[], content_results=[], total=0, page=page, limit=limit)

    # 검색어 카운트 증가 (2자 이상·1페이지 한정 — 페이지네이션 시 중복 누적 방지)
    # 같은 IP·검색어 30초 내 재호출은 무시(F5 연타·자동완성 방지)
    if len(q) >= 2 and page == 1:
        client_ip = request.client.host if request.client else "unknown"
        cache_key = (client_ip, q[:100])
        now_ts = time.time()
        last = _search_last_count.get(cache_key, 0.0)
        if now_ts - last >= _SEARCH_COUNT_DEBOUNCE_S:
            _search_last_count[cache_key] = now_ts
            # 메모리 누수 방지 — 1만 건 넘으면 절반 정리(LRU 흉내)
            if len(_search_last_count) > 10000:
                cutoff = now_ts - _SEARCH_COUNT_DEBOUNCE_S
                for k, v in list(_search_last_count.items()):
                    if v < cutoff:
                        _search_last_count.pop(k, None)
            try:
                db.execute(text("""
                    INSERT INTO search_term_counts (term, count, last_searched_at)
                    VALUES (:term, 1, NOW())
                    ON CONFLICT (term) DO UPDATE
                    SET count = search_term_counts.count + 1,
                        last_searched_at = NOW()
                """), {"term": q[:100]})
                db.commit()
            except Exception:
                db.rollback()

    # 검색어 동의어 확장: ["성당건축"] → ["성당건축", "성전건축", "신축", ...]
    terms = expand(q)
    # 원본 키워드도 항상 포함 (대소문자 무시는 ILIKE가 처리)
    q_compact = "".join(q.split())
    if q_compact and q_compact.lower() not in terms:
        terms.insert(0, q_compact.lower())

    NS = lambda col: func.replace(col, " ", "")  # noqa: E731

    # ── 게시글 검색 — 가중치 정렬 (paginated) ───────────────────
    # title 매칭이 있으면 더 위로, 그 다음 최신순
    title_match = _build_match_clause([Post.title], terms)
    content_match = _build_match_clause([Post.title, Post.content], terms)

    base_query = (
        db.query(Post)
        .join(Board, Post.board_id == Board.id)
        .options(joinedload(Post.member), joinedload(Post.board))
        .filter(Board.is_active == True)
        .filter(Board.exclude_from_search == False)
        .filter(Post.is_published == True)
        .filter(content_match)
    )
    # 정렬: 제목 매칭 우선 → 최신순
    sorted_query = base_query.order_by(
        desc(case((title_match, 1), else_=0)),
        desc(Post.created_at),
    )

    total = base_query.count()
    posts = sorted_query.offset((max(1, page) - 1) * limit).limit(limit).all()

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

    # 공지사항 — v1.5.69 부터 board.slug='notice' 의 posts 로 통합되어
    # 위쪽 게시글 검색(results)에 자연스럽게 포함됨. 별도 content_results
    # 섹션은 제거(중복 방지).

    for h in db.query(HistoryItem).filter(
        _build_match_clause([HistoryItem.event, HistoryItem.detail], terms)
    ).order_by(HistoryItem.sort_order).all():
        excerpt = _make_excerpt(h.detail or "", q) if h.detail else f"{h.year}년"
        content_results.append(ContentSearchItem(
            type="history", label="연혁",
            title=f"{h.year}년 — {h.event}",
            excerpt=excerpt,
            url="/history",
        ))

    for v in db.query(Vision).filter(
        _build_match_clause([Vision.motto, Vision.body], terms)
    ).order_by(Vision.year.desc()).all():
        content_results.append(ContentSearchItem(
            type="vision", label="본당 사목지표",
            title=v.motto,
            excerpt=f"{v.year}년 본당 사목지표",
            url="/vision",
        ))

    for g in db.query(CommunityGroup).filter(
        _build_match_clause([CommunityGroup.name, CommunityGroup.description], terms)
    ).order_by(CommunityGroup.sort_order).all():
        content_results.append(ContentSearchItem(
            type="community", label="단체/분과",
            title=g.name,
            excerpt=g.description or "",
            url=g.link_url or "/community",
        ))

    # 행사·캘린더 (events는 raw SQL — ORM 모델 없음)
    where_parts = []
    params: dict = {}
    for i, term in enumerate(terms):
        key = f"kw{i}"
        params[key] = f"%{term}%"
        where_parts.append(
            f"(REPLACE(title, ' ', '') ILIKE :{key}"
            f" OR REPLACE(COALESCE(description, ''), ' ', '') ILIKE :{key}"
            f" OR REPLACE(COALESCE(location, ''), ' ', '') ILIKE :{key})"
        )
    where_clause = " OR ".join(where_parts) if where_parts else "FALSE"
    event_rows = db.execute(text(f"""
        SELECT id, title, description, event_date, location, event_kind
        FROM events
        WHERE is_public = TRUE AND ({where_clause})
        ORDER BY event_date DESC
        LIMIT 50
    """), params).fetchall()
    for ev in event_rows:
        date_str = ev.event_date.strftime("%Y-%m-%d") if ev.event_date else ""
        kind = ev.event_kind or "행사"
        excerpt = _make_excerpt(ev.description or "", q) if ev.description else (ev.location or "")
        title = f"[{kind}] {ev.title}"
        if date_str:
            title = f"{date_str} {title}"
        content_results.append(ContentSearchItem(
            type="event", label="행사·캘린더",
            title=title,
            excerpt=excerpt,
            url="/calendar",
        ))

    # ── 주보 PDF 본문 검색 ────────────────────────────────
    # body_text 가 채워진 주보 중 본문에 키워드가 있는 것
    bulletins = (
        db.query(Bulletin)
        .filter(Bulletin.body_text.isnot(None))
        .filter(_build_match_clause([Bulletin.body_text], terms))
        .order_by(desc(Bulletin.published_date))
        .limit(20)
        .all()
    )
    for b in bulletins:
        date_str = b.published_date.strftime("%Y-%m-%d") if b.published_date else ""
        issue = f"제{b.issue_number}호 " if b.issue_number else ""
        title = f"{issue}주보 ({date_str})"
        excerpt = _make_excerpt(b.body_text or "", q)
        content_results.append(ContentSearchItem(
            type="bulletin", label="주보 본문",
            title=title,
            excerpt=excerpt,
            url=f"/bulletin/{b.id}",
        ))

    # ── 기도문 검색 ────────────────────────────────────────
    for pr in (
        db.query(Prayer)
        .filter(Prayer.is_published == True)
        .filter(_build_match_clause(
            [Prayer.title, Prayer.body, Prayer.scripture, Prayer.author], terms
        ))
        .order_by(desc(Prayer.is_featured), Prayer.display_order, Prayer.id)
        .all()
    ):
        content_results.append(ContentSearchItem(
            type="prayer", label="기도문",
            title=pr.title,
            excerpt=_make_excerpt(pr.body, q),
            url=f"/prayer/{pr.id}",
        ))

    # ── 묵상 검색 ──────────────────────────────────────────
    for m in (
        db.query(Meditation)
        .filter(Meditation.is_published == True)
        .filter(_build_match_clause(
            [Meditation.title, Meditation.body, Meditation.scripture, Meditation.author], terms
        ))
        .order_by(desc(Meditation.is_current), desc(Meditation.published_date))
        .all()
    ):
        content_results.append(ContentSearchItem(
            type="meditation", label="작은 묵상",
            title=m.title,
            excerpt=_make_excerpt(m.body, q),
            url=f"/meditation/archive/{m.id}",
        ))

    # ── 사목평의회 구성원 ──────────────────────────────────
    for cm in (
        db.query(CouncilMember)
        .filter(CouncilMember.is_active == True)
        .filter(_build_match_clause(
            [CouncilMember.name, CouncilMember.role, CouncilMember.category], terms
        ))
        .order_by(CouncilMember.sort_order, CouncilMember.id)
        .all()
    ):
        content_results.append(ContentSearchItem(
            type="council", label="사목평의회",
            title=f"{cm.name} — {cm.role}",
            excerpt=cm.category or "",
            url="/council",
        ))

    # ── 정적 페이지 (static_pages: saint/council/prayer/meditation) ──
    for sp in (
        db.query(StaticPage)
        .filter(_build_match_clause(
            [StaticPage.title, StaticPage.subtitle, StaticPage.body], terms
        ))
        .all()
    ):
        content_results.append(ContentSearchItem(
            type="static_page", label="페이지",
            title=sp.title,
            excerpt=_make_excerpt(sp.body or sp.subtitle or "", q),
            url=f"/{sp.slug}",
        ))

    # ── 자유 페이지 (dynamic_pages) ─────────────────────────
    for dp in (
        db.query(DynamicPage)
        .filter(DynamicPage.is_active == True)
        .filter(_build_match_clause(
            [DynamicPage.title, DynamicPage.subtitle, DynamicPage.body_markdown], terms
        ))
        .all()
    ):
        content_results.append(ContentSearchItem(
            type="dynamic_page", label=dp.group_label or "페이지",
            title=dp.title,
            excerpt=_make_excerpt(dp.body_markdown or dp.subtitle or "", q),
            url=f"/p/{dp.slug}",
        ))

    # ── 성당 건축 단계 ────────────────────────────────────
    for ph in (
        db.query(ConstructionPhase)
        .filter(_build_match_clause(
            [ConstructionPhase.name, ConstructionPhase.description], terms
        ))
        .order_by(ConstructionPhase.sort_order, ConstructionPhase.id)
        .all()
    ):
        content_results.append(ContentSearchItem(
            type="construction_phase", label="성당건축",
            title=ph.name,
            excerpt=_make_excerpt(ph.description or "", q),
            url="/construction",
        ))

    # ── 성당 건축 일지 ────────────────────────────────────
    for je in (
        db.query(ConstructionJournalEntry)
        .filter(_build_match_clause([ConstructionJournalEntry.note], terms))
        .order_by(desc(ConstructionJournalEntry.entry_date))
        .all()
    ):
        date_str = je.entry_date.strftime("%Y-%m-%d") if je.entry_date else ""
        content_results.append(ContentSearchItem(
            type="construction_journal", label="건축일지",
            title=f"{date_str} 공사 기록" if date_str else "공사 기록",
            excerpt=_make_excerpt(je.note, q),
            url="/construction",
        ))

    # ── 역대 사목자 (parish_pastors: priest|sister) ───────
    pastor_where_parts = []
    pastor_params: dict = {}
    for i, term in enumerate(terms):
        key = f"pkw{i}"
        pastor_params[key] = f"%{term}%"
        pastor_where_parts.append(
            f"(REPLACE(name, ' ', '') ILIKE :{key}"
            f" OR REPLACE(COALESCE(title, ''), ' ', '') ILIKE :{key}"
            f" OR REPLACE(COALESCE(bio, ''), ' ', '') ILIKE :{key})"
        )
    pastor_where = " OR ".join(pastor_where_parts) if pastor_where_parts else "FALSE"
    pastor_rows = db.execute(text(f"""
        SELECT id, name, title, bio, category
        FROM parish_pastors
        WHERE {pastor_where}
        ORDER BY sort_order, id
        LIMIT 50
    """), pastor_params).fetchall()
    for r in pastor_rows:
        url = "/sisters" if (r.category == "sister") else "/pastors"
        label = "역대 수녀님" if (r.category == "sister") else "역대 사목자"
        content_results.append(ContentSearchItem(
            type="pastor", label=label,
            title=f"{r.name} ({r.title})" if r.title else r.name,
            excerpt=_make_excerpt(r.bio or "", q),
            url=url,
        ))

    # ── 본당 출신 사제 (parish_priests) ───────────────────
    priest_where_parts = []
    priest_params: dict = {}
    for i, term in enumerate(terms):
        key = f"prkw{i}"
        priest_params[key] = f"%{term}%"
        priest_where_parts.append(
            f"(REPLACE(name, ' ', '') ILIKE :{key}"
            f" OR REPLACE(COALESCE(role, ''), ' ', '') ILIKE :{key}"
            f" OR REPLACE(COALESCE(bio, ''), ' ', '') ILIKE :{key})"
        )
    priest_where = " OR ".join(priest_where_parts) if priest_where_parts else "FALSE"
    priest_rows = db.execute(text(f"""
        SELECT id, name, role, bio
        FROM parish_priests
        WHERE {priest_where}
        ORDER BY sort_order, id
        LIMIT 50
    """), priest_params).fetchall()
    for r in priest_rows:
        content_results.append(ContentSearchItem(
            type="priest", label="본당 출신 사제",
            title=f"{r.name} ({r.role})" if r.role else r.name,
            excerpt=_make_excerpt(r.bio or "", q),
            url="/priests",
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
        .filter(_build_match_clause([Comment.content], terms))
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


# ── 인기·추천 검색어 ──────────────────────────────────────


class TermItem(BaseModel):
    term: str
    count: int = 0


class PopularSearchesOut(BaseModel):
    items: list[TermItem]


class RecommendedSearchesOut(BaseModel):
    items: list[str]


@router.get("/api/search/popular", response_model=PopularSearchesOut)
def get_popular_searches(limit: int = 5, db: Session = Depends(get_db)):
    """인기 검색어 — count DESC. 동률은 최근 검색이 위."""
    limit = max(1, min(20, limit))
    rows = db.execute(
        text(
            "SELECT term, count FROM search_term_counts "
            "WHERE count > 0 "
            "ORDER BY count DESC, last_searched_at DESC LIMIT :n"
        ),
        {"n": limit},
    ).fetchall()
    return PopularSearchesOut(
        items=[TermItem(term=r.term, count=r.count) for r in rows]
    )


@router.get("/api/search/recommended", response_model=RecommendedSearchesOut)
def get_recommended_searches(db: Session = Depends(get_db)):
    """관리자가 site_settings.RECOMMENDED_SEARCHES 에 쉼표 구분으로 등록한 추천 검색어."""
    row = db.execute(
        text("SELECT value FROM site_settings WHERE key = 'RECOMMENDED_SEARCHES'")
    ).fetchone()
    raw = (row.value if row and row.value else "") or ""
    items: list[str] = []
    seen: set[str] = set()
    for part in raw.split(","):
        t = part.strip()
        if not t or t in seen:
            continue
        seen.add(t)
        items.append(t)
        if len(items) >= 10:
            break
    return RecommendedSearchesOut(items=items)


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
def get_draft_count(db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    count = db.query(Post).filter(Post.is_published == False).count()
    return {"count": count}


@router.get("/api/boards/drafts", response_model=list[DraftOut])
def list_drafts(db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    return (
        db.query(Post)
        .options(joinedload(Post.board))
        .filter(Post.is_published == False)
        .order_by(desc(Post.created_at))
        .all()
    )


@router.post("/api/boards/drafts/{post_id}/publish", response_model=DraftOut)
def publish_draft(post_id: int, db: Session = Depends(get_db), admin = Depends(get_current_admin)):
    from app.core.admin_log import log_action, get_admin_identifier
    post = db.query(Post).options(joinedload(Post.board)).filter(Post.id == post_id, Post.is_published == False).first()
    if not post:
        raise HTTPException(status_code=404, detail="임시저장 게시글을 찾을 수 없습니다.")
    post.is_published = True
    db.commit()
    log_action(
        db, get_admin_identifier(admin),
        action="draft_publish", target_type="post", target_id=post.id,
        detail=f"draft → published: {post.title[:100] if post.title else ''}",
    )
    return db.query(Post).options(joinedload(Post.board)).filter(Post.id == post_id).first()


class PostCopyBody(BaseModel):
    target_slugs: list[str]


@router.post("/api/boards/{slug}/posts/{post_id}/copy")
def copy_post_to_boards(
    slug: str,
    post_id: int,
    body: PostCopyBody,
    db: Session = Depends(get_db),
    admin = Depends(get_current_admin),
):
    """게시글을 다중 게시판으로 복사 (admin 전용).

    - title·content·attachments(file_url 공유)·member_id 유지
    - created_at 은 복사 시점, view_count·like 등 0 으로 리셋
    - 각 target_slug 별로 새 Post + 첨부 행 생성
    - 결과: {"created": [{slug, post_id}, ...], "failed": [{slug, reason}, ...]}
    """
    from app.core.admin_log import log_action, get_admin_identifier

    src = _get_board_or_404(slug, db)
    src_post = (
        db.query(Post)
        .options(joinedload(Post.attachments))
        .filter(Post.id == post_id, Post.board_id == src.id)
        .first()
    )
    if not src_post:
        raise HTTPException(status_code=404, detail="원본 게시글을 찾을 수 없습니다.")

    seen: set[str] = set()
    created: list[dict] = []
    failed: list[dict] = []

    for target_slug in body.target_slugs:
        ts = (target_slug or "").strip()
        if not ts or ts == slug or ts in seen:
            # 자기 자신 또는 중복 — 스킵
            if ts and ts != slug:
                failed.append({"slug": ts, "reason": "중복 요청"})
            elif ts == slug:
                failed.append({"slug": ts, "reason": "원본과 동일 게시판"})
            continue
        seen.add(ts)
        target = db.query(Board).filter(Board.slug == ts, Board.is_active == True).first()
        if not target:
            failed.append({"slug": ts, "reason": "게시판을 찾을 수 없음"})
            continue

        new_post = Post(
            board_id=target.id,
            member_id=src_post.member_id,
            title=src_post.title,
            content=src_post.content,
            is_published=src_post.is_published,
            view_count=0,
        )
        db.add(new_post)
        db.flush()
        # 첨부 — file_url 공유, 새 Attachment 행만 생성
        for att in src_post.attachments:
            db.add(Attachment(
                post_id=new_post.id,
                original_name=att.original_name,
                stored_name=att.stored_name,
                file_url=att.file_url,
                file_size=att.file_size,
                is_image=att.is_image,
            ))
        created.append({"slug": ts, "post_id": new_post.id})

    db.commit()
    if created:
        log_action(
            db, get_admin_identifier(admin),
            action="post_copy", target_type="post", target_id=src_post.id,
            detail=f"copied to {len(created)} boards: {', '.join(c['slug'] for c in created)}",
        )
    return {"created": created, "failed": failed}


class PostMoveBody(BaseModel):
    target_slug: str


@router.patch("/api/boards/{slug}/posts/{post_id}/move", response_model=PostOut)
def move_post(
    slug: str,
    post_id: int,
    body: PostMoveBody,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """게시글을 다른 게시판으로 이동 (admin 전용). 댓글·첨부·추천은 post_id 기준이라 자동 따라감."""
    src = _get_board_or_404(slug, db)
    post = db.query(Post).filter(Post.id == post_id, Post.board_id == src.id).first()
    if not post:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")
    target_slug = (body.target_slug or "").strip()
    if not target_slug or target_slug == slug:
        raise HTTPException(status_code=400, detail="대상 게시판을 다르게 지정해 주세요.")
    target = db.query(Board).filter(Board.slug == target_slug, Board.is_active == True).first()
    if not target:
        raise HTTPException(status_code=404, detail="대상 게시판을 찾을 수 없습니다.")
    post.board_id = target.id
    db.commit()
    db.refresh(post)
    from app.core.admin_log import log_action, get_admin_identifier
    log_action(db, get_admin_identifier(admin), "move_post", "post", post_id, f"{slug} → {target_slug}")
    return (
        db.query(Post)
        .options(joinedload(Post.member), joinedload(Post.board), joinedload(Post.attachments))
        .filter(Post.id == post_id)
        .first()
    )


@router.patch("/api/boards/drafts/{post_id}/move", response_model=DraftOut)
def move_draft(post_id: int, body: DraftMoveBody, db: Session = Depends(get_db), admin = Depends(get_current_admin)):
    from app.core.admin_log import log_action, get_admin_identifier
    post = db.query(Post).filter(Post.id == post_id, Post.is_published == False).first()
    if not post:
        raise HTTPException(status_code=404, detail="임시저장 게시글을 찾을 수 없습니다.")
    board = db.query(Board).filter(Board.slug == body.board_slug, Board.is_active == True).first()
    if not board:
        raise HTTPException(status_code=404, detail="게시판을 찾을 수 없습니다.")
    old_board_id = post.board_id
    post.board_id = board.id
    db.commit()
    log_action(
        db, get_admin_identifier(admin),
        action="draft_move", target_type="post", target_id=post.id,
        detail=f"board_id {old_board_id} → {board.id} ({board.slug})",
    )
    return db.query(Post).options(joinedload(Post.board)).filter(Post.id == post_id).first()


@router.patch("/api/boards/drafts/{post_id}", response_model=DraftOut)
def edit_draft(post_id: int, body: DraftEditBody, db: Session = Depends(get_db), admin = Depends(get_current_admin)):
    """임시저장 게시글 제목·본문 편집 (게시 전 검토용)."""
    from app.core.admin_log import log_action, get_admin_identifier
    post = db.query(Post).filter(Post.id == post_id, Post.is_published == False).first()
    if not post:
        raise HTTPException(status_code=404, detail="임시저장 게시글을 찾을 수 없습니다.")
    old_title = post.title
    if body.title is not None:
        new_title = body.title.strip()
        if not new_title:
            raise HTTPException(status_code=400, detail="제목은 비울 수 없습니다.")
        post.title = new_title
    if body.content is not None:
        post.content = body.content
    db.commit()
    log_action(
        db, get_admin_identifier(admin),
        action="draft_edit", target_type="post", target_id=post.id,
        detail=f"'{old_title[:80]}' → '{post.title[:80]}'",
    )
    return db.query(Post).options(joinedload(Post.board)).filter(Post.id == post_id).first()


@router.delete("/api/boards/drafts/{post_id}", status_code=204)
def delete_draft(post_id: int, db: Session = Depends(get_db), admin = Depends(get_current_admin)):
    from app.core.admin_log import log_action, get_admin_identifier
    post = db.query(Post).filter(Post.id == post_id, Post.is_published == False).first()
    if not post:
        raise HTTPException(status_code=404, detail="임시저장 게시글을 찾을 수 없습니다.")
    title = post.title[:100] if post.title else ""
    _remove_post_attachment_files(post)
    db.delete(post)
    db.commit()
    log_action(
        db, get_admin_identifier(admin),
        action="draft_delete", target_type="post", target_id=post_id,
        detail=f"deleted: {title}",
    )


class PublishMultiBody(BaseModel):
    additional_board_slugs: list[str] = []
    add_calendar: bool = False
    # 캘린더 등록 시 사용할 행사 날짜. add_calendar=True 면 필수.
    event_date: Optional[date] = None
    event_location: Optional[str] = None
    event_kind: Optional[str] = None  # "행사" | "모임" | None


@router.post("/api/boards/drafts/{post_id}/publish-multi")
def publish_draft_multi(
    post_id: int,
    body: PublishMultiBody,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
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

    # 행사일정에 등록 — event_date NOT NULL 이므로 날짜 필수
    if body.add_calendar:
        if not body.event_date:
            raise HTTPException(
                status_code=400,
                detail="행사일정에 등록하려면 날짜를 지정해 주세요.",
            )
        kind = body.event_kind if body.event_kind in ("행사", "모임") else "행사"
        category = "community" if kind == "모임" else "general"
        db.execute(
            text(
                "INSERT INTO events "
                "(title, description, event_date, location, category, is_public, event_kind, is_ai_generated) "
                "VALUES (:title, :desc, :edate, :loc, :cat, TRUE, :kind, TRUE)"
            ),
            {
                "title": post.title,
                "desc": post.content or None,
                "edate": body.event_date,
                "loc": body.event_location or None,
                "cat": category,
                "kind": kind,
            },
        )

    db.commit()
    from app.core.admin_log import log_action, get_admin_identifier
    log_action(db, get_admin_identifier(admin), "publish_draft_multi", "post", post_id, f"additional={','.join(body.additional_board_slugs)}, calendar={body.add_calendar}")
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
def list_event_mappings(db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
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
    admin: Admin = Depends(get_current_admin),
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
    from app.core.admin_log import log_action, get_admin_identifier
    log_action(db, get_admin_identifier(admin), "update_event_mapping", "event_mapping", None, f"{event_type} → board={mapping.board_id} cal={mapping.use_calendar}")
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
def create_board(body: BoardIn, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    if db.query(Board).filter(Board.slug == body.slug).first():
        raise HTTPException(status_code=400, detail="이미 사용 중인 슬러그입니다.")
    board = Board(**body.model_dump())
    db.add(board)
    db.commit()
    db.refresh(board)
    from app.core.admin_log import log_action, get_admin_identifier
    log_action(db, get_admin_identifier(admin), "create_board", "board", board.id, f"{board.slug}/{board.name}")
    out = BoardOut.model_validate(board)
    out.post_count = 0
    return out


@router.put("/api/boards/{slug}", response_model=BoardOut)
def update_board(slug: str, body: BoardUpdate, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    board = db.query(Board).filter(Board.slug == slug).first()
    if not board:
        raise HTTPException(status_code=404, detail="게시판을 찾을 수 없습니다.")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(board, k, v)
    db.commit()
    board = db.query(Board).options(joinedload(Board.moderator)).filter(Board.slug == slug).first()
    from app.core.admin_log import log_action, get_admin_identifier
    log_action(db, get_admin_identifier(admin), "update_board", "board", board.id, f"{board.slug}/{board.name}")
    return _board_out(board, db)


# ─── 게시판 어드민 분류 그룹 (admin/boards 화면 정리용) ─────────────────

class BoardAdminGroupIn(BaseModel):
    name: str


class BoardAdminGroupOut(BaseModel):
    id: int
    name: str
    sort_order: int

    class Config:
        from_attributes = True


class BoardAdminGroupReorderIn(BaseModel):
    ids: list[int]


@router.get("/api/board-admin-groups", response_model=list[BoardAdminGroupOut])
def list_board_admin_groups(db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    return (
        db.query(BoardAdminGroup)
        .order_by(BoardAdminGroup.sort_order, BoardAdminGroup.id)
        .all()
    )


@router.post("/api/board-admin-groups", response_model=BoardAdminGroupOut)
def create_board_admin_group(body: BoardAdminGroupIn, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    name = (body.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="그룹 이름을 입력하세요.")
    max_order = db.query(BoardAdminGroup).count()
    g = BoardAdminGroup(name=name, sort_order=max_order)
    db.add(g)
    db.commit()
    db.refresh(g)
    from app.core.admin_log import log_action, get_admin_identifier
    log_action(db, get_admin_identifier(admin), "create_board_admin_group", "board_admin_group", g.id, name)
    return g


@router.put("/api/board-admin-groups/reorder")
def reorder_board_admin_groups(body: BoardAdminGroupReorderIn, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    for i, gid in enumerate(body.ids):
        db.query(BoardAdminGroup).filter(BoardAdminGroup.id == gid).update({"sort_order": i})
    db.commit()
    from app.core.admin_log import log_action, get_admin_identifier
    log_action(db, get_admin_identifier(admin), "reorder_board_admin_groups", "board_admin_group", None, f"순서: {','.join(map(str, body.ids))}")
    return {"ok": True}


@router.put("/api/board-admin-groups/{group_id}", response_model=BoardAdminGroupOut)
def update_board_admin_group(group_id: int, body: BoardAdminGroupIn, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    g = db.query(BoardAdminGroup).filter(BoardAdminGroup.id == group_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="그룹을 찾을 수 없습니다.")
    name = (body.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="그룹 이름을 입력하세요.")
    g.name = name
    db.commit()
    db.refresh(g)
    from app.core.admin_log import log_action, get_admin_identifier
    log_action(db, get_admin_identifier(admin), "update_board_admin_group", "board_admin_group", g.id, name)
    return g


@router.delete("/api/board-admin-groups/{group_id}", status_code=204)
def delete_board_admin_group(group_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    g = db.query(BoardAdminGroup).filter(BoardAdminGroup.id == group_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="그룹을 찾을 수 없습니다.")
    snapshot = g.name
    # boards.admin_group_id 는 ON DELETE SET NULL — 안에 있던 게시판은 자동으로 미분류 처리됨.
    db.delete(g)
    db.commit()
    from app.core.admin_log import log_action, get_admin_identifier
    log_action(db, get_admin_identifier(admin), "delete_board_admin_group", "board_admin_group", group_id, snapshot)


@router.get("/api/boards/{slug}/allowed-members", response_model=list[AllowedMemberOut])
def list_allowed_members(slug: str, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    board = db.query(Board).filter(Board.slug == slug).first()
    if not board:
        raise HTTPException(status_code=404)
    rows = (db.query(BoardAllowedMember)
            .options(joinedload(BoardAllowedMember.member))
            .filter(BoardAllowedMember.board_id == board.id).all())
    return [AllowedMemberOut.model_validate(r.member) for r in rows]


@router.post("/api/boards/{slug}/allowed-members", status_code=201)
def add_allowed_member(slug: str, body: AllowedMemberIn, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
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
        from app.core.admin_log import log_action, get_admin_identifier
        log_action(db, get_admin_identifier(admin), "add_board_allowed_member", "board", board.id, f"member={body.member_id}")
    return {"ok": True}


@router.delete("/api/boards/{slug}/allowed-members/{member_id}", status_code=204)
def remove_allowed_member(slug: str, member_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
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
        from app.core.admin_log import log_action, get_admin_identifier
        log_action(db, get_admin_identifier(admin), "remove_board_allowed_member", "board", board.id, f"member={member_id}")


@router.delete("/api/boards/{slug}", status_code=204)
def delete_board(slug: str, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    board = db.query(Board).filter(Board.slug == slug).first()
    if not board:
        raise HTTPException(status_code=404, detail="게시판을 찾을 수 없습니다.")
    snapshot = f"{board.slug}/{board.name}"
    # cascade로 posts·attachments DB row는 자동 제거되지만 디스크 파일은 남으므로 먼저 정리
    posts = (
        db.query(Post)
        .options(joinedload(Post.attachments))
        .filter(Post.board_id == board.id)
        .all()
    )
    for p in posts:
        _remove_post_attachment_files(p)
    db.delete(board)
    db.commit()
    from app.core.admin_log import log_action, get_admin_identifier
    log_action(db, get_admin_identifier(admin), "delete_board", "board", None, snapshot)


# ── 게시글 ────────────────────────────────────────────────

@router.get("/api/boards/{slug}/categories", response_model=list[str])
def list_board_categories(slug: str, db: Session = Depends(get_db)):
    """해당 게시판에 등록된 distinct 카테고리 목록(빈 값 제외)."""
    board = _get_board_or_404(slug, db)
    rows = (
        db.query(Post.category)
        .filter(
            Post.board_id == board.id,
            Post.is_published == True,
            Post.category.isnot(None),
            Post.category != "",
        )
        .distinct()
        .all()
    )
    return sorted({r[0] for r in rows if r[0]})


@router.get("/api/boards/{slug}/posts", response_model=PostListOut)
def list_posts(
    slug: str,
    page: int = 1,
    q: str = "",
    sort: str = "latest",
    category: str = "",
    db: Session = Depends(get_db),
    viewer: Optional[Member] = Depends(get_optional_member),
):
    """sort: latest(최신순) | views(조회순) | likes(추천순) | comments(댓글순).
    q: 제목·본문 ILIKE 자체 검색. category: 정확 일치 필터."""
    board = _get_board_or_404(slug, db)
    if board.members_only_read and not viewer:
        raise HTTPException(status_code=403, detail="회원만 볼 수 있는 게시판입니다.")
    _check_selected_access(board, viewer, db)
    per_page = max(1, board.posts_per_page)
    skip = (max(1, page) - 1) * per_page

    base = db.query(Post).filter(Post.board_id == board.id, Post.is_published == True)
    if category:
        base = base.filter(Post.category == category)
    kw = q.strip()
    if kw:
        # 공백 무시 ILIKE — replace 후 양쪽 매칭
        compact = "".join(kw.split())
        pattern = f"%{compact}%"
        ns = lambda col: func.replace(col, " ", "")
        base = base.filter(or_(ns(Post.title).ilike(pattern), ns(Post.content).ilike(pattern)))

    total = base.count()

    # 정렬 — 핀(is_pinned) 항상 최상단. 그 다음 sort 기준.
    sort_key = sort if sort in {"latest", "views", "likes", "comments"} else "latest"
    pin_first = desc(Post.is_pinned)

    if sort_key == "views":
        order_cols = [desc(Post.view_count), desc(Post.created_at)]
    elif sort_key == "likes":
        # likes 정렬은 PostLike count 기준 — subquery
        likes_subq = (
            db.query(PostLike.post_id, func.count(PostLike.id).label("c"))
            .group_by(PostLike.post_id)
            .subquery()
        )
        base = base.outerjoin(likes_subq, likes_subq.c.post_id == Post.id)
        order_cols = [desc(func.coalesce(likes_subq.c.c, 0)), desc(Post.created_at)]
    elif sort_key == "comments":
        comments_subq = (
            db.query(Comment.post_id, func.count(Comment.id).label("c"))
            .group_by(Comment.post_id)
            .subquery()
        )
        base = base.outerjoin(comments_subq, comments_subq.c.post_id == Post.id)
        order_cols = [desc(func.coalesce(comments_subq.c.c, 0)), desc(Post.created_at)]
    else:  # latest
        order_cols = [desc(Post.created_at)]

    order_cols = [pin_first] + order_cols

    posts = (
        base.options(joinedload(Post.member), joinedload(Post.attachments))
        .order_by(*order_cols)
        .offset(skip).limit(per_page).all()
    )
    post_ids = [p.id for p in posts]
    comment_counts = dict(
        db.query(Comment.post_id, func.count(Comment.id))
        .filter(Comment.post_id.in_(post_ids))
        .group_by(Comment.post_id)
        .all()
    ) if post_ids else {}
    like_counts = dict(
        db.query(PostLike.post_id, func.count(PostLike.id))
        .filter(PostLike.post_id.in_(post_ids))
        .group_by(PostLike.post_id)
        .all()
    ) if post_ids else {}
    my_likes: set[int] = set()
    if viewer and post_ids:
        my_likes = {
            r[0] for r in db.query(PostLike.post_id).filter(
                PostLike.post_id.in_(post_ids),
                PostLike.member_id == viewer.id,
            ).all()
        }
    result = []
    for p in posts:
        s = PostSummary.model_validate(p)
        s.comment_count = comment_counts.get(p.id, 0)
        s.like_count = like_counts.get(p.id, 0)
        s.liked_by_me = p.id in my_likes
        first_img = next((a for a in p.attachments if a.is_image), None)
        s.thumbnail_url = first_img.file_url if first_img else None
        s.has_video = _has_video(p.content)
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
    # current is None → get_current_author 가 슈퍼관리자(admin 토큰)일 때.
    # admin 은 어느 게시판에도 작성 허용. 그 외엔 지정 moderator 또는 회원 권한자만 허용.
    is_super_admin = current is None
    if board.moderator_only_write and not is_super_admin:
        if board.moderator_id != current.id and not getattr(current, "is_admin", False):
            raise HTTPException(status_code=403, detail="게시판 운영자 이상만 글을 작성할 수 있습니다.")
    # 선택 회원 게시판: 작성도 허용 명단만 (admin 은 제외)
    if not is_super_admin:
        _check_selected_access(board, current, db)
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
    out = PostOut.model_validate(post_obj)
    out.like_count = db.query(func.count(PostLike.id)).filter(PostLike.post_id == post_id).scalar() or 0
    out.liked_by_me = bool(viewer and db.query(PostLike).filter(
        PostLike.post_id == post_id, PostLike.member_id == viewer.id
    ).first())
    return out


class NeighborItem(BaseModel):
    id: int
    title: str


class NeighborsOut(BaseModel):
    prev: Optional[NeighborItem] = None
    next: Optional[NeighborItem] = None


@router.get("/api/boards/{slug}/posts/{post_id}/neighbors", response_model=NeighborsOut)
def get_post_neighbors(
    slug: str,
    post_id: int,
    db: Session = Depends(get_db),
    viewer: Optional[Member] = Depends(get_optional_member),
):
    """같은 게시판 내 인접 글 (created_at DESC 기준)."""
    board = _get_board_or_404(slug, db)
    if board.members_only_read and not viewer:
        raise HTTPException(status_code=403, detail="회원만 볼 수 있는 게시판입니다.")
    _check_selected_access(board, viewer, db)
    current = (
        db.query(Post)
        .filter(Post.id == post_id, Post.board_id == board.id, Post.is_published == True)
        .first()
    )
    if not current:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")
    # prev: 더 최신 글 (목록상 위쪽), next: 더 오래된 글 (목록상 아래쪽)
    prev = (
        db.query(Post)
        .filter(
            Post.board_id == board.id,
            Post.is_published == True,
            or_(
                Post.created_at > current.created_at,
                and_(Post.created_at == current.created_at, Post.id > current.id),
            ),
        )
        .order_by(Post.created_at.asc(), Post.id.asc())
        .first()
    )
    next_ = (
        db.query(Post)
        .filter(
            Post.board_id == board.id,
            Post.is_published == True,
            or_(
                Post.created_at < current.created_at,
                and_(Post.created_at == current.created_at, Post.id < current.id),
            ),
        )
        .order_by(Post.created_at.desc(), Post.id.desc())
        .first()
    )
    return NeighborsOut(
        prev=NeighborItem(id=prev.id, title=prev.title) if prev else None,
        next=NeighborItem(id=next_.id, title=next_.title) if next_ else None,
    )


@router.post("/api/boards/{slug}/posts/{post_id}/like", response_model=PostOut)
def toggle_post_like(
    slug: str,
    post_id: int,
    db: Session = Depends(get_db),
    current: Member = Depends(get_current_member),
):
    """추천 토글 — 회원만, 이미 추천했으면 취소. UNIQUE 제약으로 중복 방지."""
    board = _get_board_or_404(slug, db)
    if board.members_only_read:
        # 같은 정책 — 읽기 제한 회원이면 추천도 가능
        pass
    post = db.query(Post).filter(Post.id == post_id, Post.board_id == board.id).first()
    if not post:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")
    existing = db.query(PostLike).filter(
        PostLike.post_id == post_id, PostLike.member_id == current.id
    ).first()
    if existing:
        db.delete(existing)
    else:
        db.add(PostLike(post_id=post_id, member_id=current.id))
    db.commit()
    post_obj = (
        db.query(Post)
        .options(joinedload(Post.member), joinedload(Post.attachments), joinedload(Post.board))
        .filter(Post.id == post_id)
        .first()
    )
    out = PostOut.model_validate(post_obj)
    out.like_count = db.query(func.count(PostLike.id)).filter(PostLike.post_id == post_id).scalar() or 0
    out.liked_by_me = not bool(existing)
    return out


class ShareCountOut(BaseModel):
    share_count: int


@router.post("/api/boards/{slug}/posts/{post_id}/share", response_model=ShareCountOut)
def increment_share_count(
    slug: str,
    post_id: int,
    db: Session = Depends(get_db),
):
    """공유 버튼 클릭 시 카운트 +1. 인증 불필요(외부 공유 행위라 비로그인도 가능).
    게시판 share_enabled + 글 share_allowed 모두 true일 때만 카운트 증가."""
    board = _get_board_or_404(slug, db)
    if not getattr(board, "share_enabled", True):
        raise HTTPException(status_code=403, detail="이 게시판은 공유 기능을 사용하지 않습니다.")
    post = db.query(Post).filter(Post.id == post_id, Post.board_id == board.id).first()
    if not post:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")
    if not getattr(post, "share_allowed", False):
        raise HTTPException(status_code=403, detail="작성자가 공유를 허용하지 않은 글입니다.")
    post.share_count = (post.share_count or 0) + 1
    db.commit()
    return ShareCountOut(share_count=post.share_count)


@router.put("/api/boards/{slug}/posts/{post_id}", response_model=PostOut)
def update_post(
    slug: str,
    post_id: int,
    body: PostIn,
    db: Session = Depends(get_db),
    current: Optional[Member] = Depends(get_current_author),
):
    from app.core.admin_log import log_action
    board = _get_board_or_404(slug, db)
    post = _get_post_or_404(slug, post_id, db)
    is_delegated_admin = bool(current and getattr(current, "is_admin", False))
    if current and not is_delegated_admin and post.member_id != current.id and board.moderator_id != current.id:
        raise HTTPException(status_code=403, detail="본인 게시글만 수정할 수 있습니다.")
    is_admin_action = current is None  # get_current_author 가 슈퍼관리자면 None
    is_other_user_action = current is not None and post.member_id != current.id
    old_title = post.title
    post.title = body.title
    post.content = body.content
    post.intention_kind = body.intention_kind
    post.intention_for = body.intention_for
    post.category = body.category
    post.share_allowed = body.share_allowed
    db.commit()
    # admin / moderator 가 다른 사용자의 글을 수정한 경우만 감사 기록
    if is_admin_action or is_other_user_action:
        actor = "admin" if is_admin_action else f"member:{current.nickname if current else '?'}"
        log_action(
            db, actor,
            action="post_update", target_type="post", target_id=post.id,
            detail=f"[{slug}] '{old_title[:80]}' → '{body.title[:80]}' (author_id={post.member_id})",
        )
    return (
        db.query(Post)
        .options(joinedload(Post.member), joinedload(Post.comments).joinedload(Comment.member), joinedload(Post.attachments))
        .filter(Post.id == post_id)
        .first()
    )


@router.patch("/api/boards/{slug}/posts/{post_id}/pin", response_model=PostOut)
def pin_post(
    slug: str,
    post_id: int,
    body: PostPinIn,
    db: Session = Depends(get_db),
    current: Optional[Member] = Depends(get_current_author),
):
    """게시글 상단 고정 토글. 슈퍼관리자(current is None) 또는 게시판 관리자(moderator)만 가능."""
    from app.core.admin_log import log_action
    board = _get_board_or_404(slug, db)
    post = _get_post_or_404(slug, post_id, db)
    is_super = current is None
    is_delegated_admin = bool(current and getattr(current, "is_admin", False))
    is_moderator = current is not None and board.moderator_id == current.id
    if not (is_super or is_delegated_admin or is_moderator):
        raise HTTPException(status_code=403, detail="고정 권한이 없습니다. 관리자만 변경할 수 있습니다.")
    post.is_pinned = bool(body.is_pinned)
    db.commit()
    actor = "admin" if is_super else f"member:{current.nickname if current else '?'}"
    log_action(
        db, actor,
        action="post_pin" if post.is_pinned else "post_unpin",
        target_type="post", target_id=post.id,
        detail=f"[{slug}] '{post.title[:80]}'",
    )
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
    from app.core.admin_log import log_action
    board = _get_board_or_404(slug, db)
    post = _get_post_or_404(slug, post_id, db)
    is_delegated_admin = bool(current and getattr(current, "is_admin", False))
    if current and not is_delegated_admin and post.member_id != current.id and board.moderator_id != current.id:
        raise HTTPException(status_code=403, detail="본인 게시글만 삭제할 수 있습니다.")
    is_admin_action = current is None
    is_other_user_action = current is not None and post.member_id != current.id
    snapshot_title = post.title
    snapshot_author = post.member_id
    _remove_post_attachment_files(post)
    db.delete(post)
    db.commit()
    if is_admin_action or is_other_user_action:
        actor = "admin" if is_admin_action else f"member:{current.nickname if current else '?'}"
        log_action(
            db, actor,
            action="post_delete", target_type="post", target_id=post_id,
            detail=f"[{slug}] '{snapshot_title[:80]}' (author_id={snapshot_author})",
        )


# ── 댓글 ──────────────────────────────────────────────────

@router.post("/api/boards/{slug}/posts/{post_id}/comments", response_model=CommentOut, status_code=201)
def create_comment(
    slug: str,
    post_id: int,
    body: CommentIn,
    db: Session = Depends(get_db),
    current: Member = Depends(get_current_member),
):
    board = _get_board_or_404(slug, db)
    # 게시판이 회원 전용 읽기/선택 회원이면 댓글 작성도 동일 조건 적용
    if board.members_only_read and not current:
        raise HTTPException(status_code=403, detail="회원만 댓글을 작성할 수 있습니다.")
    _check_selected_access(board, current, db)
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
    is_operator = bool(getattr(current, "is_admin", False))  # 운영자(is_admin=True 회원) — 모든 댓글 수정 가능
    if comment.member_id != current.id and not is_operator:
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
    is_operator = bool(getattr(current, "is_admin", False))  # 운영자(is_admin=True 회원) — 모든 댓글 삭제 가능
    if comment.member_id != current.id and not is_operator:
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


def _remove_post_attachment_files(post: Post) -> None:
    """게시글 삭제 전 호출 — attachments에 등록된 디스크 파일을 정리.
    cascade로 DB row는 자동 제거되지만 디스크 파일은 그대로 남아 고아 파일이 누적됨.
    파일 삭제 실패는 게시글 삭제를 막지 않되 warning 로그로 남겨 사후 추적 가능하게 함."""
    for att in post.attachments or []:
        file_path = att.file_url.lstrip("/")
        if not os.path.exists(file_path):
            logger.info(
                "attachment file already missing: post_id=%s attachment_id=%s path=%s",
                post.id, att.id, file_path,
            )
            continue
        try:
            os.remove(file_path)
        except Exception as e:
            logger.warning(
                "attachment file unlink failed: post_id=%s attachment_id=%s path=%s err=%s",
                post.id, att.id, file_path, e,
            )


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
