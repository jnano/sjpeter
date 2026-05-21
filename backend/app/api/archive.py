from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import Literal, Optional
from datetime import date
import os, uuid
from app.core.database import get_db
from app.core.admin_log import get_admin_identifier, log_action
from app.core.auth import get_current_admin
from app.core.config import settings

router = APIRouter(prefix="/archive", tags=["archive"])

ALLOWED_PASTOR_CATEGORIES = ("priest", "sister")
PastorCategory = Literal["priest", "sister"]


# ── 공통 헬퍼 ──────────────────────────────────────────────

def _save_photo(file: UploadFile, subdir: str) -> str:
    ext = os.path.splitext(file.filename or "photo.jpg")[1] or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(settings.UPLOAD_DIR, subdir, filename)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    content = file.file.read()
    with open(path, "wb") as f:
        f.write(content)
    return f"/uploads/{subdir}/{filename}"


def _delete_file(url: Optional[str]):
    if url and url.startswith("/uploads/"):
        path = url.lstrip("/")
        if os.path.exists(path):
            os.remove(path)


# ══════════════════════════════════════════════════════════
# 역대 사목자 (parish_pastors)
# ══════════════════════════════════════════════════════════

class PastorIn(BaseModel):
    name: str
    title: str = "주임신부"
    appointed_at: Optional[date] = None
    resigned_at: Optional[date] = None
    bio: Optional[str] = None
    sort_order: int = 0
    category: PastorCategory = "priest"


class PastorOut(BaseModel):
    id: int
    name: str
    title: str
    appointed_at: Optional[date]
    resigned_at: Optional[date]
    photo_url: Optional[str]
    bio: Optional[str]
    sort_order: int
    category: str


def _pastor_row(r) -> dict:
    return {
        "id": r.id, "name": r.name, "title": r.title,
        "appointed_at": r.appointed_at, "resigned_at": r.resigned_at,
        "photo_url": r.photo_url, "bio": r.bio, "sort_order": r.sort_order,
        "category": getattr(r, "category", "priest") or "priest",
    }


@router.get("/pastors", response_model=list[PastorOut])
def list_pastors(
    category: Optional[PastorCategory] = Query(None, description="priest|sister 필터, 미지정 시 전체"),
    db: Session = Depends(get_db),
):
    if category:
        rows = db.execute(text(
            "SELECT * FROM parish_pastors WHERE category=:cat "
            "ORDER BY sort_order DESC, appointed_at DESC NULLS LAST"
        ), {"cat": category}).fetchall()
    else:
        rows = db.execute(text(
            "SELECT * FROM parish_pastors "
            "ORDER BY sort_order DESC, appointed_at DESC NULLS LAST"
        )).fetchall()
    return [_pastor_row(r) for r in rows]


