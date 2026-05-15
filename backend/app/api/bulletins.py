import hashlib
import logging
import os
import uuid
from datetime import date, datetime, time
from difflib import SequenceMatcher
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File, Form

logger = logging.getLogger(__name__)
from sqlalchemy.orm import Session
from sqlalchemy import desc, text
from pydantic import BaseModel
from app.core.database import get_db
from app.core.auth import get_current_admin
from app.core.config import settings
from app.core.email import send_bulletin_notification
from app.models.bulletin import Bulletin
from app.models.bulletin_extraction import BulletinExtraction
from app.models.board import Board, Post
from app.models.event_board_mapping import EventBoardMapping
from app.models.member import Member
from app.models.admin import Admin

router = APIRouter(prefix="/bulletins", tags=["bulletins"])


# ── 공개 엔드포인트 ──────────────────────────────────────


class BulletinOut(BaseModel):
    id: int
    issue_number: int | None
    published_date: date
    liturgical_season: str | None
    gospel_reference: str | None
    pdf_url: str | None
    ai_summary: str | None
    ai_status: str | None = None
    ai_started_at: datetime | None = None
    ai_finished_at: datetime | None = None
    ai_error: str | None = None

    class Config:
        from_attributes = True


@router.get("/latest", response_model=BulletinOut)
def get_latest(db: Session = Depends(get_db)):
    bulletin = (
        db.query(Bulletin)
        .filter(Bulletin.is_published == True)
        .order_by(desc(Bulletin.published_date))
        .first()
    )
    if not bulletin:
        raise HTTPException(status_code=404, detail="주보가 없습니다.")
    return bulletin


@router.get("/single/{bulletin_id}", response_model=BulletinOut)
def get_bulletin(bulletin_id: int, db: Session = Depends(get_db)):
    bulletin = db.query(Bulletin).filter(Bulletin.id == bulletin_id).first()
    if not bulletin:
        raise HTTPException(status_code=404, detail="주보를 찾을 수 없습니다.")
    return bulletin


@router.get("/", response_model=list[BulletinOut])
def list_bulletins(skip: int = 0, limit: int = 40, db: Session = Depends(get_db)):
    return (
        db.query(Bulletin)
        .filter(Bulletin.is_published == True)
        .order_by(desc(Bulletin.published_date))
        .offset(skip)
        .limit(limit)
        .all()
    )


# ── 관리자 전용 엔드포인트 ────────────────────────────────


@router.post("/", response_model=BulletinOut)
async def upload_bulletin(
    background_tasks: BackgroundTasks,
    published_date: str = Form(...),
    issue_number: int | None = Form(None),
    liturgical_season: str | None = Form(None),
    gospel_reference: str | None = Form(None),
    pdf_file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _admin: Admin = Depends(get_current_admin),
):
    if pdf_file.content_type not in ("application/pdf", "application/octet-stream"):
        raise HTTPException(status_code=400, detail="PDF 파일만 업로드할 수 있습니다.")

    ext = os.path.splitext(pdf_file.filename or "bulletin.pdf")[1] or ".pdf"
    filename = f"{uuid.uuid4().hex}{ext}"
    save_path = os.path.join(settings.UPLOAD_DIR, "bulletins", filename)
    os.makedirs(os.path.dirname(save_path), exist_ok=True)

    content = await pdf_file.read()
    with open(save_path, "wb") as f:
        f.write(content)

    pdf_url = f"/uploads/bulletins/{filename}"

    bulletin = Bulletin(
        parish_id=1,
        published_date=date.fromisoformat(published_date),
        issue_number=issue_number,
        liturgical_season=liturgical_season,
        gospel_reference=gospel_reference,
        pdf_url=pdf_url,
        is_published=True,
        ai_status="processing",  # 업로드 직후 폴링 UI가 곧바로 진행 상태로 보이도록
    )
    db.add(bulletin)
    db.commit()
    db.refresh(bulletin)

    # 알림 수신 동의 회원에게 이메일 발송 (백그라운드)
    emails = [
        m.email for m in db.query(Member).filter(
            Member.is_active == True,
            Member.receive_notification != False,  # NULL(기본값) 포함
        ).all()
        if m.email
    ]
    if emails:
        background_tasks.add_task(
            send_bulletin_notification,
            emails,
            {
                "issue_number": bulletin.issue_number,
                "published_date": str(bulletin.published_date),
                "liturgical_season": bulletin.liturgical_season,
                "gospel_reference": bulletin.gospel_reference,
            },
        )

    # AI 자동 분석 → 게시판 임시저장
    background_tasks.add_task(_auto_process_bulletin, bulletin.id)

    return bulletin


