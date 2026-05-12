from datetime import datetime, timedelta
from typing import Optional
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer()
optional_bearer_scheme = HTTPBearer(auto_error=False)

ALGORITHM = "HS256"
SESSION_TOKEN_HOURS = 12          # 기본 세션: 12시간 (브라우저 닫아도 다음날 만료)
REMEMBER_TOKEN_DAYS = 7           # "로그인 상태 유지" 체크 시: 7일


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(sub: str, role: str = "admin", remember: bool = False) -> str:
    """role: 'admin' | 'member'
    remember=False → 12시간, remember=True → 7일."""
    if remember:
        expire = datetime.utcnow() + timedelta(days=REMEMBER_TOKEN_DAYS)
    else:
        expire = datetime.utcnow() + timedelta(hours=SESSION_TOKEN_HOURS)
    return jwt.encode(
        {"sub": sub, "role": role, "exp": expire},
        settings.SECRET_KEY,
        algorithm=ALGORITHM,
    )


def token_expires_in_seconds(remember: bool = False) -> int:
    """클라이언트가 absolute 만료 시각을 계산할 수 있도록 초 단위 반환."""
    if remember:
        return REMEMBER_TOKEN_DAYS * 24 * 3600
    return SESSION_TOKEN_HOURS * 3600


def _decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="유효하지 않은 인증 정보입니다.")


def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
):
    """슈퍼 관리자(admin) 또는 위임 관리자(is_admin=True 회원) 모두 허용."""
    from app.models.admin import Admin
    from app.models.member import Member

    payload = _decode_token(credentials.credentials)
    role = payload.get("role")

    if role == "admin":
        admin = db.query(Admin).filter(Admin.username == payload.get("sub")).first()
        if not admin:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="관리자를 찾을 수 없습니다.")
        return admin

    if role == "member":
        member = db.query(Member).filter(
            Member.id == int(payload.get("sub", 0)),
            Member.is_admin == True,
            Member.is_active == True,
        ).first()
        if not member:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="관리자 권한이 필요합니다.")
        return member

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="관리자 권한이 필요합니다.")


def get_current_super_admin(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
):
    """슈퍼 관리자(admin 계정)만 허용 — 권한 부여·회수 등 민감 작업용."""
    from app.models.admin import Admin

    payload = _decode_token(credentials.credentials)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="최고 관리자 권한이 필요합니다.")

    admin = db.query(Admin).filter(Admin.username == payload.get("sub")).first()
    if not admin:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="관리자를 찾을 수 없습니다.")
    return admin


def get_optional_member(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_bearer_scheme),
    db: Session = Depends(get_db),
) -> Optional[object]:
    """토큰이 없으면 None, 있으면 Member 반환 (비회원 허용 엔드포인트용)."""
    if not credentials:
        return None
    try:
        from app.models.member import Member
        payload = jwt.decode(credentials.credentials, settings.SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("role") != "member":
            return None
        return db.query(Member).filter(
            Member.id == int(payload.get("sub", 0)),
            Member.is_active == True,
        ).first()
    except Exception:
        return None


def get_current_author(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
):
    """게시글 작성·수정·삭제: 로그인 회원 또는 슈퍼관리자 모두 허용.
    슈퍼관리자는 None 반환 → member_id=None 으로 게시글 생성."""
    from app.models.member import Member
    from app.models.admin import Admin

    payload = _decode_token(credentials.credentials)
    role = payload.get("role")

    if role == "member":
        member = db.query(Member).filter(
            Member.id == int(payload.get("sub", 0)),
            Member.is_active == True,
        ).first()
        if not member:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="회원을 찾을 수 없습니다.")
        return member

    if role == "admin":
        admin = db.query(Admin).filter(Admin.username == payload.get("sub")).first()
        if admin:
            return None  # 슈퍼관리자: member_id 없이 처리

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="로그인이 필요합니다.")


def get_current_member(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
):
    from app.models.member import Member

    payload = _decode_token(credentials.credentials)
    if payload.get("role") != "member":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="회원 로그인이 필요합니다.")

    member = db.query(Member).filter(
        Member.id == int(payload.get("sub", 0)),
        Member.is_active == True,
    ).first()
    if not member:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="회원을 찾을 수 없습니다.")
    return member
