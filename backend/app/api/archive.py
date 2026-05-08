from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional
from datetime import date
import os, uuid
from app.core.database import get_db
from app.core.auth import get_current_admin
from app.core.config import settings

router = APIRouter(prefix="/archive", tags=["archive"])


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


class PastorOut(BaseModel):
    id: int
    name: str
    title: str
    appointed_at: Optional[date]
    resigned_at: Optional[date]
    photo_url: Optional[str]
    bio: Optional[str]
    sort_order: int


def _pastor_row(r) -> dict:
    return {
        "id": r.id, "name": r.name, "title": r.title,
        "appointed_at": r.appointed_at, "resigned_at": r.resigned_at,
        "photo_url": r.photo_url, "bio": r.bio, "sort_order": r.sort_order,
    }


@router.get("/pastors", response_model=list[PastorOut])
def list_pastors(db: Session = Depends(get_db)):
    rows = db.execute(text(
        "SELECT * FROM parish_pastors ORDER BY sort_order DESC, appointed_at DESC NULLS LAST"
    )).fetchall()
    return [_pastor_row(r) for r in rows]


@router.post("/pastors", response_model=PastorOut, status_code=201)
def create_pastor(body: PastorIn, db: Session = Depends(get_db), _=Depends(get_current_admin)):
    row = db.execute(text(
        "INSERT INTO parish_pastors (name, title, appointed_at, resigned_at, bio, sort_order) "
        "VALUES (:name, :title, :app, :res, :bio, :ord) RETURNING *"
    ), {"name": body.name, "title": body.title, "app": body.appointed_at,
        "res": body.resigned_at, "bio": body.bio, "ord": body.sort_order}).fetchone()
    db.commit()
    return _pastor_row(row)


@router.post("/pastors/{pastor_id}/photo", response_model=PastorOut)
async def upload_pastor_photo(
    pastor_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
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
    return _pastor_row(row)


@router.put("/pastors/{pastor_id}", response_model=PastorOut)
def update_pastor(pastor_id: int, body: PastorIn, db: Session = Depends(get_db), _=Depends(get_current_admin)):
    row = db.execute(text(
        "UPDATE parish_pastors SET name=:name, title=:title, appointed_at=:app, "
        "resigned_at=:res, bio=:bio, sort_order=:ord WHERE id=:id RETURNING *"
    ), {"name": body.name, "title": body.title, "app": body.appointed_at,
        "res": body.resigned_at, "bio": body.bio, "ord": body.sort_order, "id": pastor_id}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="사목자를 찾을 수 없습니다.")
    db.commit()
    return _pastor_row(row)


@router.delete("/pastors/{pastor_id}", status_code=204)
def delete_pastor(pastor_id: int, db: Session = Depends(get_db), _=Depends(get_current_admin)):
    existing = db.execute(text("SELECT photo_url FROM parish_pastors WHERE id=:id"), {"id": pastor_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="사목자를 찾을 수 없습니다.")
    _delete_file(existing.photo_url)
    db.execute(text("DELETE FROM parish_pastors WHERE id=:id"), {"id": pastor_id})
    db.commit()


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
def create_priest(body: PriestIn, db: Session = Depends(get_db), _=Depends(get_current_admin)):
    row = db.execute(text(
        "INSERT INTO parish_priests (name, baptism_date, ordained_date, role, bio, sort_order) "
        "VALUES (:name, :bap, :ord, :role, :bio, :sord) RETURNING *"
    ), {"name": body.name, "bap": body.baptism_date, "ord": body.ordained_date,
        "role": body.role, "bio": body.bio, "sord": body.sort_order}).fetchone()
    db.commit()
    return _priest_row(row)


@router.post("/priests/{priest_id}/photo", response_model=PriestOut)
async def upload_priest_photo(
    priest_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
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
    return _priest_row(row)


@router.put("/priests/{priest_id}", response_model=PriestOut)
def update_priest(priest_id: int, body: PriestIn, db: Session = Depends(get_db), _=Depends(get_current_admin)):
    row = db.execute(text(
        "UPDATE parish_priests SET name=:name, baptism_date=:bap, ordained_date=:ord, "
        "role=:role, bio=:bio, sort_order=:sord WHERE id=:id RETURNING *"
    ), {"name": body.name, "bap": body.baptism_date, "ord": body.ordained_date,
        "role": body.role, "bio": body.bio, "sord": body.sort_order, "id": priest_id}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="사제를 찾을 수 없습니다.")
    db.commit()
    return _priest_row(row)


@router.delete("/priests/{priest_id}", status_code=204)
def delete_priest(priest_id: int, db: Session = Depends(get_db), _=Depends(get_current_admin)):
    existing = db.execute(text("SELECT photo_url FROM parish_priests WHERE id=:id"), {"id": priest_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="사제를 찾을 수 없습니다.")
    _delete_file(existing.photo_url)
    db.execute(text("DELETE FROM parish_priests WHERE id=:id"), {"id": priest_id})
    db.commit()