@router.post("/{bulletin_id}/reanalyze")
def reanalyze_bulletin(
    bulletin_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _admin: Admin = Depends(get_current_admin),
):
    """기존 주보를 다시 AI 분석. 파서 개선 후 0건 처리된 주보를 살리는 용도."""
    bulletin = db.query(Bulletin).filter(Bulletin.id == bulletin_id).first()
    if not bulletin:
        raise HTTPException(status_code=404, detail="주보를 찾을 수 없습니다.")

    bulletin.ai_status = "processing"
    bulletin.ai_started_at = datetime.utcnow()
    bulletin.ai_finished_at = None
    bulletin.ai_error = None
    db.commit()

    background_tasks.add_task(_auto_process_bulletin, bulletin_id)
    return {"ok": True, "ai_status": "processing"}


@router.delete("/{bulletin_id}")
def delete_bulletin(
    bulletin_id: int,
    db: Session = Depends(get_db),
    _admin: Admin = Depends(get_current_admin),
):
    bulletin = db.query(Bulletin).filter(Bulletin.id == bulletin_id).first()
    if not bulletin:
        raise HTTPException(status_code=404, detail="주보를 찾을 수 없습니다.")

    if bulletin.pdf_url:
        file_path = bulletin.pdf_url.lstrip("/")
        if os.path.exists(file_path):
            os.remove(file_path)

    db.query(BulletinExtraction).filter(
        BulletinExtraction.bulletin_id == bulletin_id
    ).delete(synchronize_session=False)
    db.delete(bulletin)
    db.commit()
    return {"ok": True}


# ── AI 분석 엔드포인트 ────────────────────────────────────


class ExtractionOut(BaseModel):
    id: int
    bulletin_id: int
    title: str
    content: Optional[str]
    group_name: Optional[str]
    event_date: Optional[date]
    location: Optional[str]
    event_type: Optional[str]
    status: str
    target_board_id: Optional[int]
    created_post_id: Optional[int]
    created_notice_id: Optional[int] = None
    created_event_id: Optional[int] = None
    created_meditation_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


@router.post("/{bulletin_id}/analyze", response_model=list[ExtractionOut])
def analyze_bulletin(
    bulletin_id: int,
    db: Session = Depends(get_db),
    _admin: Admin = Depends(get_current_admin),
):
    from app.services.pdf_extractor import extract_text, is_text_sparse, pdf_to_images_b64
    from app.services.claude_analyzer import analyze_bulletin_text, analyze_bulletin_images

    bulletin = db.query(Bulletin).filter(Bulletin.id == bulletin_id).first()
    if not bulletin:
        raise HTTPException(status_code=404, detail="주보를 찾을 수 없습니다.")
    if not bulletin.pdf_url:
        raise HTTPException(status_code=400, detail="PDF 파일이 없습니다.")

    pdf_path = bulletin.pdf_url.lstrip("/")
    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="PDF 파일을 찾을 수 없습니다.")

    # 텍스트 추출 시도 → 희박하면 Vision으로, 텍스트 분석 결과 0건이면 Vision으로 재시도
    text = extract_text(pdf_path)
    if is_text_sparse(text):
        images = pdf_to_images_b64(pdf_path)
        events = analyze_bulletin_images(bulletin.published_date, images)
    else:
        events = analyze_bulletin_text(bulletin.published_date, text)
        if not events:
            # 텍스트가 충분해 보였지만 의미 있는 행사·공지를 못 뽑은 경우(예: 본문이 이미지)
            # 한 번 더 Vision으로 시도 — 토큰 비용은 늘지만 정확도 우선
            import logging
            logging.getLogger(__name__).info(
                "[bulletin %d] 텍스트 분석 0건 → Vision fallback", bulletin_id
            )
            images = pdf_to_images_b64(pdf_path)
            events = analyze_bulletin_images(bulletin.published_date, images)

    if not events:
        return []

    # 추출된 events를 _auto_process_bulletin과 동일한 라우팅 로직으로 처리:
    # 공지 → notices INSERT / 행사·모임 + 날짜 → events INSERT / 나머지 → ai-extract 게시판 임시저장.
    new_extractions = _route_and_save_events(db, bulletin, events, bulletin_id)
    db.commit()
    for e in new_extractions:
        db.refresh(e)
    return new_extractions


