"""백업 endpoint (v1.5.456) — super-admin 이 admin UI 에서 DB+uploads 백업 다운로드.

새 본당 운영자가 sysadmin 도움 없이 백업할 수 있게 하는 안전망. 별도 cron 권장.
"""
import logging
import os
import subprocess
import tempfile
import shutil
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth import get_current_super_admin
from app.core.admin_log import get_admin_identifier, log_action
from app.core.config import settings
from app.models.admin import Admin


router = APIRouter(prefix="/api/admin/backup", tags=["admin-backup"])
_logger = logging.getLogger(__name__)


def _parse_database_url(url: str) -> dict:
    """SQLAlchemy URL → pg_dump 인자. postgresql+psycopg2://user:pw@host:port/db."""
    from urllib.parse import urlparse
    # 'postgresql+psycopg2://...' → 'postgresql://...'
    cleaned = url.replace("postgresql+psycopg2://", "postgresql://", 1)
    parsed = urlparse(cleaned)
    return {
        "host": parsed.hostname or "localhost",
        "port": str(parsed.port or 5432),
        "user": parsed.username or "",
        "password": parsed.password or "",
        "database": (parsed.path or "/").lstrip("/"),
    }


@router.post("/run")
def run_backup(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_super_admin),
):
    """DB schema+data + uploads/ + private-uploads/ + site_settings INSERT 를 tar.gz 로 묶어 반환.

    반환: 파일 스트림. 클라이언트는 Content-Disposition 으로 자동 다운로드.
    실패 시 500. 백업은 backend/backups/ 에도 같은 파일 저장(보존).
    """
    creds = _parse_database_url(settings.DATABASE_URL)
    if not creds["database"]:
        raise HTTPException(status_code=500, detail="DATABASE_URL 파싱 실패")

    # 1) staging 디렉토리
    staging = Path(tempfile.mkdtemp(prefix="faithandme_backup_"))
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    base_name = f"backup_{timestamp}"

    try:
        env = {**os.environ, "PGPASSWORD": creds["password"]}

        # 2) pg_dump (schema + data, plain SQL)
        dump_file = staging / "db_full.sql"
        with open(dump_file, "wb") as out:
            ret = subprocess.run(
                ["pg_dump", "-h", creds["host"], "-p", creds["port"],
                 "-U", creds["user"], "--no-owner", "--no-acl", creds["database"]],
                env=env, stdout=out, stderr=subprocess.PIPE, check=True, timeout=300,
            )
            if ret.returncode != 0:
                raise HTTPException(status_code=500, detail=f"pg_dump 실패: {ret.stderr.decode()[:200]}")

        # 3) site_settings INSERT (별도 — 빠르게 키만 복원 가능하게)
        site_file = staging / "site_settings_data.sql"
        with open(site_file, "wb") as out:
            subprocess.run(
                ["pg_dump", "-h", creds["host"], "-p", creds["port"],
                 "-U", creds["user"], "--data-only", "--inserts",
                 "-t", "site_settings", creds["database"]],
                env=env, stdout=out, stderr=subprocess.PIPE, check=True, timeout=60,
            )

        # 4) uploads/ private-uploads/ 복사 (있으면)
        for d in ("uploads", "private-uploads"):
            src = Path(settings.UPLOAD_DIR).parent / d
            if not src.exists() and d == "uploads":
                src = Path(settings.UPLOAD_DIR)
            if src.exists() and src.is_dir():
                shutil.copytree(src, staging / d, dirs_exist_ok=True)

        # 5) RESTORE.md
        (staging / "RESTORE.md").write_text(
            f"# 백업 복구 안내 — {timestamp}\n\n"
            "## 압축 해제 후\n"
            "```bash\n"
            f"psql -U {creds['user']} -d {creds['database']} < db_full.sql\n"
            f"# 또는 키만 별도 복원:\n"
            f"psql -U {creds['user']} -d {creds['database']} < site_settings_data.sql\n"
            "```\n\n"
            "uploads/ 와 private-uploads/ 는 backend 의 동일 경로에 그대로 복사하면 됩니다.\n",
            encoding="utf-8",
        )

        # 6) tar.gz 압축 (backups/ 에 영구 보존 + 다운로드 응답에 동일 사용)
        backup_dir = Path(__file__).resolve().parent.parent.parent / "backups"
        backup_dir.mkdir(exist_ok=True)
        archive_path = backup_dir / f"{base_name}.tar.gz"
        subprocess.run(["tar", "czf", str(archive_path), "-C", str(staging.parent), staging.name],
                       check=True, timeout=300)

        # 7) staging 정리는 백그라운드에서
        background_tasks.add_task(shutil.rmtree, str(staging), ignore_errors=True)

        log_action(db, get_admin_identifier(admin), "run_backup", "backup", None,
                   f"size={archive_path.stat().st_size} bytes")

        return FileResponse(
            path=str(archive_path),
            filename=f"{base_name}.tar.gz",
            media_type="application/gzip",
        )

    except subprocess.CalledProcessError as exc:
        shutil.rmtree(staging, ignore_errors=True)
        _logger.error("백업 실패: %s", exc)
        raise HTTPException(status_code=500, detail=f"백업 실패: {exc}")
    except subprocess.TimeoutExpired:
        shutil.rmtree(staging, ignore_errors=True)
        raise HTTPException(status_code=504, detail="백업 timeout (5분 초과)")
    except Exception as exc:
        shutil.rmtree(staging, ignore_errors=True)
        _logger.error("백업 예외: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc)[:200])


@router.get("/list")
def list_backups(_: Admin = Depends(get_current_super_admin)):
    """backend/backups/ 에 저장된 과거 백업 파일 목록."""
    backup_dir = Path(__file__).resolve().parent.parent.parent / "backups"
    if not backup_dir.exists():
        return {"files": []}
    files = []
    for p in sorted(backup_dir.glob("backup_*.tar.gz"), reverse=True):
        st = p.stat()
        files.append({
            "name": p.name,
            "size": st.st_size,
            "created_at": datetime.fromtimestamp(st.st_mtime).isoformat(),
        })
    return {"files": files}