@router.post("/pastors", response_model=PastorOut, status_code=201)
def create_pastor(body: PastorIn, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    row = db.execute(text(
        "INSERT INTO parish_pastors (name, title, appointed_at, resigned_at, bio, sort_order, category) "
        "VALUES (:name, :title, :app, :res, :bio, :ord, :cat) RETURNING *"
    ), {"name": body.name, "title": body.title, "app": body.appointed_at,
        "res": body.resigned_at, "bio": body.bio, "ord": body.sort_order,
        "cat": body.category}).fetchone()
    db.commit()
    log_action(db, get_admin_identifier(admin), "create_pastor", "parish_pastor", row.id, body.name)
    return _pastor_row(row)


@router.post("/pastors/{pastor_id}/photo", response_model=PastorOut)
async def upload_pastor_photo(
    pastor_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    existing = db.execute(text("SELECT * FROM parish_pastors WHERE id=:id"), {"id": pastor_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="사목자를 찾을 수 없습니다.")
    _delete_file(existing.photo_url)
    url = _save_photo(file, "pastors")
    row = db.execute(text(
        "UPDATE parish_pastors SET photo_url=:url WHERE id=:id RETURNING *"
    ), {"url": url, "id": pastor_id}).fetchone()
    db.commit()
    log_action(db, get_admin_identifier(admin), "upload_pastor_photo", "parish_pastor", pastor_id, row.name)
    return _pastor_row(row)


@router.put("/pastors/{pastor_id}", response_model=PastorOut)
def update_pastor(pastor_id: int, body: PastorIn, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    row = db.execute(text(
        "UPDATE parish_pastors SET name=:name, title=:title, appointed_at=:app, "
        "resigned_at=:res, bio=:bio, sort_order=:ord, category=:cat WHERE id=:id RETURNING *"
    ), {"name": body.name, "title": body.title, "app": body.appointed_at,
        "res": body.resigned_at, "bio": body.bio, "ord": body.sort_order,
        "cat": body.category, "id": pastor_id}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="사목자를 찾을 수 없습니다.")
    db.commit()
    log_action(db, get_admin_identifier(admin), "update_pastor", "parish_pastor", pastor_id, body.name)
    return _pastor_row(row)


@router.delete("/pastors/{pastor_id}", status_code=204)
def delete_pastor(pastor_id: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    existing = db.execute(text("SELECT name, photo_url FROM parish_pastors WHERE id=:id"), {"id": pastor_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="사목자를 찾을 수 없습니다.")
    snapshot = existing.name
    _delete_file(existing.photo_url)
    db.execute(text("DELETE FROM parish_pastors WHERE id=:id"), {"id": pastor_id})
    db.commit()
    log_action(db, get_admin_identifier(admin), "delete_pastor", "parish_pastor", pastor_id, snapshot)


def _infer_staff_role(title: Optional[str], category: str) -> str:
    """parish_pastors의 title·category로 parish_staff.role을 추론.

    수녀(category=sister)는 '수녀'로 고정. priest의 경우 title에 '보좌'가 있으면
    '보좌신부', 그 외에는 '주임신부' 기본.
    """
    if category == "sister":
        return "수녀"
    if title and "보좌" in title:
        return "보좌신부"
    return "주임신부"


@router.post("/pastors/{pastor_id}/restore-to-staff")
def restore_pastor_to_staff(
    pastor_id: int,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    """역대 사목자 record를 현재 사목자(parish_staff)로 복원.

    이전(move-to-archive)의 역연산. parish_pastors record는 삭제되고,
    parish_staff에 새로 등록된다. 사진 URL은 그대로 옮겨져 파일은 재사용.
    """
    row = db.execute(
        text("SELECT * FROM parish_pastors WHERE id=:id"),
        {"id": pastor_id},
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="역대 사목자 record가 없습니다.")

    role = _infer_staff_role(row.title, getattr(row, "category", "priest") or "priest")

    # 가장 큰 sort_order + 1로 새 staff를 등록
    max_order = db.execute(
        text("SELECT COALESCE(MAX(sort_order), -1) AS m FROM parish_staff WHERE role=:r"),
        {"r": role},
    ).fetchone()
    next_order = (max_order.m if max_order else -1) + 1

    db.execute(
        text(
            "INSERT INTO parish_staff "
            "(role, name, title, photo_url, career_items, sort_order, is_active, created_at, updated_at) "
            "VALUES (:role, :name, :title, :photo, :career, :ord, TRUE, NOW(), NOW())"
        ),
        {
            "role": role,
            "name": row.name,
            "title": row.title,
            "photo": row.photo_url,
            "career": row.bio,
            "ord": next_order,
        },
    )
    # 사진 파일은 새 staff record가 참조하므로 유지, parish_pastors record만 삭제
    db.execute(text("DELETE FROM parish_pastors WHERE id=:id"), {"id": pastor_id})
    db.commit()
    log_action(db, get_admin_identifier(admin), "restore_pastor_to_staff", "parish_pastor", pastor_id, f"role={role}")
    return {"ok": True, "role": role}


# ══════════════════════════════════════════════════════════
# 본당 출신 사제 (parish_priests)
# ══════════════════════════════════════════════════════════

class PriestIn(BaseModel):
    name: str
    baptism_date: Optional[date] = None
    ordained_date: date
    role: Optional[str] = None
    bio: Optional[str] = None
    sort_order: int = 0


class PriestOut(BaseModel):
    id: int
    name: str
    baptism_date: Optional[date]
    ordained_date: date
    role: Optional[str]
    photo_url: Optional[str]
    bio: Optional[str]
    sort_order: int


def _priest_row(r) -> dict:
    return {
        "id": r.id, "name": r.name, "baptism_date": r.baptism_date,
        "ordained_date": r.ordained_date, "role": r.role,
        "photo_url": r.photo_url, "bio": r.bio, "sort_order": r.sort_order,
    }


@router.get("/priests", response_model=list[PriestOut])
def list_priests(db: Session = Depends(get_db)):
    rows = db.execute(text(
        "SELECT * FROM parish_priests ORDER BY ordained_date DESC"
    )).fetchall()
    return [_priest_row(r) for r in rows]


@router.post("/priests", response_model=PriestOut, status_code=201)
def create_priest(body: PriestIn, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    row = db.execute(text(
        "INSERT INTO parish_priests (name, baptism_date, ordained_date, role, bio, sort_order) "
        "VALUES (:name, :bap, :ord, :role, :bio, :sord) RETURNING *"
    ), {"name": body.name, "bap": body.baptism_date, "ord": body.ordained_date,
        "role": body.role, "bio": body.bio, "sord": body.sort_order}).fetchone()
    db.commit()
    log_action(db, get_admin_identifier(admin), "create_priest", "parish_priest", row.id, body.name)
    return _priest_row(row)


@router.post("/priests/{priest_id}/photo", response_model=PriestOut)
async def upload_priest_photo(
    priest_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    existing = db.execute(text("SELECT * FROM parish_priests WHERE id=:id"), {"id": priest_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="사제를 찾을 수 없습니다.")
    _delete_file(existing.photo_url)
    url = _save_photo(file, "priests")
    row = db.execute(text(
        "UPDATE parish_priests SET photo_url=:url WHERE id=:id RETURNING *"
    ), {"url": url, "id": priest_id}).fetchone()
    db.commit()
    log_action(db, get_admin_identifier(admin), "upload_priest_photo", "parish_priest", priest_id, row.name)
    return _priest_row(row)


@router.put("/priests/{priest_id}", response_model=PriestOut)
def update_priest(priest_id: int, body: PriestIn, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    row = db.execute(text(
        "UPDATE parish_priests SET name=:name, baptism_date=:bap, ordained_date=:ord, "
        "role=:role, bio=:bio, sort_order=:sord WHERE id=:id RETURNING *"
    ), {"name": body.name, "bap": body.baptism_date, "ord": body.ordained_date,
        "role": body.role, "bio": body.bio, "sord": body.sort_order, "id": priest_id}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="사제를 찾을 수 없습니다.")
    db.commit()
    log_action(db, get_admin_identifier(admin), "update_priest", "parish_priest", priest_id, body.name)
    return _priest_row(row)


@router.delete("/priests/{priest_id}", status_code=204)
def delete_priest(priest_id: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    existing = db.execute(text("SELECT name, photo_url FROM parish_priests WHERE id=:id"), {"id": priest_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="사제를 찾을 수 없습니다.")
    snapshot = existing.name
    _delete_file(existing.photo_url)
    db.execute(text("DELETE FROM parish_priests WHERE id=:id"), {"id": priest_id})
    db.commit()
    log_action(db, get_admin_identifier(admin), "delete_priest", "parish_priest", priest_id, snapshot)