# 매핑 가능한 event_type — /admin/event-mapping 에서 7개 행사 유형별로
# '게시판' 또는 '캘린더' 라우팅 지정 가능. 매핑 없을 때 디폴트:
#   - 행사·모임 + 날짜 → events 테이블
#   - 그 외 → ai-extract 게시판 임시저장
ROUTABLE_EVENT_TYPES = {"행사", "모임", "봉사", "순례", "피정", "강의", "기타"}


def _route_and_save_events(db: Session, bulletin: Bulletin, events: list[dict], bulletin_id: int) -> list[BulletinExtraction]:
    """events 리스트를 BulletinExtraction에 저장하고 자동 라우팅.

    라우팅 우선순위:
    1. 묵상 → meditations 직등록
    2. 지표 → pending (수동 검토)
    3. 공지 → notices 직등록
    4. 행사·모임·봉사·순례·피정·강의·기타 → /admin/event-mapping 매핑 우선
       a. use_calendar=True + 날짜 있음 → events 테이블 (event_kind=event_type)
       b. board_id 지정 → 그 게시판으로 Post
       c. 매핑 없음 + 행사·모임 + 날짜 → events 테이블 (디폴트)
       d. 그 외 → ai-extract 게시판 fallback
    """
    from sqlalchemy import text as _text
    if not events:
        return []

    parish_row = db.execute(_text("SELECT id FROM parishes LIMIT 1")).fetchone()
    parish_id = parish_row[0] if parish_row else 1
    ai_board = db.query(Board).filter(Board.slug == "ai-extract", Board.is_active == True).first()

    # /admin/event-mapping 매핑을 한 번에 dict 로 로드 (event_type → EventBoardMapping)
    mapping_by_type: dict[str, EventBoardMapping] = {
        m.event_type: m for m in db.query(EventBoardMapping).all()
    }

    issue_label = (
        f"제{bulletin.issue_number}호"
        if bulletin.issue_number
        else bulletin.published_date.strftime("%Y.%m.%d")
    )
    # AI 자동 등록 항목은 등록 시각이 아닌 주보 발행일을 기준으로 created_at 설정
    # (과거 주보 일괄 처리 시 게시판/캘린더에서 발행일순으로 자연 정렬되도록)
    published_ts = datetime.combine(bulletin.published_date, time(12, 0))

    new_extractions: list[BulletinExtraction] = []
    for ev in events:
        fp = _fingerprint(
            ev.get("group_name"),
            ev.get("event_date"),
            ev.get("event_type"),
            ev.get("title"),
            bulletin_id=bulletin_id,
        )
        exists = db.query(BulletinExtraction).filter(
            BulletinExtraction.fingerprint == fp,
            BulletinExtraction.status != "rejected",
        ).first()
        if exists:
            continue

        parsed_date = _parse_date(ev.get("event_date"))
        if _is_fuzzy_duplicate(db, ev.get("title", ""), parsed_date, bulletin_id=bulletin_id):
            continue

        event_type = ev.get("event_type") or "모임"
        title = ev.get("title", "")
        content_text = ev.get("content")

        # 묵상 → meditations 바로 등록 (published_date는 주보 발행일)
        if event_type == "묵상":
            scripture = (ev.get("scripture") or "").strip() or None
            row = db.execute(
                _text(
                    "INSERT INTO meditations (title, scripture, body, published_date, is_published, created_at, updated_at) "
                    "VALUES (:title, :scr, :body, :pdate, TRUE, :ts, :ts) RETURNING id"
                ),
                {
                    "title": title, "scr": scripture,
                    "body": content_text or "",
                    "pdate": bulletin.published_date, "ts": published_ts,
                },
            ).first()
            ext = BulletinExtraction(
                bulletin_id=bulletin_id, title=title, content=content_text,
                group_name=ev.get("group_name"), event_date=parsed_date,
                location=ev.get("location"), event_type=event_type,
                fingerprint=fp, status="auto_drafted",
                created_meditation_id=row[0] if row else None,
            )
            db.add(ext)
            new_extractions.append(ext)
            continue

        # 사목지표 → 반드시 관리자 검토 필수. visions 테이블에 자동 INSERT 절대 금지.
        # (사목지표는 본당 한 해 사목 방향이라 AI 추출 그대로 등록 시 오해의 소지 큼)
        # BulletinExtraction 에만 status='pending' 으로 저장 → 관리자가 result/extractions
        # 페이지에서 approve-as-vision 엔드포인트로 직접 등록해야만 visions 에 반영됨.
        if event_type == "지표":
            ext = BulletinExtraction(
                bulletin_id=bulletin_id, title=title, content=content_text,
                group_name=ev.get("group_name"), event_date=parsed_date,
                location=ev.get("location"), event_type=event_type,
                fingerprint=fp, status="pending",
            )
            db.add(ext)
            new_extractions.append(ext)
            continue

        # 공지 → notices 바로 등록 (created_at은 주보 발행일)
        if event_type == "공지":
            row = db.execute(
                _text(
                    "INSERT INTO notices (parish_id, title, content, is_pinned, is_ai_generated, created_at) "
                    "VALUES (:pid, :title, :content, FALSE, TRUE, :created) RETURNING id"
                ),
                {"pid": parish_id, "title": title, "content": content_text, "created": published_ts},
            ).first()
            ext = BulletinExtraction(
                bulletin_id=bulletin_id, title=title, content=content_text,
                group_name=ev.get("group_name"), event_date=parsed_date,
                location=ev.get("location"), event_type=event_type,
                fingerprint=fp, status="auto_drafted",
                created_notice_id=row[0] if row else None,
            )
            db.add(ext)
            new_extractions.append(ext)
            continue

        # ── 4. 행사·모임·봉사·순례·피정·강의·기타: /admin/event-mapping 매핑 우선 ──
        if event_type in ROUTABLE_EVENT_TYPES:
            mapping = mapping_by_type.get(event_type)
            category = "community" if event_type == "모임" else "general"

            # 4a) 매핑.use_calendar=True + 날짜 있음 → events 테이블
            if mapping and mapping.use_calendar and parsed_date:
                parsed_end = _parse_date(ev.get("end_date"))
                row = db.execute(
                    _text(
                        "INSERT INTO events (title, description, event_date, end_date, location, category, is_public, is_ai_generated, event_kind, created_at) "
                        "VALUES (:title, :desc, :edate, :eend, :loc, :cat, TRUE, TRUE, :kind, :created) RETURNING id"
                    ),
                    {
                        "title": title, "desc": content_text,
                        "edate": parsed_date,
                        "eend": parsed_end if parsed_end and parsed_end != parsed_date else None,
                        "loc": ev.get("location"), "cat": category, "kind": event_type,
                        "created": published_ts,
                    },
                ).first()
                ext = BulletinExtraction(
                    bulletin_id=bulletin_id, title=title, content=content_text,
                    group_name=ev.get("group_name"), event_date=parsed_date,
                    location=ev.get("location"), event_type=event_type,
                    fingerprint=fp, status="auto_drafted",
                    created_event_id=row[0] if row else None,
                )
                db.add(ext)
                new_extractions.append(ext)
                continue

            # 4b) 매핑.board_id 지정 → 그 게시판으로 Post 생성
            if mapping and mapping.board_id:
                post = Post(
                    board_id=mapping.board_id, member_id=None,
                    title=f"[{issue_label}] {title}",
                    content=f"> **출처: {issue_label} 주보** ({bulletin.published_date})\n\n---\n\n{content_text or ''}",
                    is_published=False,
                )
                db.add(post)
                db.flush()
                ext = BulletinExtraction(
                    bulletin_id=bulletin_id, title=title, content=content_text,
                    group_name=ev.get("group_name"), event_date=parsed_date,
                    location=ev.get("location"), event_type=event_type,
                    fingerprint=fp, status="auto_drafted",
                    target_board_id=mapping.board_id, created_post_id=post.id,
                )
                db.add(ext)
                new_extractions.append(ext)
                continue

            # 4c) 매핑 없음 + 행사·모임 + 날짜 → events 테이블 (기존 디폴트 동작)
            if event_type in ("행사", "모임") and parsed_date:
                parsed_end = _parse_date(ev.get("end_date"))
                row = db.execute(
                    _text(
                        "INSERT INTO events (title, description, event_date, end_date, location, category, is_public, is_ai_generated, event_kind, created_at) "
                        "VALUES (:title, :desc, :edate, :eend, :loc, :cat, TRUE, TRUE, :kind, :created) RETURNING id"
                    ),
                    {
                        "title": title, "desc": content_text,
                        "edate": parsed_date,
                        "eend": parsed_end if parsed_end and parsed_end != parsed_date else None,
                        "loc": ev.get("location"), "cat": category, "kind": event_type,
                        "created": published_ts,
                    },
                ).first()
                ext = BulletinExtraction(
                    bulletin_id=bulletin_id, title=title, content=content_text,
                    group_name=ev.get("group_name"), event_date=parsed_date,
                    location=ev.get("location"), event_type=event_type,
                    fingerprint=fp, status="auto_drafted",
                    created_event_id=row[0] if row else None,
                )
                db.add(ext)
                new_extractions.append(ext)
                continue

            # 4d) 그 외 (날짜 없거나 use_calendar=False & board_id=NULL) → ai-extract fallback (아래로)

        # ── 5. fallback: ai-extract 게시판 임시저장 ──
        if ai_board:
            post = Post(
                board_id=ai_board.id, member_id=None,
                title=f"[{issue_label}] {title}",
                content=f"> **출처: {issue_label} 주보** ({bulletin.published_date})\n\n---\n\n{content_text or ''}",
                is_published=False,
            )
            db.add(post)
            db.flush()
            ext = BulletinExtraction(
                bulletin_id=bulletin_id, title=title, content=content_text,
                group_name=ev.get("group_name"), event_date=parsed_date,
                location=ev.get("location"), event_type=event_type,
                fingerprint=fp, status="auto_drafted",
                target_board_id=ai_board.id, created_post_id=post.id,
            )
        else:
            ext = BulletinExtraction(
                bulletin_id=bulletin_id, title=title, content=content_text,
                group_name=ev.get("group_name"), event_date=parsed_date,
                location=ev.get("location"), event_type=event_type,
                fingerprint=fp, status="pending",
            )
        db.add(ext)
        new_extractions.append(ext)

    return new_extractions


