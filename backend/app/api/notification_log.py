"""admin 알림 발송 모니터링 — notification_batches 목록·상세.

v1.5.327 — '누구에게 몇 번 보냈는지' 모니터링.
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import desc, text
from sqlalchemy.orm import Session

from app.core.auth import get_current_admin
from app.core.database import get_db
from app.models.admin import Admin
from app.models.notification import Notification, NotificationBatch

router = APIRouter(prefix="/admin/notification-batches", tags=["admin", "notifications"])


class BatchOut(BaseModel):
    id: int
    kind: str
    title: str
    source_post_id: Optional[int] = None
    source_event_id: Optional[int] = None
    source_vision_id: Optional[int] = None
    source_meditation_id: Optional[int] = None
    source_extraction_id: Optional[int] = None
    community_group_ids: list[int]
    community_group_names: list[str]  # JOIN 으로 채움
    admin_username: Optional[str] = None
    target_count: int
    site_sent: int
    email_sent: int
    kakao_sent: int
    failed_reason: Optional[str] = None
    created_at: datetime
    read_count: int = 0   # batch_id 매칭 알림 중 read_at IS NOT NULL


class BatchListOut(BaseModel):
    items: list[BatchOut]
    total: int


@router.get("", response_model=BatchListOut)
def list_batches(
    limit: int = Query(30, ge=1, le=200),
    offset: int = Query(0, ge=0),
    kind: Optional[str] = Query(None, description="community | vision | meditation"),
    failed_only: bool = Query(False, description="실패(분과 미선택·대상 0명) 만"),
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    q = db.query(NotificationBatch)
    if kind:
        q = q.filter(NotificationBatch.kind == kind)
    if failed_only:
        q = q.filter(NotificationBatch.failed_reason.isnot(None))
    total = q.count()
    rows = q.order_by(desc(NotificationBatch.created_at)).offset(offset).limit(limit).all()

    # community_group_ids → name 매핑 한 번에
    all_gids: set[int] = set()
    for r in rows:
        for g in (r.community_group_ids or []):
            all_gids.add(g)
    gname_map: dict[int, str] = {}
    if all_gids:
        name_rows = db.execute(
            text("SELECT id, name FROM community_groups WHERE id = ANY(:gids)"),
            {"gids": list(all_gids)},
        ).fetchall()
        gname_map = {r.id: r.name for r in name_rows}

    # 각 batch 의 read_count — 한 번에 집계
    read_map: dict[int, int] = {}
    batch_ids = [r.id for r in rows]
    if batch_ids:
        read_rows = db.execute(
            text(
                "SELECT batch_id, COUNT(*) FROM notifications "
                "WHERE batch_id = ANY(:ids) AND read_at IS NOT NULL "
                "GROUP BY batch_id"
            ),
            {"ids": batch_ids},
        ).fetchall()
        read_map = {r.batch_id: int(r.count) for r in read_rows}

    items = [
        BatchOut(
            id=r.id, kind=r.kind, title=r.title,
            source_post_id=r.source_post_id,
            source_event_id=r.source_event_id,
            source_vision_id=r.source_vision_id,
            source_meditation_id=r.source_meditation_id,
            source_extraction_id=r.source_extraction_id,
            community_group_ids=list(r.community_group_ids or []),
            community_group_names=[gname_map.get(g, f"#{g}") for g in (r.community_group_ids or [])],
            admin_username=r.admin_username,
            target_count=r.target_count,
            site_sent=r.site_sent,
            email_sent=r.email_sent,
            kakao_sent=r.kakao_sent,
            failed_reason=r.failed_reason,
            created_at=r.created_at,
            read_count=read_map.get(r.id, 0),
        )
        for r in rows
    ]
    return BatchListOut(items=items, total=total)


class BatchRecipientOut(BaseModel):
    member_id: int
    nickname: str
    email: Optional[str] = None
    read_at: Optional[datetime] = None
    notification_id: int


@router.get("/{batch_id}/recipients", response_model=list[BatchRecipientOut])
def list_recipients(
    batch_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """batch 의 발송 대상 회원 목록 + 읽음 여부."""
    batch = db.query(NotificationBatch).filter(NotificationBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="batch 를 찾을 수 없습니다.")
    rows = db.execute(
        text(
            "SELECT n.id AS notification_id, n.member_id, n.read_at, m.nickname, m.email "
            "FROM notifications n JOIN members m ON m.id = n.member_id "
            "WHERE n.batch_id = :bid "
            "ORDER BY n.read_at NULLS FIRST, n.id"
        ),
        {"bid": batch_id},
    ).fetchall()
    return [
        BatchRecipientOut(
            member_id=r.member_id, nickname=r.nickname, email=r.email,
            read_at=r.read_at, notification_id=r.notification_id,
        )
        for r in rows
    ]
