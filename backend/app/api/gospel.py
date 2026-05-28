import re
import logging
from datetime import date, datetime, timedelta

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

# 전례 시기 키워드 → 색 제의
_VESTMENT_MAP = [
    (("사순", "대림", "재의"), "purple"),
    (("성령", "성지", "수난", "순교", "성목요일", "성금요일"), "red"),
    (("연중",), "green"),
]


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


def _infer_vestment(season: str | None) -> str:
    """전례 시기 텍스트에서 색 제의를 추정 — 키워드 매칭, 기본 white."""
    if not season:
        return "white"
    for keywords, color in _VESTMENT_MAP:
        if any(k in season for k in keywords):
            return color
    return "white"


def _clean_lines(text: str) -> list[str]:
    return [l.strip() for l in text.split("\n") if l.strip()]


_BOOK_NAME_RE = re.compile(
    r'(마카베오기?|이사야서?|예레미야서?|에제키엘서?|호세아서?|요엘서?|아모스서?|오바드야서?|요나서?|미카서?|나훔서?|하바쿡서?|스바니야서?|하까이서?|즈카르야서?|말라키서?|로마|코린토|갈라티아|에페소|필리피|콜로새|테살로니카|티모테오|티토|필레몬|히브리|야고|베드로|요한|유다|묵시록?|창세기|탈출기|레위기|민수기|신명기|여호수아|판관기|룻|사무엘|열왕기|역대기|에즈라|느헤미야|토빗|유딧|에스테르|욥기|시편|잠언|코헬렛|아가|지혜서|집회서|애가|바룩|다니엘|즈가르야|사도행전)'
)


def _parse_first_reading(block_text: str) -> dict | None:
    """제1독서 블록(▥ ... 말씀입니다.) 파싱.
    구조:
        <소제목>
        ▥ 마카베오기 하권의 말씀입니다.6,18.21.24-31
        그 무렵 18 매우 뛰어난 율법 학자들 ...
        ...
        주님의 말씀입니다.
    """
    lines = _clean_lines(block_text)
    if not lines:
        return None
    # ▥ 가 포함된 라인 찾기
    ref_idx = next((i for i, l in enumerate(lines) if l.startswith("▥")), None)
    if ref_idx is None:
        return None
    ref_line = lines[ref_idx]
    # "▥ 마카베오기 하권의 말씀입니다.6,18.21.24-31" → "마카베오기 하권 6,18.21.24-31"
    m = re.match(r'▥\s*(.+?)의?\s*말씀입니다\.?\s*([\d,\.\-ㄱ-ㅎ\s]+)?', ref_line)
    if m:
        book = m.group(1).strip()
        chapter = (m.group(2) or "").strip()
        reference = f"{book} {chapter}".strip()
    else:
        reference = ref_line.lstrip("▥ ").strip()

    # 본문: ref_line 다음부터 "주님의 말씀입니다." 직전까지.
    body: list[str] = []
    for l in lines[ref_idx + 1:]:
        if l.startswith("주님의 말씀입니다") or l.startswith("◎ 하느님 감사합니다"):
            break
        # 회중 응답·소제목 표기 제외
        if l.startswith("◎") or l.startswith("○"):
            continue
        body.append(l)
    text = "\n".join(body).strip()
    if not text:
        return None
    return {"reference": reference, "text": text}