@router.get("/extractions/pending", response_model=list[ExtractionOut])
def list_pending_extractions(
    db: Session = Depends(get_db),
    _admin: Admin = Depends(get_current_admin),
):
    return (
        db.query(BulletinExtraction)
        .filter(BulletinExtraction.status == "pending")
        .order_by(desc(BulletinExtraction.created_at))
        .all()
    )


@router.get("/extractions/pending/count")
def count_pending_extractions(
    db: Session = Depends(get_db),
    _admin: Admin = Depends(get_current_admin),
):
    """사이드바 뱃지용 — 검토 대기 추출 항목 수.

    - total: 전체 pending 건수
    - vision: 그 중 사목지표('지표') 건수. 0 보다 크면 반드시 관리자 검토 필요.
    """
    total = (
        db.query(BulletinExtraction)
        .filter(BulletinExtraction.status == "pending")
        .count()
    )
    vision = (
        db.query(BulletinExtraction)
        .filter(
            BulletinExtraction.status == "pending",
            BulletinExtraction.event_type == "지표",
        )
        .count()
    )
    return {"total": total, "vision": vision}


@router.get("/{bulletin_id}/extractions", response_model=list[ExtractionOut])
def list_bulletin_extractions(
    bulletin_id: int,
    db: Session = Depends(get_db),
    _admin: Admin = Depends(get_current_admin),
):
    return (
        db.query(BulletinExtraction)
        .filter(BulletinExtraction.bulletin_id == bulletin_id)
        .order_by(BulletinExtraction.event_date)
        .all()
    )


