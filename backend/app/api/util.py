"""유틸 엔드포인트 — 외부 URL resolve 등.

현재:
- /api/util/resolve-naver-share — naver.me 단축 URL 을 풀 URL 로 resolve 해서
  Naver TV 비디오 ID 추출 (없으면 null). 클라이언트는 CORS 때문에 직접 못 함.
"""
import re
import logging
from functools import lru_cache

import httpx
from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/util", tags=["util"])

_SHARE_CODE_RE = re.compile(r"^[A-Za-z0-9]{1,40}$")
_NAVER_TV_RE = re.compile(r"^/(?:v|embed)/(\d+)")


@lru_cache(maxsize=1024)
def _resolve_share_uncached(code: str) -> str | None:
    """naver.me/<code> → 최종 URL. 실패 시 None.

    follow_redirects=True 로 httpx 가 자동으로 마지막 URL 까지 따라감.
    """
    try:
        with httpx.Client(timeout=5.0, follow_redirects=True) as client:
            r = client.get(f"https://naver.me/{code}")
            return str(r.url)
    except Exception as e:
        logger.warning("naver.me resolve failed (%s): %s", code, e)
        return None


@router.get("/resolve-naver-share")
def resolve_naver_share(code: str):
    """naver.me/<code> 의 Naver TV 비디오 ID 를 반환. 매칭 안 되면 video_id=null.

    응답: {"video_id": "12345678" | null, "resolved_url": "..."}
    """
    if not _SHARE_CODE_RE.match(code):
        raise HTTPException(status_code=400, detail="invalid share code")

    resolved = _resolve_share_uncached(code)
    if not resolved:
        return {"video_id": None, "resolved_url": None}

    try:
        from urllib.parse import urlparse
        parsed = urlparse(resolved)
        if parsed.hostname == "tv.naver.com":
            m = _NAVER_TV_RE.match(parsed.path)
            if m:
                return {"video_id": m.group(1), "resolved_url": resolved}
    except Exception:
        pass

    return {"video_id": None, "resolved_url": resolved}
