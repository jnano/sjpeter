"""통합 사진 인덱스 API — /photos 공개 페이지용.

7개 출처(page_photos · 공개 게시판 첨부 · 주보 추출 · 역대 사목자/수녀 · 본당 출신 사제 ·
본당 가족 · 공사 단계/일지)를 UNION ALL 로 통합해 한 번에 반환.

권한: 비공개 게시판(members_only_read=true)·검색 제외(exclude_from_search=true)·
비활성 게시판(is_active=false) 사진은 노출 금지. 회원 프로필 사진도 노출 안 함.
"""

from datetime import datetime
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.site_settings import get_setting

router = APIRouter(prefix="/photos", tags=["photos"])

ALLOWED_VIEW_SCOPES = ("public", "members")


def _resolve_view_scope() -> str:
    raw = (get_setting("PHOTOS_VIEW_SCOPE", "public") or "public").strip().lower()
    return raw if raw in ALLOWED_VIEW_SCOPES else "public"

DEFAULT_LIMIT = 60
MAX_LIMIT = 120


class PhotoItem(BaseModel):
    source: str
    source_id: int
    file_url: str
    source_label: str
    click_href: str
    created_at: Optional[datetime] = None


class PhotosOut(BaseModel):
    items: list[PhotoItem]
    next_offset: int
    has_more: bool
    total: int
    seed: str
    mode: str
    view_scope: str


class PhotosAccessOut(BaseModel):
    view_scope: str


# 공통 UNION 본문 — ORDER BY 만 모드에 따라 바뀜.
_UNION_SQL = """
WITH unioned AS (
  -- 1) page_photos (페이지 슬라이드쇼)
  SELECT 'page_photo'::text AS source, p.id::int AS source_id,
         p.file_url, p.created_at,
         COALESCE(s.label, p.page_slug) AS source_label,
         COALESCE(s.public_href, '/') AS click_href,
         1 AS source_order
  FROM page_photos p
  LEFT JOIN page_photo_slugs s ON s.slug = p.page_slug
  WHERE p.file_url IS NOT NULL AND p.file_url <> ''

  UNION ALL

  -- 2) 공개 게시판 첨부 이미지 (주보 추출 포함 — source_bulletin_id 로 라벨 분기)
  -- click_href prefix: boards.kind='gallery' 면 /gallery/, 아니면 /boards/.
  -- menus._compute_href (menus.py) 와 동일 정책 — 사용자가 메뉴로 가는 경로와 사진 클릭 경로가 같아 사이드바 매칭 성공.
  SELECT CASE WHEN a.source_bulletin_id IS NOT NULL THEN 'bulletin' ELSE 'attachment' END,
         a.id::int, a.file_url, a.created_at,
         CASE WHEN a.source_bulletin_id IS NOT NULL THEN '주보' ELSE b.name END,
         '/' || (CASE WHEN b.kind = 'gallery' THEN 'gallery' ELSE 'boards' END) || '/' || b.slug || '/' || a.post_id,
         CASE WHEN a.source_bulletin_id IS NOT NULL THEN 2 ELSE 3 END
  FROM attachments a
  JOIN posts po ON po.id = a.post_id
  JOIN boards b ON b.id = po.board_id
  WHERE a.is_image = TRUE
    AND po.is_published = TRUE
    AND b.members_only_read = FALSE
    AND b.exclude_from_search = FALSE
    AND COALESCE(b.is_active, TRUE) = TRUE

  UNION ALL

  -- 3) 역대 사목자 (priest/sister 분기)
  SELECT CASE WHEN category = 'sister' THEN 'sister' ELSE 'pastor' END,
         id::int, photo_url, created_at,
         CASE WHEN category = 'sister' THEN '역대 수녀님' ELSE '역대 사목자' END,
         CASE WHEN category = 'sister' THEN '/sisters' ELSE '/pastors' END,
         CASE WHEN category = 'sister' THEN 5 ELSE 4 END
  FROM parish_pastors
  WHERE photo_url IS NOT NULL AND photo_url <> ''

  UNION ALL

  -- 4) 본당 출신 사제
  SELECT 'priest'::text, id::int, photo_url, created_at,
         '본당 출신 사제', '/priests', 6
  FROM parish_priests
  WHERE photo_url IS NOT NULL AND photo_url <> ''

  UNION ALL

  -- 5) 본당 가족 (현재 활동중)
  SELECT 'staff'::text, id::int, photo_url, created_at,
         COALESCE(role, '본당 가족'), '/pastor', 7
  FROM parish_staff
  WHERE photo_url IS NOT NULL AND photo_url <> ''
    AND COALESCE(is_active, TRUE) = TRUE

  UNION ALL

  -- 6) 공사 단계 대표 사진
  SELECT 'construction_phase'::text, id::int, photo_url, created_at,
         '공사 단계', '/construction', 8
  FROM construction_phases
  WHERE photo_url IS NOT NULL AND photo_url <> ''

  UNION ALL

  -- 7) 공사 일지 사진
  SELECT 'construction_journal'::text, id::int, photo_url, created_at,
         '공사 일지', '/construction', 9
  FROM construction_journal
  WHERE photo_url IS NOT NULL AND photo_url <> ''
)
SELECT source, source_id, file_url, source_label, click_href, created_at,
       COUNT(*) OVER () AS total_count
FROM unioned
ORDER BY {order_clause}
LIMIT :limit OFFSET :offset
"""

_ORDER_GROUPED = "source_order, source_label, created_at DESC NULLS LAST, source_id DESC"
# 시드 기반 결정론적 셔플 — 같은 시드 → 같은 순서 (페이지를 넘어가도 중복·누락 없음)
_ORDER_SHUFFLE = "md5(source || ':' || source_id || ':' || :seed)"


@router.get("", response_model=PhotosOut)
def list_photos(
    mode: str = Query("shuffle", pattern="^(shuffle|grouped)$"),
    seed: Optional[str] = Query(None, max_length=64),
    offset: int = Query(0, ge=0),
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    db: Session = Depends(get_db),
):
    if mode == "grouped":
        sql = _UNION_SQL.format(order_clause=_ORDER_GROUPED)
        active_seed = ""  # grouped 는 시드 무의미
    else:
        active_seed = seed or uuid4().hex[:16]
        sql = _UNION_SQL.format(order_clause=_ORDER_SHUFFLE)

    params = {"limit": limit, "offset": offset}
    if mode == "shuffle":
        params["seed"] = active_seed

    rows = db.execute(text(sql), params).mappings().all()

    items = [
        PhotoItem(
            source=r["source"],
            source_id=r["source_id"],
            file_url=r["file_url"],
            source_label=r["source_label"],
            click_href=r["click_href"],
            created_at=r["created_at"],
        )
        for r in rows
    ]
    total = int(rows[0]["total_count"]) if rows else 0
    next_offset = offset + len(items)
    has_more = next_offset < total

    return PhotosOut(
        items=items,
        next_offset=next_offset,
        has_more=has_more,
        total=total,
        seed=active_seed,
        mode=mode,
        view_scope=_resolve_view_scope(),
    )


@router.get("/access", response_model=PhotosAccessOut)
def get_access():
    """페이지 접근 권한 정보만 반환 (SSR 분기용 경량 endpoint).

    실제 권한 차단은 프론트 SSR 가 담당 — 페이지 권한이 'members' + 비로그인이면 안내 박스 렌더.
    사진 데이터 자체는 항상 게시판 권한 정책에 따라 필터링됨(권한과 무관하게 비공개 사진은 안 노출).
    """
    return PhotosAccessOut(view_scope=_resolve_view_scope())