class ApproveBody(BaseModel):
    board_id: int


@router.post("/extractions/{extraction_id}/approve", response_model=ExtractionOut)
def approve_extraction(
    extraction_id: int,
    body: ApproveBody,
    db: Session = Depends(get_db),
    _admin: Admin = Depends(get_current_admin),
):
    ext = db.query(BulletinExtraction).filter(BulletinExtraction.id == extraction_id).first()
    if not ext:
        raise HTTPException(status_code=404, detail="추출 항목을 찾을 수 없습니다.")

    board = db.query(Board).filter(Board.id == body.board_id, Board.is_active == True).first()
    if not board:
        raise HTTPException(status_code=404, detail="게시판을 찾을 수 없습니다.")

    post = Post(
        board_id=board.id,
        member_id=None,  # AI 자동 생성 게시글
        title=ext.title,
        content=ext.content or "",
    )
    db.add(post)
    db.flush()

    ext.status = "approved"
    ext.target_board_id = board.id
    ext.created_post_id = post.id
    db.commit()
    db.refresh(ext)
    return ext


_EVENT_CATEGORY: dict[str, str] = {
    "순례": "liturgy",
    "피정": "education",
    "모임": "community",
    "행사": "general",
    "강의": "education",
    "봉사": "community",
    "기타": "general",
}


