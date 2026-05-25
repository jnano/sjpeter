"""예비자교리 관리 API.

차수(catechumen_classes) · 참여자(catechumen_members) · 사진(catechumen_photos) CRUD.
프로젝트 혼용 스타일(raw SQL)·archive.py 패턴을 따른다.
조회(GET)는 공개, 변경(POST/PUT/DELETE)은 get_current_admin 보호.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
import os, uuid
from app.core.database import get_db
from app.core.admin_log import get_admin_identifier, log_action
from app.core.auth import get_current_admin
from app.core.config import settings

router = APIRouter(prefix="/catechumen", tags=["catechumen"])


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
# 차수 (catechumen_classes)
# ══════════════════════════════════════════════════════════

class ClassIn(BaseModel):
    round_no: Optional[int] = None
    start_date: Optional[date] = None
    baptism_at: Optional[datetime] = None
    apply_open: bool = False
    apply_start_date: Optional[date] = None
    apply_note: Optional[str] = None
    note: Optional[str] = None
    sort_order: int = 0


class ClassOut(BaseModel):
    id: int
    round_no: Optional[int]
    start_date: Optional[date]
    baptism_at: Optional[datetime]
    apply_open: bool
    apply_start_date: Optional[date]
    apply_note: Optional[str]
    note: Optional[str]
    sort_order: int
    member_count: int = 0
    photo_count: int = 0


def _class_row(r) -> dict:
    return {
        "id": r.id, "round_no": r.round_no, "start_date": r.start_date,
        "baptism_at": r.baptism_at, "apply_open": r.apply_open,
        "apply_start_date": r.apply_start_date, "apply_note": r.apply_note,
        "note": r.note, "sort_order": r.sort_order,
        "member_count": getattr(r, "member_count", 0) or 0,
        "photo_count": getattr(r, "photo_count", 0) or 0,
    }


@router.get("/classes", response_model=list[ClassOut])
def list_classes(db: Session = Depends(get_db)):
    rows = db.execute(text(
        "SELECT c.*, "
        "(SELECT COUNT(*) FROM catechumen_members m WHERE m.class_id=c.id) AS member_count, "
        "(SELECT COUNT(*) FROM catechumen_photos p WHERE p.class_id=c.id) AS photo_count "
        "FROM catechumen_classes c "
        "ORDER BY c.sort_order DESC, c.round_no DESC NULLS LAST, c.id DESC"
    )).fetchall()
    return [_class_row(r) for r in rows]


@router.get("/classes/{class_id}", response_model=ClassOut)
def get_class(class_id: int, db: Session = Depends(get_db)):
    r = db.execute(text(
        "SELECT c.*, "
        "(SELECT COUNT(*) FROM catechumen_members m WHERE m.class_id=c.id) AS member_count, "
        "(SELECT COUNT(*) FROM catechumen_photos p WHERE p.class_id=c.id) AS photo_count "
        "FROM catechumen_classes c WHERE c.id=:id"
    ), {"id": class_id}).fetchone()
    if not r:
        raise HTTPException(status_code=404, detail="차수를 찾을 수 없습니다.")
    return _class_row(r)


@router.post("/classes", response_model=ClassOut, status_code=201)
def create_class(body: ClassIn, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    row = db.execute(text(
        "INSERT INTO catechumen_classes "
        "(round_no, start_date, baptism_at, apply_open, apply_start_date, apply_note, note, sort_order) "
        "VALUES (:rno, :sd, :bap, :ao, :asd, :an, :note, :ord) RETURNING *"
    ), {"rno": body.round_no, "sd": body.start_date, "bap": body.baptism_at,
        "ao": body.apply_open, "asd": body.apply_start_date, "an": body.apply_note,
        "note": body.note, "ord": body.sort_order}).fetchone()
    db.commit()
    log_action(db, get_admin_identifier(admin), "create_catechumen_class",
               "catechumen_class", row.id, f"제{body.round_no}차")
    return _class_row(row)


@router.put("/classes/{class_id}", response_model=ClassOut)
def update_class(class_id: int, body: ClassIn, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    row = db.execute(text(
        "UPDATE catechumen_classes SET round_no=:rno, start_date=:sd, baptism_at=:bap, "
        "apply_open=:ao, apply_start_date=:asd, apply_note=:an, note=:note, sort_order=:ord, "
        "updated_at=NOW() WHERE id=:id RETURNING *"
    ), {"rno": body.round_no, "sd": body.start_date, "bap": body.baptism_at,
        "ao": body.apply_open, "asd": body.apply_start_date, "an": body.apply_note,
        "note": body.note, "ord": body.sort_order, "id": class_id}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="차수를 찾을 수 없습니다.")
    db.commit()
    log_action(db, get_admin_identifier(admin), "update_catechumen_class",
               "catechumen_class", class_id, f"제{body.round_no}차")
    return _class_row(row)


@router.delete("/classes/{class_id}", status_code=204)
def delete_class(class_id: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    existing = db.execute(text("SELECT round_no FROM catechumen_classes WHERE id=:id"), {"id": class_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="차수를 찾을 수 없습니다.")
    # 사진 파일 정리 (행은 ON DELETE CASCADE 로 함께 삭제됨)
    photos = db.execute(text("SELECT file_url FROM catechumen_photos WHERE class_id=:id"), {"id": class_id}).fetchall()
    for p in photos:
        _delete_file(p.file_url)
    db.execute(text("DELETE FROM catechumen_classes WHERE id=:id"), {"id": class_id})
    db.commit()
    log_action(db, get_admin_identifier(admin), "delete_catechumen_class",
               "catechumen_class", class_id, f"제{existing.round_no}차")


# ══════════════════════════════════════════════════════════
# 참여자 (catechumen_members)
# ══════════════════════════════════════════════════════════

class MemberIn(BaseModel):
    member_id: Optional[int] = None
    name: Optional[str] = None
    baptismal_name: Optional[str] = None
    baptized_at: Optional[date] = None
    sort_order: int = 0


class MemberOut(BaseModel):
    id: int
    class_id: int
    member_id: Optional[int]
    name: Optional[str]
    baptismal_name: Optional[str]
    baptized_at: Optional[date]
    sort_order: int
    member_nickname: Optional[str] = None  # member_id 연결 시 회원 닉네임


def _member_row(r) -> dict:
    return {
        "id": r.id, "class_id": r.class_id, "member_id": r.member_id,
        "name": r.name, "baptismal_name": r.baptismal_name,
        "baptized_at": r.baptized_at, "sort_order": r.sort_order,
        "member_nickname": getattr(r, "member_nickname", None),
    }


@router.get("/classes/{class_id}/members", response_model=list[MemberOut])
def list_members(class_id: int, db: Session = Depends(get_db)):
    rows = db.execute(text(
        "SELECT cm.*, mb.nickname AS member_nickname "
        "FROM catechumen_members cm "
        "LEFT JOIN members mb ON mb.id = cm.member_id "
        "WHERE cm.class_id=:cid "
        "ORDER BY cm.sort_order ASC, cm.id ASC"
    ), {"cid": class_id}).fetchall()
    return [_member_row(r) for r in rows]


@router.post("/classes/{class_id}/members", response_model=MemberOut, status_code=201)
def add_member(class_id: int, body: MemberIn, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    cls = db.execute(text("SELECT id FROM catechumen_classes WHERE id=:id"), {"id": class_id}).fetchone()
    if not cls:
        raise HTTPException(status_code=404, detail="차수를 찾을 수 없습니다.")
    row = db.execute(text(
        "INSERT INTO catechumen_members (class_id, member_id, name, baptismal_name, baptized_at, sort_order) "
        "VALUES (:cid, :mid, :name, :bn, :ba, :ord) RETURNING *"
    ), {"cid": class_id, "mid": body.member_id, "name": body.name,
        "bn": body.baptismal_name, "ba": body.baptized_at, "ord": body.sort_order}).fetchone()
    db.commit()
    log_action(db, get_admin_identifier(admin), "add_catechumen_member",
               "catechumen_member", row.id, body.name or f"member#{body.member_id}")
    full = db.execute(text(
        "SELECT cm.*, mb.nickname AS member_nickname FROM catechumen_members cm "
        "LEFT JOIN members mb ON mb.id = cm.member_id WHERE cm.id=:id"
    ), {"id": row.id}).fetchone()
    return _member_row(full)


@router.put("/members/{member_row_id}", response_model=MemberOut)
def update_member(member_row_id: int, body: MemberIn, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    row = db.execute(text(
        "UPDATE catechumen_members SET member_id=:mid, name=:name, baptismal_name=:bn, "
        "baptized_at=:ba, sort_order=:ord, updated_at=NOW() WHERE id=:id RETURNING *"
    ), {"mid": body.member_id, "name": body.name, "bn": body.baptismal_name,
        "ba": body.baptized_at, "ord": body.sort_order, "id": member_row_id}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="참여자를 찾을 수 없습니다.")
    db.commit()
    log_action(db, get_admin_identifier(admin), "update_catechumen_member",
               "catechumen_member", member_row_id, body.name or f"member#{body.member_id}")
    full = db.execute(text(
        "SELECT cm.*, mb.nickname AS member_nickname FROM catechumen_members cm "
        "LEFT JOIN members mb ON mb.id = cm.member_id WHERE cm.id=:id"
    ), {"id": member_row_id}).fetchone()
    return _member_row(full)


@router.delete("/members/{member_row_id}", status_code=204)
def delete_member(member_row_id: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    existing = db.execute(text("SELECT name FROM catechumen_members WHERE id=:id"), {"id": member_row_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="참여자를 찾을 수 없습니다.")
    db.execute(text("DELETE FROM catechumen_members WHERE id=:id"), {"id": member_row_id})
    db.commit()
    log_action(db, get_admin_identifier(admin), "delete_catechumen_member",
               "catechumen_member", member_row_id, existing.name or "")


# ══════════════════════════════════════════════════════════
# 사진 (catechumen_photos) — category 별 앨범
# ══════════════════════════════════════════════════════════

class PhotoOut(BaseModel):
    id: int
    class_id: int
    category: str
    file_url: str
    alt: Optional[str]
    sort_order: int


def _photo_row(r) -> dict:
    return {
        "id": r.id, "class_id": r.class_id, "category": r.category,
        "file_url": r.file_url, "alt": r.alt, "sort_order": r.sort_order,
    }


@router.get("/classes/{class_id}/photos", response_model=list[PhotoOut])
def list_photos(class_id: int, category: Optional[str] = None, db: Session = Depends(get_db)):
    if category:
        rows = db.execute(text(
            "SELECT * FROM catechumen_photos WHERE class_id=:cid AND category=:cat "
            "ORDER BY sort_order ASC, id ASC"
        ), {"cid": class_id, "cat": category}).fetchall()
    else:
        rows = db.execute(text(
            "SELECT * FROM catechumen_photos WHERE class_id=:cid ORDER BY category, sort_order ASC, id ASC"
        ), {"cid": class_id}).fetchall()
    return [_photo_row(r) for r in rows]


@router.post("/classes/{class_id}/photos", response_model=PhotoOut, status_code=201)
async def upload_photo(
    class_id: int,
    category: str = Form(...),
    alt: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    cls = db.execute(text("SELECT id FROM catechumen_classes WHERE id=:id"), {"id": class_id}).fetchone()
    if not cls:
        raise HTTPException(status_code=404, detail="차수를 찾을 수 없습니다.")
    url = _save_photo(file, "catechumen")
    max_ord = db.execute(text(
        "SELECT COALESCE(MAX(sort_order), -1) AS m FROM catechumen_photos WHERE class_id=:cid AND category=:cat"
    ), {"cid": class_id, "cat": category}).fetchone()
    next_ord = (max_ord.m if max_ord else -1) + 1
    row = db.execute(text(
        "INSERT INTO catechumen_photos (class_id, category, file_url, alt, sort_order) "
        "VALUES (:cid, :cat, :url, :alt, :ord) RETURNING *"
    ), {"cid": class_id, "cat": category, "url": url, "alt": alt, "ord": next_ord}).fetchone()
    db.commit()
    log_action(db, get_admin_identifier(admin), "upload_catechumen_photo",
               "catechumen_photo", row.id, category)
    return _photo_row(row)


@router.delete("/photos/{photo_id}", status_code=204)
def delete_photo(photo_id: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    existing = db.execute(text("SELECT file_url, category FROM catechumen_photos WHERE id=:id"), {"id": photo_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="사진을 찾을 수 없습니다.")
    _delete_file(existing.file_url)
    db.execute(text("DELETE FROM catechumen_photos WHERE id=:id"), {"id": photo_id})
    db.commit()
    log_action(db, get_admin_identifier(admin), "delete_catechumen_photo",
               "catechumen_photo", photo_id, existing.category)