def _parse_psalm(block_text: str) -> dict | None:
    """화답송 블록(첫 줄=출처, ◎ refrain, ○ verses) 파싱.
    시편뿐 아니라 다니·이사야·탈출기 노래 등 다양한 출처 지원.
    구조:
        시편 34(33),2-3...(◎ 5ㄴ 참조)   또는   다니 3,52ㄱ.52ㄷ.53...(◎ 52ㄴ)
        ◎ 주님은 온갖 두려움에서 나를 구하셨네.
        ○ 나 언제나 주님을 찬미하리니 ... ◎
        ○ 나와 함께 주님을 칭송하여라 ... ◎
    """
    lines = _clean_lines(block_text)
    if not lines:
        return None
    # 화답송 후보 조건: ◎ 있음 + ○ 있음 (verses 多)
    if not any(l.startswith("◎") for l in lines):
        return None
    if sum(1 for l in lines if l.startswith("○")) < 1:
        return None
    # reference 는 첫 줄 전체에서 괄호 안의 후렴 출처 표기 분리
    raw_ref = lines[0]
    # "시편 34(33),2-3.4-5...(◎ 5ㄴ 참조)" 또는 "다니 3,...(◎ 52ㄴ)" — 끝 괄호 떼기
    reference = re.sub(r'\s*\(\s*◎[^)]*\)\s*$', '', raw_ref).strip()

    refrain = None
    verses: list[str] = []
    for l in lines[1:]:
        if l.startswith("◎"):
            cleaned = l.lstrip("◎ ").strip()
            if refrain is None and cleaned:
                refrain = cleaned
        elif l.startswith("○"):
            # 끝의 "◎" 떼고 한 줄로
            verse = re.sub(r'\s*◎\s*$', '', l.lstrip("○ ")).strip()
            if verse:
                verses.append(verse)

    if not refrain and not verses:
        return None
    return {
        "reference": reference,
        "refrain": refrain or "",
        "verses": verses,
    }


def _parse_alleluia(block_text: str) -> dict | None:
    """복음환호송 블록(짧은 ◎○◎ 패턴) 파싱.
    호출 시점에 이미 ✠/▥ 없는 ◎○ 블록임이 보장됨(순서 기반 식별).

    구조:
        야고 1,12   또는   묵시 1,8 참조
        ◎ 알렐루야.
        ○ 시련을 견디어 내는 사람은 행복하다. ...
        ◎ 알렐루야.
    """
    lines = _clean_lines(block_text)
    if not lines:
        return None
    if not any(l.startswith("◎") for l in lines):
        return None
    reference = lines[0].strip()
    refrain = None
    verse = None
    for l in lines[1:]:
        if l.startswith("◎"):
            cleaned = l.lstrip("◎ ").strip().rstrip(".")
            if refrain is None and cleaned:
                refrain = cleaned
        elif l.startswith("○"):
            v = l.lstrip("○ ").strip()
            if verse is None and v:
                verse = v
    if not refrain:
        return None
    return {
        "reference": reference,
        "refrain": refrain,
        "verse": verse or "",
    }


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


def _parse_readings(soup: BeautifulSoup) -> dict:
    """board_layout 블록들을 순회하며 1독서·2독서·화답송·복음환호송을 식별·파싱.

    굿뉴스 missa 페이지의 ▥/✠/◎ 패턴 분포:
      - ▥ + "말씀입니다" → 독서. 처음 만나는 게 1독서, 두 번째가 2독서(주일·대축일).
      - ◎ + ○ + ▥/✠ 없음 → 화답송 또는 복음환호송. 순서가 항상 화답송 → 복음환호송이므로
        먼저 만나는 것을 psalm, 다음을 alleluia 로 배정. 화답송이 시편 외 노래
        (다니·이사야·탈출기 등)인 경우도 동일 식별.
      - ✠ → 복음(별도 파서)
    """
    first_reading = None
    second_reading = None
    psalm = None
    alleluia = None

    for div in soup.find_all(class_='board_layout'):
        text = div.get_text(separator="\n", strip=True)
        if "✠" in text:
            continue  # 복음은 별도 파서
        lines = _clean_lines(text)
        if not lines:
            continue

        # 제1·2독서 (▥ + 말씀입니다)
        if any(l.startswith("▥") for l in lines):
            parsed = _parse_first_reading(text)
            if parsed:
                if first_reading is None:
                    first_reading = parsed
                elif second_reading is None:
                    second_reading = parsed
            continue

        # 화답송·복음환호송 모두 ◎○ 블록 — 순서로 구분
        has_response = any(l.startswith("◎") for l in lines)
        if not has_response:
            continue
        if psalm is None:
            parsed = _parse_psalm(text)
            if parsed:
                psalm = parsed
                continue
        if alleluia is None:
            parsed = _parse_alleluia(text)
            if parsed:
                alleluia = parsed
                continue

    return {
        "first": first_reading,
        "second": second_reading,
        "psalm": psalm,
        "alleluia": alleluia,
    }