def _auto_process_bulletin(bulletin_id: int) -> None:
    """주보 업로드 직후 백그라운드에서 AI 분석 → 자동 라우팅.

    공지  → notices 바로 등록 (관리자 검토 불필요)
    행사 + 날짜 → events 캘린더 바로 등록
    나머지 (모임, 날짜 없는 행사) → 'ai-extract' 게시판 임시저장

    진행 상태는 bulletins.ai_status 컬럼으로 노출 (processing → done|failed).
    """
    from app.core.database import SessionLocal
    from app.services.pdf_extractor import extract_text, is_text_sparse, pdf_to_images_b64
    from app.services.claude_analyzer import analyze_bulletin_text, analyze_bulletin_images

    db = SessionLocal()
    started = datetime.utcnow()
    try:
        bulletin = db.query(Bulletin).filter(Bulletin.id == bulletin_id).first()
        if not bulletin or not bulletin.pdf_url:
            return

        # 분석 시작 표시 (UI 폴링용)
        bulletin.ai_status = "processing"
        bulletin.ai_started_at = started
        bulletin.ai_finished_at = None
        bulletin.ai_error = None
        db.commit()

        pdf_path = bulletin.pdf_url.lstrip("/")
        if not os.path.exists(pdf_path):
            bulletin.ai_status = "failed"
            bulletin.ai_error = "PDF 파일을 찾을 수 없습니다."
            bulletin.ai_finished_at = datetime.utcnow()
            db.commit()
            return

        text_content = extract_text(pdf_path)
        # 통합검색용 PDF 본문 저장 — 텍스트가 충분히 추출됐을 때만
        # (희박해도 일단 저장하면 "본문 없음" 케이스와 구분이 어려워 검색 노이즈가 됨)
        if text_content and len(text_content) >= 50:
            bulletin.body_text = text_content
            db.commit()
        if is_text_sparse(text_content):
            logger.info("[bulletin %d] 텍스트 희박 → Vision 분석 경로", bulletin_id)
            images = pdf_to_images_b64(pdf_path)
            events = analyze_bulletin_images(bulletin.published_date, images)
        else:
            logger.info("[bulletin %d] 텍스트 분석 경로 (%d자)", bulletin_id, len(text_content))
            events = analyze_bulletin_text(bulletin.published_date, text_content)
            if not events:
                logger.info("[bulletin %d] 텍스트 분석 0건 → Vision fallback", bulletin_id)
                images = pdf_to_images_b64(pdf_path)
                events = analyze_bulletin_images(bulletin.published_date, images)

        logger.info("[bulletin %d] 추출된 항목 %d건", bulletin_id, len(events) if events else 0)

        new_extractions = _route_and_save_events(db, bulletin, events or [], bulletin_id)
        bulletin.ai_status = "done"
        bulletin.ai_finished_at = datetime.utcnow()
        db.commit()
        logger.info(
            "[bulletin %d] 자동 처리 완료 — %d건 라우팅 (소요 %.1fs)",
            bulletin_id,
            len(new_extractions),
            (bulletin.ai_finished_at - started).total_seconds(),
        )
    except Exception as exc:
        logger.exception("[bulletin %d] 자동 처리 실패: %s", bulletin_id, exc)
        db.rollback()
        # 실패 상태 기록 — rollback 이후 새 트랜잭션
        try:
            b = db.query(Bulletin).filter(Bulletin.id == bulletin_id).first()
            if b:
                b.ai_status = "failed"
                b.ai_finished_at = datetime.utcnow()
                b.ai_error = str(exc)[:500]
                db.commit()
        except Exception:
            db.rollback()
    finally:
        db.close()


