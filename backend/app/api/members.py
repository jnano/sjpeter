import re
import os
import uuid
import secrets
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Request, BackgroundTasks
from fastapi.responses import StreamingResponse
import csv
import io
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_, func, text
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, timedelta
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.core.database import get_db
from app.core.auth import verify_password, create_access_token, hash_password, get_current_member, get_current_admin, get_current_super_admin, token_expires_in_seconds
from app.core.config import settings
from app.core.site_settings import get_setting
from app.api._responses import OkResponse, MessageResponse
from app.core.admin_log import log_action, get_admin_identifier
from app.models.member import Member
from app.models.admin import Admin
from app.models.board import Post
from app.models.content import CommunityGroup
from app.models.member_interest import MemberCommunityInterest
from app.models.board import Comment

limiter = Limiter(key_func=get_remote_address)

AVATAR_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
AVATAR_MAX_SIZE = 5 * 1024 * 1024  # 5 MB
SPECIAL_CHARS = set(r"!@#$%^&*()_+-=[]{}|;':\",./<>?~`\\")


def _validate_password(password: str) -> None:
    """비밀번호 정책 — 8자 이상 + 영문·숫자·특수문자 중 2종류 이상.

    이전엔 '특수문자 1개 필수' 였으나 'aaaaaaaa!' 같은 사전 공격 약한 비밀번호가
    통과되는 문제. 3종 중 2종 강제로 entropy 를 올리되 60대 신자 UX 고려해
    3종 전부는 강제하지 않는다 (보안 vs UX 절충).
    """
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="비밀번호는 8자 이상이어야 합니다.")
    has_alpha = any(c.isalpha() for c in password)
    has_digit = any(c.isdigit() for c in password)
    has_special = any(c in SPECIAL_CHARS for c in password)
    if sum([has_alpha, has_digit, has_special]) < 2:
        raise HTTPException(
            status_code=400,
            detail="비밀번호는 영문·숫자·특수문자 중 2종류 이상을 포함해야 합니다.",
        )

router = APIRouter(prefix="/members", tags=["members"])


# ── 스키마 ────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    # Member.name 은 nullable=True — admin 빠른 등록 시 생략 가능. 공개 회원가입은 client 측에서 필수 처리.
    name: Optional[str] = None
    nickname: str
    phone: Optional[str] = None
    receive_notification: bool = False
    password: str
    # 영명축일 (선택). 입력 시 둘 다 필요.
    name_day_month: Optional[int] = None
    name_day_day: Optional[int] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    remember: bool = False  # "로그인 상태 유지" 체크 시 토큰 만료 7일


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
    # 영명축일 — 둘 다 값일 때 저장, 한 쪽만이면 400, 둘 다 None이면 변경 없음.
    # 비우기는 별도 DELETE /me/name-day 사용.
    name_day_month: Optional[int] = None
    name_day_day: Optional[int] = None


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
    interest_prompt_completed: bool = False
    notify_kakao: bool = False
    notify_vision: bool = False
    notify_meditation: bool = False
    name_day_month: Optional[int] = None
    name_day_day: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class MemberAdminOut(BaseModel):
    id: int
    email: str
    nickname: str
    name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    social_provider: Optional[str] = None
    is_active: bool
    is_admin: bool = False
    is_email_verified: bool = False
    has_password: bool = True   # 비밀번호 설정 여부 (소셜 전용 여부 판단용)
    post_count: int = 0
    name_day_month: Optional[int] = None
    name_day_day: Optional[int] = None
    last_login_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class MemberDetailOut(MemberAdminOut):
    """회원 상세 — 활동 통계 + 관심 분과 포함."""
    comment_count: int = 0
    interest_groups: list[dict] = []   # [{id, label}]
    receive_notification: bool = False
    notify_kakao: bool = False


class MemberAdminUpdate(BaseModel):
    """관리자가 회원 정보를 직접 수정. 이메일·이름·전화·세례명·세례명 축일."""
    email: Optional[str] = None
    name: Optional[str] = None
    nickname: Optional[str] = None
    phone: Optional[str] = None
    name_day_month: Optional[int] = None
    name_day_day: Optional[int] = None


class MemberListResponse(BaseModel):
    items: list[MemberAdminOut]
    total: int
    page: int
    size: int


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    member: MemberOut
    expires_in: int = 12 * 3600  # 토큰 유효 시간(초) — 기본 12시간


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str


def _validate_name_day(month: int, day: int) -> None:
    """영명축일 월·일 유효성 — 1~12 월, 해당 월의 실제 일수 안에 있는지 검사 (윤년 고려 안 함 → 2월은 29일까지 허용)."""
    import calendar
    if not (1 <= month <= 12):
        raise HTTPException(status_code=400, detail="영명축일의 월은 1~12 사이여야 합니다.")
    # 윤년 기준(2020)으로 최대 일수 산출 → 2월 29일 허용
    max_day = calendar.monthrange(2020, month)[1]
    if not (1 <= day <= max_day):
        raise HTTPException(status_code=400, detail=f"{month}월은 1~{max_day}일 사이여야 합니다.")


