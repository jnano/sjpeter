from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional


def log_action(
    db: Session,
    admin_identifier: str,
    action: str,
    target_type: Optional[str] = None,
    target_id: Optional[int] = None,
    detail: Optional[str] = None,
) -> None:
    """관리자 행동을 admin_logs 테이블에 기록한다."""
    try:
        db.execute(text(
            "INSERT INTO admin_logs (admin_identifier, action, target_type, target_id, detail) "
            "VALUES (:admin, :action, :ttype, :tid, :detail)"
        ), {
            "admin": admin_identifier,
            "action": action,
            "ttype": target_type,
            "tid": target_id,
            "detail": detail,
        })
        db.commit()
    except Exception:
        pass  # 로그 실패가 본 작업을 중단하지 않도록