class ApproveAsVisionBody(BaseModel):
    year: int | None = None
    motto: str | None = None
    body: str | None = None
    is_current: bool = False


@router.post("/extractions/{extraction_id}/approve-as-vision", response_model=ExtractionOut)
def approve_extraction_as_vision(
    extraction_id: int,
    body: ApproveAsVisionBody,
    db: Session = Depends(get_db),
    _admin: Admin = Depends(get_current_admin),
):
    """AI가 뽑은 '지표' 추출 항목을 visions 테이블에 등록.

    - motto / body / year 는 body 로 받되, 비어 있으면 extraction 에서 자동 채움
    - is_current=True 면 같은 해의 기존 current 항목들을 자동으로 False 로 내림
    """
    ext = db.query(BulletinExtraction).filter(BulletinExtraction.id == extraction_id).first()
    if not ext:
        raise HTTPException(status_code=404, detail="추출 항목을 찾을 수 없습니다.")
    if ext.status != "pending":
        raise HTTPException(status_code=400, detail="이미 처리된 항목입니다.")

    bulletin = db.query(Bulletin).filter(Bulletin.id == ext.bulletin_id).first()
    default_year = bulletin.published_date.year if bulletin else date.today().year

    year = body.year or default_year
    motto = (body.motto or ext.title or "").strip()
    if not motto:
        raise HTTPException(status_code=400, detail="motto(슬로건)는 비울 수 없습니다.")
    # visions.motto 는 VARCHAR(300) — 너무 길면 잘라서 저장
    motto = motto[:300]
    vision_body = body.body if body.body is not None else (ext.content or None)

    # is_current=True 면 같은 해의 기존 current 를 False 로 내림
    if body.is_current:
        db.execute(
            text("UPDATE visions SET is_current = FALSE WHERE year = :y AND is_current = TRUE"),
            {"y": year},
        )

    db.execute(
        text(
            "INSERT INTO visions (year, motto, body, is_current) "
            "VALUES (:year, :motto, :body, :is_current)"
        ),
        {"year": year, "motto": motto, "body": vision_body, "is_current": body.is_current},
    )

    ext.status = "approved"
    db.commit()
    db.refresh(ext)
    return ext