def _apply_name_day(target, month: Optional[int], day: Optional[int]) -> None:
    """RegisterRequest/UpdateRequest의 name_day_month/day 페어 처리 — 한 쪽만이면 400."""
    if month is None and day is None:
        return  # 변경 없음
    if month is None or day is None:
        raise HTTPException(status_code=400, detail="영명축일은 월·일을 함께 입력해야 합니다.")
    _validate_name_day(month, day)
    target.name_day_month = month
    target.name_day_day = day


def is_smtp_available() -> bool:
    """site_settings 의 SMTP_USER 와 SMTP_PASSWORD 가 모두 설정되어 있으면 True."""
    return bool((get_setting("SMTP_USER") or "").strip() and (get_setting("SMTP_PASSWORD") or "").strip())


_email_logger = logging.getLogger(__name__)


def _send_email(to_email: str, subject: str, body: str, html_body: Optional[str] = None) -> None:
    """이메일 발송. SMTP 미설정 시 logging.info 로 콘솔 기록.

    html_body 가 주어지면 multipart/alternative 로 plain + HTML 두 가지를 모두 첨부.
    메일 클라이언트가 HTML 을 우선 표시. plain 은 미지원 클라이언트·spam filter 점수용 fallback.
    """
    smtp_user = get_setting("SMTP_USER")
    smtp_password = get_setting("SMTP_PASSWORD")
    if not smtp_user or not smtp_password:
        _email_logger.info("[메일 발송 mock] to=%s subject=%s\n%s", to_email, subject, body)
        return
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = get_setting("SMTP_FROM") or smtp_user
        msg["To"] = to_email
        # plain → html 순서 (multipart/alternative 는 마지막 part 가 우선 표시)
        msg.attach(MIMEText(body, "plain", "utf-8"))
        if html_body:
            msg.attach(MIMEText(html_body, "html", "utf-8"))
        smtp_host = get_setting("SMTP_HOST", "smtp.gmail.com")
        smtp_port = int(get_setting("SMTP_PORT", "587"))
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.ehlo()
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(smtp_user, [to_email], msg.as_string())
    except Exception as e:
        _email_logger.error("[SMTP 오류] to=%s: %s", to_email, e)
        raise HTTPException(status_code=500, detail="이메일 발송에 실패했습니다. 잠시 후 다시 시도하세요.")


# ── 메일 HTML 템플릿 (공통) ─────────────────────────────────────────
# 인라인 CSS — 대부분의 메일 클라이언트(특히 Gmail·Naver) 가 외부 stylesheet 를 제거하므로
# style 속성으로 직접 작성. 색상은 brand primary(#1a365d) 고정 (시즌별 변경 영향 X).

def _mail_button_html(label: str, url: str) -> str:
    return (
        f'<a href="{url}" '
        'style="display:inline-block;padding:14px 36px;background:#1a365d;color:#ffffff;'
        'text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;'
        'font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,\'Apple SD Gothic Neo\',sans-serif;">'
        f'{label}</a>'
    )


