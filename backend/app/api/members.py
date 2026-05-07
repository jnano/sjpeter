import re
import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_, func
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from app.core.database import get_db
from app.core.auth import verify_password, create_access_token, hash_password, get_current_member, get_current_admin, get_current_super_admin
from app.core.config import settings
from app.models.member import Member
from app.models.admin import Admin
from app.models.board import Post

AVATAR_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
AVATAR_MAX_SIZE = 5 * 1024 * 1024  # 5 MB

router = APIRouter(prefix="/members", tags=["members"])


# ── 스키마 ────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    nickname: str
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class SocialLoginRequest(BaseModel):
    provider: str
    provider_id: str
    email: Optional[str] = None
    name: Optional[str] = None
    avatar_url: Optional[str] = None


class UpdateRequest(BaseModel):
    nickname: Optional[str] = None
    password: Optional[str] = None


class MemberOut(BaseModel):
    id: int
    email: str
    nickname: str
    avatar_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class MemberAdminOut(BaseModel):
    id: int
    email: str
    nickname: str
    avatar_url: Optional[str] = None
    social_provider: Optional[str] = None
    is_active: bool
    is_admin: bool = False
    has_password: bool = True   # 비밀번호 설정 여부 (소셜 전용 여부 판단용)
    post_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


class MemberListResponse(BaseModel):
    items: list[MemberAdminOut]
    total: int
    page: int
    size: int


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    member: MemberOut


# ── 공개 엔드포인트 ──────────────────────────────────────

@router.post("/register", response_model=TokenResponse, status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    if len(body.nickname) < 2:
        raise HTTPException(status_code=400, detail="닉네임은 2자 이상이어야 합니다.")
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="비밀번호는 8자 이상이어야 합니다.")
    if db.query(Member).filter(Member.email == body.email).first():
        raise HTTPException(status_code=400, detail="이미 사용 중인 이메일입니다.")
    if db.query(Member).filter(Member.nickname == body.nickname).first():
        raise HTTPException(status_code=400, detail="이미 사용 중인 닉네임입니다.")

    member = Member(
        email=body.email,
        nickname=body.nickname,
        hashed_password=hash_password(body.password),
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return TokenResponse(
        access_token=create_access_token(str(member.id), role="member"),
        member=member,
    )


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    member = db.query(Member).filter(Member.email == body.email).first()
    if not member or not member.hashed_password:
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다.")
    if not verify_password(body.password, member.hashed_password):
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다.")
    if not member.is_active:
        raise HTTPException(status_code=403, detail="비활성화된 계정입니다.")
    return TokenResponse(
        access_token=create_access_token(str(member.id), role="member"),
        member=member,
    )


@router.post("/social-login", response_model=TokenResponse)
def social_login(body: SocialLoginRequest, db: Session = Depends(get_db)):
    member = db.query(Member).filter(
        Member.social_provider == body.provider,
        Member.social_id == body.provider_id,
    ).first()

    if not member and body.email:
        member = db.query(Member).filter(Member.email == body.email).first()
        if member:
            member.social_provider = body.provider
            member.social_id = body.provider_id
            if body.avatar_url and not member.avatar_url:
                member.avatar_url = body.avatar_url
            db.commit()

    if not member:
        nickname = _unique_nickname(body.name or "", db)
        email = body.email or f"{body.provider}_{body.provider_id}@social.local"
        member = Member(
            email=email,
            nickname=nickname,
            hashed_password=None,
            social_provider=body.provider,
            social_id=body.provider_id,
            avatar_url=body.avatar_url,
        )
        db.add(member)
        db.commit()
        db.refresh(member)

    if not member.is_active:
        raise HTTPException(status_code=403, detail="비활성화된 계정입니다.")

    return TokenResponse(
        access_token=create_access_token(str(member.id), role="member"),
        member=member,
    )


@router.get("/me", response_model=MemberOut)
def get_me(current: Member = Depends(get_current_member)):
    return current


@router.put("/me", response_model=MemberOut)
def update_me(
    body: UpdateRequest,
    db: Session = Depends(get_db),
    current: Member = Depends(get_current_member),
):
    if body.nickname:
        if db.query(Member).filter(Member.nickname == body.nickname, Member.id != current.id).first():
            raise HTTPException(status_code=400, detail="이미 사용 중인 닉네임입니다.")
        current.nickname = body.nickname
    if body.password:
        if len(body.password) < 8:
            raise HTTPException(status_code=400, detail="비밀번호는 8자 이상이어야 합니다.")
        current.hashed_password = hash_password(body.password)
    db.commit()
    db.refresh(current)
    return current


@router.post("/me/avatar", response_model=MemberOut)
async def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current: Member = Depends(get_current_member),
):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in AVATAR_IMAGE_EXTS:
        raise HTTPException(status_code=400, detail="이미지 파일만 업로드할 수 있습니다.")

    data = await file.read()
    if len(data) > AVATAR_MAX_SIZE:
        raise HTTPException(status_code=400, detail="파일 크기는 5MB 이하여야 합니다.")

    avatar_dir = os.path.join(settings.UPLOAD_DIR, "avatars")
    os.makedirs(avatar_dir, exist_ok=True)

    filename = f"{uuid.uuid4().hex}{ext}"
    save_path = os.path.join(avatar_dir, filename)
    with open(save_path, "wb") as f:
        f.write(data)

    # 기존 커스텀 아바타 파일 삭제 (소셜 URL은 삭제 안 함)
    if current.avatar_url and current.avatar_url.startswith("/uploads/avatars/"):
        old_path = os.path.join(settings.UPLOAD_DIR, current.avatar_url.lstrip("/uploads/"))
        if os.path.exists(old_path):
            os.remove(old_path)

    current.avatar_url = f"/uploads/avatars/{filename}"
    db.commit()
    db.refresh(current)
    return current


