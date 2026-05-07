import re
import os
import uuid
import secrets
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_, func, text
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, timedelta
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.core.database import get_db
from app.core.auth import verify_password, create_access_token, hash_password, get_current_member, get_current_admin, get_current_super_admin
from app.core.config import settings
from app.core.admin_log import log_action
from app.models.member import Member
from app.models.admin import Admin
from app.models.board import Post

limiter = Limiter(key_func=get_remote_address)

AVATAR_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
AVATAR_MAX_SIZE = 5 * 1024 * 1024  # 5 MB
SPECIAL_CHARS = set(r"!@#$%^&*()_+-=[]{}|;':\",./<>?~`\\")


def _validate_password(password: str) -> None:
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="비밀번호는 8자 이상이어야 합니다.")
    if not any(c in SPECIAL_CHARS for c in password):
        raise HTTPException(status_code=400, detail="비밀번호에 특수문자를 포함해야 합니다.")

router = APIRouter(prefix="/members", tags=["members"])


# ── 스키마 ────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    name: str
    nickname: str
    phone: Optional[str] = None
    receive_notification: bool = False
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
    name: Optional[str] = None
    nickname: Optional[str] = None
    phone: Optional[str] = None
    receive_notification: Optional[bool] = None
    current_password: Optional[str] = None
    password: Optional[str] = None


class MemberOut(BaseModel):
    id: int
    email: str
    name: Optional[str] = None
    nickname: str
    phone: Optional[str] = None
    receive_notification: bool = False
    avatar_url: Optional[str] = None
    has_password: bool = True
    is_admin: bool = False
    is_email_verified: bool = False
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


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str


def _send_email(to_email: str, subject: str, body: str) -> None:
    """이메일 발송. SMTP 미설정 시 콘솔 출력."""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        print(f"[메일 발송] {to_email}\n제목: {subject}\n{body}")
        return
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_FROM or settings.SMTP_USER
        msg["To"] = to_email
        msg.attach(MIMEText(body, "plain", "utf-8"))
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_USER, [to_email], msg.as_string())
    except Exception as e:
        print(f"[SMTP 오류] {e}")
        raise HTTPException(status_code=500, detail="이메일 발송에 실패했습니다. 잠시 후 다시 시도하세요.")


def _send_reset_email(to_email: str, reset_url: str, nickname: str) -> None:
    """비밀번호 재설정 이메일 발송."""
    _send_email(
        to_email,
        "[세종성베드로성당] 비밀번호 재설정 안내",
        f"안녕하세요, {nickname}님.\n\n비밀번호 재설정 링크가 요청되었습니다.\n"
        f"아래 링크를 클릭하여 새 비밀번호를 설정하세요 (유효 시간: 1시간).\n\n{reset_url}\n\n"
        "본인이 요청하지 않으셨다면 이 메일을 무시하세요.\n\n세종성베드로성당 드림",
    )


def _send_verification_email(to_email: str, verify_url: str, nickname: str) -> None:
    """이메일 인증 메일 발송."""
    _send_email(
        to_email,
        "[세종성베드로성당] 이메일 주소 인증 안내",
        f"안녕하세요, {nickname}님.\n\n세종성베드로성당 홈페이지에 가입해 주셔서 감사합니다.\n"
        f"아래 링크를 클릭하여 이메일 주소를 인증해 주세요 (유효 시간: 24시간).\n\n{verify_url}\n\n"
        "세종성베드로성당 드림",
    )


# ── 공개 엔드포인트 ──────────────────────────────────────