def _mail_layout_html(title: str, greeting_html: str, body_html: str, button_html: str, footer_note: str = "") -> str:
    """메일 본문 공통 레이아웃 — 깔끔한 단색·단일 컬럼."""
    footer = (
        f'<p style="margin:24px 0 0;color:#9ca3af;font-size:12px;line-height:1.6;">{footer_note}</p>'
        if footer_note else ""
    )
    from app.core.site_settings import get_parish_name, get_parish_name_en
    parish_name = get_parish_name()
    parish_name_en = get_parish_name_en()
    return f"""<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8"><title>{title}</title></head>
<body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Apple SD Gothic Neo',sans-serif;color:#1f2937;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="background:#f5f5f4;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr>
          <td style="background:#1a365d;padding:24px 32px;text-align:center;">
            <div style="color:#ffffff;font-size:16px;font-weight:600;letter-spacing:0.5px;">{parish_name}</div>
            {f'<div style="color:#cbd5e1;font-size:12px;margin-top:4px;">{parish_name_en}</div>' if parish_name_en else ''}
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px 32px;">
            <h1 style="margin:0 0 20px;font-size:20px;color:#1a365d;font-weight:700;">{title}</h1>
            <p style="margin:0 0 12px;font-size:15px;line-height:1.7;">{greeting_html}</p>
            <div style="font-size:15px;line-height:1.7;color:#374151;">{body_html}</div>
            <div style="text-align:center;margin:32px 0 8px;">{button_html}</div>
            {footer}
          </td>
        </tr>
        <tr>
          <td style="background:#fafaf9;padding:18px 32px;text-align:center;border-top:1px solid #e5e7eb;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">© 2026 {parish_name}. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _send_reset_email(to_email: str, reset_url: str, nickname: str) -> None:
    """비밀번호 재설정 이메일 발송 — HTML 버튼 + plain 텍스트 fallback."""
    from app.core.site_settings import get_parish_name
    parish_name = get_parish_name()
    plain = (
        f"안녕하세요, {nickname}님.\n\n비밀번호 재설정 링크가 요청되었습니다.\n"
        f"아래 링크를 클릭하여 새 비밀번호를 설정하세요 (유효 시간: 1시간).\n\n{reset_url}\n\n"
        f"본인이 요청하지 않으셨다면 이 메일을 무시하세요.\n\n{parish_name} 드림"
    )
    html = _mail_layout_html(
        title="비밀번호 재설정",
        greeting_html=f"안녕하세요, <strong>{nickname}</strong> 님.",
        body_html=(
            "비밀번호 재설정이 요청되었습니다.<br>"
            "아래 버튼을 눌러 새 비밀번호를 설정해 주세요. "
            "<span style=\"color:#9ca3af;\">(유효 시간: 1시간)</span>"
        ),
        button_html=_mail_button_html("비밀번호 재설정하기", reset_url),
        footer_note=(
            "본인이 요청하지 않으셨다면 이 메일을 무시해 주세요.<br>"
            f"버튼이 작동하지 않으면 다음 주소를 직접 입력해 주세요: <span style=\"color:#6b7280;word-break:break-all;\">{reset_url}</span>"
        ),
    )
    _send_email(to_email, f"[{parish_name}] 비밀번호 재설정 안내", plain, html_body=html)


def _send_verification_email(to_email: str, verify_url: str, nickname: str) -> None:
    """이메일 인증 메일 발송 — HTML 버튼 + plain 텍스트 fallback."""
    from app.core.site_settings import get_parish_name
    parish_name = get_parish_name()
    plain = (
        f"안녕하세요, {nickname}님.\n\n{parish_name} 홈페이지에 가입해 주셔서 감사합니다.\n"
        f"아래 링크를 클릭하여 이메일 주소를 인증해 주세요 (유효 시간: 24시간).\n\n{verify_url}\n\n"
        f"{parish_name} 드림"
    )
    html = _mail_layout_html(
        title="이메일 주소 인증",
        greeting_html=f"안녕하세요, <strong>{nickname}</strong> 님.",
        body_html=(
            f"{parish_name} 홈페이지에 가입해 주셔서 감사합니다.<br>"
            "아래 버튼을 눌러 이메일 주소를 인증해 주세요. "
            "<span style=\"color:#9ca3af;\">(유효 시간: 24시간)</span>"
        ),
        button_html=_mail_button_html("이메일 인증하기", verify_url),
        footer_note=(
            "본인이 가입하지 않으셨다면 이 메일을 무시해 주세요.<br>"
            f"버튼이 작동하지 않으면 다음 주소를 직접 입력해 주세요: <span style=\"color:#6b7280;word-break:break-all;\">{verify_url}</span>"
        ),
    )
    _send_email(to_email, f"[{parish_name}] 이메일 주소 인증 안내", plain, html_body=html)


# ── 공개 엔드포인트 ──────────────────────────────────────

@router.post("/register", response_model=TokenResponse, status_code=201)
@limiter.limit("5/minute")
def register(request: Request, body: RegisterRequest, db: Session = Depends(get_db)):
    if len(body.nickname) < 2:
        raise HTTPException(status_code=400, detail="닉네임은 2자 이상이어야 합니다.")
    _validate_password(body.password)
    if db.query(Member).filter(Member.email == body.email).first():
        raise HTTPException(status_code=400, detail="이미 사용 중인 이메일입니다.")

    # SMTP 미설정 시 이메일 인증 단계 자동 스킵 — 다른 본당이 SMTP 입력 전이라도 가입 가능
    smtp_ok = is_smtp_available()

    member = Member(
        email=body.email,
        name=body.name.strip() if body.name else None,
        nickname=body.nickname,
        phone=body.phone.strip() if body.phone else None,
        receive_notification=body.receive_notification,
        hashed_password=hash_password(body.password),
        is_email_verified=not smtp_ok,  # SMTP 없으면 가입 즉시 활성, 있으면 메일 인증 대기
    )
    _apply_name_day(member, body.name_day_month, body.name_day_day)
    db.add(member)
    db.commit()
    db.refresh(member)

    # 인증 이메일 발송 — SMTP 설정된 경우에만. 실패해도 가입은 완료
    if smtp_ok:
        try:
            _issue_and_send_verification(member, db)
        except Exception:
            pass

    return TokenResponse(
        access_token=create_access_token(str(member.id), role="member"),
        member=_member_out(member),
        expires_in=token_expires_in_seconds(False),
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
    member.last_login_at = datetime.utcnow()
    db.commit()
    return TokenResponse(
        access_token=create_access_token(str(member.id), role="member", remember=body.remember),
        member=_member_out(member),
        expires_in=token_expires_in_seconds(body.remember),
    )


@router.post("/social-login", response_model=TokenResponse)
def social_login(request: Request, body: SocialLoginRequest, db: Session = Depends(get_db)):
    """소셜 로그인 — Next.js 서버(NextAuth) 만 호출 가능.

    누구나 직접 호출하면 provider_id 임의 박아 타인의 social 계정으로
    로그인 가능한 위험이 있어 2중 방어:
      1) localhost IP 만 허용 (단일 머신 운영 가정)
      2) X-Internal-Secret 헤더가 backend INTERNAL_API_SECRET 과 일치
         (reverse proxy 뒤에서 client.host 가 항상 127.0.0.1 로 보이는 경우 대비)
    NextAuth callbacks 은 server-side 실행이라 BACKEND_INTERNAL_URL +
    process.env.INTERNAL_API_SECRET 으로 backend 호출 → 통과.
    """
    client = request.client.host if request.client else ""
    if client not in ("127.0.0.1", "::1", "localhost"):
        raise HTTPException(status_code=403, detail="Internal endpoint")

    # INTERNAL_API_SECRET 이 설정돼 있으면 헤더 검증. dev 에서 비어있으면 IP 검증만.
    expected = (settings.INTERNAL_API_SECRET or "").strip()
    if expected:
        provided = request.headers.get("X-Internal-Secret", "").strip()
        if not secrets.compare_digest(provided, expected):
            raise HTTPException(status_code=403, detail="Internal endpoint")

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
            # Google·Kakao 가 검증한 이메일이므로 자동 verified 처리
            if not member.is_email_verified:
                member.is_email_verified = True
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
            # social 가입자는 OAuth provider 가 이메일을 검증한 상태 → 자동 verified
            is_email_verified=True,
        )
        db.add(member)
        db.commit()
        db.refresh(member)

    if not member.is_active:
        raise HTTPException(status_code=403, detail="비활성화된 계정입니다.")

    member.last_login_at = datetime.utcnow()
    db.commit()

    return TokenResponse(
        access_token=create_access_token(str(member.id), role="member"),
        member=_member_out(member),
        expires_in=token_expires_in_seconds(False),
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
        interest_prompt_completed=bool(getattr(member, "interest_prompt_completed", False)),
        notify_kakao=bool(getattr(member, "notify_kakao", False)),
        notify_vision=bool(getattr(member, "notify_vision", False)),
        notify_meditation=bool(getattr(member, "notify_meditation", False)),
        name_day_month=getattr(member, "name_day_month", None),
        name_day_day=getattr(member, "name_day_day", None),
        created_at=member.created_at,
    )


@router.get("/me", response_model=MemberOut)
def get_me(current: Member = Depends(get_current_member)):
    return _member_out(current)


# ── 관심 분과/단체 ────────────────────────────────────────

class InterestGroupOut(BaseModel):
    id: int
    name: str
    parent_id: Optional[int] = None
    slug: Optional[str] = None

    class Config:
        from_attributes = True


class MyInterestsOut(BaseModel):
    groups: list[InterestGroupOut]
    notify_kakao: bool
    notify_vision: bool
    notify_meditation: bool
    interest_prompt_completed: bool
    has_phone: bool  # 카톡 알림 발송 가능 여부 — 프론트 토글 가드용


class UpdateInterestsRequest(BaseModel):
    community_ids: list[int] = []
    notify_kakao: bool = False
    notify_vision: bool = False
    notify_meditation: bool = False


def _expand_with_ancestors(db: Session, ids: list[int]) -> list[int]:
    """선택된 community_group id들에 대해 부모(분과)를 자동 포함하여 반환.
    트리는 최대 2계층(분과 → 소속단체)이지만 안전상 N계층까지 따라간다."""
    if not ids:
        return []
    result: set[int] = set()
    pending = list(set(ids))
    # 한 쿼리에 모든 노드 조회 (간단)
    visited: set[int] = set()
    while pending:
        rows = db.query(CommunityGroup.id, CommunityGroup.parent_id).filter(
            CommunityGroup.id.in_(pending)
        ).all()
        next_round: list[int] = []
        for gid, parent_id in rows:
            if gid in visited:
                continue
            visited.add(gid)
            result.add(gid)
            if parent_id and parent_id not in visited:
                next_round.append(parent_id)
        pending = next_round
    return sorted(result)


@router.get("/me/interests", response_model=MyInterestsOut)
def get_my_interests(
    db: Session = Depends(get_db),
    current: Member = Depends(get_current_member),
):
    rows = (
        db.query(CommunityGroup)
        .join(MemberCommunityInterest, MemberCommunityInterest.community_group_id == CommunityGroup.id)
        .filter(MemberCommunityInterest.member_id == current.id)
        .order_by(CommunityGroup.sort_order, CommunityGroup.id)
        .all()
    )
    return MyInterestsOut(
        groups=[InterestGroupOut.model_validate(g) for g in rows],
        notify_kakao=bool(getattr(current, "notify_kakao", False)),
        notify_vision=bool(getattr(current, "notify_vision", False)),
        notify_meditation=bool(getattr(current, "notify_meditation", False)),
        interest_prompt_completed=bool(getattr(current, "interest_prompt_completed", False)),
        has_phone=bool((current.phone or "").strip()),
    )


@router.put("/me/interests", response_model=MyInterestsOut)
def update_my_interests(
    body: UpdateInterestsRequest,
    db: Session = Depends(get_db),
    current: Member = Depends(get_current_member),
):
    """관심분과 일괄 덮어쓰기. 단체만 선택해도 부모 분과 자동 포함하여 저장."""
    expanded = _expand_with_ancestors(db, body.community_ids)
    # 존재 검증 — 잘못된 id는 무시 (보안: 외부 입력 신뢰 안 함)
    valid_ids = [
        r[0] for r in db.query(CommunityGroup.id).filter(CommunityGroup.id.in_(expanded)).all()
    ] if expanded else []
    db.query(MemberCommunityInterest).filter(
        MemberCommunityInterest.member_id == current.id
    ).delete(synchronize_session=False)
    for gid in valid_ids:
        db.add(MemberCommunityInterest(member_id=current.id, community_group_id=gid))
    current.notify_kakao = bool(body.notify_kakao)
    current.notify_vision = bool(body.notify_vision)
    current.notify_meditation = bool(body.notify_meditation)
    current.interest_prompt_completed = True
    db.commit()
    db.refresh(current)
    return get_my_interests(db=db, current=current)


@router.post("/me/interests/skip", status_code=204)
def skip_interest_prompt(
    db: Session = Depends(get_db),
    current: Member = Depends(get_current_member),
):
    """'관심분과 선택 안함' — onboarding 응답만 마킹하고 관심·알림 설정은 비워둔다."""
    current.interest_prompt_completed = True
    db.commit()
    return None


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
    _apply_name_day(current, body.name_day_month, body.name_day_day)
    db.commit()
    db.refresh(current)
    return _member_out(current)


@router.delete("/me/name-day", response_model=MemberOut)
def clear_my_name_day(db: Session = Depends(get_db), current: Member = Depends(get_current_member)):
    """영명축일 비우기 — 둘 다 NULL로 초기화."""
    current.name_day_month = None
    current.name_day_day = None
    db.commit()
    db.refresh(current)
    return _member_out(current)


@router.get("/me/export")
def export_my_data(db: Session = Depends(get_db), current: Member = Depends(get_current_member)):
    """v1.5.456 — 개인정보 보호법(KISA) 정보주체 권리: 회원 본인 데이터 다운로드.

    프로필 + 작성한 글·댓글 + 관심 분과 + 알림 설정을 JSON 으로 반환.
    응답은 Content-Disposition 으로 첨부파일 다운로드 유도.
    """
    from datetime import datetime
    from fastapi.responses import JSONResponse
    from app.models.board import Post, Comment

    # 본인 글
    posts = db.query(Post).filter(Post.member_id == current.id).all()
    posts_data = [{
        "id": p.id,
        "board_slug": p.board.slug if p.board else None,
        "title": p.title,
        "body": p.body,
        "view_count": p.view_count,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    } for p in posts]

    # 본인 댓글
    comments = db.query(Comment).filter(Comment.member_id == current.id).all()
    comments_data = [{
        "id": c.id,
        "post_id": c.post_id,
        "body": c.body,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    } for c in comments]

    # 관심 분과 (v1.5.~ member_interests)
    interests_data: list[dict] = []
    try:
        from app.models.member_interest import MemberInterest
        rows = db.query(MemberInterest).filter(MemberInterest.member_id == current.id).all()
        interests_data = [{"community_group_id": r.community_group_id} for r in rows]
    except Exception:
        pass

    payload = {
        "exported_at": datetime.utcnow().isoformat() + "Z",
        "exported_for": "본인 데이터 전체 다운로드 (개인정보 보호법 제35조)",
        "profile": {
            "id": current.id,
            "email": current.email,
            "nickname": current.nickname,
            "phone": current.phone,
            "baptismal_name": current.baptismal_name,
            "name_day_month": current.name_day_month,
            "name_day_day": current.name_day_day,
            "avatar_url": current.avatar_url,
            "created_at": current.created_at.isoformat() if current.created_at else None,
            "last_login_at": current.last_login_at.isoformat() if getattr(current, "last_login_at", None) else None,
        },
        "posts": posts_data,
        "comments": comments_data,
        "interests": interests_data,
    }
    filename = f"my-data-{current.id}-{datetime.utcnow().strftime('%Y%m%d')}.json"
    return JSONResponse(
        content=payload,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/me", status_code=204)
def delete_me(
    db: Session = Depends(get_db),
    current: Member = Depends(get_current_member),
):
    """회원 탈퇴 — 소프트 삭제.

    이전엔 댓글·게시글·members row 까지 hard DELETE 했으나, 다른 회원이
    탈퇴 회원의 글에 단 답글·댓글 트리가 끊기는 문제가 있었다.
    CLAUDE.md "소프트 삭제: is_deleted 필드로 관리" 원칙에도 위배.

    이제는 PII 만 제거하고 글·댓글은 유지:
      - is_active=FALSE (로그인 차단)
      - nickname → "탈퇴 회원" (게시판에서 마스킹 표시)
      - email → "deleted-{id}@deleted.local" (UNIQUE NOT NULL 충족 + 재가입 가능)
      - name·phone·hashed_password·social_*·avatar_url 모두 NULL
      - avatar 파일은 디스크에서 삭제
    """
    # 아바타 파일 삭제 (디스크에서)
    if current.avatar_url and current.avatar_url.startswith("/uploads/avatars/"):
        old_path = os.path.join(settings.UPLOAD_DIR, current.avatar_url.lstrip("/uploads/"))
        if os.path.exists(old_path):
            try:
                os.remove(old_path)
            except Exception:
                pass

    current.is_active = False
    current.nickname = "탈퇴 회원"
    current.email = f"deleted-{current.id}@deleted.local"
    current.name = None
    current.phone = None
    current.hashed_password = None
    current.social_provider = None
    current.social_id = None
    current.avatar_url = None
    current.receive_notification = False
    current.notify_kakao = False
    current.notify_vision = False
    current.notify_meditation = False
    current.is_email_verified = False
    current.interest_prompt_completed = False
    current.name_day_month = None
    current.name_day_day = None
    db.commit()


def _is_image_magic(data: bytes) -> bool:
    """업로드된 파일의 매직 바이트로 이미지 여부를 검증.

    확장자만으론 '.jpg' 로 이름만 바꾼 임의 파일을 막을 수 없어 추가 검증.
    JPEG / PNG / GIF / WebP 4종을 인정 (admin 페이지·신자 프로필 사진 충분).
    """
    if len(data) < 12:
        return False
    if data.startswith(b"\xff\xd8\xff"):  # JPEG
        return True
    if data.startswith(b"\x89PNG\r\n\x1a\n"):  # PNG
        return True
    if data.startswith(b"GIF87a") or data.startswith(b"GIF89a"):  # GIF
        return True
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":  # WebP
        return True
    return False


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
    if not _is_image_magic(data):
        raise HTTPException(status_code=400, detail="유효한 이미지 파일이 아닙니다.")

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
    verify_url = f"{get_setting("SITE_URL", settings.SITE_URL)}/members/verify-email?token={token}"
    _send_verification_email(member.email, verify_url, member.nickname)


@router.post("/send-verification", status_code=200, response_model=MessageResponse)
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


@router.get("/verify-email", status_code=200, response_model=MessageResponse)
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

def _create_and_send_reset_token(member_id: int) -> None:
    """비밀번호 재설정 토큰 발급 + 이메일 발송 — background task 용.

    별도 DB 세션을 열어 응답 흐름과 분리한다. 응답 latency 가 회원 존재
    여부에 따라 차이 나지 않도록 (timing attack 차단) forgot_password 는
    이 함수를 BackgroundTasks 로 위임하고 즉시 응답한다.
    """
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        m = db.get(Member, member_id)
        if not m or not m.is_active or not m.hashed_password:
            return

        db.execute(text(
            "UPDATE password_reset_tokens SET used = TRUE WHERE member_id = :mid AND used = FALSE"
        ), {"mid": m.id})

        token = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(hours=1)
        db.execute(text(
            "INSERT INTO password_reset_tokens (member_id, token, expires_at) VALUES (:mid, :token, :exp)"
        ), {"mid": m.id, "token": token, "exp": expires_at})
        db.commit()

        reset_url = f"{get_setting('SITE_URL', settings.SITE_URL)}/members/reset-password?token={token}"
        try:
            _send_reset_email(m.email, reset_url, m.nickname)
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning("[forgot-password] 메일 발송 실패 member_id=%s: %s", m.id, exc)
    finally:
        db.close()


@router.post("/forgot-password", status_code=200, response_model=MessageResponse)
@limiter.limit("3/minute")
def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """비밀번호 재설정 이메일 발송 — 회원 존재 여부 노출하지 않음.

    응답 latency 가 회원 존재 여부에 영향 받지 않도록 토큰 생성·이메일
    발송을 BackgroundTasks 로 위임한다 (timing attack 으로 회원 enumeration
    하는 시도를 차단).
    """
    member = db.query(Member).filter(Member.email == body.email, Member.is_active == True).first()
    if member and member.hashed_password:
        background_tasks.add_task(_create_and_send_reset_token, member.id)
    # 회원 존재·미존재 모두 같은 메시지·같은 흐름 — latency 균일.
    return {"message": "이메일 주소로 재설정 링크를 보냈습니다."}


@router.post("/reset-password", status_code=200, response_model=MessageResponse)
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

    member = db.get(Member, row.member_id)
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
    inactive_months: Optional[int] = Query(
        None,
        ge=1,
        le=60,
        description="N개월 이상 미접속 회원만 (last_login_at IS NULL 도 포함)",
    ),
    db: Session = Depends(get_db),
    _admin: Admin = Depends(get_current_admin),
):
    query = db.query(Member)

    if q:
        like = f"%{q}%"
        query = query.filter(or_(Member.email.ilike(like), Member.nickname.ilike(like)))

    if is_active is not None:
        query = query.filter(Member.is_active == is_active)

    # 장기 미접속 필터 — 운영자가 비활성 전환 대상 회원을 찾을 때 사용.
    # 30일/월 근사. last_login_at NULL (한 번도 로그인 안 함) 도 포함.
    if inactive_months is not None:
        threshold = datetime.utcnow() - timedelta(days=inactive_months * 30)
        query = query.filter(
            or_(Member.last_login_at == None, Member.last_login_at < threshold)
        )

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
            name=m.name,
            phone=m.phone,
            avatar_url=m.avatar_url,
            social_provider=m.social_provider,
            is_active=m.is_active,
            is_admin=m.is_admin,
            is_email_verified=bool(m.is_email_verified),
            has_password=m.hashed_password is not None,
            post_count=post_counts.get(m.id, 0),
            name_day_month=m.name_day_month,
            name_day_day=m.name_day_day,
            last_login_at=m.last_login_at,
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
        name=body.name.strip() if body.name else None,
        nickname=body.nickname,
        hashed_password=hash_password(body.password),
        is_active=True,
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    log_action(db, get_admin_identifier(_admin), "admin_create_member", "member", member.id, member.email)
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
    log_action(db, get_admin_identifier(_admin), "activate_member", "member", member_id, f"{member.email}")
    return _to_admin_out(member, db)


@router.put("/admin/{member_id}/deactivate", response_model=MemberAdminOut)
def admin_deactivate_member(
    member_id: int,
    db: Session = Depends(get_db),
    _admin: Admin = Depends(get_current_admin),
):
    member = _get_member_or_404(member_id, db)
    # 자기 자신 비활성화 방지 — 세션 무효화로 admin 페이지 접근 자체가 막힘.
    # 운영자(is_admin=True 회원)는 자기 자신과 같은 Member 행이므로 가드 필수.
    if isinstance(_admin, Member) and _admin.id == member.id:
        raise HTTPException(status_code=400, detail="자신을 비활성화할 수 없습니다.")
    member.is_active = False
    db.commit()
    db.refresh(member)
    log_action(db, get_admin_identifier(_admin), "deactivate_member", "member", member_id, f"{member.email}")
    return _to_admin_out(member, db)


@router.delete("/admin/{member_id}", response_model=OkResponse)
def admin_delete_member(
    member_id: int,
    db: Session = Depends(get_db),
    _admin: Admin = Depends(get_current_admin),
):
    """admin 이 회원을 삭제. 본인 탈퇴(DELETE /me)와 동일한 소프트 삭제 적용.

    이전엔 hard DELETE 라 회원의 글·댓글이 모두 사라져 게시판 흐름이 끊겼다.
    이제는 PII 만 제거하고 글·댓글은 보존, nickname 은 '탈퇴 회원' 으로 마스킹.
    """
    member = _get_member_or_404(member_id, db)
    # 자기 자신 삭제 방지
    if isinstance(_admin, Member) and _admin.id == member.id:
        raise HTTPException(status_code=400, detail="자신을 삭제할 수 없습니다.")
    original_email = member.email

    # 아바타 파일 삭제
    if member.avatar_url and member.avatar_url.startswith("/uploads/avatars/"):
        old_path = os.path.join(settings.UPLOAD_DIR, member.avatar_url.lstrip("/uploads/"))
        if os.path.exists(old_path):
            try:
                os.remove(old_path)
            except Exception:
                pass

    member.is_active = False
    member.nickname = "탈퇴 회원"
    member.email = f"deleted-{member.id}@deleted.local"
    member.name = None
    member.phone = None
    member.hashed_password = None
    member.social_provider = None
    member.social_id = None
    member.avatar_url = None
    member.receive_notification = False
    member.notify_kakao = False
    member.notify_vision = False
    member.notify_meditation = False
    member.is_email_verified = False
    member.interest_prompt_completed = False
    member.name_day_month = None
    member.name_day_day = None
    member.is_admin = False  # 권한도 회수
    db.commit()
    log_action(db, get_admin_identifier(_admin), "delete_member", "member", member_id, original_email)
    return {"ok": True}


@router.patch("/admin/{member_id}/reset-password")
def admin_reset_password(
    member_id: int,
    db: Session = Depends(get_db),
    _admin: Admin = Depends(get_current_admin),
):
    """관리자·운영자 — 회원 비밀번호를 무작위 임시 패스워드로 초기화.

    임시 패스워드는 응답 본문에 1회만 표시한다. 관리자는 안전한 경로(전화·
    SMS·대면)로 회원에게 전달하고, 회원은 첫 로그인 직후 마이페이지에서 본인
    선택 비밀번호로 변경하도록 안내한다.

    이전엔 고정 문자열 '0629' 를 default 로 박았으나, 코드에 평문이 노출되어
    누구나 알 수 있는 값이 되는 위험 때문에 random 발급으로 전환.
    """
    member = _get_member_or_404(member_id, db)
    temp_pw = secrets.token_urlsafe(8)  # url-safe 11자 (8 bytes 인코딩)
    member.hashed_password = hash_password(temp_pw)
    db.commit()
    log_action(db, get_admin_identifier(_admin), "admin_reset_password", "member", member_id, member.email)
    return {
        "ok": True,
        "temp_password": temp_pw,
        "message": "임시 비밀번호를 안전한 경로로 회원에게 전달하세요. 첫 로그인 후 변경을 권고합니다.",
    }


@router.patch("/admin/{member_id}/grant-admin", response_model=MemberAdminOut)
def grant_admin(
    member_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_super_admin),
):
    """슈퍼 관리자만 호출 가능 — 회원에게 관리 권한 부여.
    비밀번호가 없는 소셜 회원도 지정 가능하나, 실제 관리자 패널 로그인은
    비밀번호 설정 후에만 가능하다."""
    member = _get_member_or_404(member_id, db)
    member.is_admin = True
    db.commit()
    db.refresh(member)
    log_action(db, get_admin_identifier(admin), "grant_admin", "member", member.id, member.email)
    return _to_admin_out(member, db)


@router.patch("/admin/{member_id}/revoke-admin", response_model=MemberAdminOut)
def revoke_admin(
    member_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_super_admin),
):
    """슈퍼 관리자만 호출 가능 — 회원 관리 권한 회수."""
    member = _get_member_or_404(member_id, db)
    member.is_admin = False
    db.commit()
    db.refresh(member)
    log_action(db, get_admin_identifier(admin), "revoke_admin", "member", member.id, member.email)
    return _to_admin_out(member, db)


# ── v1.5.269: 회원 상세·수정·CSV export ─────────────────────

@router.get("/admin/export.csv")
def admin_export_csv(
    q: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    _admin: Admin = Depends(get_current_super_admin),
):
    """현재 필터 조건의 회원 전체를 CSV 로 내려준다. 외부 메일링·통계 용도.
    개인정보 일괄 노출이라 super-admin 전용."""
    query = db.query(Member)
    if q:
        like = f"%{q}%"
        query = query.filter(or_(Member.email.ilike(like), Member.nickname.ilike(like)))
    if is_active is not None:
        query = query.filter(Member.is_active == is_active)
    members = query.order_by(desc(Member.created_at)).all()

    buf = io.StringIO()
    # 한글 깨짐 방지 — Excel 호환 BOM
    buf.write("﻿")
    writer = csv.writer(buf)
    writer.writerow([
        "id", "이메일", "이름", "세례명", "전화", "활성", "운영자", "이메일인증",
        "가입방법", "마지막 로그인", "가입일",
    ])
    for m in members:
        writer.writerow([
            m.id,
            m.email or "",
            m.name or "",
            m.nickname or "",
            m.phone or "",
            "활성" if m.is_active else "비활성",
            "예" if m.is_admin else "아니오",
            "예" if m.is_email_verified else "아니오",
            m.social_provider or "이메일",
            m.last_login_at.strftime("%Y-%m-%d %H:%M") if m.last_login_at else "",
            m.created_at.strftime("%Y-%m-%d %H:%M") if m.created_at else "",
        ])
    csv_bytes = buf.getvalue().encode("utf-8")
    log_action(db, get_admin_identifier(_admin), "export_members_csv", "member", None, f"{len(members)}건")
    return StreamingResponse(
        io.BytesIO(csv_bytes),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="members.csv"'},
    )


@router.get("/admin/{member_id}", response_model=MemberDetailOut)
def admin_get_member(
    member_id: int,
    db: Session = Depends(get_db),
    _admin: Admin = Depends(get_current_super_admin),
):
    """회원 상세 — 활동 통계(글·댓글 수) + 관심 분과 포함. super-admin 전용
    (개인정보 + 관심 분과 + 활동 이력을 단일 화면에 노출)."""
    member = _get_member_or_404(member_id, db)
    post_count = db.query(func.count(Post.id)).filter(Post.member_id == member.id).scalar() or 0
    comment_count = db.query(func.count(Comment.id)).filter(Comment.member_id == member.id).scalar() or 0
    interests = (
        db.query(CommunityGroup.id, CommunityGroup.name)
        .join(MemberCommunityInterest, MemberCommunityInterest.community_group_id == CommunityGroup.id)
        .filter(MemberCommunityInterest.member_id == member.id)
        .order_by(CommunityGroup.id.asc())
        .all()
    )
    interest_groups = [{"id": i.id, "label": i.name} for i in interests]
    return MemberDetailOut(
        id=member.id,
        email=member.email,
        nickname=member.nickname,
        name=member.name,
        phone=member.phone,
        avatar_url=member.avatar_url,
        social_provider=member.social_provider,
        is_active=member.is_active,
        is_admin=member.is_admin,
        is_email_verified=bool(member.is_email_verified),
        has_password=member.hashed_password is not None,
        post_count=post_count,
        comment_count=comment_count,
        interest_groups=interest_groups,
        receive_notification=bool(member.receive_notification),
        notify_kakao=bool(member.notify_kakao),
        name_day_month=member.name_day_month,
        name_day_day=member.name_day_day,
        last_login_at=member.last_login_at,
        created_at=member.created_at,
    )


@router.patch("/admin/{member_id}", response_model=MemberAdminOut)
def admin_update_member(
    member_id: int,
    body: MemberAdminUpdate,
    db: Session = Depends(get_db),
    _admin: Admin = Depends(get_current_super_admin),
):
    """관리자가 회원 기본 정보를 수정한다. 이메일은 중복 검사 후 변경.
    회원 개인정보 수정이라 super-admin 전용."""
    member = _get_member_or_404(member_id, db)
    data = body.model_dump(exclude_unset=True)
    changed: list[str] = []

    if "email" in data and data["email"] and data["email"] != member.email:
        if db.query(Member).filter(Member.email == data["email"], Member.id != member.id).first():
            raise HTTPException(status_code=400, detail="이미 사용 중인 이메일입니다.")
        member.email = data["email"]
        changed.append("email")

    if "nickname" in data and data["nickname"]:
        if len(data["nickname"]) < 2:
            raise HTTPException(status_code=400, detail="세례명/닉네임은 2자 이상이어야 합니다.")
        member.nickname = data["nickname"]
        changed.append("nickname")

    for field in ("name", "phone", "name_day_month", "name_day_day"):
        if field in data:
            setattr(member, field, data[field])
            changed.append(field)

    db.commit()
    db.refresh(member)
    log_action(
        db, get_admin_identifier(_admin), "admin_update_member", "member", member.id,
        f"{member.email} ({','.join(changed) or '변경없음'})",
    )
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
        name=member.name,
        phone=member.phone,
        avatar_url=member.avatar_url,
        social_provider=member.social_provider,
        is_active=member.is_active,
        is_admin=member.is_admin,
        is_email_verified=bool(member.is_email_verified),
        has_password=member.hashed_password is not None,
        post_count=post_count,
        name_day_month=member.name_day_month,
        name_day_day=member.name_day_day,
        last_login_at=member.last_login_at,
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
