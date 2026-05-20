"""admin 대시보드 첫 운영 가이드 — 체크리스트.

새 본당이 setup wizard 직후 무엇부터 채워야 할지 막힘 없이 진행하도록
6개 핵심 항목의 완료 여부를 판정해 반환한다.
모두 완료되면 프론트엔드가 카드 자체를 숨김.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.auth import get_current_admin
from app.core.database import get_db
from app.models.admin import Admin

router = APIRouter(prefix="/api/admin/onboarding", tags=["admin-onboarding"])


class ChecklistItem(BaseModel):
    key: str
    label: str
    done: bool
    href: str
    optional: bool = False
    hint: str = ""


class ChecklistResponse(BaseModel):
    items: list[ChecklistItem]
    all_done: bool


def _count(db: Session, sql: str, **params) -> int:
    row = db.execute(text(sql), params).first()
    return int(row[0]) if row and row[0] is not None else 0


def _setting_filled(db: Session, key: str) -> bool:
    row = db.execute(
        text("SELECT value FROM site_settings WHERE key = :k"),
        {"k": key},
    ).first()
    return bool((row[0] or "").strip()) if row else False


@router.get("/checklist", response_model=ChecklistResponse)
def get_checklist(
    db: Session = Depends(get_db),
    _admin: Admin = Depends(get_current_admin),
):
    # 1. 본당 정보 보완 — 첫 row 의 address·phone 모두 채워져야 done
    parish_filled = (
        _count(
            db,
            "SELECT COUNT(*) FROM parishes "
            "WHERE COALESCE(NULLIF(TRIM(address), ''), NULL) IS NOT NULL "
            "AND COALESCE(NULLIF(TRIM(phone), ''), NULL) IS NOT NULL",
        )
        > 0
    )

    # 2. 주임 신부님 등록 — parish_staff 에 role='주임신부'
    head_priest_set = _count(db, "SELECT COUNT(*) FROM parish_staff WHERE role = '주임신부'") > 0

    # 3. 첫 공지 — notices 1건 이상
    first_notice = _count(db, "SELECT COUNT(*) FROM notices") > 0

    # 4. 주보 — bulletins 1건 이상
    first_bulletin = _count(db, "SELECT COUNT(*) FROM bulletins") > 0

    # 5. 회원가입 활성화 — SMTP_USER 채워짐 (없어도 회원 가입 가능 — Phase C 적용 — 하지만 이메일 인증·재설정 흐름은 막힘)
    smtp_ok = _setting_filled(db, "SMTP_USER") and _setting_filled(db, "SMTP_PASSWORD")

    # 6. 외부 서비스 연동 — Google/Kakao OAuth 또는 AWS AI 중 하나라도 (선택)
    external_ok = (
        (_setting_filled(db, "GOOGLE_CLIENT_ID") and _setting_filled(db, "GOOGLE_CLIENT_SECRET"))
        or (_setting_filled(db, "KAKAO_CLIENT_ID") and _setting_filled(db, "KAKAO_CLIENT_SECRET"))
        or (
            _setting_filled(db, "AWS_ACCESS_KEY_ID")
            and _setting_filled(db, "AWS_SECRET_ACCESS_KEY")
            and _setting_filled(db, "AWS_REGION")
        )
    )

    items = [
        ChecklistItem(
            key="parish_info",
            label="본당 정보 보완",
            done=parish_filled,
            href="/admin/parish/info",
            hint="주소·연락처를 입력합니다",
        ),
        ChecklistItem(
            key="head_priest",
            label="주임 신부님 등록",
            done=head_priest_set,
            href="/admin/parish-staff",
            hint="본당 가족에 주임신부 1명을 추가합니다",
        ),
        ChecklistItem(
            key="first_notice",
            label="첫 공지 작성",
            done=first_notice,
            href="/admin/notices",
            hint="신자에게 보일 첫 공지를 올립니다",
        ),
        ChecklistItem(
            key="first_bulletin",
            label="주보 1회 업로드",
            done=first_bulletin,
            href="/admin/bulletin",
            hint="PDF 주보를 한 번 올려봅니다 — AI 자동 추출 동작 확인",
        ),
        ChecklistItem(
            key="smtp",
            label="회원가입 이메일 활성화",
            done=smtp_ok,
            href="/admin/settings",
            hint="SMTP 키를 입력하면 회원 인증·비밀번호 재설정 메일이 발송됩니다",
        ),
        ChecklistItem(
            key="external",
            label="외부 서비스 연동",
            done=external_ok,
            href="/admin/settings",
            optional=True,
            hint="OAuth 로그인·AI 추출 등 — 선택 사항입니다",
        ),
    ]

    # 필수 항목(5개)이 모두 완료되면 all_done — 선택 항목(external)은 포함하지 않음
    required_done = all(it.done for it in items if not it.optional)
    return ChecklistResponse(items=items, all_done=required_done)
