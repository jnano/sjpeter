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
    raw = _BRACKET_COLOR_PATTERN.sub("", raw)
    raw = _ENGLISH_PATTERN.sub("", raw)
    season = raw.strip()
    return season if season else None


def _parse_gospel_text(soup: BeautifulSoup) -> str | None:
    """복음 본문의 핵심 문단을 추출한다."""
    text = soup.get_text(separator="\n")
    lines = [l.strip() for l in text.split("\n") if l.strip()]

    # ✠ 표시 이후 본문 수집
    gospel_start = None
    for i, line in enumerate(lines):
        if "✠" in line:
            gospel_start = i
            break

    if gospel_start is None:
        return None

    # ✠ 줄 이후에서 실제 복음 본문 문장 수집
    # 전례 응답(◎ ○), 너무 짧은 줄, 다음 섹션 제목은 제외
    _SKIP_PREFIXES = ("◎", "○", "✠", "※", "입당송", "본기도", "예물기도", "영성체송", "영성체 후")
    gospel_lines = []
    for line in lines[gospel_start + 1:]:
        if any(line.startswith(p) for p in _SKIP_PREFIXES):
            continue
        if len(line) < 8:
            continue
        # 다음 전례 섹션이 시작되면 중단
        if re.match(r'^(입당송|본기도|제\s*\d+\s*독서|화답송|복음환호송|예물기도|영성체송|감사송|주님의\s*기도|영성체\s*후)', line):
            break
        gospel_lines.append(line)
        # 약 150자 이상이면 충분
        if sum(len(l) for l in gospel_lines) >= 150:
            break

    if not gospel_lines:
        return None

    # 대표 문장: 첫 의미 있는 문단 1-2개
    combined = " ".join(gospel_lines[:3])
    # 너무 길면 첫 문장만
    if len(combined) > 200:
        sentences = re.split(r'(?<=[다했다니까요.])\s+', combined)
        return sentences[0] if sentences else combined[:200]
    return combined


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
