"""가톨릭 전례력 — 날짜 → 시기 자동 계산.

부활절은 매년 다른 날짜(춘분 후 첫 보름 후 첫 일요일)라 Gauss 알고리즘으로 계산.
나머지 시기는 부활절(또는 성탄)을 기준으로 상대 일수로 결정.

시기 정의(한국 천주교 일반 기준):
  - 사순(lent): 재의 수요일(부활절 46일 전) ~ 부활 전날(성토요일)
  - 부활(easter): 부활절 ~ 성령강림 전날(부활 49일 후 토요일)
  - 성령강림(pentecost): 성령강림 대축일 그 한 주 (부활 후 50~56일)
  - 대림(advent): 12월 25일 전 4번째 주일 ~ 12월 24일
  - 성탄(christmas): 12월 25일 ~ 다음 해 주의 세례 축일(1월 첫 일요일 이후)
  - 연중(ordinary): 위 어느 시기에도 속하지 않을 때 (기본값)
"""

from datetime import date, timedelta
from typing import Literal

Season = Literal["advent", "christmas", "lent", "easter", "pentecost", "ordinary"]


def easter_date(year: int) -> date:
    """Gauss 알고리즘으로 부활절 주일 날짜 계산."""
    a = year % 19
    b = year // 100
    c = year % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = ((h + l - 7 * m + 114) % 31) + 1
    return date(year, month, day)


def _advent_start(year: int) -> date:
    """대림 제1주일(12월 25일 전 4번째 주일). 11월 27일~12월 3일 범위."""
    christmas = date(year, 12, 25)
    # 성탄(12/25) 직전 일요일을 기준으로 -3주 (총 4번째 주일 = 성탄 4주 전 일요일)
    # 12/25가 일요일이면 그 자체가 대림 1주일이 아니라 그 직전 일요일(12/18)이 대림 1주일.
    weekday = christmas.weekday()  # 월=0 ... 일=6
    days_back = (weekday + 1) % 7  # 일요일이면 7, 월요일이면 1, ...
    if days_back == 0:
        days_back = 7
    last_sunday_before_christmas = christmas - timedelta(days=days_back)
    return last_sunday_before_christmas - timedelta(days=21)  # 4번째 주일


def _baptism_of_lord(year: int) -> date:
    """주의 세례 축일 — 1월 6일(주현 대축일) 직후 일요일.
    한국 일부 본당은 1월 첫 주일을 주현으로 옮겨 그 다음 주일을 주의 세례로 봄.
    여기서는 1월 6일 이후 첫 일요일(없으면 그 주 월요일) 디폴트 사용.
    성탄시기 종료일 = 주의 세례 = 이 날짜 포함.
    """
    epiphany = date(year, 1, 6)
    # epiphany 이후 첫 일요일
    weekday = epiphany.weekday()  # 월=0 ... 일=6
    if weekday == 6:
        # 6일이 일요일이면 그 다음 주 일요일이 주의 세례
        return epiphany + timedelta(days=7)
    days_until_sunday = 6 - weekday
    return epiphany + timedelta(days=days_until_sunday)


def compute_current_season(d: date) -> Season:
    """오늘 날짜로 전례 시기 자동 결정."""
    year = d.year

    easter = easter_date(year)
    ash_wednesday = easter - timedelta(days=46)
    pentecost = easter + timedelta(days=49)  # 부활 50일째 일요일
    pentecost_week_end = pentecost + timedelta(days=6)  # 성령강림 주간 마지막 토요일

    advent_start = _advent_start(year)
    # 성탄 종료일 = 이번 연도의 주의 세례 (성탄→다음 해이지만 1월~2월 사이라 같은 year로 처리)
    baptism_this_year = _baptism_of_lord(year)
    # 작년 성탄이 올해 1월까지 이어진 경우: year 1월 ~ 주의 세례 사이는 christmas
    last_year_christmas_start = date(year, 1, 1)  # 1월 1일은 무조건 성탄

    # 1) 1월 1일 ~ 주의 세례: 성탄
    if last_year_christmas_start <= d <= baptism_this_year:
        return "christmas"

    # 2) 사순: 재의 수요일 ~ 부활 전날
    if ash_wednesday <= d < easter:
        return "lent"

    # 3) 부활: 부활절 ~ 성령강림 전날
    if easter <= d < pentecost:
        return "easter"

    # 4) 성령강림 주간(부활 후 7번째 주): 성령강림 대축일 + 그 주
    if pentecost <= d <= pentecost_week_end:
        return "pentecost"

    # 5) 대림: 대림 제1주일 ~ 12월 24일
    if advent_start <= d <= date(year, 12, 24):
        return "advent"

    # 6) 성탄: 12월 25일 ~ 12월 31일
    if date(year, 12, 25) <= d <= date(year, 12, 31):
        return "christmas"

    # 7) 그 외: 연중
    return "ordinary"
