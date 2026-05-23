"""회원 사이트 내 알림 API.

- GET    /api/members/me/notifications          : 본인 알림 목록 (최신순, limit/offset)
- GET    /api/members/me/notifications/unread-count : 읽지 않은 알림 수
- PATCH  /api/members/me/notifications/{id}/read    : 단일 읽음 처리
- PATCH  /api/members/me/notifications/read-all     : 전체 읽음

분과 태깅된 글 등록 hook 이 이미 notifications 에 insert 했음 (bulletins._fanout_community_notifications).
이 라우터는 회원이 자기 알림을 조회·읽음 처리하는 쪽만 담당.
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.core.auth import get_current_member
from app.core.database import get_db
from app.models.member import Member
from app.models.notification import Notification

router = APIRouter(prefix="/members/me/notifications", tags=["notifications"])


class NotificationOut(BaseModel):
    id: int
    kind: str
    title: str
    body: Optional[str] = None
    post_id: Optional[int] = None
    event_id: Optional[int] = None
    vision_id: Optional[int] = None
    meditation_id: Optional[int] = None
    community_group_id: Optional[int] = None
    community_group_name: Optional[str] = None  # JOIN 으로 채움
    board_slug: Optional[str] = None             # post 가 속한 게시판 slug — 이동 URL 구성용
    read_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("", response_model=list[NotificationOut])
def list_notifications(
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
    unread_only: bool = Query(False),
    db: Session = Depends(get_db),
    me: Member = Depends(get_current_member),
):
    """본인 알림 목록. 최신순. unread_only=true 면 안 읽은 것만."""
    from sqlalchemy import text as _text
    rows = db.execute(
        _text(
            "SELECT n.id, n.kind, n.title, n.body, n.post_id, n.event_id, "
            "       n.vision_id, n.meditation_id, "
            "       n.community_group_id, cg.name AS community_group_name, "
            "       b.slug AS board_slug, "
            "       n.read_at, n.created_at "
            "FROM notifications n "
            "LEFT JOIN community_groups cg ON cg.id = n.community_group_id "
            "LEFT JOIN posts p ON p.id = n.post_id "
            "LEFT JOIN boards b ON b.id = p.board_id "
            "WHERE n.member_id = :mid "
            + ("AND n.read_at IS NULL " if unread_only else "")
            + "ORDER BY n.created_at DESC "
            "LIMIT :lim OFFSET :off"
        ),
        {"mid": me.id, "lim": limit, "off": offset},
    ).fetchall()
    return [
        NotificationOut(
            id=r.id, kind=r.kind, title=r.title, body=r.body,
            post_id=r.post_id, event_id=r.event_id,
            vision_id=r.vision_id, meditation_id=r.meditation_id,
            community_group_id=r.community_group_id,
            community_group_name=r.community_group_name,
            board_slug=r.board_slug,
            read_at=r.read_at, created_at=r.created_at,
        )
        for r in rows
    ]


@router.get("/unread-count")
def unread_count(
    db: Session = Depends(get_db),
    me: Member = Depends(get_current_member),
):
    """헤더 종 카운터용. 분리 endpoint 라 캐시·폴링 가볍게."""
    n = (
        db.query(Notification)
        .filter(Notification.member_id == me.id, Notification.read_at.is_(None))
        .count()
    )
    return {"count": n}


@router.patch("/{notification_id}/read")
def mark_read(
    notification_id: int,
    db: Session = Depends(get_db),
    me: Member = Depends(get_current_member),
):
    notif = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.member_id == me.id)
        .first()
    )
    if not notif:
        raise HTTPException(status_code=404, detail="알림을 찾을 수 없습니다.")
    if notif.read_at is None:
        notif.read_at = datetime.utcnow()
        db.commit()
    return {"ok": True}


@router.patch("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    me: Member = Depends(get_current_member),
):
    now = datetime.utcnow()
    n = (
        db.query(Notification)
        .filter(Notification.member_id == me.id, Notification.read_at.is_(None))
        .update({Notification.read_at: now}, synchronize_session=False)
    )
    db.commit()
    return {"ok": True, "updated": n}