@router.delete("/me/avatar", response_model=MemberOut)
def delete_avatar(
    db: Session = Depends(get_db),
    current: Member = Depends(get_current_member),
):
    if current.avatar_url and current.avatar_url.startswith("/uploads/avatars/"):
        old_path = os.path.join(settings.UPLOAD_DIR, current.avatar_url.lstrip("/uploads/"))
        if os.path.exists(old_path):
            os.remove(old_path)
    current.avatar_url = None
    db.commit()
    db.refresh(current)
    return current


# ── 관리자 전용 엔드포인트 ────────────────────────────────

@router.get("/admin/search")
def admin_search_members(
    q: str = Query("", description="닉네임 또는 이메일"),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    _admin: Admin = Depends(get_current_admin),
):
    """게시판 관리자 지정 등에 사용하는 간단한 회원 검색."""
    query = db.query(Member).filter(Member.is_active == True)
    if q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(or_(Member.nickname.ilike(like), Member.email.ilike(like)))
    members = query.order_by(Member.nickname).limit(limit).all()
    return [{"id": m.id, "nickname": m.nickname, "email": m.email, "avatar_url": m.avatar_url} for m in members]


@router.get("/admin/list", response_model=MemberListResponse)
def admin_list_members(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    q: Optional[str] = Query(None, description="이메일 또는 닉네임 검색"),
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    _admin: Admin = Depends(get_current_admin),
):
    query = db.query(Member)

    if q:
        like = f"%{q}%"
        query = query.filter(or_(Member.email.ilike(like), Member.nickname.ilike(like)))

    if is_active is not None:
        query = query.filter(Member.is_active == is_active)

    total = query.count()
    members = (
        query.order_by(desc(Member.created_at))
        .offset((page - 1) * size)
        .limit(size)
        .all()
    )

    post_counts = {
        row.member_id: row.cnt
        for row in db.query(Post.member_id, func.count(Post.id).label("cnt"))
        .filter(Post.member_id.in_([m.id for m in members]))
        .group_by(Post.member_id)
        .all()
    }

    items = [
        MemberAdminOut(
            id=m.id,
            email=m.email,
            nickname=m.nickname,
            avatar_url=m.avatar_url,
            social_provider=m.social_provider,
            is_active=m.is_active,
            is_admin=m.is_admin,
            has_password=m.hashed_password is not None,
            post_count=post_counts.get(m.id, 0),
            created_at=m.created_at,
        )
        for m in members
    ]

    return MemberListResponse(items=items, total=total, page=page, size=size)


