import hashlib
import logging
import os
import re
import uuid
from datetime import date, datetime, time
from difflib import SequenceMatcher
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse

logger = logging.getLogger(__name__)
from sqlalchemy.orm import Session
from sqlalchemy import desc, text
from pydantic import BaseModel
from app.core.database import get_db
from app.core.admin_log import get_admin_identifier, log_action
from app.core.auth import get_current_admin
from app.core.config import settings
from app.core.email import send_bulletin_notification
from app.models.bulletin import Bulletin, BulletinExtractedImage
from app.models.bulletin_extraction import BulletinExtraction
from app.models.page_photo import PagePhoto
from app.models.attachment import Attachment
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
    admin: Admin = Depends(get_current_admin),
):
    if pdf_file.content_type not in ("application/pdf", "application/octet-stream"):
        raise HTTPException(status_code=400, detail="PDF 파일만 업로드할 수 있습니다.")

    content = await pdf_file.read()
    # MIME 헤더만으론 octet-stream 우회 가능. 매직 바이트(`%PDF-`)로 실제 검증.
    if not content.startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="유효한 PDF 파일이 아닙니다.")

    ext = os.path.splitext(pdf_file.filename or "bulletin.pdf")[1] or ".pdf"
    filename = f"{uuid.uuid4().hex}{ext}"
    save_path = os.path.join(settings.UPLOAD_DIR, "bulletins", filename)
    os.makedirs(os.path.dirname(save_path), exist_ok=True)

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

    log_action(db, get_admin_identifier(admin), "upload_bulletin", "bulletin", bulletin.id, f"호={bulletin.issue_number} {bulletin.published_date}")
    return bulletin