@router.post("/extractions/{extraction_id}/approve-as-event", response_model=ExtractionOut)
def approve_extraction_as_event(
    extraction_id: int,
    db: Session = Depends(get_db),
    _admin: Admin = Depends(get_current_admin),
):
    ext = db.query(BulletinExtraction).filter(BulletinExtraction.id == extraction_id).first()
    if not ext:
        raise HTTPException(status_code=404, detail="추출 항목을 찾을 수 없습니다.")
    if ext.status != "pending":
        raise HTTPException(status_code=400, detail="이미 처리된 항목입니다.")

    category = _EVENT_CATEGORY.get(ext.event_type or "", "general")

    db.execute(
        text(
            "INSERT INTO events (title, description, event_date, start_time, location, category, is_public) "
            "VALUES (:title, :desc, :edate, :stime, :loc, :cat, TRUE)"
        ),
        {
            "title": ext.title,
            "desc": ext.content,
            "edate": ext.event_date,
            "stime": None,
            "loc": ext.location,
            "cat": category,
        },
    )

    ext.status = "approved"
    db.commit()
    db.refresh(ext)
    return ext


@router.post("/extractions/{extraction_id}/reject", response_model=ExtractionOut)
def reject_extraction(
    extraction_id: int,
    db: Session = Depends(get_db),
    _admin: Admin = Depends(get_current_admin),
):
    ext = db.query(BulletinExtraction).filter(BulletinExtraction.id == extraction_id).first()
    if not ext:
        raise HTTPException(status_code=404, detail="추출 항목을 찾을 수 없습니다.")
    ext.status = "rejected"
    db.commit()
    db.refresh(ext)
    return ext


# ── 헬퍼 ──────────────────────────────────────────────────


def _fingerprint(
    group: str | None,
    event_date: str | None,
    event_type: str | None,
    title: str | None = "",
    bulletin_id: int | None = None,
) -> str:
    """추출 항목 식별용 fingerprint.

    - bulletin_id 를 포함해 **주보별 독립** 처리. 같은 주보 안에서만 중복이
      차단되고, 다른 주보의 동명 항목(예: 매주 반복되는 '주일 말씀 묵상과 실천')
      은 자연스럽게 통과한다.
    - bulletin_id 없이 호출되면(혹시 모를 다른 경로) title·type 기반 fp 로 폴백.
    - 다른 주보 간 같은 행사·공지 중복은 _is_fuzzy_duplicate 가 별도 처리.
    """
    title_key = "".join((title or "").split())
    bid = "" if bulletin_id is None else str(bulletin_id)
    raw = f"{bid}|{group or ''}|{event_date or ''}|{event_type or ''}|{title_key}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


def _is_fuzzy_duplicate(
    db: Session,
    title: str,
    event_date: "date | None",
    bulletin_id: int | None = None,
) -> bool:
    """제목 유사도 80% 이상이면 중복으로 판단.

    비교 범위:
    - event_date 가 있으면: 같은 날짜의 모든 기존 항목과 비교 (다른 주보 포함)
    - event_date 가 없으면: **같은 bulletin_id 안에서만** 비교
      (다른 주보의 비슷한 공지/묵상까지 막아버리면 매주 반복되는 공지가 사라지므로)
    """
    if not title:
        return False

    query = db.query(BulletinExtraction.title).filter(
        BulletinExtraction.status != "rejected",
    )
    if event_date:
        query = query.filter(BulletinExtraction.event_date == event_date)
    elif bulletin_id is not None:
        query = query.filter(BulletinExtraction.bulletin_id == bulletin_id)
    else:
        return False

    for (existing_title,) in query.all():
        ratio = SequenceMatcher(None, title, existing_title).ratio()
        if ratio >= 0.80:
            logger.info(
                "[중복 감지] '%s' ↔ '%s' (유사도 %.0f%%, 범위=%s)",
                title, existing_title, ratio * 100,
                f"date={event_date}" if event_date else f"bulletin={bulletin_id}",
            )
            return True
    return False


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None
