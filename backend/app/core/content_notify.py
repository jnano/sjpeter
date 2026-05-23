"""사목지표·주일말씀 알림 fanout (v1.5.313).

- members.notify_vision / notify_meditation 가 TRUE 인 회원에게:
  1) notifications 테이블에 site 알림 insert (kind='vision' | 'meditation')
  2) 이메일 발송 (SMTP 미설정 시 조용히 건너뜀)

발송 시점: admin 이 사목지표·주일말씀을 등록할 때 "알림 발송" 체크박스가 ON 인 경우.
"""
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Literal, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.site_settings import get_setting, get_parish_name

logger = logging.getLogger(__name__)

ContentKind = Literal["vision", "meditation"]

_KIND_META = {
    "vision": {
        "flag": "notify_vision",
        "label": "사목지표",
        "path": "/vision",
    },
    "meditation": {
        "flag": "notify_meditation",
        "label": "주일말씀",
        "path": "/meditation",
    },
}


def _build_email_html(kind: ContentKind, title: str, body_preview: Optional[str], href: str) -> str:
    meta = _KIND_META[kind]
    parish = get_parish_name()
    preview = (body_preview or "").strip()
    preview_block = (
        f'<p style="margin:18px 0 0;color:#555;font-size:14px;line-height:1.7;white-space:pre-wrap;">{preview[:400]}</p>'
        if preview else ""
    )
    return f"""<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f0eb;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0eb;"><tr><td align="center" style="padding:40px 16px;">
<table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
<tr><td style="background:#1b3d6e;padding:32px;text-align:center;">
<p style="margin:0 0 8px;color:#c9a84c;font-size:13px;letter-spacing:2px;">{meta["label"]}</p>
<h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:bold;">{parish}</h1>
</td></tr>
<tr><td style="padding:32px;">
<p style="margin:0 0 6px;color:#999;font-size:13px;">새 {meta["label"]}이(가) 등록되었습니다.</p>
<p style="margin:0;color:#1b3d6e;font-size:20px;font-weight:bold;">{title}</p>
{preview_block}
<table cellpadding="0" cellspacing="0" style="margin:28px auto 0;"><tr>
<td align="center" style="background:#1b3d6e;border-radius:8px;">
<a href="{href}" style="display:block;padding:13px 36px;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;letter-spacing:0.5px;">{meta["label"]} 보기</a>
</td></tr></table>
</td></tr>
<tr><td style="background:#f9f5f0;padding:18px 32px;text-align:center;border-top:1px solid #e5ddd3;">
<p style="margin:0;color:#aaa;font-size:11px;line-height:1.8;">{parish} 홈페이지 알림 수신에 동의하신 분께 발송됩니다.</p>
</td></tr>
</table></td></tr></table></body></html>"""


def _send_email_batch(emails: list[str], subject: str, html: str) -> int:
    if not emails:
        return 0
    smtp_user = get_setting("SMTP_USER")
    smtp_password = get_setting("SMTP_PASSWORD")
    if not smtp_user or not smtp_password:
        logger.warning("[content_notify] SMTP 미설정 — 이메일 발송 건너뜀 (대상 %d명)", len(emails))
        return 0
    sender = get_setting("SMTP_FROM") or smtp_user
    smtp_host = get_setting("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(get_setting("SMTP_PORT", "587"))
    sent = 0
    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.login(smtp_user, smtp_password)
            for em in emails:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"] = sender
                msg["To"] = em
                msg.attach(MIMEText(html, "html", "utf-8"))
                try:
                    smtp.sendmail(sender, [em], msg.as_string())
                    sent += 1
                except Exception as e:
                    logger.error("[content_notify] 이메일 발송 실패 (%s): %s", em, e)
    except Exception as e:
        logger.error("[content_notify] SMTP 연결 실패: %s", e)
    return sent


def fanout_content_notification(
    db: Session,
    *,
    kind: ContentKind,
    title: str,
    body_preview: Optional[str] = None,
    target_id: Optional[int] = None,
) -> dict:
    """수신 동의 회원에게 site notification + email 동시 발송. 결과 dict 반환.

    target_id: 알림이 가리키는 vision.id 또는 meditation.id. 주보 삭제 등으로 그 row 가
    사라지면 FK SET NULL 로 NULL 이 되어, 프론트가 '원글 삭제됨' 판정에 사용.
    """
    meta = _KIND_META.get(kind)
    if not meta:
        return {"site": 0, "email": 0}

    rows = db.execute(
        text(
            "SELECT id, email, is_email_verified FROM members "
            f"WHERE is_active = TRUE AND COALESCE({meta['flag']}, FALSE) = TRUE"
        )
    ).fetchall()
    if not rows:
        logger.info("[content_notify] kind=%s 수신 동의 회원 없음", kind)
        return {"site": 0, "email": 0}

    from app.models.notification import Notification
    short_body = (body_preview[:280] if body_preview else None)
    extra: dict = {}
    if kind == "vision":
        extra["vision_id"] = target_id
    elif kind == "meditation":
        extra["meditation_id"] = target_id
    db.add_all([
        Notification(
            member_id=r.id, kind=kind,
            title=title, body=short_body,
            post_id=None, event_id=None, community_group_id=None,
            **extra,
        )
        for r in rows
    ])
    db.commit()
    site_count = len(rows)

    # 이메일은 verified·실제 이메일만
    email_targets = [
        r.email for r in rows
        if r.is_email_verified and r.email and not r.email.startswith("deleted-")
    ]
    site_url = get_setting("SITE_URL", settings.SITE_URL)
    href = f"{site_url}{meta['path']}"
    subject = f"[{get_parish_name()}] 새 {meta['label']} 안내"
    html = _build_email_html(kind, title, body_preview, href)
    email_count = _send_email_batch(email_targets, subject, html)

    logger.info(
        "[content_notify] kind=%s sent: site=%d, email=%d/%d",
        kind, site_count, email_count, len(email_targets),
    )
    return {"site": site_count, "email": email_count}
