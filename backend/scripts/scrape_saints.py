"""CDCC(가톨릭교리통신교육회) 성인 목록 1회성 수집 스크립트.

추출 필드: 한글명, 라틴 원어명, 축일(월·일), 신분 — 이상 4개로 한정.
(생애·출생지·순교지 등 사이트 고유 표기물은 수집하지 않음 → 데이터베이스 권리·약관 분쟁 회피.)

이름·축일·신분은 가톨릭 보편 전례력의 사실 데이터로 저작권 비대상.
출처는 사이트 푸터·관리자 페이지에 명시 권장.

사용: python scripts/scrape_saints.py [출력파일]
기본 출력: backend/app/data/saints_seed.json
"""
from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path
from typing import Iterable

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://www.cdcc.co.kr/community/saint.asp"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    )
}
SLEEP_BETWEEN_REQUESTS = 0.7  # 서버 예의

# 한글 접두어 → 신분 prefix 매핑
PREFIX_TO_RANK = {
    "성": "saint_m",       # 남자 성인
    "성녀": "saint_f",     # 여자 성인
    "복자": "blessed_m",
    "복녀": "blessed_f",
}


def parse_feast(text: str) -> tuple[int, int] | None:
    """'5월 10일' → (5, 10)."""
    m = re.search(r"(\d{1,2})\s*월\s*(\d{1,2})\s*일", text)
    if not m:
        return None
    return int(m.group(1)), int(m.group(2))


def parse_korean_name(raw: str) -> tuple[str, str | None]:
    """'성 가탈도' → ('가탈도', '성'). 접두어 없으면 ('가탈도', None)."""
    raw = raw.replace("\xa0", " ").strip()
    for prefix in ("성녀", "성", "복자", "복녀"):
        if raw.startswith(prefix + " "):
            return raw[len(prefix) + 1:].strip(), prefix
    return raw, None


def fetch_page(month: int, page: int, session: requests.Session) -> str:
    resp = session.get(
        BASE_URL,
        params={
            "page": page,
            "sch_mon": month,
            "sch_day": "",
            "search_t": "",
            "al_s": "",
            "al_e": "",
            "ja_s": "",
            "ja_e": "",
        },
        headers=HEADERS,
        timeout=15,
    )
    resp.raise_for_status()
    return resp.text


def parse_rows(html: str, month: int) -> Iterable[dict]:
    soup = BeautifulSoup(html, "html.parser")
    rows = soup.select('tr[onclick^="go2view"]')
    for tr in rows:
        onclick = tr.get("onclick", "")
        idx_match = re.search(r"go2view\((\d+)\)", onclick)
        if not idx_match:
            continue
        idx = int(idx_match.group(1))

        tds = tr.find_all("td")
        if len(tds) < 4:
            continue

        raw_korean = tds[0].get_text(strip=True)
        raw_latin = tds[1].get_text(strip=True)
        raw_feast = tds[2].get_text(strip=True)
        raw_title = tds[3].get_text(strip=True)

        korean, prefix = parse_korean_name(raw_korean)
        feast = parse_feast(raw_feast)
        if not feast or not korean:
            continue

        # 축일 월이 검색 월과 일치해야 (다른 월 행이 섞이지 않도록)
        if feast[0] != month:
            continue

        yield {
            "idx": idx,
            "korean_name": korean,
            "latin_name": (raw_latin or "").strip() or None,
            "feast_month": feast[0],
            "feast_day": feast[1],
            "title": (raw_title or "").strip() or None,
            "prefix": prefix,  # 성/성녀/복자/복녀
        }


def crawl_month(month: int, session: requests.Session) -> list[dict]:
    out: list[dict] = []
    page = 1
    while True:
        html = fetch_page(month, page, session)
        rows = list(parse_rows(html, month))
        if not rows:
            break
        out.extend(rows)
        if len(rows) < 20:
            break
        page += 1
        if page > 30:
            break
        time.sleep(SLEEP_BETWEEN_REQUESTS)
    return out


def main() -> None:
    out_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / "app" / "data" / "saints_seed.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    session = requests.Session()
    all_rows: list[dict] = []
    seen_idx: set[int] = set()

    for month in range(1, 13):
        rows = crawl_month(month, session)
        # 중복 idx 제거
        for r in rows:
            if r["idx"] in seen_idx:
                continue
            seen_idx.add(r["idx"])
            all_rows.append(r)
        print(f"month={month:2d}  collected={len(rows):3d}  cumulative_unique={len(all_rows):4d}", flush=True)
        time.sleep(SLEEP_BETWEEN_REQUESTS)

    # 정렬: 한글명 → 축일
    all_rows.sort(key=lambda r: (r["korean_name"], r["feast_month"], r["feast_day"]))

    with out_path.open("w", encoding="utf-8") as f:
        json.dump(all_rows, f, ensure_ascii=False, indent=2)

    print(f"\n총 {len(all_rows)}명 수집 완료 → {out_path}")


if __name__ == "__main__":
    main()
