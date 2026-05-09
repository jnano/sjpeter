import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.site_settings import get_setting

logger = logging.getLogger(__name__)


def _build_bulletin_html(info: dict) -> str:
    issue = f"제{info['issue_number']}호" if info.get("issue_number") else ""
    season = info.get("liturgical_season") or ""
    gospel = info.get("gospel_reference") or ""
    pub_date = info.get("published_date") or ""
    url = f"{get_setting('SITE_URL', 'http://localhost:3000')}/bulletin"
    unsubscribe_url = f"{get_setting('SITE_URL', 'http://localhost:3000')}/members/me"

    title_parts = [p for p in [issue, season] if p]
    title_line = " · ".join(title_parts) if title_parts else "주보"

    detail_rows = ""
    if pub_date:
        detail_rows += f"""
        <tr>
          <td style="padding:4px 0;color:#888;font-size:12px;width:72px;">발행일</td>
          <td style="padding:4px 0;color:#333;font-size:12px;">{pub_date}</td>
        </tr>"""
    if season:
        detail_rows += f"""
        <tr>
          <td style="padding:4px 0;color:#888;font-size:12px;">전례시기</td>
          <td style="padding:4px 0;color:#333;font-size:12px;">{season}</td>
        </tr>"""
    if gospel:
        detail_rows += f"""
        <tr>
          <td style="padding:4px 0;color:#888;font-size:12px;">복음</td>
          <td style="padding:4px 0;color:#333;font-size:12px;">{gospel}</td>
        </tr>"""

    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f5f0eb;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0eb;">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table width="520" cellpadding="0" cellspacing="0"
             style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

        <!-- 헤더 -->
        <tr>
          <td style="background:#1b3d6e;padding:36px 32px;text-align:center;">
            <p style="margin:0 0 10px;color:#c9a84c;font-size:22px;">✝</p>
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:1px;">
              세종 성베드로 성당
            </h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.55);font-size:12px;letter-spacing:2px;">
              SEJONG ST. PETER'S PARISH
            </p>
          </td>
        </tr>

        <!-- 본문 -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 6px;color:#999;font-size:13px;">이번 주 주보가 등록되었습니다.</p>
            <p style="margin:0 0 24px;color:#1b3d6e;font-size:20px;font-weight:bold;">{title_line}</p>

            <!-- 주보 정보 카드 -->
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#f9f5f0;border:1px solid #e5ddd3;border-radius:10px;margin-bottom:28px;">
              <tr>
                <td style="padding:18px 20px;">
                  <table cellpadding="0" cellspacing="0" width="100%">
                    {detail_rows}
                  </table>
                </td>
              </tr>
            </table>

            <!-- 버튼 -->
            <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td align="center" style="background:#1b3d6e;border-radius:8px;">
                  <a href="{url}"
                     style="display:block;padding:13px 36px;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;letter-spacing:0.5px;">
                    주보 보기
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- 푸터 -->
        <tr>
          <td style="background:#f9f5f0;padding:18px 32px;text-align:center;border-top:1px solid #e5ddd3;">
            <p style="margin:0;color:#aaa;font-size:11px;line-height:1.8;">
              본 메일은 세종 성베드로 성당 홈페이지 알림 수신에 동의하신 분께 발송됩니다.<br>
              수신을 원하지 않으시면
              <a href="{unsubscribe_url}" style="color:#1b3d6e;text-decoration:underline;">여기</a>
              에서 설정을 변경하세요.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>"""


def send_bulletin_notification(emails: list[str], bulletin_info: dict) -> int:
    """주보 알림 이메일 일괄 발송. SMTP 미설정 시 조용히 건너뜀. 성공 건수 반환."""
    smtp_user = get_setting("SMTP_USER")
    smtp_password = get_setting("SMTP_PASSWORD")
    if not smtp_user or not smtp_password:
        logger.warning("SMTP 설정 없음 — 이메일 발송 건너뜀")
        return 0
    if not emails:
        return 0

    issue = f"제{bulletin_info['issue_number']}호 " if bulletin_info.get("issue_number") else ""
    season = bulletin_info.get("liturgical_season") or ""
    subject_suffix = f"{issue}{season}".strip() or "이번 주 주보"
    subject = f"[세종 성베드로 성당] {subject_suffix} 등록 안내"
    html = _build_bulletin_html(bulletin_info)
    sender = get_setting("SMTP_FROM") or smtp_user

    sent = 0
    try:
        smtp_host = get_setting("SMTP_HOST", "smtp.gmail.com")
        smtp_port = int(get_setting("SMTP_PORT", "587"))
        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.login(smtp_user, smtp_password)
            for email in emails:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"] = sender
                msg["To"] = email
                msg.attach(MIMEText(html, "html", "utf-8"))
                try:
                    smtp.sendmail(sender, [email], msg.as_string())
                    sent += 1
                except Exception as e:
                    logger.error("이메일 발송 실패 (%s): %s", email, e)
    except Exception as e:
        logger.error("SMTP 연결 실패: %s", e)

    logger.info("주보 알림 이메일: %d/%d건 발송", sent, len(emails))
    return sent
