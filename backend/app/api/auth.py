from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.core.database import get_db
from app.core.auth import verify_password, create_access_token, _decode_token
from app.models.admin import Admin

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/auth", tags=["auth"])
bearer_scheme = HTTPBearer()


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AdminLoginRequest(BaseModel):
    identifier: str   # admin 아이디 또는 위임 관리자 이메일
    password: str


class AdminLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str           # "admin" | "member"
    display_name: str
    is_super_admin: bool


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    """기존 admin 계정 전용 로그인 (하위 호환)."""
    admin = db.query(Admin).filter(Admin.username == body.username).first()
    if not admin or not verify_password(body.password, admin.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="아이디 또는 비밀번호가 올바르지 않습니다.",
        )
    token = create_access_token(admin.username)
    return LoginResponse(access_token=token)


@router.post("/admin-login", response_model=AdminLoginResponse)
@limiter.limit("10/minute")
def admin_login_unified(request: Request, body: AdminLoginRequest, db: Session = Depends(get_db)):
    """슈퍼 관리자(admin 아이디) 또는 위임 관리자(이메일) 통합 로그인."""
    from app.models.member import Member

    # 1. Admin 테이블에서 username 조회
    admin = db.query(Admin).filter(Admin.username == body.identifier).first()
    if admin and verify_password(body.password, admin.hashed_password):
        token = create_access_token(sub=admin.username, role="admin")
        from app.core.admin_log import log_action
        log_action(db, admin.username, "admin_login", detail="슈퍼관리자 로그인")
        return AdminLoginResponse(
            access_token=token,
            role="admin",
            display_name=admin.username,
            is_super_admin=True,
        )

    # 2. Member 테이블에서 이메일 조회 (is_admin=True 회원만)
    member = db.query(Member).filter(
        Member.email == body.identifier,
        Member.is_admin == True,
        Member.is_active == True,
    ).first()
    if member and member.hashed_password and verify_password(body.password, member.hashed_password):
        token = create_access_token(sub=str(member.id), role="member")
        return AdminLoginResponse(
            access_token=token,
            role="member",
            display_name=member.nickname,
            is_super_admin=False,
        )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="아이디/이메일 또는 비밀번호가 올바르지 않습니다.",
    )


@router.post("/admin-session", response_model=AdminLoginResponse)
def exchange_member_token_for_admin(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
):
    """회원 JWT로 어드민 세션 토큰을 발급한다 (is_admin=True 회원 전용)."""
    from app.models.member import Member

    payload = _decode_token(credentials.credentials)
    if payload.get("role") != "member":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="회원 토큰이 필요합니다.")

    member = db.query(Member).filter(
        Member.id == int(payload.get("sub", 0)),
        Member.is_admin == True,
        Member.is_active == True,
    ).first()
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="관리자 권한이 없습니다.")

    token = create_access_token(sub=str(member.id), role="member")
    return AdminLoginResponse(
        access_token=token,
        role="member",
        display_name=member.nickname,
        is_super_admin=False,
    )


@router.get("/admin-me")
def get_admin_me(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
):
    """현재 로그인한 관리자 정보 반환."""
    from app.models.member import Member

    payload = _decode_token(credentials.credentials)
    role = payload.get("role")

    if role == "admin":
        admin = db.query(Admin).filter(Admin.username == payload.get("sub")).first()
        if admin:
            return {"display_name": admin.username, "role": "admin", "is_super_admin": True}

    if role == "member":
        member = db.query(Member).filter(
            Member.id == int(payload.get("sub", 0)),
            Member.is_admin == True,
            Member.is_active == True,
        ).first()
        if member:
            return {"display_name": member.nickname, "role": "member", "is_super_admin": False}

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="유효하지 않은 인증 정보입니다.")
