"""첫 실행 setup wizard 엔드포인트.

admins 테이블이 비어 있으면 (= 첫 설치) setup 페이지로 강제 리다이렉트되도록
프론트엔드가 GET /api/setup/status 를 통해 상태를 확인한다.
POST /api/setup/init 은 admins 가 비어 있을 때만 동작 — 첫 슈퍼관리자 + 본당 정보 입력.

GET /api/setup/system-check 는 별도로, 호스팅 서버의 최소사양 충족 여부를
진단 (다른 본당 운영자가 호스팅 직후 사용).
"""
import os
import platform
import re
import shutil
import sys
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.admin_log import log_action
from app.core.auth import hash_password
from app.core.config import settings as app_settings
from app.core.database import get_db
from app.core.site_settings import get_setting
from app.models.admin import Admin
from app.models.board import Board

router = APIRouter(tags=["setup"])


# 첫 setup 직후 자동 생성될 기본 게시판.
# 다른 본당이 빈 사이트가 아니라 첫 인상이 있는 사이트로 시작하도록 함.
# admin 이 마음에 들지 않으면 /admin/boards 에서 자유롭게 삭제·이름 변경 가능.
DEFAULT_BOARDS: list[dict] = [
    {
        "name": "자유게시판",
        "slug": "free",
        "description": "본당 신자들이 자유롭게 글을 쓰는 공간",
        "kind": "default",
        "members_only_write": True,
    },
    {
        "name": "사진 갤러리",
        "slug": "gallery",
        "description": "본당 행사·일상 사진 모음",
        "kind": "default",
        "members_only_write": True,
    },
    {
        "name": "기도 청원",
        "slug": "prayer-line",
        "description": "한 줄로 청원·감사·위령 기도를 나누는 공간",
        "kind": "line",
        "members_only_write": True,
    },
    {
        "name": "묵상 나눔",
        "slug": "meditation-board",
        "description": "말씀과 일상의 묵상을 함께 나누는 공간",
        "kind": "default",
        "members_only_write": True,
    },
]


def _seed_default_boards(db: Session) -> int:
    """기본 게시판 4종 시드. slug 단위 idempotent — 같은 slug 가 이미 있으면 건너뜀.

    backend startup 의 _migrate_add_columns 가 시스템 게시판 (notice/ai-extract/liturgy/events)
    을 먼저 시드하므로 Board.count() 기반 조건은 부적절하다. slug 단위로 비교한다.

    반환: 새로 생성된 게시판 수 (0~4). 모두 이미 있으면 0.
    """
    created = 0
    for spec in DEFAULT_BOARDS:
        existing = db.query(Board).filter(Board.slug == spec["slug"]).first()
        if existing:
            continue
        db.add(Board(
            name=spec["name"],
            slug=spec["slug"],
            description=spec["description"],
            kind=spec["kind"],
            members_only_write=spec["members_only_write"],
            is_active=True,
            show_in_menu=True,
        ))
        created += 1
    return created


class SetupStatus(BaseModel):
    setup_completed: bool
    admin_count: int
    parish_name: str
    site_url: str


class SetupInitRequest(BaseModel):
    admin_username: str = Field(min_length=4, max_length=50)
    admin_password: str = Field(min_length=8, max_length=200)
    parish_name: str = Field(min_length=1, max_length=200)
    parish_name_en: str = Field(default="", max_length=200)
    parish_address: str = Field(default="", max_length=300)
    parish_phone: str = Field(default="", max_length=50)
    site_url: str = Field(min_length=1, max_length=500)


class SetupInitResponse(BaseModel):
    ok: bool
    message: str


def _get_setting_value(db: Session, key: str) -> str:
    row = db.execute(
        text("SELECT value FROM site_settings WHERE key = :k"),
        {"k": key},
    ).first()
    return (row[0] or "") if row else ""


@router.get("/api/setup/status", response_model=SetupStatus)
def setup_status(db: Session = Depends(get_db)):
    """setup 완료 여부를 반환. 인증 불필요 — 프론트엔드 layout 가드에서 사용."""
    admin_count = db.query(Admin).count()
    return SetupStatus(
        setup_completed=admin_count > 0,
        admin_count=admin_count,
        parish_name=_get_setting_value(db, "PARISH_NAME"),
        site_url=_get_setting_value(db, "SITE_URL"),
    )