@router.post("/admin/create", response_model=MemberAdminOut, status_code=201)
def admin_create_member(
    body: RegisterRequest,
    db: Session = Depends(get_db),
    _admin: Admin = Depends(get_current_admin),
):
    """관리자가 회원을 직접 등록한다."""
    if len(body.nickname) < 2:
        raise HTTPException(status_code=400, detail="닉네임은 2자 이상이어야 합니다.")
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="비밀번호는 8자 이상이어야 합니다.")
    if db.query(Member).filter(Member.email == body.email).first():
        raise HTTPException(status_code=400, detail="이미 사용 중인 이메일입니다.")
    if db.query(Member).filter(Member.nickname == body.nickname).first():
        raise HTTPException(status_code=400, detail="이미 사용 중인 닉네임입니다.")

    member = Member(
        email=body.email,
        nickname=body.nickname,
        hashed_password=hash_password(body.password),
        is_active=True,
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return _to_admin_out(member, db)


@router.put("/admin/{member_id}/activate", response_model=MemberAdminOut)
def admin_activate_member(
    member_id: int,
    db: Session = Depends(get_db),
    _admin: Admin = Depends(get_current_admin),
):
    member = _get_member_or_404(member_id, db)
    member.is_active = True
    db.commit()
    db.refresh(member)
    return _to_admin_out(member, db)


@router.put("/admin/{member_id}/deactivate", response_model=MemberAdminOut)
def admin_deactivate_member(
    member_id: int,
    db: Session = Depends(get_db),
    _admin: Admin = Depends(get_current_admin),
):
    member = _get_member_or_404(member_id, db)
    member.is_active = False
    db.commit()
    db.refresh(member)
    return _to_admin_out(member, db)


@router.delete("/admin/{member_id}")
def admin_delete_member(
    member_id: int,
    db: Session = Depends(get_db),
    _admin: Admin = Depends(get_current_admin),
):
    _get_member_or_404(member_id, db)
    from sqlalchemy import text
    # 댓글 → 게시글 → 회원 순서로 삭제 (FK 제약 우회)
    db.execute(text("DELETE FROM comments WHERE member_id = :id"), {"id": member_id})
    db.execute(text("DELETE FROM posts WHERE member_id = :id"), {"id": member_id})
    db.execute(text("DELETE FROM members WHERE id = :id"), {"id": member_id})
    db.commit()
    return {"ok": True}


@router.patch("/admin/{member_id}/reset-password")
def admin_reset_password(
    member_id: int,
    db: Session = Depends(get_db),
    _admin: Admin = Depends(get_current_admin),
):
    """관리자·위임관리자 — 회원 비밀번호를 초기값(0629)으로 초기화."""
    member = _get_member_or_404(member_id, db)
    member.hashed_password = hash_password("0629")
    db.commit()
    return {"ok": True}


@router.patch("/admin/{member_id}/grant-admin", response_model=MemberAdminOut)
def grant_admin(
    member_id: int,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_super_admin),
):
    """슈퍼 관리자만 호출 가능 — 회원에게 관리 권한 부여.
    비밀번호가 없는 소셜 회원도 지정 가능하나, 실제 관리자 패널 로그인은
    비밀번호 설정 후에만 가능하다."""
    member = _get_member_or_404(member_id, db)
    member.is_admin = True
    db.commit()
    db.refresh(member)
    return _to_admin_out(member, db)


@router.patch("/admin/{member_id}/revoke-admin", response_model=MemberAdminOut)
def revoke_admin(
    member_id: int,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_super_admin),
):
    """슈퍼 관리자만 호출 가능 — 회원 관리 권한 회수."""
    member = _get_member_or_404(member_id, db)
    member.is_admin = False
    db.commit()
    db.refresh(member)
    return _to_admin_out(member, db)


# ── 헬퍼 ──────────────────────────────────────────────────

def _get_member_or_404(member_id: int, db: Session) -> Member:
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")
    return member


def _to_admin_out(member: Member, db: Session) -> MemberAdminOut:
    post_count = db.query(func.count(Post.id)).filter(Post.member_id == member.id).scalar() or 0
    return MemberAdminOut(
        id=member.id,
        email=member.email,
        nickname=member.nickname,
        avatar_url=member.avatar_url,
        social_provider=member.social_provider,
        is_active=member.is_active,
        is_admin=member.is_admin,
        has_password=member.hashed_password is not None,
        post_count=post_count,
        created_at=member.created_at,
    )


def _unique_nickname(raw: str, db: Session) -> str:
    base = re.sub(r"[^가-힣a-zA-Z0-9]", "", raw)[:10] or "회원"
    candidate = base
    suffix = 1
    while db.query(Member).filter(Member.nickname == candidate).first():
        candidate = f"{base}{suffix}"
        suffix += 1
    return candidate
