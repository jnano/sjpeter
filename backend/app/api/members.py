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
from app.core.auth import verify_password, create_access_token, hash_password, get_current_member, get_current_admin, get_current_super_admin, token_expires_in_seconds
from app.core.config import settings
from app.core.site_settings import get_setting
from app.core.admin_log import log_action, get_admin_identifier
from app.models.member import Member
from app.models.admin import Admin
from app.models.board import Post
from app.models.content import CommunityGroup
from app.models.member_interest import MemberCommunityInterest

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
    name_day_month: Optional[int] = None
    name_day_day: Optional[int] = None
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


def _send_email(to_email: str, subject: str, body: str, html_body: Optional[str] = None) -> None:
    """이메일 발송. SMTP 미설정 시 콘솔 출력.

    html_body 가 주어지면 multipart/alternative 로 plain + HTML 두 가지를 모두 첨부.
    메일 클라이언트가 HTML 을 우선 표시. plain 은 미지원 클라이언트·spam filter 점수용 fallback.
    """
    smtp_user = get_setting("SMTP_USER")
    smtp_password = get_setting("SMTP_PASSWORD")
    if not smtp_user or not smtp_password:
        print(f"[메일 발송] {to_email}\n제목: {subject}\n{body}")
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
        print(f"[SMTP 오류] {e}")
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
    return TokenResponse(
        access_token=create_access_token(str(member.id), role="member", remember=body.remember),
        member=_member_out(member),
        expires_in=token_expires_in_seconds(body.remember),
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
    interest_prompt_completed: bool


class UpdateInterestsRequest(BaseModel):
    community_ids: list[int] = []
    notify_kakao: bool = False


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
        interest_prompt_completed=bool(getattr(current, "interest_prompt_completed", False)),
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
    verify_url = f"{get_setting("SITE_URL", settings.SITE_URL)}/members/verify-email?token={token}"
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

    reset_url = f"{get_setting("SITE_URL", settings.SITE_URL)}/members/reset-password?token={token}"
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


@router.delete("/admin/{member_id}")
def admin_delete_member(
    member_id: int,
    db: Session = Depends(get_db),
    _admin: Admin = Depends(get_current_admin),
):
    member = _get_member_or_404(member_id, db)
    # 자기 자신 삭제 방지
    if isinstance(_admin, Member) and _admin.id == member.id:
        raise HTTPException(status_code=400, detail="자신을 삭제할 수 없습니다.")
    member_email = member.email
    from sqlalchemy import text
    # 댓글 → 게시글 → 회원 순서로 삭제 (FK 제약 우회)
    db.execute(text("DELETE FROM comments WHERE member_id = :id"), {"id": member_id})
    db.execute(text("DELETE FROM posts WHERE member_id = :id"), {"id": member_id})
    db.execute(text("DELETE FROM members WHERE id = :id"), {"id": member_id})
    db.commit()
    log_action(db, get_admin_identifier(_admin), "delete_member", "member", member_id, member_email)
    return {"ok": True}


@router.patch("/admin/{member_id}/reset-password")
def admin_reset_password(
    member_id: int,
    db: Session = Depends(get_db),
    _admin: Admin = Depends(get_current_admin),
):
    """관리자·운영자 — 회원 비밀번호를 초기값(0629)으로 초기화."""
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