async def _build_day(date_str: str, soup: BeautifulSoup) -> dict:
    """공통 데이터 — date·season·vestment·복음·readings 4종 + 호환 필드."""
    text = soup.get_text(separator="\n")
    gospel_ref = _parse_gospel_ref(text)
    gospel_text = _parse_gospel_text(soup)
    season = _parse_season(soup)
    readings = _parse_readings(soup)
    return {
        "date": date_str,
        "liturgical_season": season,
        "vestment_color": _infer_vestment(season),
        # 호환 필드 (기존 위젯이 사용)
        "gospel_reference": gospel_ref,
        "gospel_text": gospel_text,
        # 시안 read-tabs 4종
        "readings": {
            "first": readings["first"],
            "second": readings["second"],
            "psalm": readings["psalm"],
            "alleluia": readings["alleluia"],
            "gospel": (
                {"reference": gospel_ref, "text": gospel_text}
                if gospel_ref or gospel_text else None
            ),
        },
    }


# ── 엔드포인트 ─────────────────────────────────────────────

@router.get("/gospel/today")
async def get_today_gospel():
    """
    오늘의 미사 말씀(1독서·화답송·복음환호송·복음)과 전례 시기를 반환한다.
    일별 캐시 적용 — 홈 '오늘의 말씀' 위젯과 /word 페이지가 공용.
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

    result = await _build_day(date_str, soup)
    _cache_set("today", result)

    return {"success": True, "data": result, "message": ""}


@router.get("/gospel")
async def get_gospel(date_str: str = Query(..., alias="date", description="YYYY-MM-DD")):
    """
    주어진 날짜의 미사 말씀(1독서·화답송·복음환호송·복음)과 전례 시기를 반환한다.
    날짜별 캐시 — 같은 날짜를 다시 요청해도 굿뉴스에 한 번만 fetch.
    """
    try:
        date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(status_code=422, detail="date 형식이 올바르지 않습니다 (YYYY-MM-DD)")

    cached = _cache_get(f"day:{date_str}")
    if cached:
        return {"success": True, "data": cached, "message": ""}

    soup = await _fetch_missa_page(date_str)
    if soup is None:
        raise HTTPException(status_code=502, detail="굿뉴스 서버에 연결하지 못했습니다.")

    result = await _build_day(date_str, soup)
    _cache_set(f"day:{date_str}", result)

    return {"success": True, "data": result, "message": "" if result["gospel_reference"] else "해당 날짜의 복음 구절을 찾지 못했습니다."}


@router.get("/gospel/week")
async def get_gospel_week(from_str: str = Query(..., alias="from", description="주 시작 날짜 (월요일 권장) YYYY-MM-DD")):
    """주어진 날짜부터 7일치의 reference·season 만 가져옴 (본문 제외, 우측 rail 용).

    본문까지 모두 가져오면 응답이 무겁고 굿뉴스에 7번 부담이 가므로,
    참조·전례 시기만 추출해 list 로 반환한다. 본문은 사용자가 그 날짜를 클릭할 때
    /api/gospel?date= 로 별도 fetch.
    """
    try:
        start = date.fromisoformat(from_str)
    except ValueError:
        raise HTTPException(status_code=422, detail="from 형식이 올바르지 않습니다 (YYYY-MM-DD)")

    cached = _cache_get(f"week:{from_str}")
    if cached:
        return {"success": True, "data": cached, "message": ""}

    days = []
    for i in range(7):
        d = (start + timedelta(days=i)).isoformat()
        soup = await _fetch_missa_page(d)
        if soup is None:
            days.append({"date": d, "season": None, "first_ref": None, "gospel_ref": None})
            continue
        text = soup.get_text(separator="\n")
        # 1독서 reference 만 빠르게
        first = _parse_readings(soup)["first"]
        days.append({
            "date": d,
            "season": _parse_season(soup),
            "first_ref": first["reference"] if first else None,
            "gospel_ref": _parse_gospel_ref(text),
        })

    _cache_set(f"week:{from_str}", days)
    return {"success": True, "data": days, "message": ""}
