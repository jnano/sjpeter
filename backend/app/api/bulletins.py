import hashlib
import logging
import os
import uuid
from datetime import date, datetime
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


def _route_and_save_events(db: Session, bulletin: Bulletin, events: list[dict], bulletin_id: int) -> list[BulletinExtraction]:
    """events 리스트를 BulletinExtraction에 저장하고 자동 라우팅.
    - 공지 → notices INSERT, status='auto_drafted'
    - 행사/모임 + 날짜 → events INSERT, status='auto_drafted'
    - 나머지 → ai-extract 게시판 임시저장 (또는 pending)
    """
    from sqlalchemy import text as _text
    if not events:
        return []

    parish_row = db.execute(_text("SELECT id FROM parishes LIMIT 1")).fetchone()
    parish_id = parish_row[0] if parish_row else 1
    ai_board = db.query(Board).filter(Board.slug == "ai-extract", Board.is_active == True).first()
    issue_label = (
        f"제{bulletin.issue_number}호"
        if bulletin.issue_number
        else bulletin.published_date.strftime("%Y.%m.%d")
    )

    new_extractions: list[BulletinExtraction] = []
    for ev in events:
        fp = _fingerprint(ev.get("group_name"), ev.get("event_date"), ev.get("event_type"))
        exists = db.query(BulletinExtraction).filter(
            BulletinExtraction.fingerprint == fp,
            BulletinExtraction.status != "rejected",
        ).first()
        if exists:
            continue

        parsed_date = _parse_date(ev.get("event_date"))
        if _is_fuzzy_duplicate(db, ev.get("title", ""), parsed_date):
            continue

        event_type = ev.get("event_type") or "모임"
        title = ev.get("title", "")
        content_text = ev.get("content")

        # 공지 → notices 바로 등록
        if event_type == "공지":
            db.execute(
                _text(
                    "INSERT INTO notices (parish_id, title, content, is_pinned, is_ai_generated, created_at) "
                    "VALUES (:pid, :title, :content, FALSE, TRUE, NOW())"
                ),
                {"pid": parish_id, "title": title, "content": content_text},
            )
            ext = BulletinExtraction(
                bulletin_id=bulletin_id, title=title, content=content_text,
                group_name=ev.get("group_name"), event_date=parsed_date,
                location=ev.get("location"), event_type=event_type,
                fingerprint=fp, status="auto_drafted",
            )
            db.add(ext)
            new_extractions.append(ext)
            continue

        # 행사/모임 + 날짜 → 캘린더 바로 등록
        if event_type in ("행사", "모임") and parsed_date:
            category = "community" if event_type == "모임" else "general"
            parsed_end = _parse_date(ev.get("end_date"))
            db.execute(
                _text(
                    "INSERT INTO events (title, description, event_date, end_date, location, category, is_public, is_ai_generated, event_kind) "
                    "VALUES (:title, :desc, :edate, :eend, :loc, :cat, TRUE, TRUE, :kind)"
                ),
                {
                    "title": title, "desc": content_text,
                    "edate": parsed_date,
                    "eend": parsed_end if parsed_end and parsed_end != parsed_date else None,
                    "loc": ev.get("location"), "cat": category, "kind": event_type,
                },
            )
            ext = BulletinExtraction(
                bulletin_id=bulletin_id, title=title, content=content_text,
                group_name=ev.get("group_name"), event_date=parsed_date,
                location=ev.get("location"), event_type=event_type,
                fingerprint=fp, status="auto_drafted",
            )
            db.add(ext)
            new_extractions.append(ext)
            continue

        # 나머지 (날짜 없는 행사·모임) → ai-extract 게시판 임시저장
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
    """
    from app.core.database import SessionLocal
    from app.services.pdf_extractor import extract_text, is_text_sparse, pdf_to_images_b64
    from app.services.claude_analyzer import analyze_bulletin_text, analyze_bulletin_images
    from sqlalchemy import text as _text

    db = SessionLocal()
    try:
        bulletin = db.query(Bulletin).filter(Bulletin.id == bulletin_id).first()
        if not bulletin or not bulletin.pdf_url:
            return

        pdf_path = bulletin.pdf_url.lstrip("/")
        if not os.path.exists(pdf_path):
            return

        text_content = extract_text(pdf_path)
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
        if not events:
            return

        new_extractions = _route_and_save_events(db, bulletin, events, bulletin_id)
        db.commit()
        logger.info("[bulletin %d] 자동 처리 완료 — %d건 라우팅", bulletin_id, len(new_extractions))
    except Exception as exc:
        logger.exception("[bulletin %d] 자동 처리 실패: %s", bulletin_id, exc)
        db.rollback()
    finally:
        db.close()


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


def _fingerprint(group: str | None, event_date: str | None, event_type: str | None) -> str:
    raw = f"{group or ''}|{event_date or ''}|{event_type or ''}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


def _is_fuzzy_duplicate(db: Session, title: str, event_date: "date | None") -> bool:
    """같은 날짜의 기존 추출 항목 중 제목 유사도 80% 이상이면 중복으로 판단."""
    if not event_date or not title:
        return False
    existing_titles = (
        db.query(BulletinExtraction.title)
        .filter(
            BulletinExtraction.event_date == event_date,
            BulletinExtraction.status != "rejected",
        )
        .all()
    )
    for (existing_title,) in existing_titles:
        ratio = SequenceMatcher(None, title, existing_title).ratio()
        if ratio >= 0.80:
            logger.info("[중복 감지] '%s' ↔ '%s' (유사도 %.0f%%)", title, existing_title, ratio * 100)
            return True
    return False


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None