@router.post("/{bulletin_id}/reanalyze")
def reanalyze_bulletin(
    bulletin_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """기존 주보를 다시 AI 분석. 파서 개선 후 0건 처리된 주보를 살리는 용도."""
    # SELECT FOR UPDATE 로 동시 reanalyze race 차단 (이미 processing 이면 409)
    bulletin = (
        db.query(Bulletin)
        .filter(Bulletin.id == bulletin_id)
        .with_for_update()
        .first()
    )
    if not bulletin:
        raise HTTPException(status_code=404, detail="주보를 찾을 수 없습니다.")
    if bulletin.ai_status == "processing":
        raise HTTPException(status_code=409, detail="이미 분석이 진행 중입니다. 잠시 후 다시 시도해 주세요.")

    bulletin.ai_status = "processing"
    bulletin.ai_started_at = datetime.utcnow()
    bulletin.ai_finished_at = None
    bulletin.ai_error = None
    bulletin.ai_retry_count = 0  # 수동 재분석은 새 시작 — 자동 재시도 한도 리셋
    db.commit()
    log_action(db, get_admin_identifier(admin), "reanalyze_bulletin", "bulletin", bulletin_id, None)

    background_tasks.add_task(_auto_process_bulletin, bulletin_id)
    return {"ok": True, "ai_status": "processing"}


class BatchCountsBody(BaseModel):
    bulletin_ids: list[int]


@router.post("/routed-counts/batch")
def bulletin_routed_counts_batch(
    body: BatchCountsBody,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """다건 주보의 결과물 카운트를 한 번에 합산. /admin/bulletin 다중 삭제 다이얼로그용 (N+1 회피)."""
    if not body.bulletin_ids:
        return {"per_bulletin": {}, "sum": {"extractions": 0, "events": 0, "meditations": 0, "visions": 0, "posts": 0, "images": 0}, "not_found": []}

    # SQLAlchemy expanding bindparam — IN 절에 list 안전하게 바인딩 (PG syntax error 방어)
    from sqlalchemy import bindparam

    def counts_by_col(table: str, col: str) -> dict[int, int]:
        stmt = text(
            f"SELECT {col}, COUNT(*) FROM {table} WHERE {col} IN :ids GROUP BY {col}"
        ).bindparams(bindparam("ids", expanding=True))
        rows = db.execute(stmt, {"ids": body.bulletin_ids}).fetchall()
        return {r[0]: r[1] for r in rows}

    # 존재하는 주보 id 확인 (not_found 분리 — bulk-reject 와 일관성)
    existing_rows = db.execute(
        text("SELECT id FROM bulletins WHERE id IN :ids").bindparams(bindparam("ids", expanding=True)),
        {"ids": body.bulletin_ids},
    ).fetchall()
    existing_ids = {r[0] for r in existing_rows}
    not_found = [i for i in body.bulletin_ids if i not in existing_ids]

    ext_map = counts_by_col("bulletin_extractions", "bulletin_id")
    img_map = counts_by_col("bulletin_extracted_images", "bulletin_id")
    ev_map = counts_by_col("events", "source_bulletin_id")
    med_map = counts_by_col("meditations", "source_bulletin_id")
    vis_map = counts_by_col("visions", "source_bulletin_id")
    post_map = counts_by_col("posts", "source_bulletin_id")

    per_bulletin: dict[int, dict] = {}
    total = {"extractions": 0, "events": 0, "meditations": 0, "visions": 0, "posts": 0, "images": 0}
    for bid in body.bulletin_ids:
        if bid not in existing_ids:
            continue  # not_found 는 per_bulletin 에서 제외 (0 으로 오해 방지)
        row = {
            "extractions": ext_map.get(bid, 0),
            "events": ev_map.get(bid, 0),
            "meditations": med_map.get(bid, 0),
            "visions": vis_map.get(bid, 0),
            "posts": post_map.get(bid, 0),
            "images": img_map.get(bid, 0),
        }
        per_bulletin[bid] = row
        for k, v in row.items():
            total[k] += v

    return {"per_bulletin": per_bulletin, "sum": total, "not_found": not_found}


@router.get("/ai-stats")
def ai_analysis_stats(
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """AI 분석 관찰성 지표 — 성공률·소요시간·재시도·에러 패턴·event_type 분포."""
    # 상태별 분포
    status_rows = db.execute(text(
        "SELECT ai_status, COUNT(*) FROM bulletins WHERE ai_status IS NOT NULL GROUP BY ai_status"
    )).fetchall()
    by_status = {r[0]: r[1] for r in status_rows}
    total_analyzed = sum(by_status.values())

    # 소요시간(초): 완료된 분석만
    duration_rows = db.execute(text("""
        SELECT EXTRACT(EPOCH FROM (ai_finished_at - ai_started_at))::INT
        FROM bulletins
        WHERE ai_status='done' AND ai_started_at IS NOT NULL AND ai_finished_at IS NOT NULL
        ORDER BY 1
    """)).fetchall()
    durations = [r[0] for r in duration_rows if r[0] is not None]

    def percentile(values: list[int], p: float) -> int:
        if not values:
            return 0
        idx = min(len(values) - 1, int(len(values) * p))
        return values[idx]

    duration_stats = {
        "count": len(durations),
        "avg": int(sum(durations) / len(durations)) if durations else 0,
        "p50": percentile(durations, 0.5),
        "p95": percentile(durations, 0.95),
        "max": durations[-1] if durations else 0,
    }

    # 재시도 발생 분포
    retry_rows = db.execute(text(
        "SELECT ai_retry_count, COUNT(*) FROM bulletins WHERE ai_retry_count > 0 GROUP BY ai_retry_count"
    )).fetchall()
    retries = {r[0]: r[1] for r in retry_rows}

    # 자주 발생한 에러 (최근 50건)
    error_rows = db.execute(text("""
        SELECT LEFT(ai_error, 80) AS err, COUNT(*) AS cnt
        FROM bulletins WHERE ai_status='failed' AND ai_error IS NOT NULL
        GROUP BY LEFT(ai_error, 80) ORDER BY cnt DESC LIMIT 10
    """)).fetchall()
    top_errors = [{"error": r[0], "count": r[1]} for r in error_rows]

    # event_type 분포 (라우팅 결과)
    type_rows = db.execute(text(
        "SELECT COALESCE(event_type,'(미분류)') AS t, COUNT(*) FROM bulletin_extractions GROUP BY t ORDER BY 2 DESC"
    )).fetchall()
    by_event_type = [{"event_type": r[0], "count": r[1]} for r in type_rows]

    # 최근 분석 5건
    recent_rows = db.execute(text("""
        SELECT id, issue_number, published_date, ai_status, ai_started_at, ai_finished_at,
               ai_retry_count, LEFT(COALESCE(ai_error,''), 80) AS err
        FROM bulletins
        WHERE ai_status IS NOT NULL
        ORDER BY COALESCE(ai_started_at, '1970-01-01'::TIMESTAMP) DESC
        LIMIT 5
    """)).fetchall()
    recent = [
        {
            "id": r[0], "issue_number": r[1], "published_date": str(r[2]) if r[2] else None,
            "ai_status": r[3],
            "ai_started_at": r[4].isoformat() if r[4] else None,
            "ai_finished_at": r[5].isoformat() if r[5] else None,
            "ai_retry_count": r[6] or 0,
            "ai_error": r[7] if r[7] else None,
        }
        for r in recent_rows
    ]

    return {
        "total_analyzed": total_analyzed,
        "by_status": by_status,
        "success_rate": round(by_status.get("done", 0) / total_analyzed * 100, 1) if total_analyzed else 0.0,
        "duration_seconds": duration_stats,
        "retries": retries,
        "top_errors": top_errors,
        "by_event_type": by_event_type,
        "recent": recent,
    }


@router.get("/{bulletin_id}/routed-counts")
def bulletin_routed_counts(
    bulletin_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """주보 삭제 시 cascade 로 함께 사라질 결과물 카운트.
    프론트엔드 삭제 다이얼로그에서 미리 보여줘 사용자가 결정할 수 있게 함."""
    bulletin = db.query(Bulletin).filter(Bulletin.id == bulletin_id).first()
    if not bulletin:
        raise HTTPException(status_code=404, detail="주보를 찾을 수 없습니다.")

    return {
        "extractions": db.execute(
            text("SELECT COUNT(*) FROM bulletin_extractions WHERE bulletin_id=:b"),
            {"b": bulletin_id},
        ).scalar() or 0,
        "events": db.execute(
            text("SELECT COUNT(*) FROM events WHERE source_bulletin_id=:b"),
            {"b": bulletin_id},
        ).scalar() or 0,
        "meditations": db.execute(
            text("SELECT COUNT(*) FROM meditations WHERE source_bulletin_id=:b"),
            {"b": bulletin_id},
        ).scalar() or 0,
        "visions": db.execute(
            text("SELECT COUNT(*) FROM visions WHERE source_bulletin_id=:b"),
            {"b": bulletin_id},
        ).scalar() or 0,
        "posts": db.execute(
            text("SELECT COUNT(*) FROM posts WHERE source_bulletin_id=:b"),
            {"b": bulletin_id},
        ).scalar() or 0,
        "images": db.execute(
            text("SELECT COUNT(*) FROM bulletin_extracted_images WHERE bulletin_id=:b"),
            {"b": bulletin_id},
        ).scalar() or 0,
    }


@router.delete("/{bulletin_id}")
def delete_bulletin(
    bulletin_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """주보 삭제. 다음이 함께 정리됨:
    - bulletin_extractions / bulletin_extracted_images (DB CASCADE)
    - events / meditations / visions (source_bulletin_id CASCADE)
    - source_bulletin_id 를 가진 posts — ORM 으로 명시 삭제 (attachments.post_id 가
      NO ACTION 이라 DB CASCADE 만으론 ForeignKeyViolation. ORM lifecycle 안에서
      Post.attachments cascade="all, delete-orphan" 가 attachment 도 함께 정리).
    - PDF 파일 + bulletin-extracted/{id} 디렉터리 + 각 post 의 attachment 디스크 파일.
    """
    import shutil
    # boards.py 의 디스크 unlink 헬퍼 재사용 (circular 회피 위해 함수 안에서 import)
    from app.api.boards import _remove_post_attachment_files

    bulletin = db.query(Bulletin).filter(Bulletin.id == bulletin_id).first()
    if not bulletin:
        raise HTTPException(status_code=404, detail="주보를 찾을 수 없습니다.")

    if bulletin.pdf_url:
        file_path = bulletin.pdf_url.lstrip("/")
        if os.path.exists(file_path):
            os.remove(file_path)

    # 추출 이미지 디렉터리 정리 (DB cascade 와 별개로 디스크 파일·폴더 삭제)
    # private-uploads/ 로 이전 (v1.5.278). 구버전 호환 위해 둘 다 시도.
    for extracted_dir in (
        os.path.join("private-uploads", "bulletin-extracted", str(bulletin_id)),
        os.path.join(settings.UPLOAD_DIR, "bulletin-extracted", str(bulletin_id)),
    ):
        if os.path.isdir(extracted_dir):
            try:
                shutil.rmtree(extracted_dir)
            except Exception as exc:
                logger.warning("[bulletin %d] 추출 이미지 디렉터리 삭제 실패 (%s): %s", bulletin_id, extracted_dir, exc)

    # source_bulletin_id 를 가진 posts 를 ORM 으로 명시 정리.
    # attachments 의 디스크 파일 unlink 한 뒤 Post 를 삭제 — Post.attachments cascade 가
    # attachment DB row 까지 자동 제거. db.delete(bulletin) 전에 처리해야 FK 충돌 회피.
    from sqlalchemy.orm import joinedload
    bulletin_posts = (
        db.query(Post)
        .options(joinedload(Post.attachments))
        .filter(Post.source_bulletin_id == bulletin_id)
        .all()
    )
    for p in bulletin_posts:
        _remove_post_attachment_files(p)
        db.delete(p)
    db.flush()

    snapshot = f"호={bulletin.issue_number} {bulletin.published_date}"
    db.delete(bulletin)
    db.commit()
    log_action(db, get_admin_identifier(admin), "delete_bulletin", "bulletin", bulletin_id, snapshot)
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
    created_vision_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


@router.post("/{bulletin_id}/analyze", response_model=list[ExtractionOut])
def analyze_bulletin(
    bulletin_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    from app.services.pdf_extractor import extract_text, is_text_sparse, pdf_to_images_b64
    from app.services.claude_analyzer import analyze_bulletin_text, analyze_bulletin_images, is_ai_available

    if not is_ai_available():
        raise HTTPException(
            status_code=503,
            detail="AI 분석이 비활성 상태입니다. 관리자 > 사이트 설정 > AI 그룹에서 AWS Bedrock 키를 입력하세요."
        )

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
    log_action(db, get_admin_identifier(admin), "analyze_bulletin", "bulletin", bulletin_id, f"extracted={len(new_extractions)}")
    return new_extractions


# 매핑 가능한 event_type — /admin/event-mapping 에서 7개 행사 유형별로
# '게시판' 또는 '캘린더' 라우팅 지정 가능. 매핑 없을 때 디폴트:
#   - 행사·모임 + 날짜 → events 테이블
#   - 그 외 → ai-extract 게시판 임시저장
ROUTABLE_EVENT_TYPES = {"행사", "모임", "봉사", "순례", "피정", "강의", "기타"}


def _format_event_card_body(
    event_id: int,
    title: str,
    event_date,
    location: str | None,
    description: str | None,
) -> str:
    """캘린더 이벤트와 연동된 게시판 카드 본문.
    본문은 짧은 메타 + 캘린더 deep-link 만 보유 — 본문 자체는 events.description 이 권위.
    DB 중복 회피 정책 (시나리오 A)."""
    WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"]
    parts = [f"📅 **{title}**", ""]
    if event_date:
        wk = WEEKDAYS[event_date.weekday()]
        parts.append(f"{event_date.strftime('%Y년 %m월 %d일')} ({wk})")
    if location:
        parts.append(f"📍 {location}")
    parts.append("")
    parts.append(f"→ [캘린더에서 자세히 보기](/calendar?event={event_id})")
    if description:
        parts.append("")
        parts.append("---")
        parts.append("*상세 내용은 캘린더 페이지에서 확인하실 수 있습니다.*")
    return "\n".join(parts)


# 묵상 본문 끝에 흔히 박혀오는 '글 | 작성자' 표기를 잡기 위한 정규식.
# 구분자 후보: | (ASCII pipe) · │ (U+2502) · ｜ (U+FF5C) · ㅣ (U+3163 한글 모음 — 사용자가 자주 혼동) · ： · : · · (middle dot) · -.
_MEDITATION_AUTHOR_RE = re.compile(r'^\s*글\s*[|│｜ㅣ：:·\-]\s*(.+?)\s*$')


def _extract_meditation_author(body: str) -> tuple[str, Optional[str]]:
    """묵상 본문 끝의 '글 | 작성자' 한 줄을 추출.

    반환: (정제된 본문, 추출된 작성자 or None).
    매치 실패 시 원본 body 그대로 + None — 본문 손실 방지.

    동작:
      1) 본문을 줄 단위로 split
      2) 끝에서부터 빈 줄을 건너뛴 첫 비어있지 않은 줄을 검사
      3) 정규식 매치되면 그 줄을 잘라내고, 트레일링 빈 줄도 정리
    """
    if not body:
        return body, None
    lines = body.splitlines()
    i = len(lines) - 1
    while i >= 0 and not lines[i].strip():
        i -= 1
    if i < 0:
        return body, None
    m = _MEDITATION_AUTHOR_RE.match(lines[i])
    if not m:
        return body, None
    author = m.group(1).strip()
    new_lines = lines[:i]
    while new_lines and not new_lines[-1].strip():
        new_lines.pop()
    return "\n".join(new_lines), author


def _find_existing_event(db: Session, title: str, event_date) -> Optional[int]:
    """같은 (title, event_date) events 가 이미 있으면 그 id 반환, 없으면 None.

    AI 자동 라우팅(_apply_extraction_routing)·split-by-dates 가 매 주보마다 같은 행사를
    중복 등록하는 것을 막기 위한 사전 검사용. source_bulletin_id 와 무관하게 검사 —
    같은 날짜·제목이면 다른 주보에서 추출돼도 중복으로 간주.

    참고: 사용자가 직접 액션(approve_extraction_as_event)으로 등록하는 경로는 검사 안 함.
    사용자가 의도적으로 같은 행사를 두 번 등록하는 경우를 막지 않기 위함.
    """
    row = db.execute(
        text("SELECT id FROM events WHERE title = :t AND event_date = :d LIMIT 1"),
        {"t": title, "d": event_date},
    ).first()
    return row[0] if row else None


def _format_source_footer(bulletin: Bulletin) -> str:
    """AI 추출 콘텐츠 본문 끝에 붙일 출처 표기.
    본문과 3줄 띄운 뒤 회색 작은 글씨로: '출처: 제N호 주보 (YYYY.MM.DD)'.
    날짜 포맷은 issue_label 과 한국식 점 구분자(YYYY.MM.DD) 로 통일."""
    date_str = bulletin.published_date.strftime("%Y.%m.%d")
    issue_label = f"제{bulletin.issue_number}호" if bulletin.issue_number else date_str
    return (
        "\n\n\n\n"
        f'<span style="color: gray;"><small>**출처: {issue_label} 주보** ({date_str})</small></span>'
    )


def _repin_latest_meditation(db: Session) -> None:
    """발행일이 가장 최근인 단 1개의 묵상만 is_current=TRUE 로 만든다.
    동일 날짜가 여러 개면 id가 가장 큰(나중 등록) 것을 선택.
    옛 주보를 등록해도 옛 글이 대표가 되지 않고, 핀 중복도 방지.

    commit 은 호출자 책임 — savepoint(begin_nested) 내부에서도 안전하게 호출 가능하도록.
    """
    from sqlalchemy import text as _text
    db.execute(_text("UPDATE meditations SET is_current = FALSE WHERE is_current = TRUE"))
    db.execute(_text("""
        UPDATE meditations SET is_current = TRUE
        WHERE id = (
          SELECT id FROM meditations
          WHERE is_published = TRUE
          ORDER BY published_date DESC, id DESC
          LIMIT 1
        )
    """))


def _route_and_save_events(db: Session, bulletin: Bulletin, events: list[dict], bulletin_id: int) -> list[BulletinExtraction]:
    """events 리스트를 BulletinExtraction에 모두 status='pending'으로 저장.

    v1.5.104 부터 자동 라우팅을 폐기 — 관리자가 /admin/bulletin/extractions 에서
    개별 또는 일괄 승인해야 실제 라우팅(meditations/notices/events/게시판) 적용됨.
    중복 fingerprint·fuzzy duplicate 만 스킵.

    실제 라우팅 로직은 `_apply_extraction_routing()` 헬퍼로 분리되어
    승인 API(/extractions/{id}/approve) 에서 호출됨.
    """
    if not events:
        return []

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
        ).first()
        if exists:
            continue

        parsed_date = _parse_date(ev.get("event_date"))
        if _is_fuzzy_duplicate(db, ev.get("title", ""), parsed_date, bulletin_id=bulletin_id):
            continue

        event_type = ev.get("event_type") or "모임"
        title = ev.get("title", "")
        content_text = ev.get("content")

        # groups 배열(복수) 또는 group_name(단일) 정규화 → group_candidates
        groups_raw = ev.get("groups")
        group_candidates: list[str] | None = None
        if isinstance(groups_raw, list):
            cleaned = [g.strip() for g in groups_raw if isinstance(g, str) and g.strip()]
            if cleaned:
                group_candidates = cleaned
        if group_candidates is None and ev.get("group_name"):
            group_candidates = [ev["group_name"]]

        # 시점 분류 — AI 가 미응답하면 unknown 으로 안전 default
        temporal_kind = (ev.get("temporal_kind") or "unknown").strip().lower()
        if temporal_kind not in ("future", "timeless", "past", "unknown"):
            temporal_kind = "unknown"

        # 모든 카테고리 — 관리자 검토 대기
        ext = BulletinExtraction(
            bulletin_id=bulletin_id, title=title, content=content_text,
            group_name=ev.get("group_name"),
            group_candidates=group_candidates,
            event_date=parsed_date,
            location=ev.get("location"), event_type=event_type,
            temporal_kind=temporal_kind,
            temporal_reason=ev.get("temporal_reason"),
            fingerprint=fp, status="pending",
        )
        db.add(ext)
        new_extractions.append(ext)

    return new_extractions


def _apply_extraction_routing(db: Session, ext: BulletinExtraction) -> BulletinExtraction:
    """단일 BulletinExtraction 을 event_type 에 맞춰 실제 라우팅 (승인 시 호출).

    - 묵상 → meditations
    - 공지 → notices
    - 행사·모임·봉사·순례·피정·강의·기타 → /admin/event-mapping 매핑 기반
        a. mapping.use_calendar=True + 날짜 있음 → events
        b. mapping.board_id 지정 → 그 게시판으로 Post
        c. 매핑 없음 + 행사·모임 + 날짜 → events (디폴트)
        d. 그 외 → ai-extract 게시판 fallback

    지표는 별도 motto/year 등 필요해 이 함수에서 처리 안 함 →
    /extractions/{id}/approve-as-vision 엔드포인트로 직접 처리.

    이미 처리된(approved/rejected) 항목은 raise.
    """
    from sqlalchemy import text as _text
    if ext.status != "pending":
        raise HTTPException(status_code=400, detail="이미 처리된 항목입니다.")
    if ext.event_type == "지표":
        raise HTTPException(
            status_code=400,
            detail="지표는 일괄 승인 대상이 아닙니다. approve-as-vision 으로 처리하세요.",
        )

    bulletin = db.query(Bulletin).filter(Bulletin.id == ext.bulletin_id).first()
    if not bulletin:
        raise HTTPException(status_code=404, detail="주보를 찾을 수 없습니다.")

    parish_row = db.execute(_text("SELECT id FROM parishes LIMIT 1")).fetchone()
    parish_id = parish_row[0] if parish_row else 1
    ai_board = db.query(Board).filter(Board.slug == "ai-extract", Board.is_active == True).first()

    issue_label = (
        f"제{bulletin.issue_number}호"
        if bulletin.issue_number
        else bulletin.published_date.strftime("%Y.%m.%d")
    )
    published_ts = datetime.combine(bulletin.published_date, time(12, 0))

    event_type = ext.event_type or "모임"
    title = ext.title or ""
    content_text = ext.content
    parsed_date = ext.event_date
    # 모든 분기에서 본문 끝에 동일한 형식의 출처 표기를 붙임 (회색 작은 글씨, 3줄 띄움)
    body_with_source = (content_text or "") + _format_source_footer(bulletin)

    # 1. 묵상 → meditations
    if event_type == "묵상":
        # 본문 끝의 '글 | 작성자' 표기는 author 컬럼으로 분리, 본문에서는 제거.
        cleaned_text, meditation_author = _extract_meditation_author(content_text or "")
        meditation_body = cleaned_text + _format_source_footer(bulletin)
        row = db.execute(
            _text(
                "INSERT INTO meditations (title, body, author, published_date, is_published, source_bulletin_id, created_at, updated_at) "
                "VALUES (:title, :body, :author, :pdate, TRUE, :src, :ts, :ts) RETURNING id"
            ),
            {
                "title": title, "body": meditation_body, "author": meditation_author,
                "pdate": bulletin.published_date, "src": bulletin.id, "ts": published_ts,
            },
        ).first()
        new_id = row[0] if row else None
        ext.created_meditation_id = new_id
        ext.status = "approved"
        # 발행일 기준 최신만 대표(is_current)로 지정 — 옛 주보를 늦게 등록해도
        # 옛 글이 자동으로 대표가 되지 않도록, 동시에 옛 핀이 남는 것도 방지.
        if new_id:
            _repin_latest_meditation(db)
        return ext

    # 2. 공지 → posts (notice 게시판)
    # /api/notices/* 는 모두 posts 테이블의 notice 게시판에서 읽으므로,
    # 공지 INSERT 도 동일하게 posts 로 가야 공개 페이지에 노출됨.
    # is_ai_generated 표시는 member_id=NULL 로 추론 (notices.py:_to_notice_out).
    if event_type == "공지":
        notice_board = db.query(Board).filter(Board.slug == "notice", Board.is_active == True).first()
        # notice 게시판이 없거나 비활성이면 ai-extract 으로 graceful fallback (초기 셋업·운영 안전장치)
        target = notice_board or ai_board
        if not target:
            raise HTTPException(status_code=500, detail="'notice'·'ai-extract' 게시판이 모두 없습니다. 게시판 설정을 확인하세요.")
        post = Post(
            board_id=target.id,
            member_id=None,                # AI/admin 생성 표식
            title=title if notice_board else f"[{issue_label}] {title}",
            content=body_with_source,
            is_published=bool(notice_board),  # fallback 시 임시저장
            is_pinned=False,
            view_count=0,
            source_bulletin_id=bulletin.id,
            created_at=published_ts,
        )
        db.add(post)
        db.flush()                         # post.id 확보
        if notice_board:
            ext.created_notice_id = post.id    # 컬럼명은 created_notice_id 지만 실제로는 posts.id
        else:
            ext.target_board_id = target.id
            ext.created_post_id = post.id
        ext.status = "approved"
        return ext

    # 3. 행사·모임·... — 매핑 우선
    if event_type in ROUTABLE_EVENT_TYPES:
        mapping = db.query(EventBoardMapping).filter(EventBoardMapping.event_type == event_type).first()
        category = "community" if event_type == "모임" else "general"

        # 3a. 캘린더 매핑 + 날짜 있음 → events (중복이면 skip + 기존 id 재사용)
        if mapping and mapping.use_calendar and parsed_date:
            existing_id = _find_existing_event(db, title, parsed_date)
            if existing_id:
                ext.created_event_id = existing_id
                ext.status = "approved"
                logger.info(
                    "[ext %s] skip duplicate event (3a): (%r, %s) → existing id=%d",
                    ext.id, title, parsed_date, existing_id,
                )
                return ext
            row = db.execute(
                _text(
                    "INSERT INTO events (title, description, event_date, end_date, location, category, is_public, is_ai_generated, event_kind, source_bulletin_id, created_at) "
                    "VALUES (:title, :desc, :edate, :eend, :loc, :cat, TRUE, TRUE, :kind, :src, :created) RETURNING id"
                ),
                {
                    "title": title, "desc": body_with_source,
                    "edate": parsed_date, "eend": None,
                    "loc": ext.location, "cat": category, "kind": event_type,
                    "src": bulletin.id, "created": published_ts,
                },
            ).first()
            ext.created_event_id = row[0] if row else None
            ext.status = "approved"
            return ext

        # 3b. 게시판 매핑 지정
        if mapping and mapping.board_id:
            post = Post(
                board_id=mapping.board_id, member_id=None,
                title=f"[{issue_label}] {title}",
                content=body_with_source,
                is_published=False,
                source_bulletin_id=bulletin.id,
                created_at=published_ts,
            )
            db.add(post)
            db.flush()
            ext.target_board_id = mapping.board_id
            ext.created_post_id = post.id
            ext.status = "approved"
            return ext

        # 3c. 매핑 없음 + 행사·모임 + 날짜 → events (디폴트). 중복이면 skip + 기존 id 재사용
        if event_type in ("행사", "모임") and parsed_date:
            existing_id = _find_existing_event(db, title, parsed_date)
            if existing_id:
                ext.created_event_id = existing_id
                ext.status = "approved"
                logger.info(
                    "[ext %s] skip duplicate event (3c): (%r, %s) → existing id=%d",
                    ext.id, title, parsed_date, existing_id,
                )
                return ext
            row = db.execute(
                _text(
                    "INSERT INTO events (title, description, event_date, end_date, location, category, is_public, is_ai_generated, event_kind, source_bulletin_id, created_at) "
                    "VALUES (:title, :desc, :edate, :eend, :loc, :cat, TRUE, TRUE, :kind, :src, :created) RETURNING id"
                ),
                {
                    "title": title, "desc": body_with_source,
                    "edate": parsed_date, "eend": None,
                    "loc": ext.location, "cat": category, "kind": event_type,
                    "src": bulletin.id, "created": published_ts,
                },
            ).first()
            ext.created_event_id = row[0] if row else None
            ext.status = "approved"
            return ext

    # 4. fallback → ai-extract 게시판
    if ai_board:
        post = Post(
            board_id=ai_board.id, member_id=None,
            title=f"[{issue_label}] {title}",
            content=body_with_source,
            is_published=False,
            source_bulletin_id=bulletin.id,
            created_at=published_ts,
        )
        db.add(post)
        db.flush()
        ext.target_board_id = ai_board.id
        ext.created_post_id = post.id

    ext.status = "approved"
    return ext


@router.get("/extractions/pending", response_model=list[ExtractionOut])
def list_pending_extractions(
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
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
    admin: Admin = Depends(get_current_admin),
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
    admin: Admin = Depends(get_current_admin),
):
    return (
        db.query(BulletinExtraction)
        .filter(BulletinExtraction.bulletin_id == bulletin_id)
        .order_by(BulletinExtraction.event_date)
        .all()
    )


class ApproveBody(BaseModel):
    # 모든 필드 optional — 비어 있으면 라우팅 자동 결정. 게시판 강제 지정·편집 시 채움.
    board_id: Optional[int] = None
    title: Optional[str] = None
    content: Optional[str] = None
    event_date: Optional[date] = None
    location: Optional[str] = None


@router.post("/extractions/{extraction_id}/approve", response_model=ExtractionOut)
def approve_extraction(
    extraction_id: int,
    body: ApproveBody | None = None,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """단일 항목 승인 — event_type 에 맞춰 자동 라우팅.

    body 의 모든 필드는 optional. 채워진 필드는 승인 직전에 ext 에 반영.
    board_id 가 명시되면 그 게시판으로 강제 라우팅(매핑·디폴트 우선순위 무시).
    """
    ext = db.query(BulletinExtraction).filter(BulletinExtraction.id == extraction_id).first()
    if not ext:
        raise HTTPException(status_code=404, detail="추출 항목을 찾을 수 없습니다.")
    if ext.status != "pending":
        raise HTTPException(status_code=400, detail="이미 처리된 항목입니다.")

    # 편집 필드 적용 (있는 것만)
    if body:
        if body.title is not None: ext.title = body.title.strip() or ext.title
        if body.content is not None: ext.content = body.content
        if body.event_date is not None: ext.event_date = body.event_date
        if body.location is not None: ext.location = body.location

    # board_id 가 명시되면 그 게시판으로 강제
    if body and body.board_id is not None:
        board = db.query(Board).filter(Board.id == body.board_id, Board.is_active == True).first()
        if not board:
            raise HTTPException(status_code=404, detail="게시판을 찾을 수 없습니다.")
        bulletin = db.query(Bulletin).filter(Bulletin.id == ext.bulletin_id).first()
        issue_label = (
            f"제{bulletin.issue_number}호" if bulletin and bulletin.issue_number
            else (bulletin.published_date.strftime("%Y.%m.%d") if bulletin else "")
        )
        # AI 추출 데이터의 created_at 은 주보 발행일(정오)로 — 과거 주보 등록 시 등록 시점이 박혀 혼란 회피
        published_ts = datetime.combine(bulletin.published_date, time(12, 0)) if bulletin else datetime.utcnow()
        post = Post(
            board_id=board.id, member_id=None,
            title=f"[{issue_label}] {ext.title}" if issue_label else ext.title,
            content=ext.content or "",
            is_published=False,
            source_bulletin_id=ext.bulletin_id,
            created_at=published_ts,
        )
        db.add(post)
        db.flush()
        ext.target_board_id = board.id
        ext.created_post_id = post.id
        ext.status = "approved"
        db.commit()
        db.refresh(ext)
        log_action(db, get_admin_identifier(admin), "approve_extraction", "bulletin_extraction", ext.id, f"강제 board={board.id}")
        return ext

    # 자동 라우팅
    _apply_extraction_routing(db, ext)
    db.commit()
    db.refresh(ext)
    log_action(db, get_admin_identifier(admin), "approve_extraction", "bulletin_extraction", ext.id, f"auto type={ext.event_type}")
    return ext


class BulkApproveBody(BaseModel):
    extraction_ids: list[int]


@router.post("/extractions/bulk-approve")
def bulk_approve_extractions(
    body: BulkApproveBody,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """여러 추출 항목을 일괄 자동 라우팅. 지표는 스킵하고 보고."""
    if not body.extraction_ids:
        return {"approved": [], "skipped": [], "failed": []}

    extractions = db.query(BulletinExtraction).filter(
        BulletinExtraction.id.in_(body.extraction_ids)
    ).all()

    approved: list[int] = []
    skipped: list[dict] = []  # 지표 또는 이미 처리됨
    failed: list[dict] = []

    for ext in extractions:
        if ext.status != "pending":
            skipped.append({"id": ext.id, "reason": f"status={ext.status}"})
            continue
        if ext.event_type == "지표":
            skipped.append({"id": ext.id, "reason": "지표는 approve-as-vision 으로 별도 처리"})
            continue
        # savepoint 로 부분 실패 격리 — 한 건 실패해도 세션 unstable 되지 않음
        sp = db.begin_nested()
        try:
            _apply_extraction_routing(db, ext)
            sp.commit()
            approved.append(ext.id)
        except HTTPException as e:
            sp.rollback()
            failed.append({"id": ext.id, "reason": e.detail})
        except Exception as e:
            sp.rollback()
            failed.append({"id": ext.id, "reason": str(e)})

    db.commit()
    log_action(db, get_admin_identifier(admin), "bulk_approve_extractions", "bulletin_extraction", None, f"approved={len(approved)}, skipped={len(skipped)}, failed={len(failed)}")
    return {"approved": approved, "skipped": skipped, "failed": failed}


class ExtractionPatchBody(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    event_date: Optional[date] = None
    location: Optional[str] = None
    event_type: Optional[str] = None
    group_name: Optional[str] = None


@router.patch("/extractions/{extraction_id}", response_model=ExtractionOut)
def update_extraction(
    extraction_id: int,
    body: ExtractionPatchBody,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """승인 전 편집 — pending 상태에서만 가능."""
    ext = db.query(BulletinExtraction).filter(BulletinExtraction.id == extraction_id).first()
    if not ext:
        raise HTTPException(status_code=404, detail="추출 항목을 찾을 수 없습니다.")
    if ext.status != "pending":
        raise HTTPException(status_code=400, detail="이미 처리된 항목은 편집할 수 없습니다.")

    if body.title is not None: ext.title = body.title.strip() or ext.title
    if body.content is not None: ext.content = body.content
    if body.event_date is not None: ext.event_date = body.event_date
    if body.location is not None: ext.location = body.location
    if body.event_type is not None: ext.event_type = body.event_type
    if body.group_name is not None: ext.group_name = body.group_name or None
    db.commit()
    db.refresh(ext)
    log_action(db, get_admin_identifier(admin), "update_extraction", "bulletin_extraction", ext.id, ext.title)
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
    from app.services.pdf_extractor import (
        extract_text, is_text_sparse, pdf_to_images_b64, extract_embedded_images,
    )
    from app.services.claude_analyzer import analyze_bulletin_text, analyze_bulletin_images, is_ai_available

    db = SessionLocal()
    started = datetime.utcnow()
    try:
        bulletin = db.query(Bulletin).filter(Bulletin.id == bulletin_id).first()
        if not bulletin or not bulletin.pdf_url:
            return

        # AWS Bedrock 키가 비어 있으면 AI 추출 비활성 — 업로드 자체는 성공, 분석만 스킵
        if not is_ai_available():
            bulletin.ai_status = "disabled"
            bulletin.ai_finished_at = datetime.utcnow()
            bulletin.ai_error = "AI 비활성 — 관리자 > 사이트 설정 > AI 그룹에서 AWS Bedrock 키를 입력하세요."
            db.commit()
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

        # 사진 추출 — 실패해도 메인 분석 결과는 보존
        try:
            _extract_and_save_images(db, bulletin_id, pdf_path)
        except Exception as img_exc:
            logger.warning("[bulletin %d] 이미지 추출 실패 (무시): %s", bulletin_id, img_exc)

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
        # 일시적 오류(timeout/connection) 이고 재시도 안 했으면 1회 자동 재시도
        err_str = str(exc).lower()
        transient_patterns = ("timeout", "timed out", "connection", "throttl", "rate limit", "503", "502", "504", "service unavailable")
        is_transient = any(p in err_str for p in transient_patterns)
        try:
            b = db.query(Bulletin).filter(Bulletin.id == bulletin_id).first()
            if not b:
                return
            current_retry = getattr(b, "ai_retry_count", 0) or 0
            if is_transient and current_retry < 1:
                # 1회 자동 재시도 — 5초 후 같은 함수 재호출
                b.ai_retry_count = current_retry + 1
                b.ai_error = f"[일시 오류 자동 재시도 {current_retry + 1}회] {str(exc)[:400]}"
                db.commit()
                logger.warning("[bulletin %d] 일시 오류 → 5초 후 1회 자동 재시도", bulletin_id)
                import time as _time
                _time.sleep(5)
                _auto_process_bulletin(bulletin_id)
                return
            # 재시도 한도 초과 또는 영구 오류 → failed
            b.ai_status = "failed"
            b.ai_finished_at = datetime.utcnow()
            b.ai_error = str(exc)[:500]
            db.commit()
        except Exception:
            db.rollback()
    finally:
        db.close()


def _extract_and_save_images(db: Session, bulletin_id: int, pdf_path: str) -> int:
    """주보 PDF에서 사진을 추출해 파일로 저장하고 DB에 등록.

    저장 위치: private-uploads/bulletin-extracted/{bulletin_id}/img-N.{ext}
      ── 정적 마운트(/uploads) 가 닿지 않는 디렉토리. URL 추측·XSS 로 인한
         분류 전 신자 얼굴 사진 등의 공개 노출 차단.
    file_url: /api/bulletins/extracted-images/{id}/file  (admin guard 라우트)
    file_path: 실제 disk 상대 path (admin 라우트 내부에서만 사용)
    """
    from app.services.pdf_extractor import extract_embedded_images

    images = extract_embedded_images(pdf_path, min_dim=200)
    if not images:
        logger.info("[bulletin %d] 추출된 사진 0건", bulletin_id)
        return 0

    save_dir = os.path.join("private-uploads", "bulletin-extracted", str(bulletin_id))
    os.makedirs(save_dir, exist_ok=True)

    saved = 0
    for idx, img in enumerate(images, start=1):
        ext = img["ext"]
        filename = f"img-{idx}.{ext}"
        disk_path = os.path.join(save_dir, filename)
        with open(disk_path, "wb") as f:
            f.write(img["bytes"])

        # file_url 에 id 가 필요해 2단계: placeholder insert → flush → id 채움
        row = BulletinExtractedImage(
            bulletin_id=bulletin_id,
            file_url="",
            file_path=disk_path,
            width=img["width"],
            height=img["height"],
            page_number=img["page"],
            status="pending",
        )
        db.add(row)
        db.flush()  # row.id 발급
        row.file_url = f"/api/bulletins/extracted-images/{row.id}/file"
        saved += 1
    db.commit()
    logger.info("[bulletin %d] 사진 %d장 추출·저장 완료", bulletin_id, saved)
    return saved


# ── 추출 사진 분류 endpoints ─────────────────────────────


class ExtractedImageOut(BaseModel):
    id: int
    bulletin_id: int
    file_url: str
    width: int
    height: int
    page_number: int
    status: str
    routed_to: str | None
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/{bulletin_id}/extracted-images", response_model=list[ExtractedImageOut])
def list_extracted_images(
    bulletin_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """주보 PDF에서 추출된 사진 목록 (관리자만)."""
    return (
        db.query(BulletinExtractedImage)
        .filter(BulletinExtractedImage.bulletin_id == bulletin_id)
        .order_by(BulletinExtractedImage.page_number, BulletinExtractedImage.id)
        .all()
    )


@router.get("/extracted-images/{image_id}/file")
def serve_extracted_image(
    image_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """분류 전 추출 사진의 admin guard 서빙.

    정적 마운트(/uploads) 대신 이 라우트로만 접근 가능 — URL 추측·XSS 에 의한
    민감 사진(신자 얼굴 등) 공개 노출 차단. file_path 는 private-uploads/
    하위라 디렉토리 자체가 공개 마운트에서 닿지 않는다.
    """
    img = db.query(BulletinExtractedImage).filter(BulletinExtractedImage.id == image_id).first()
    if not img:
        raise HTTPException(status_code=404, detail="이미지를 찾을 수 없습니다.")
    if not img.file_path or not os.path.exists(img.file_path):
        raise HTTPException(status_code=410, detail="파일이 더 이상 존재하지 않습니다.")
    return FileResponse(img.file_path)


class RouteImageBody(BaseModel):
    target: str          # "construction" | "gallery" | "ignore"
    gallery_slug: str | None = None  # target == "gallery" 일 때 필수


@router.post("/extracted-images/{image_id}/route")
def route_extracted_image(
    image_id: int,
    body: RouteImageBody,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """추출된 사진을 분류·등록.

    - construction: page_photos 테이블에 slug='construction'으로 등록 (성전 건축 슬라이드)
    - gallery: 지정된 boards.slug 갤러리에 새 게시글 생성 후 사진 첨부 (※ 추후 구현)
    - ignore: 상태만 ignored로 변경, 파일은 보존
    """
    img = db.query(BulletinExtractedImage).filter(BulletinExtractedImage.id == image_id).first()
    if not img:
        raise HTTPException(status_code=404, detail="이미지를 찾을 수 없습니다.")

    if body.target == "construction":
        # private-uploads/ 에 있는 원본을 공개 정적 위치로 복사.
        # page_photos.file_url 은 공개 페이지(/construction)에서 사용되므로 admin guard
        # 라우트가 아닌 공개 URL 이 필요하다.
        if not img.file_path or not os.path.exists(img.file_path):
            raise HTTPException(status_code=500, detail=f"원본 파일이 없습니다: {img.file_path}")
        ext = os.path.splitext(img.file_path)[1].lower() or ".jpg"
        stored = f"{uuid.uuid4().hex}{ext}"
        dst_dir = os.path.join(settings.UPLOAD_DIR, "construction")
        os.makedirs(dst_dir, exist_ok=True)
        dst_path = os.path.join(dst_dir, stored)
        with open(img.file_path, "rb") as fsrc, open(dst_path, "wb") as fdst:
            fdst.write(fsrc.read())

        # page_photos 의 construction slug 다음 sort_order 계산
        last = (
            db.query(PagePhoto)
            .filter(PagePhoto.page_slug == "construction")
            .order_by(PagePhoto.sort_order.desc())
            .first()
        )
        next_order = (last.sort_order + 1) if last else 0
        db.add(PagePhoto(
            page_slug="construction",
            file_url=f"/uploads/construction/{stored}",
            alt=None,
            sort_order=next_order,
        ))
        img.status = "routed"
        img.routed_to = "construction"
        img.routed_at = datetime.utcnow()
        db.commit()
        log_action(db, get_admin_identifier(admin), "route_extracted_image", "extracted_image", image_id, "construction")
        return {"ok": True, "routed_to": "construction"}

    if body.target == "gallery":
        if not body.gallery_slug:
            raise HTTPException(status_code=400, detail="gallery_slug가 필요합니다.")
        target_board = db.query(Board).filter(
            Board.slug == body.gallery_slug, Board.is_active == True,
        ).first()
        if not target_board:
            raise HTTPException(status_code=404, detail=f"갤러리 게시판을 찾을 수 없습니다: {body.gallery_slug}")

        # 추출 파일을 attachments 디렉토리로 복사 (원본은 그대로 두어 다른 갤러리에도 또 보낼 수 있게)
        src_path = img.file_path
        if not src_path or not os.path.exists(src_path):
            raise HTTPException(status_code=500, detail=f"원본 파일이 없습니다: {src_path}")
        ext = os.path.splitext(src_path)[1].lower() or ".jpg"
        stored = f"{uuid.uuid4().hex}{ext}"
        dst_dir = os.path.join(settings.UPLOAD_DIR, "attachments")
        os.makedirs(dst_dir, exist_ok=True)
        dst_path = os.path.join(dst_dir, stored)
        with open(src_path, "rb") as fsrc, open(dst_path, "wb") as fdst:
            fdst.write(fsrc.read())
        file_size = os.path.getsize(dst_path)

        # 갤러리 게시글 생성 — 본문은 짧은 캡션, 첨부에 이미지
        bulletin = db.query(Bulletin).filter(Bulletin.id == img.bulletin_id).first()
        issue_label = (
            f"제{bulletin.issue_number}호"
            if bulletin and bulletin.issue_number
            else (bulletin.published_date.strftime("%Y.%m.%d") if bulletin else "")
        )
        title = f"[{issue_label}] 주보 사진" if issue_label else "주보 사진"
        post_body = (
            "주보에서 자동 추출된 사진입니다."
            + (_format_source_footer(bulletin) if bulletin else "")
        )
        # AI 추출 데이터의 created_at 은 주보 발행일(정오)로 — 과거 주보 등록 시 등록 시점이 박혀 혼란 회피
        published_ts = datetime.combine(bulletin.published_date, time(12, 0)) if bulletin else datetime.utcnow()
        post = Post(
            board_id=target_board.id,
            member_id=None,
            title=title,
            content=post_body,
            is_published=True,
            is_pinned=False,
            view_count=0,
            source_bulletin_id=img.bulletin_id,
            created_at=published_ts,
        )
        db.add(post)
        db.flush()
        db.add(Attachment(
            post_id=post.id,
            original_name=os.path.basename(src_path),
            stored_name=stored,
            file_url=f"/uploads/attachments/{stored}",
            file_size=file_size,
            is_image=True,
            # 주보 삭제 시 SET NULL — 사진은 보존, 출처만 사라짐
            source_bulletin_id=img.bulletin_id,
            created_at=published_ts,
        ))

        img.status = "routed"
        img.routed_to = f"gallery:{body.gallery_slug}"
        img.routed_at = datetime.utcnow()
        db.commit()
        log_action(db, get_admin_identifier(admin), "route_extracted_image", "extracted_image", image_id, f"gallery:{body.gallery_slug}")
        return {"ok": True, "routed_to": img.routed_to, "post_id": post.id}

    if body.target == "ignore":
        img.status = "ignored"
        img.routed_to = "ignored"
        img.routed_at = datetime.utcnow()
        db.commit()
        log_action(db, get_admin_identifier(admin), "route_extracted_image", "extracted_image", image_id, "ignored")
        return {"ok": True, "routed_to": "ignored"}

    raise HTTPException(status_code=400, detail=f"알 수 없는 target: {body.target}")


@router.post("/extracted-images/{image_id}/crop", response_model=ExtractedImageOut)
async def crop_extracted_image(
    image_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """admin이 frontend에서 잘라낸 사진으로 원본 파일을 덮어쓰고 width/height 갱신.
    스캔본 주보에서 한 페이지 통째로 추출된 사진을 사용자가 직접 잘라 쓸 때 사용."""
    img = db.query(BulletinExtractedImage).filter(BulletinExtractedImage.id == image_id).first()
    if not img:
        raise HTTPException(status_code=404, detail="이미지를 찾을 수 없습니다.")
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="이미지 파일만 업로드할 수 있습니다.")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="빈 파일입니다.")

    # 원본 disk path 에 덮어쓰기 (file_url client URL 은 image_id 기반이라 그대로 유지)
    disk_path = img.file_path
    if not disk_path:
        raise HTTPException(status_code=500, detail="원본 파일 경로가 없습니다.")
    os.makedirs(os.path.dirname(disk_path), exist_ok=True)
    with open(disk_path, "wb") as f:
        f.write(data)

    # 새 width/height 측정 (Pillow 없으면 PyMuPDF 의 fitz.Pixmap 사용)
    try:
        import fitz
        pix = fitz.Pixmap(disk_path)
        img.width = pix.width
        img.height = pix.height
    except Exception:
        # 측정 실패 시 그대로 유지
        pass

    db.commit()
    db.refresh(img)
    log_action(db, get_admin_identifier(admin), "crop_extracted_image", "extracted_image", image_id, None)
    return img


@router.delete("/extracted-images/{image_id}")
def delete_extracted_image(
    image_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """추출된 사진 DB 레코드 + 파일 모두 삭제."""
    img = db.query(BulletinExtractedImage).filter(BulletinExtractedImage.id == image_id).first()
    if not img:
        raise HTTPException(status_code=404, detail="이미지를 찾을 수 없습니다.")

    if img.file_path and os.path.exists(img.file_path):
        try:
            os.remove(img.file_path)
        except Exception:
            pass
    db.delete(img)
    db.commit()
    log_action(db, get_admin_identifier(admin), "delete_extracted_image", "extracted_image", image_id, None)
    return {"ok": True}


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
    admin: Admin = Depends(get_current_admin),
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

    row = db.execute(
        text(
            "INSERT INTO visions (year, motto, body, is_current, source_bulletin_id) "
            "VALUES (:year, :motto, :body, :is_current, :src) RETURNING id"
        ),
        {"year": year, "motto": motto, "body": vision_body, "is_current": body.is_current, "src": ext.bulletin_id},
    ).first()
    ext.created_vision_id = row[0] if row else None

    ext.status = "approved"
    db.commit()
    db.refresh(ext)
    log_action(db, get_admin_identifier(admin), "approve_as_vision", "bulletin_extraction", ext.id, f"vision={ext.created_vision_id} year={year}")
    return ext


class ApproveAsEventBody(BaseModel):
    """캘린더 등록 옵션. board_slug 지정 시 같은 행사를 가리키는 카드 게시글도 함께 생성.
    카드 본문은 events.description 을 복사하지 않고 짧은 링크만 보유 → DB 중복 회피."""
    board_slug: str | None = None


@router.post("/extractions/{extraction_id}/approve-as-event", response_model=ExtractionOut)
def approve_extraction_as_event(
    extraction_id: int,
    body: ApproveAsEventBody | None = None,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    ext = db.query(BulletinExtraction).filter(BulletinExtraction.id == extraction_id).first()
    if not ext:
        raise HTTPException(status_code=404, detail="추출 항목을 찾을 수 없습니다.")
    if ext.status != "pending":
        raise HTTPException(status_code=400, detail="이미 처리된 항목입니다.")

    category = _EVENT_CATEGORY.get(ext.event_type or "", "general")
    event_kind = ext.event_type if ext.event_type in ("행사", "모임") else None
    bulletin = db.query(Bulletin).filter(Bulletin.id == ext.bulletin_id).first()
    desc_with_source = (ext.content or "") + (_format_source_footer(bulletin) if bulletin else "")
    # AI 추출 데이터의 created_at 은 주보 발행일(정오)로 — 과거 주보 등록 시 등록 시점이 박혀 혼란 회피
    published_ts = datetime.combine(bulletin.published_date, time(12, 0)) if bulletin else datetime.utcnow()

    row = db.execute(
        text(
            "INSERT INTO events (title, description, event_date, start_time, location, category, "
            "is_public, is_ai_generated, event_kind, source_bulletin_id, created_at) "
            "VALUES (:title, :desc, :edate, :stime, :loc, :cat, TRUE, TRUE, :kind, :src, :created) RETURNING id"
        ),
        {
            "title": ext.title,
            "desc": desc_with_source,
            "edate": ext.event_date,
            "stime": None,
            "loc": ext.location,
            "cat": category,
            "kind": event_kind,
            "src": ext.bulletin_id,
            "created": published_ts,
        },
    ).first()
    event_id = row[0] if row else None
    ext.created_event_id = event_id
    ext.status = "approved"

    # 게시판 카드 옵션 — 본문은 짧은 링크만 (시나리오 A)
    board_slug = (body.board_slug if body else None) or None
    if board_slug and event_id:
        target_board = db.query(Board).filter(Board.slug == board_slug, Board.is_active == True).first()
        if not target_board:
            raise HTTPException(status_code=404, detail=f"게시판을 찾을 수 없습니다: {board_slug}")
        card_body = _format_event_card_body(
            event_id=event_id,
            title=ext.title or "",
            event_date=ext.event_date,
            location=ext.location,
            description=ext.content,
        )
        post = Post(
            board_id=target_board.id,
            member_id=None,
            title=ext.title or "",
            content=card_body,
            is_published=True,
            is_pinned=False,
            view_count=0,
            linked_event_id=event_id,
            source_bulletin_id=ext.bulletin_id,
            created_at=published_ts,
        )
        db.add(post)
        db.flush()
        ext.target_board_id = target_board.id
        ext.created_post_id = post.id

    db.commit()
    db.refresh(ext)
    log_action(db, get_admin_identifier(admin), "approve_as_event", "bulletin_extraction", ext.id, f"event={ext.created_event_id} board={board_slug or '-'}")
    return ext


@router.post("/extractions/{extraction_id}/reject")
def reject_extraction(
    extraction_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    # 거부 = 즉시 삭제. rejected 행은 어디서도 조회·중복검사에 쓰이지 않아 보존 가치 없음.
    ext = db.query(BulletinExtraction).filter(BulletinExtraction.id == extraction_id).first()
    if not ext:
        raise HTTPException(status_code=404, detail="추출 항목을 찾을 수 없습니다.")
    snapshot = ext.title
    db.delete(ext)
    db.commit()
    log_action(db, get_admin_identifier(admin), "reject_extraction", "bulletin_extraction", extraction_id, snapshot)
    return {"deleted": extraction_id}


class BulkRejectBody(BaseModel):
    extraction_ids: list[int]


@router.post("/extractions/bulk-reject")
def bulk_reject_extractions(
    body: BulkRejectBody,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """여러 추출 항목을 일괄 거부(삭제)."""
    if not body.extraction_ids:
        return {"deleted": [], "not_found": []}

    extractions = db.query(BulletinExtraction).filter(
        BulletinExtraction.id.in_(body.extraction_ids)
    ).all()
    found_ids = {ext.id for ext in extractions}
    not_found = [i for i in body.extraction_ids if i not in found_ids]

    for ext in extractions:
        db.delete(ext)
    db.commit()
    log_action(db, get_admin_identifier(admin), "bulk_reject_extractions", "bulletin_extraction", None, f"deleted={len(found_ids)}, not_found={len(not_found)}")
    return {"deleted": sorted(found_ids), "not_found": not_found}


class SplitByDatesBody(BaseModel):
    dry_run: bool = True  # True: 미리보기만, False: 실제 분리 적용


# 본문에 등장하는 'M/D' 또는 'M/D(요일)' 패턴 — 같은 행사에 여러 날짜가 나열될 때
_DATE_PATTERN = re.compile(r'(\b\d{1,2})/(\d{1,2})(?:\s*\(([월화수목금토일])요?일?\))?')


def _extract_dates_from_text(text: str, base_year: int, base_date: "date | None") -> list[date]:
    """본문에서 M/D 또는 M/D(요일) 패턴을 모두 찾아 date 리스트로 변환.
    base_year: 기본 연도. M/D 가 base_date 보다 6개월 이상 이전이면 다음 해로 처리.
    중복 제거, 발행순 정렬."""
    if not text:
        return []
    results: list[date] = []
    seen: set[tuple[int, int]] = set()
    for m in _DATE_PATTERN.finditer(text):
        try:
            mo = int(m.group(1))
            dy = int(m.group(2))
            if not (1 <= mo <= 12 and 1 <= dy <= 31):
                continue
            if (mo, dy) in seen:
                continue
            seen.add((mo, dy))
            year = base_year
            try:
                d = date(year, mo, dy)
            except ValueError:
                continue
            # base_date 보다 6개월 이상 이전이면 다음 해로 (예: 발행 12월, 본문에 1월 = 다음해)
            if base_date and (base_date - d).days > 180:
                try:
                    d = date(year + 1, mo, dy)
                except ValueError:
                    continue
            results.append(d)
        except (ValueError, IndexError):
            continue
    results.sort()
    return results


@router.post("/extractions/{extraction_id}/split-by-dates")
def split_extraction_by_dates(
    extraction_id: int,
    body: SplitByDatesBody | None = None,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """추출 항목의 본문에서 'M/D(요일)' 패턴을 찾아 같은 제목으로 여러 날짜의 별도 항목으로 분리.
    dry_run=True (기본) → 미리보기만, False → 실제 분리 적용."""
    ext = db.query(BulletinExtraction).filter(BulletinExtraction.id == extraction_id).first()
    if not ext:
        raise HTTPException(status_code=404, detail="추출 항목을 찾을 수 없습니다.")
    if ext.status != "pending":
        raise HTTPException(status_code=400, detail="이미 처리된 항목은 분리할 수 없습니다.")

    bulletin = db.query(Bulletin).filter(Bulletin.id == ext.bulletin_id).first()
    base_date = bulletin.published_date if bulletin else None
    base_year = base_date.year if base_date else datetime.now().year

    dates = _extract_dates_from_text(ext.content or "", base_year, base_date)
    if len(dates) < 2:
        raise HTTPException(status_code=400, detail="본문에서 2개 이상의 날짜 패턴을 찾지 못했습니다.")

    dry = body.dry_run if body else True
    if dry:
        return {
            "preview": True,
            "dates": [d.isoformat() for d in dates],
            "count": len(dates),
            "message": f"본문에서 {len(dates)}개의 날짜를 발견했습니다.",
        }

    # 실제 분리 — 원본의 event_date 를 첫 날짜로, 나머지는 새 extraction 으로 INSERT
    ext.event_date = dates[0]
    new_extractions: list[BulletinExtraction] = []
    for d in dates[1:]:
        new_ext = BulletinExtraction(
            bulletin_id=ext.bulletin_id,
            title=ext.title,
            content=ext.content,
            group_name=ext.group_name,
            event_date=d,
            location=ext.location,
            event_type=ext.event_type,
            status="pending",
            fingerprint=_fingerprint(
                ext.group_name, d.isoformat(), ext.event_type,
                ext.title, bulletin_id=ext.bulletin_id,
            ),
        )
        db.add(new_ext)
        new_extractions.append(new_ext)
    db.commit()
    log_action(db, get_admin_identifier(admin), "split_extraction_by_dates", "bulletin_extraction", ext.id, f"split into {len(dates)} dates")
    return {
        "preview": False,
        "split_count": len(dates),
        "original_id": ext.id,
        "new_ids": [n.id for n in new_extractions],
    }


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

    query = db.query(BulletinExtraction.title)
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
