import re
import logging
from datetime import date, datetime

import httpx
from bs4 import BeautifulSoup
from fastapi import APIRouter, HTTPException, Query

logger = logging.getLogger(__name__)

router = APIRouter()

_MISSA_URL = "https://maria.catholic.or.kr/mi_pr/missa/missa.asp"

# 날짜별 메모리 캐시
_daily_cache: dict = {}

# 복음서 이름 → 약어 정규화 매핑
_BOOK_NORMALIZE = {
    "마태오": "마태",
    "마르코": "마르",
    "루카": "루카",
    "요한": "요한",
}

_COLOR_PATTERN = re.compile(r'\(\s*[백녹자홍금]\s*\)')
_BRACKET_COLOR_PATTERN = re.compile(r'\[\s*[백녹자홍금]\s*\]')
_ENGLISH_PATTERN = re.compile(r'[A-Za-z].*')


def _cache_get(key: str):
    today = date.today().isoformat()
    entry = _daily_cache.get(key)
    if entry and entry.get("date") == today:
        return entry.get("value")
    return None


def _cache_set(key: str, value):
    today = date.today().isoformat()
    # 오래된 캐시 제거
    for k in list(_daily_cache.keys()):
        if _daily_cache[k].get("date") != today:
            del _daily_cache[k]
    _daily_cache[key] = {"date": today, "value": value}


async def _fetch_missa_page(date_str: str) -> BeautifulSoup | None:
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(
                _MISSA_URL,
                params={"goMonth": date_str},
                headers={"User-Agent": "Mozilla/5.0 (faithandme/1.0)"},
            )
        resp.raise_for_status()
        try:
            html = resp.text
        except Exception:
            html = resp.content.decode("euc-kr", errors="replace")
        return BeautifulSoup(html, "html.parser")
    except Exception as exc:
        logger.warning("굿뉴스 요청 실패 (%s): %s", date_str, exc)
        return None


def _parse_gospel_ref(text: str) -> str | None:
    """✠ 서두 패턴에서 복음 구절 참조(예: 요한 14,27-31ㄱ)를 추출한다.
    굿뉴스 측에서 시작/끝 표기를 혼동하는 경우(예: 2026-05-17 '복음의 끝입니다')도 매칭."""
    match = re.search(
        r'✠\s*(마태오?|마르코?|루카|요한)[이가]\s*전한\s*거룩한\s*복음(?:입니다|의\s*끝입니다)\s*[.．]?\s*(\d+,[\d\-]+[ㄱㄴ]?)',
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
    raw = _BRACKET_COLOR_PATTERN.sub("", raw)
    raw = _ENGLISH_PATTERN.sub("", raw)
    season = raw.strip()
    return season if season else None


def _parse_gospel_text(soup: BeautifulSoup) -> str | None:
    """복음 본문 전체를 줄바꿈으로 이어 반환한다.
    굿뉴스 missa 페이지는 각 전례 섹션(입당송/본기도/제1독서/.../복음/...)이
    class='board_layout' 컨테이너로 분리되어 있어, ✠ 가 포함된 board_layout 하나만 골라
    파싱하면 감사송/영성체송 등 후속 섹션의 누락 없이 정확한 복음 본문만 추출 가능.

    홈 위젯은 CSS line-clamp 로 미리보기, /word 상세 페이지는 전체 본문을 노출한다.
    """
    chapter_verse_re = re.compile(r'^[\d,\sㄱㄴ\-]+$')

    for div in soup.find_all(class_='board_layout'):
        text = div.get_text(separator="\n", strip=True)
        if "✠" not in text:
            continue

        lines = [l.strip() for l in text.split("\n") if l.strip()]
        result = []
        skip_chapter_verse = False
        for line in lines:
            # ✠ 시작 헤더 라인 ("✠ 마르코가 전한 거룩한 복음입니다.") 건너뛰기
            if line.startswith("✠"):
                skip_chapter_verse = True
                continue
            # 헤더 직후의 장·절 라인 ("16,23ㄴ-28") 건너뛰기 — gospel_reference 필드와 중복
            if skip_chapter_verse:
                skip_chapter_verse = False
                if chapter_verse_re.match(line):
                    continue
            # 회중 응답 ("◎ 그리스도님, 찬미합니다.") 건너뛰기
            if line.startswith("◎") or line.startswith("○"):
                continue
            if len(line) < 2:
                continue
            result.append(line)

        return "\n".join(result) if result else None

    return None


# ── 엔드포인트 ─────────────────────────────────────────────

@router.get("/gospel/today")
async def get_today_gospel():
    """
    오늘의 복음 구절과 전례 시기를 반환한다 (일별 캐시 적용).
    홈페이지 '오늘의 말씀' 위젯용.
    """
    cached = _cache_get("today")
    if cached:
        return {"success": True, "data": cached, "message": ""}

    date_str = date.today().isoformat()
    soup = await _fetch_missa_page(date_str)

    if soup is None:
        return {
            "success": False,
            "data": None,
            "message": "굿뉴스 서버에 연결하지 못했습니다.",
        }

    text = soup.get_text(separator="\n")
    gospel_ref = _parse_gospel_ref(text)
    gospel_text = _parse_gospel_text(soup)
    season = _parse_season(soup)

    result = {
        "date": date_str,
        "liturgical_season": season,
        "gospel_reference": gospel_ref,
        "gospel_text": gospel_text,
    }
    _cache_set("today", result)

    return {"success": True, "data": result, "message": ""}



@router.get("/gospel")
async def get_gospel(date_str: str = Query(..., alias="date", description="YYYY-MM-DD")):
    """
    주어진 날짜의 복음 구절과 전례 시기를 반환한다.
    """
    try:
        date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(status_code=422, detail="date 형식이 올바르지 않습니다 (YYYY-MM-DD)")

    soup = await _fetch_missa_page(date_str)
    if soup is None:
        raise HTTPException(status_code=502, detail="굿뉴스 서버에 연결하지 못했습니다.")

    text = soup.get_text(separator="\n")
    gospel_ref = _parse_gospel_ref(text)
    season = _parse_season(soup)

    return {
        "success": True,
        "data": {
            "gospel_reference": gospel_ref,
            "liturgical_season": season,
        },
        "message": "" if gospel_ref else "해당 날짜의 복음 구절을 찾지 못했습니다.",
    }