@router.post("/register", response_model=TokenResponse, status_code=201)
@limiter.limit("5/minute")
def register(request: Request, body: RegisterRequest, db: Session = Depends(get_db)):
    if len(body.nickname) < 2:
        raise HTTPException(status_code=400, detail="닉네임은 2자 이상이어야 합니다.")
    _validate_password(body.password)
    if db.query(Member).filter(Member.email == body.email).first():
        raise HTTPException(status_code=400, detail="이미 사용 중인 이메일입니다.")

    member = Member(
        email=body.email,
        name=body.name.strip() if body.name else None,
        nickname=body.nickname,
        phone=body.phone.strip() if body.phone else None,
        receive_notification=body.receive_notification,
        hashed_password=hash_password(body.password),
    )
    db.add(member)
    db.commit()
    db.refresh(member)

    # 인증 이메일 발송 (실패해도 가입은 완료)
    try:
        _issue_and_send_verification(member, db)
    except Exception:
        pass

    return TokenResponse(
        access_token=create_access_token(str(member.id), role="member"),
        member=_member_out(member),
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
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


def _member_out(member: Member) -> MemberOut:
    """Member ORM → MemberOut, has_password 명시 계산."""
    return MemberOut(
        id=member.id,
        email=member.email,
        name=member.name,
        nickname=member.nickname,
        phone=member.phone,
        receive_notification=bool(member.receive_notification),
        avatar_url=member.avatar_url,
        has_password=member.hashed_password is not None,
        is_admin=bool(member.is_admin),
        is_email_verified=bool(member.is_email_verified),
        created_at=member.created_at,
    )


@router.get("/me", response_model=MemberOut)
def get_me(current: Member = Depends(get_current_member)):
    return _member_out(current)


@router.put("/me", response_model=MemberOut)
def update_me(
    body: UpdateRequest,
    db: Session = Depends(get_db),
    current: Member = Depends(get_current_member),
):
    if body.name is not None:
        current.name = body.name.strip() or None
    if body.phone is not None:
        current.phone = body.phone.strip() or None
    if body.receive_notification is not None:
        current.receive_notification = body.receive_notification
    if body.nickname:
        if len(body.nickname) < 2:
            raise HTTPException(status_code=400, detail="세례명은 2자 이상이어야 합니다.")
        current.nickname = body.nickname
    if body.password:
        _validate_password(body.password)
        if current.hashed_password:
            if not body.current_password or not verify_password(body.current_password, current.hashed_password):
                raise HTTPException(status_code=400, detail="현재 비밀번호가 올바르지 않습니다.")
        current.hashed_password = hash_password(body.password)
    db.commit()
    db.refresh(current)
    return _member_out(current)


@router.delete("/me", status_code=204)
def delete_me(
    db: Session = Depends(get_db),
    current: Member = Depends(get_current_member),
):
    """회원 탈퇴 — 댓글·게시글·아바타 파일 포함 삭제."""
    from sqlalchemy import text

    # 아바타 파일 삭제
    if current.avatar_url and current.avatar_url.startswith("/uploads/avatars/"):
        old_path = os.path.join(settings.UPLOAD_DIR, current.avatar_url.lstrip("/uploads/"))
        if os.path.exists(old_path):
            os.remove(old_path)

    db.execute(text("DELETE FROM comments WHERE member_id = :id"), {"id": current.id})
    db.execute(text("DELETE FROM posts WHERE member_id = :id"), {"id": current.id})
    db.execute(text("DELETE FROM members WHERE id = :id"), {"id": current.id})
    db.commit()


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
    return _member_out(current)


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
    return _member_out(current)


# ── 이메일 인증 ────────────────────────────────────────────

def _issue_and_send_verification(member: Member, db: Session) -> None:
    """인증 토큰 발급 및 메일 발송."""
    db.execute(text(
        "UPDATE email_verification_tokens SET used = TRUE WHERE member_id = :mid AND used = FALSE"
    ), {"mid": member.id})
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(hours=24)
    db.execute(text(
        "INSERT INTO email_verification_tokens (member_id, token, expires_at) VALUES (:mid, :token, :exp)"
    ), {"mid": member.id, "token": token, "exp": expires_at})
    db.commit()
    verify_url = f"{settings.SITE_URL}/members/verify-email?token={token}"
    _send_verification_email(member.email, verify_url, member.nickname)


@router.post("/send-verification", status_code=200)
def send_verification(
    db: Session = Depends(get_db),
    current: Member = Depends(get_current_member),
):
    """로그인한 회원에게 인증 메일 재발송."""
    if current.is_email_verified:
        raise HTTPException(status_code=400, detail="이미 인증된 이메일입니다.")
    if current.social_provider:
        raise HTTPException(status_code=400, detail="소셜 계정은 이메일 인증이 필요하지 않습니다.")
    _issue_and_send_verification(current, db)
    return {"message": "인증 메일을 발송했습니다."}


@router.get("/verify-email", status_code=200)
def verify_email(token: str, db: Session = Depends(get_db)):
    """이메일 인증 링크 처리."""
    row = db.execute(text(
        "SELECT id, member_id, expires_at, used FROM email_verification_tokens WHERE token = :token"
    ), {"token": token}).fetchone()

    if not row or row.used:
        raise HTTPException(status_code=400, detail="유효하지 않거나 이미 사용된 링크입니다.")
    if datetime.utcnow() > row.expires_at:
        raise HTTPException(status_code=400, detail="인증 링크가 만료되었습니다. 마이페이지에서 재발송하세요.")

    db.execute(text(
        "UPDATE members SET is_email_verified = TRUE WHERE id = :id"
    ), {"id": row.member_id})
    db.execute(text(
        "UPDATE email_verification_tokens SET used = TRUE WHERE id = :id"
    ), {"id": row.id})
    db.commit()
    return {"message": "이메일 인증이 완료되었습니다."}


# ── 비밀번호 찾기 ──────────────────────────────────────────

@router.post("/forgot-password", status_code=200)
@limiter.limit("3/minute")
def forgot_password(request: Request, body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """비밀번호 재설정 이메일 발송 (이메일 미존재 여부는 노출하지 않음)."""
    member = db.query(Member).filter(Member.email == body.email, Member.is_active == True).first()
    if not member or not member.hashed_password:
        return {"message": "이메일 주소로 재설정 링크를 보냈습니다."}

    # 기존 미사용 토큰 무효화
    db.execute(text(
        "UPDATE password_reset_tokens SET used = TRUE WHERE member_id = :mid AND used = FALSE"
    ), {"mid": member.id})

    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(hours=1)
    db.execute(text(
        "INSERT INTO password_reset_tokens (member_id, token, expires_at) VALUES (:mid, :token, :exp)"
    ), {"mid": member.id, "token": token, "exp": expires_at})
    db.commit()

    reset_url = f"{settings.SITE_URL}/members/reset-password?token={token}"
    _send_reset_email(member.email, reset_url, member.nickname)
    return {"message": "이메일 주소로 재설정 링크를 보냈습니다."}


@router.post("/reset-password", status_code=200)
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    """토큰으로 비밀번호 재설정."""
    _validate_password(body.password)

    row = db.execute(text(
        "SELECT id, member_id, expires_at, used FROM password_reset_tokens WHERE token = :token"
    ), {"token": body.token}).fetchone()

    if not row or row.used:
        raise HTTPException(status_code=400, detail="유효하지 않거나 이미 사용된 링크입니다.")
    if datetime.utcnow() > row.expires_at:
        raise HTTPException(status_code=400, detail="링크가 만료되었습니다. 다시 요청해 주세요.")

    member = db.query(Member).get(row.member_id)
    if not member or not member.is_active:
        raise HTTPException(status_code=400, detail="유효하지 않은 계정입니다.")

    member.hashed_password = hash_password(body.password)
    db.execute(text(
        "UPDATE password_reset_tokens SET used = TRUE WHERE id = :id"
    ), {"id": row.id})
    db.commit()
    return {"message": "비밀번호가 변경되었습니다. 새 비밀번호로 로그인하세요."}


# ── 관리자 전용 엔드포인트 ────────────────────────────────

@router.get("/admin/stats")
def admin_stats(
    db: Session = Depends(get_db),
    _admin: Admin = Depends(get_current_admin),
):
    """대시보드용 통계."""
    from app.models.board import Post, Comment
    from sqlalchemy import text
    total_members   = db.query(func.count(Member.id)).scalar() or 0
    active_members  = db.query(func.count(Member.id)).filter(Member.is_active == True).scalar() or 0
    total_posts     = db.query(func.count(Post.id)).scalar() or 0
    total_comments  = db.query(func.count(Comment.id)).scalar() or 0
    recent_members  = (
        db.query(Member)
        .filter(Member.is_active == True)
        .order_by(desc(Member.created_at))
        .limit(5)
        .all()
    )
    return {
        "total_members": total_members,
        "active_members": active_members,
        "total_posts": total_posts,
        "total_comments": total_comments,
        "recent_members": [
            {"id": m.id, "name": m.name, "nickname": m.nickname, "email": m.email, "created_at": m.created_at}
            for m in recent_members
        ],
    }


@router.get("/admin/logs")
def admin_logs(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _admin: Admin = Depends(get_current_admin),
):
    """관리 활동 로그 조회."""
    offset = (page - 1) * size
    rows = db.execute(text(
        "SELECT id, admin_identifier, action, target_type, target_id, detail, created_at "
        "FROM admin_logs ORDER BY created_at DESC LIMIT :size OFFSET :offset"
    ), {"size": size, "offset": offset}).fetchall()
    total = db.execute(text("SELECT COUNT(*) FROM admin_logs")).scalar() or 0
    return {
        "items": [
            {
                "id": r.id, "admin": r.admin_identifier, "action": r.action,
                "target_type": r.target_type, "target_id": r.target_id,
                "detail": r.detail,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
        "total": total,
        "page": page,
        "size": size,
    }


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
    log_action(db, _admin.username, "activate_member", "member", member_id, f"{member.email}")
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
    log_action(db, _admin.username, "deactivate_member", "member", member_id, f"{member.email}")
    return _to_admin_out(member, db)


@router.delete("/admin/{member_id}")
def admin_delete_member(
    member_id: int,
    db: Session = Depends(get_db),
    _admin: Admin = Depends(get_current_admin),
):
    member = _get_member_or_404(member_id, db)
    member_email = member.email
    from sqlalchemy import text
    # 댓글 → 게시글 → 회원 순서로 삭제 (FK 제약 우회)
    db.execute(text("DELETE FROM comments WHERE member_id = :id"), {"id": member_id})
    db.execute(text("DELETE FROM posts WHERE member_id = :id"), {"id": member_id})
    db.execute(text("DELETE FROM members WHERE id = :id"), {"id": member_id})
    db.commit()
    log_action(db, _admin.username, "delete_member", "member", member_id, member_email)
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