@router.post("/api/setup/init", response_model=SetupInitResponse, status_code=201)
def setup_init(body: SetupInitRequest, db: Session = Depends(get_db)):
    """첫 슈퍼관리자 계정 + 본당 정보 1회 등록.

    admins 테이블이 비어 있을 때만 동작. 두 번째 호출은 403.
    """
    # 1. admins 가 이미 존재하면 거부 (실수 또는 악의적 재호출 방어)
    if db.query(Admin).count() > 0:
        raise HTTPException(
            status_code=403,
            detail="setup 이 이미 완료되었습니다. 관리자 계정이 존재합니다.",
        )

    # 2. username 형식 검사 (영문·숫자·언더스코어)
    if not re.fullmatch(r"[A-Za-z0-9_]{4,50}", body.admin_username):
        raise HTTPException(
            status_code=400,
            detail="아이디는 영문·숫자·언더스코어 4~50자여야 합니다.",
        )

    # 3. 비밀번호 강도 검사 (최소 8자 + 영문 + 숫자)
    pw = body.admin_password
    if not (re.search(r"[A-Za-z]", pw) and re.search(r"\d", pw)):
        raise HTTPException(
            status_code=400,
            detail="비밀번호는 영문과 숫자를 모두 포함해야 합니다.",
        )

    # 4. site_url 형식 검사 (http/https 시작)
    if not re.match(r"^https?://", body.site_url):
        raise HTTPException(
            status_code=400,
            detail="사이트 URL 은 http:// 또는 https:// 로 시작해야 합니다.",
        )

    # 5. admin 계정 생성
    admin = Admin(
        username=body.admin_username,
        hashed_password=hash_password(body.admin_password),
    )
    db.add(admin)

    # 6. site_settings UPSERT (PARISH_NAME, PARISH_NAME_EN, SITE_URL)
    for key, value in [
        ("PARISH_NAME", body.parish_name.strip()),
        ("PARISH_NAME_EN", body.parish_name_en.strip()),
        ("SITE_URL", body.site_url.strip().rstrip("/")),
    ]:
        db.execute(
            text(
                "UPDATE site_settings SET value = :v WHERE key = :k"
            ),
            {"v": value, "k": key},
        )

    # 7. parishes 첫 row 동기화 — admin/parish/info 페이지의 기본값. parishes.name 이 master.
    db.execute(
        text(
            "UPDATE parishes SET name = :name, address = :addr, phone = :phone "
            "WHERE id = (SELECT id FROM parishes ORDER BY id LIMIT 1)"
        ),
        {
            "name": body.parish_name.strip(),
            "addr": body.parish_address.strip(),
            "phone": body.parish_phone.strip(),
        },
    )

    # 8. 기본 게시판 자동 생성 (boards 가 비어 있을 때만 — 다른 본당의 첫 시작 인상)
    seeded = _seed_default_boards(db)

    db.commit()

    # setup 은 첫 admin 생성 이전이라 get_admin_identifier 사용 불가 — "setup" 으로 기록
    log_action(
        db, "setup", "setup_init", "system", None,
        f"첫 관리자={body.admin_username}, 본당={body.parish_name}, seeded_boards={seeded}",
    )

    msg = "첫 관리자 계정과 본당 정보가 등록되었습니다."
    if seeded:
        msg += f" 기본 게시판 {seeded}개를 자동 생성했습니다."
    return SetupInitResponse(ok=True, message=msg)


# ── 시스템 자가진단 ───────────────────────────────────────────
#  다른 본당 운영자가 호스팅 서버에 설치 직후, 자기 서버가 본 시스템 운영에
#  적합한지 확인할 수 있도록 환경 정보를 반환. 인증 불필요 — 일반 정보만
#  제공 (path·hostname·process 등 민감 정보 제외).

class SystemCheckItem(BaseModel):
    label: str
    value: str
    status: str  # "ok" | "warn" | "fail" | "info"
    detail: str = ""


class SystemCheckResponse(BaseModel):
    items: list[SystemCheckItem]
    setup_completed: bool


def _get_memory_total_gb() -> float | None:
    """전체 RAM (GB). psutil 없이 stdlib 만 — Linux /proc/meminfo, 기타 None."""
    # macOS·BSD 는 sysctl 필요 → 일단 Linux 만 시도, 실패 시 None.
    try:
        with open("/proc/meminfo") as f:
            for line in f:
                if line.startswith("MemTotal:"):
                    kb = int(line.split()[1])
                    return round(kb / 1024 / 1024, 1)
    except Exception:
        pass
    return None


