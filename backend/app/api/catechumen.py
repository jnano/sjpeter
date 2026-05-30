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
from app.core.auth import get_current_admin, get_current_member
from app.core.config import settings
from app.models.catechumen import CatechumenPage

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


# ══════════════════════════════════════════════════════════
# 입교신청 (catechumen_applications) — 회원 전용
# ══════════════════════════════════════════════════════════

ACTIVE_STATUSES = ("접수", "연락완료")
ALL_STATUSES = ("접수", "연락완료", "등록완료", "취소")


class ApplicationIn(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    baptismal_name_wish: Optional[str] = None
    message: Optional[str] = None


class ApplicationOut(BaseModel):
    id: int
    member_id: int
    class_id: Optional[int]
    name: Optional[str]
    phone: Optional[str]
    baptismal_name_wish: Optional[str]
    message: Optional[str]
    status: str
    created_at: datetime
    member_nickname: Optional[str] = None
    member_email: Optional[str] = None
    class_round_no: Optional[int] = None


class StatusIn(BaseModel):
    status: str


def _app_row(r) -> dict:
    return {
        "id": r.id, "member_id": r.member_id, "class_id": r.class_id,
        "name": r.name, "phone": r.phone, "baptismal_name_wish": r.baptismal_name_wish,
        "message": r.message, "status": r.status, "created_at": r.created_at,
        "member_nickname": getattr(r, "member_nickname", None),
        "member_email": getattr(r, "member_email", None),
        "class_round_no": getattr(r, "class_round_no", None),
    }


@router.post("/applications", response_model=ApplicationOut, status_code=201)
def create_application(body: ApplicationIn, db: Session = Depends(get_db), member=Depends(get_current_member)):
    # 중복 방지: 접수·연락완료 상태의 진행 중 신청이 있으면 거부
    dup = db.execute(text(
        "SELECT id FROM catechumen_applications WHERE member_id=:mid AND status IN ('접수','연락완료')"
    ), {"mid": member.id}).fetchone()
    if dup:
        raise HTTPException(status_code=409, detail="이미 접수된 입교신청이 있습니다.")
    # 모집중(apply_open) 차수에 자동 연결 (없으면 미연결 — 대기)
    cls = db.execute(text(
        "SELECT id FROM catechumen_classes WHERE apply_open=TRUE ORDER BY sort_order DESC, round_no DESC NULLS LAST LIMIT 1"
    )).fetchone()
    class_id = cls.id if cls else None
    row = db.execute(text(
        "INSERT INTO catechumen_applications (member_id, class_id, name, phone, baptismal_name_wish, message, status) "
        "VALUES (:mid, :cid, :name, :phone, :bn, :msg, '접수') RETURNING *"
    ), {"mid": member.id, "cid": class_id, "name": body.name, "phone": body.phone,
        "bn": body.baptismal_name_wish, "msg": body.message}).fetchone()
    db.commit()
    return _app_row(row)


@router.get("/applications/me", response_model=list[ApplicationOut])
def my_applications(db: Session = Depends(get_db), member=Depends(get_current_member)):
    rows = db.execute(text(
        "SELECT a.*, c.round_no AS class_round_no FROM catechumen_applications a "
        "LEFT JOIN catechumen_classes c ON c.id = a.class_id "
        "WHERE a.member_id=:mid ORDER BY a.created_at DESC"
    ), {"mid": member.id}).fetchall()
    return [_app_row(r) for r in rows]


@router.get("/applications", response_model=list[ApplicationOut])
def list_applications(status: Optional[str] = None, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    base = (
        "SELECT a.*, mb.nickname AS member_nickname, mb.email AS member_email, c.round_no AS class_round_no "
        "FROM catechumen_applications a "
        "LEFT JOIN members mb ON mb.id = a.member_id "
        "LEFT JOIN catechumen_classes c ON c.id = a.class_id "
    )
    if status:
        rows = db.execute(text(base + "WHERE a.status=:st ORDER BY a.created_at DESC"), {"st": status}).fetchall()
    else:
        rows = db.execute(text(base + "ORDER BY a.created_at DESC")).fetchall()
    return [_app_row(r) for r in rows]


@router.put("/applications/{app_id}/status", response_model=ApplicationOut)
def update_application_status(app_id: int, body: StatusIn, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    if body.status not in ALL_STATUSES:
        raise HTTPException(status_code=400, detail="잘못된 상태값입니다.")
    row = db.execute(text(
        "UPDATE catechumen_applications SET status=:st, updated_at=NOW() WHERE id=:id RETURNING *"
    ), {"st": body.status, "id": app_id}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="신청을 찾을 수 없습니다.")
    db.commit()
    log_action(db, get_admin_identifier(admin), "update_catechumen_application", "catechumen_application", app_id, body.status)
    return _app_row(row)


@router.post("/applications/{app_id}/to-member")
def application_to_member(app_id: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    """신청을 해당 차수의 참여자(catechumen_members)로 전환하고 status='등록완료' 처리."""
    a = db.execute(text("SELECT * FROM catechumen_applications WHERE id=:id"), {"id": app_id}).fetchone()
    if not a:
        raise HTTPException(status_code=404, detail="신청을 찾을 수 없습니다.")
    if not a.class_id:
        raise HTTPException(status_code=400, detail="연결된 차수가 없습니다. 먼저 신청에 차수를 지정하세요.")
    # 이미 같은 차수에 같은 회원이 등록돼 있으면 중복 생성 안 함
    exist = db.execute(text(
        "SELECT id FROM catechumen_members WHERE class_id=:cid AND member_id=:mid"
    ), {"cid": a.class_id, "mid": a.member_id}).fetchone()
    if not exist:
        max_ord = db.execute(text(
            "SELECT COALESCE(MAX(sort_order), -1) AS m FROM catechumen_members WHERE class_id=:cid"
        ), {"cid": a.class_id}).fetchone()
        db.execute(text(
            "INSERT INTO catechumen_members (class_id, member_id, name, baptismal_name, sort_order) "
            "VALUES (:cid, :mid, :name, :bn, :ord)"
        ), {"cid": a.class_id, "mid": a.member_id, "name": a.name,
            "bn": a.baptismal_name_wish, "ord": (max_ord.m if max_ord else -1) + 1})
    db.execute(text("UPDATE catechumen_applications SET status='등록완료', updated_at=NOW() WHERE id=:id"), {"id": app_id})
    db.commit()
    log_action(db, get_admin_identifier(admin), "catechumen_application_to_member", "catechumen_application", app_id, a.name or "")
    return {"ok": True, "class_id": a.class_id}


@router.delete("/applications/{app_id}", status_code=204)
def delete_application(app_id: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    existing = db.execute(text("SELECT name FROM catechumen_applications WHERE id=:id"), {"id": app_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="신청을 찾을 수 없습니다.")
    db.execute(text("DELETE FROM catechumen_applications WHERE id=:id"), {"id": app_id})
    db.commit()
    log_action(db, get_admin_identifier(admin), "delete_catechumen_application", "catechumen_application", app_id, existing.name or "")


# ══════════════════════════════════════════════════════════
# 회원 마이페이지 — 입교 기록 · 세례성사 앨범 (회원 전용)
# ══════════════════════════════════════════════════════════

class MyRecordOut(BaseModel):
    class_id: int
    round_no: Optional[int]
    baptized_at: Optional[date]       # 개인 세례일(없으면 차수 세례성사일)
    baptismal_name: Optional[str]
    photo_count: int                  # 차수 전체 사진 수
    baptism_photo_count: int          # 세례성사 사진 수


@router.get("/my-record", response_model=list[MyRecordOut])
def my_record(db: Session = Depends(get_db), member=Depends(get_current_member)):
    """본인이 참여자로 등록된 차수의 입교 기록 (마이페이지용)."""
    rows = db.execute(text(
        "SELECT cm.class_id, c.round_no, "
        "COALESCE(cm.baptized_at, c.baptism_at::date) AS baptized_at, "
        "cm.baptismal_name, "
        "(SELECT COUNT(*) FROM catechumen_photos p WHERE p.class_id=cm.class_id) AS photo_count, "
        "(SELECT COUNT(*) FROM catechumen_photos p WHERE p.class_id=cm.class_id AND p.category='세례성사') AS baptism_photo_count "
        "FROM catechumen_members cm "
        "JOIN catechumen_classes c ON c.id = cm.class_id "
        "WHERE cm.member_id=:mid "
        "ORDER BY c.round_no DESC NULLS LAST, c.id DESC"
    ), {"mid": member.id}).fetchall()
    return [{
        "class_id": r.class_id, "round_no": r.round_no, "baptized_at": r.baptized_at,
        "baptismal_name": r.baptismal_name, "photo_count": r.photo_count or 0,
        "baptism_photo_count": r.baptism_photo_count or 0,
    } for r in rows]


class AlbumOut(BaseModel):
    class_id: int
    round_no: Optional[int]
    baptism_at: Optional[datetime]
    photos: list[PhotoOut]


@router.get("/classes/{class_id}/album", response_model=AlbumOut)
def class_album(class_id: int, db: Session = Depends(get_db), member=Depends(get_current_member)):
    """차수 전체 사진 앨범 (회원 전용 — 입교자 사진 프라이버시)."""
    cls = db.execute(text("SELECT id, round_no, baptism_at FROM catechumen_classes WHERE id=:id"), {"id": class_id}).fetchone()
    if not cls:
        raise HTTPException(status_code=404, detail="차수를 찾을 수 없습니다.")
    rows = db.execute(text(
        "SELECT * FROM catechumen_photos WHERE class_id=:cid ORDER BY category, sort_order ASC, id ASC"
    ), {"cid": class_id}).fetchall()
    return {
        "class_id": cls.id, "round_no": cls.round_no, "baptism_at": cls.baptism_at,
        "photos": [_photo_row(r) for r in rows],
    }


# ──────────────────────────── 안내 페이지 콘텐츠 (/catechumen) ────────────────────────────
# 공개 /catechumen 페이지의 hero·4단계·커리큘럼·일정·FAQ·CTA 를 단일 JSON 행으로 관리.
# 행이 없으면 아래 기본값(현재 시안 문구)을 반환 → 첫 배포·미입력 본당도 정상 노출.
# "신청 방법" 칼럼의 전화·주소는 공개 페이지에서 parish 정보로 동적 렌더(여기 포함 안 함).

DEFAULT_PAGE_CONTENT = {
    "hero": {
        "eyebrow": "예비신자 모집 · 2026 가을학기",
        "title_normal": "한 걸음만 다가오시면,",
        "title_em": "나머지는 함께 걷겠습니다.",
        "body": "가톨릭에 처음이신 분, 다시 돌아오고 싶으신 분 모두 환영합니다. 매주 한 번의 수업과 미사로 9개월간 함께 신앙의 길을 걷습니다.",
        "stats": [
            {"v": "9개월", "l": "전체 과정"},
            {"v": "주 1회", "l": "교리 수업"},
            {"v": "무료", "l": "교재 포함"},
            {"v": "2026.09", "l": "가을 학기 개강"},
        ],
    },
    "path_steps": [
        {"n": "01", "when": "9월", "title": "신청과 환영", "body": "등록과 첫 만남. 본당 공동체의 환영을 받고, 동료 예비신자들과 인사합니다.", "done": True},
        {"n": "02", "when": "10월 — 1월", "title": "예비교리", "body": "매주 한 번 교리 수업과 주일 미사 참례. 가톨릭 신앙의 기초를 배웁니다.", "done": False},
        {"n": "03", "when": "2월 — 4월", "title": "사순 시기 준비", "body": "선택받은 예비신자(Elect)로 선포되어, 사순 시기를 함께 묵상하며 준비합니다.", "done": False},
        {"n": "04", "when": "부활 성야", "title": "세례 · 첫영성체", "body": "부활 성야 미사에서 세례·견진·첫영성체를 한 번에 받게 됩니다.", "done": False},
    ],
    "curriculum": [
        {"term": "1학기 · 9월—12월", "title": "하느님과 그리스도", "period": "총 14주 · 화요일 19:30",
         "items": ["① 신앙이란 무엇인가", "② **삼위일체**: 성부·성자·성령", "③ 그리스도의 생애와 가르침", "④ 십자가의 의미", "⑤ 부활과 영원한 생명"]},
        {"term": "2학기 · 1월—3월", "title": "교회와 성사", "period": "총 12주 · 화요일 19:30",
         "items": ["① 교회의 의미와 사도성", "② **일곱 성사**: 세례·견진·성체", "③ 미사와 전례", "④ 고해와 화해", "⑤ 성모님과 성인들"]},
        {"term": "3학기 · 3월—4월", "title": "그리스도인의 삶", "period": "총 6주 + 사순 피정",
         "items": ["① 십계명과 양심", "② **기도의 삶**: 매일·매주", "③ 사랑과 정의", "④ 사순 시기 영성", "⑤ 부활 성야 준비"]},
    ],
    "schedule": [
        {"label": "개강", "value": "2026년 9월 1일 (화)", "sub": "입학 미사 19:00 · 본당 성전"},
        {"label": "수업", "value": "매주 화요일 19:30 — 21:00", "sub": "본당 회합실"},
        {"label": "미사", "value": "주일 10:30 교중 미사 참례", "sub": "예비신자도 함께 참여 가능"},
        {"label": "종강", "value": "2027년 부활 성야 (4월 3일)", "sub": "세례·견진·첫영성체"},
        {"label": "교재", "value": "『가톨릭 교회 입문』 (무료 배부)", "sub": "한국천주교중앙협의회"},
    ],
    "faq": [
        {"q": "전혀 모르는데 괜찮을까요?", "a": '네, 가장 환영합니다. 예비신자 과정은 "이미 알고 있는 분"이 아니라 "알아가고 싶은 분"을 위한 자리입니다.'},
        {"q": "비용이 드나요?", "a": "완전 무료입니다. 교재와 자료는 본당에서 제공합니다. 부담 없이 시작하세요."},
        {"q": "몇 번 빠져도 되나요?", "a": "2회 이상 결석 시 보충 수업을 안내드립니다. 다만 핵심 주제(부활·성사 등)는 가급적 참석을 권장합니다."},
        {"q": "가족과 함께 참여할 수 있나요?", "a": "네, 가족·친구가 함께 신청하시면 더 좋습니다. 부부 동반 예비신자 비율이 30% 정도입니다."},
        {"q": "세례명은 어떻게 정하나요?", "a": "과정 중 성인 사전과 함께 자신의 마음에 와 닿는 성인의 이름을 정하게 됩니다. 대부모도 함께 정합니다."},
        {"q": "중도에 그만둬도 되나요?", "a": "물론입니다. 신앙은 강요로 시작될 수 없습니다. 다만 한 학기는 끝까지 들어보시기를 권합니다."},
    ],
    "cta": {
        "eyebrow": "함께 걸어요",
        "title_normal": "한 줄의 신청서가",
        "title_em": "한 생의 신앙으로 자라납니다.",
    },
}


class PageContentIn(BaseModel):
    content: dict


@router.get("/page-content")
def get_page_content(db: Session = Depends(get_db)):
    """공개 — 안내 페이지 콘텐츠. 저장된 행이 없으면 기본값 반환."""
    row = db.query(CatechumenPage).first()
    if row and row.content:
        return row.content
    return DEFAULT_PAGE_CONTENT


@router.put("/page-content")
def update_page_content(body: PageContentIn, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    """Admin — 안내 페이지 콘텐츠 저장(단일 행 upsert)."""
    row = db.query(CatechumenPage).first()
    if row is None:
        row = CatechumenPage(content=body.content)
        db.add(row)
    else:
        row.content = body.content
    db.commit()
    db.refresh(row)
    log_action(db, get_admin_identifier(admin), "update_catechumen_page", "catechumen_page", row.id, "")
    return row.content
