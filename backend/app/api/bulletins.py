import hashlib
import os
import uuid
from datetime import date, datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel
from app.core.database import get_db
from app.core.auth import get_current_admin
from app.core.config import settings
from app.models.bulletin import Bulletin
from app.models.bulletin_extraction import BulletinExtraction
from app.models.board import Board, Post
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

    # 텍스트 추출 시도 → 희박하면 Vision으로 폴백
    text = extract_text(pdf_path)
    if is_text_sparse(text):
        images = pdf_to_images_b64(pdf_path)
        events = analyze_bulletin_images(bulletin.published_date, images)
    else:
        events = analyze_bulletin_text(bulletin.published_date, text)

    if not events:
        return []

    # 중복 감지 + DB 저장
    new_extractions = []
    for ev in events:
        fp = _fingerprint(ev.get("group_name"), ev.get("event_date"), ev.get("event_type"))
        exists = db.query(BulletinExtraction).filter(
            BulletinExtraction.fingerprint == fp,
            BulletinExtraction.status != "rejected",
        ).first()
        if exists:
            continue

        ext = BulletinExtraction(
            bulletin_id=bulletin_id,
            title=ev.get("title", ""),
            content=ev.get("content"),
            group_name=ev.get("group_name"),
            event_date=_parse_date(ev.get("event_date")),
            location=ev.get("location"),
            event_type=ev.get("event_type"),
            fingerprint=fp,
            status="pending",
        )
        db.add(ext)
        new_extractions.append(ext)

    db.commit()
    for e in new_extractions:
        db.refresh(e)
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


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None