def _get_disk_free_gb(path: str) -> tuple[float, float]:
    """(free_gb, total_gb). path 없으면 cwd."""
    target = path if os.path.exists(path) else "."
    usage = shutil.disk_usage(target)
    return round(usage.free / 1024**3, 1), round(usage.total / 1024**3, 1)


def _parse_pg_major(version_str: str) -> int | None:
    """'PostgreSQL 15.4 on ...' → 15"""
    m = re.match(r"PostgreSQL\s+(\d+)", version_str or "")
    return int(m.group(1)) if m else None


@router.get("/api/setup/system-check", response_model=SystemCheckResponse)
def system_check(db: Session = Depends(get_db)):
    """호스팅 서버 환경 자가진단 — 최소사양 충족 여부.

    인증 불필요. 공개 가능한 일반 정보만 노출 (Python·DB·디스크·메모리·외부 키
    설정 여부). path·hostname·process·IP 등 운영 정보는 포함하지 않음.

    status 의미:
      - ok:   요구사항 충족
      - warn: 운영 가능하나 권장 미달
      - fail: 운영 불가능 (즉시 조치 필요)
      - info: 충족 여부 무관한 안내
    """
    items: list[SystemCheckItem] = []

    # 1. Python 버전 — 3.11 이상 권장 (FastAPI·pydantic 2 호환)
    py_ver = sys.version_info
    py_str = f"{py_ver.major}.{py_ver.minor}.{py_ver.micro}"
    if py_ver >= (3, 11):
        items.append(SystemCheckItem(label="Python", value=py_str, status="ok"))
    elif py_ver >= (3, 10):
        items.append(SystemCheckItem(
            label="Python", value=py_str, status="warn",
            detail="3.11 이상 권장 (현재 버전도 동작은 하지만 일부 type hint 가 제한)",
        ))
    else:
        items.append(SystemCheckItem(
            label="Python", value=py_str, status="fail",
            detail="3.11 이상 필요. 현재 버전에서는 기동이 불가능합니다.",
        ))

    # 2. OS / Platform
    items.append(SystemCheckItem(
        label="운영체제", value=f"{platform.system()} {platform.machine()}",
        status="info",
        detail="Ubuntu 22.04+ · Debian 12+ · macOS 권장. Windows 는 미지원.",
    ))

    # 3. PostgreSQL 버전 + 연결
    try:
        pg_full = db.execute(text("SELECT version()")).scalar() or ""
        pg_major = _parse_pg_major(pg_full)
        if pg_major is None:
            items.append(SystemCheckItem(
                label="PostgreSQL", value="연결됨 (버전 파싱 실패)", status="warn",
            ))
        elif pg_major >= 15:
            items.append(SystemCheckItem(
                label="PostgreSQL", value=str(pg_major), status="ok",
            ))
        elif pg_major >= 13:
            items.append(SystemCheckItem(
                label="PostgreSQL", value=str(pg_major), status="warn",
                detail="15 이상 권장 (gin_trgm_ops 인덱스 성능 차이).",
            ))
        else:
            items.append(SystemCheckItem(
                label="PostgreSQL", value=str(pg_major), status="fail",
                detail="13 이상 필요. 12 이하는 마이그레이션 충돌 가능.",
            ))
    except Exception as exc:
        items.append(SystemCheckItem(
            label="PostgreSQL", value="연결 실패", status="fail",
            detail=f"DATABASE_URL 확인 필요. {str(exc)[:120]}",
        ))

    # 4. 메모리 — Linux 한정 (macOS·기타는 info)
    mem_gb = _get_memory_total_gb()
    if mem_gb is None:
        items.append(SystemCheckItem(
            label="메모리", value="감지 불가", status="info",
            detail="non-Linux 환경. 운영 서버는 Linux 권장 — 최소 1GB · 권장 2GB.",
        ))
    elif mem_gb >= 2.0:
        items.append(SystemCheckItem(label="메모리", value=f"{mem_gb}GB", status="ok"))
    elif mem_gb >= 1.0:
        items.append(SystemCheckItem(
            label="메모리", value=f"{mem_gb}GB", status="warn",
            detail="2GB 이상 권장. 주보 AI 분석·동시 접속 많을 때 swap 발생 가능.",
        ))
    else:
        items.append(SystemCheckItem(
            label="메모리", value=f"{mem_gb}GB", status="fail",
            detail="1GB 미만 — FastAPI+PostgreSQL+Node 동시 실행 불가.",
        ))

    # 5. 디스크 (uploads 디렉토리 기준)
    upload_root = app_settings.UPLOAD_DIR if os.path.isabs(app_settings.UPLOAD_DIR) else app_settings.UPLOAD_DIR
    free_gb, total_gb = _get_disk_free_gb(upload_root)
    if free_gb >= 5.0:
        items.append(SystemCheckItem(
            label="디스크 여유", value=f"{free_gb}GB / {total_gb}GB", status="ok",
        ))
    elif free_gb >= 2.0:
        items.append(SystemCheckItem(
            label="디스크 여유", value=f"{free_gb}GB / {total_gb}GB", status="warn",
            detail="5GB+ 권장. 주보 PDF·사진 누적 시 1년 안에 부족할 수 있음.",
        ))
    else:
        items.append(SystemCheckItem(
            label="디스크 여유", value=f"{free_gb}GB / {total_gb}GB", status="fail",
            detail="2GB 미만 — 업로드·DB 쓰기 실패 가능.",
        ))

    # 6. uploads 디렉토리 쓰기 가능 여부
    try:
        os.makedirs(app_settings.UPLOAD_DIR, exist_ok=True)
        test_path = os.path.join(app_settings.UPLOAD_DIR, ".write_test")
        with open(test_path, "w") as f:
            f.write("x")
        os.remove(test_path)
        items.append(SystemCheckItem(label="업로드 디렉토리 쓰기", value="가능", status="ok"))
    except Exception as exc:
        items.append(SystemCheckItem(
            label="업로드 디렉토리 쓰기", value="실패", status="fail",
            detail=f"권한·경로 확인 필요. {str(exc)[:120]}",
        ))

    # 7. 외부 키 설정 여부 — site_settings 에서 admin 이 입력. 미설정도 fail 아님 (선택 기능).
    secret_keys = [
        ("AWS_ACCESS_KEY_ID", "AWS Bedrock (주보 AI 분석)"),
        ("SMTP_USER", "이메일 발송 (비밀번호 재설정·주보 알림)"),
        ("GOOGLE_CLIENT_ID", "Google 소셜 로그인"),
        ("KAKAO_CLIENT_ID", "Kakao 소셜 로그인"),
        ("KAKAO_MAP_KEY", "오시는 길 지도"),
    ]
    for key, desc in secret_keys:
        configured = bool((get_setting(key) or "").strip())
        items.append(SystemCheckItem(
            label=desc,
            value="설정됨" if configured else "미설정",
            status="ok" if configured else "info",
            detail="" if configured else "선택 기능 — admin/settings 에서 입력하면 활성화.",
        ))

    # 8. INTERNAL_API_SECRET (소셜 로그인 보안)
    internal_secret_set = bool((app_settings.INTERNAL_API_SECRET or "").strip())
    items.append(SystemCheckItem(
        label="INTERNAL_API_SECRET",
        value="설정됨" if internal_secret_set else "미설정",
        status="ok" if internal_secret_set else "warn",
        detail="" if internal_secret_set
        else "소셜 로그인 사용 시 backend/.env + frontend/.env.local 에 동일 값 설정 권장.",
    ))

    # 9. SECRET_KEY 강도 (운영 시 추측 가능한 default 값 사용 차단)
    sk = app_settings.SECRET_KEY or ""
    weak_markers = ("change", "default", "secret", "dev")
    is_weak = any(m in sk.lower() for m in weak_markers)
    if len(sk) < 32:
        items.append(SystemCheckItem(
            label="SECRET_KEY", value=f"{len(sk)}자", status="fail",
            detail="32자 이상 필요. `openssl rand -hex 32` 결과로 교체.",
        ))
    elif is_weak:
        items.append(SystemCheckItem(
            label="SECRET_KEY", value="추측 가능한 값", status="warn",
            detail="'dev'·'default'·'change' 등이 포함됨. `openssl rand -hex 32` 결과로 교체 권장.",
        ))
    else:
        items.append(SystemCheckItem(label="SECRET_KEY", value=f"{len(sk)}자", status="ok"))

    return SystemCheckResponse(
        items=items,
        setup_completed=db.query(Admin).count() > 0,
    )
