"""장애 신고 API.

- POST /api/reports — 신고 등록 (인증 선택, 비회원 허용)
- GET  /api/reports — 운영자 목록
- GET  /api/reports/{id} — 운영자 상세
- PATCH /api/reports/{id} — 운영자 상태·메모 수정

알림(이메일) 발송은 개발 단계 보류 — 추후 _notify_operators stub 채우면 활성화.
"""
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from pydantic import BaseModel, EmailStr

from app.core.database import get_db
from app.core.auth import get_current_admin, get_optional_member
from app.models.issue_report import IssueReport
from app.models.member import Member

router = APIRouter(prefix="/reports", tags=["issue_reports"])

VALID_STATUSES = {"pending", "in_progress", "done"}


# ── 스키마 ─────────────────────────────────────────────────

class IssueReportIn(BaseModel):
    """신고 등록 — 회원이면 reporter_member_id 자동 채움, 비회원은 name/email 직접 입력."""
    content: str
    page_url: Optional[str] = None
    reporter_name: Optional[str] = None
    reporter_email: Optional[EmailStr] = None


class IssueReportUpdate(BaseModel):
    status: Optional[str] = None
    admin_note: Optional[str] = None


class ReporterOut(BaseModel):
    id: int
    nickname: str
    email: str
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True


class IssueReportOut(BaseModel):
    id: int
    content: str
    page_url: Optional[str] = None
    status: str
    admin_note: Optional[str] = None
    reporter_member_id: Optional[int] = None
    reporter_name: Optional[str] = None
    reporter_email: Optional[str] = None
    reporter: Optional[ReporterOut] = None  # 회원 신고면 채움
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class IssueReportListOut(BaseModel):
    items: list[IssueReportOut]
    total: int
    counts: dict  # {"pending": N, "in_progress": N, "done": N}


# ── 알림 stub (개발 단계 비활성, 추후 채움) ───────────────

def _notify_operators(report: IssueReport, db: Session) -> None:
    """운영자에게 신규 신고 알림. 현재 stub — 운영 단계에서 활성화."""
    return


# ── endpoint ──────────────────────────────────────────────

@router.post("", response_model=IssueReportOut, status_code=201)
def create_report(
    body: IssueReportIn,
    db: Session = Depends(get_db),
    current: Optional[Member] = Depends(get_optional_member),
):
    content = (body.content or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="신고 내용을 입력해 주세요.")
    if len(content) > 5000:
        raise HTTPException(status_code=400, detail="신고 내용은 5000자 이내로 입력해 주세요.")
    # 회원이 등록하면 reporter_member_id 자동, 이름·이메일은 회원 정보로 채움
    if current:
        reporter_member_id = current.id
        reporter_name = current.nickname
        reporter_email = current.email
    else:
        reporter_member_id = None
        reporter_name = (body.reporter_name or "").strip() or None
        reporter_email = body.reporter_email
    page_url = (body.page_url or "").strip()[:500] or None
    report = IssueReport(
        reporter_member_id=reporter_member_id,
        reporter_name=reporter_name,
        reporter_email=reporter_email,
        content=content,
        page_url=page_url,
        status="pending",
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    _notify_operators(report, db)
    return _to_out(report, db)


@router.get("", response_model=IssueReportListOut)
def list_reports(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    q = db.query(IssueReport).options(joinedload(IssueReport.reporter))
    if status:
        if status not in VALID_STATUSES:
            raise HTTPException(status_code=400, detail="잘못된 status 값입니다.")
        q = q.filter(IssueReport.status == status)
    total = q.count()
    items = (
        q.order_by(desc(IssueReport.created_at))
         .offset((page - 1) * size)
         .limit(size)
         .all()
    )
    counts = {s: 0 for s in VALID_STATUSES}
    for row in db.query(IssueReport.status).all():
        if row[0] in counts:
            counts[row[0]] += 1
    return IssueReportListOut(
        items=[_to_out(r, db) for r in items],
        total=total,
        counts=counts,
    )


@router.get("/{report_id}", response_model=IssueReportOut)
def get_report(report_id: int, db: Session = Depends(get_db), _admin=Depends(get_current_admin)):
    report = _get_or_404(report_id, db)
    return _to_out(report, db)


@router.patch("/{report_id}", response_model=IssueReportOut)
def update_report(
    report_id: int,
    body: IssueReportUpdate,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    report = _get_or_404(report_id, db)
    if body.status is not None:
        if body.status not in VALID_STATUSES:
            raise HTTPException(status_code=400, detail="잘못된 status 값입니다.")
        report.status = body.status
    if body.admin_note is not None:
        report.admin_note = body.admin_note.strip() or None
    db.commit()
    db.refresh(report)
    return _to_out(report, db)


@router.delete("/{report_id}", status_code=204)
def delete_report(report_id: int, db: Session = Depends(get_db), _admin=Depends(get_current_admin)):
    report = _get_or_404(report_id, db)
    db.delete(report)
    db.commit()


# ── 헬퍼 ──────────────────────────────────────────────────

def _get_or_404(report_id: int, db: Session) -> IssueReport:
    report = (
        db.query(IssueReport)
        .options(joinedload(IssueReport.reporter))
        .filter(IssueReport.id == report_id)
        .first()
    )
    if not report:
        raise HTTPException(status_code=404, detail="신고를 찾을 수 없습니다.")
    return report


def _to_out(report: IssueReport, db: Session) -> IssueReportOut:
    out = IssueReportOut.model_validate(report)
    if report.reporter:
        out.reporter = ReporterOut.model_validate(report.reporter)
    return out
