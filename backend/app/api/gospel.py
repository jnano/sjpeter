import re
import logging
from datetime import date

import httpx
from bs4 import BeautifulSoup
from fastapi import APIRouter, HTTPException, Query

logger = logging.getLogger(__name__)

router = APIRouter()

_MISSA_URL = "https://maria.catholic.or.kr/mi_pr/missa/missa.asp"

# 복음서 이름 → 약어 정규화 매핑
_BOOK_NORMALIZE = {
    "마태오": "마태",
    "마르코": "마르",
    "루카": "루카",
    "요한": "요한",
}

# 전례 색깔 괄호·영문 제거용 패턴
_COLOR_PATTERN = re.compile(r'\(\s*[백녹자홍금]\s*\)')
_ENGLISH_PATTERN = re.compile(r'[A-Za-z].*')


def _parse_gospel(text: str) -> str | None:
    """✠ 서두 패턴에서 복음 구절 참조(예: 요한 14,27-31ㄱ)를 추출한다."""
    match = re.search(
        r'✠\s*(마태오?|마르코?|루카|요한)[이가]\s*전한\s*거룩한\s*복음입니다\s*[.．]?\s*(\d+,[\d\-]+[ㄱㄴ]?)',
        text,
    )
    if not match:
        return None
    raw_book = match.group(1)
    ref = match.group(2).strip()
    book = _BOOK_NORMALIZE.get(raw_book, raw_book)
    return f"{book} {ref}"


def _parse_season(soup: BeautifulSoup) -> str | None:
    """달력 영역의 active 링크에서 전례 시기 텍스트를 추출한다."""
    left_date = soup.find(class_="left_date")
    if left_date is None:
        return None
    a_active = left_date.find("a", class_="active")
    if a_active is None:
        return None
    raw = a_active.get_text(strip=True)
    raw = _COLOR_PATTERN.sub("", raw)
    raw = _ENGLISH_PATTERN.sub("", raw)
    season = raw.strip()
    return season if season else None


@router.get("/gospel")
async def get_gospel(date_str: str = Query(..., alias="date", description="YYYY-MM-DD")):
    """
    주어진 날짜의 가톨릭 굿뉴스 매일미사 페이지에서
    복음 구절과 전례 시기를 가져온다.
    """
    try:
        date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(status_code=422, detail="date 형식이 올바르지 않습니다 (YYYY-MM-DD)")

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                _MISSA_URL,
                params={"goMonth": date_str},
                headers={"User-Agent": "Mozilla/5.0 (faithandme/1.0)"},
            )
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        logger.warning("굿뉴스 요청 실패: %s", exc)
        raise HTTPException(status_code=502, detail="굿뉴스 서버에 연결하지 못했습니다.")

    soup = BeautifulSoup(resp.text, "html.parser")
    # separator="\n" 으로 <br> 위치에 줄바꿈을 삽입하여 절번호가 참조에 붙지 않게 한다
    text = soup.get_text(separator="\n")

    gospel_ref = _parse_gospel(text)
    season = _parse_season(soup)

    return {
        "success": True,
        "data": {
            "gospel_reference": gospel_ref,
            "liturgical_season": season,
        },
        "message": "" if gospel_ref else "해당 날짜의 복음 구절을 찾지 못했습니다.",
    }
