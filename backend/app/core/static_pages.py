"""사이트 내 정적 페이지 화이트리스트.

menu_items.link_type='page' 일 때 static_page_slug로 참조되는 페이지들.
새 페이지 추가 시 여기와 frontend에 모두 등록.
"""

STATIC_PAGES: list[dict] = [
    # 성당 소개
    {"slug": "/about",    "label": "성당 안내",          "category": "성당 소개"},
    {"slug": "/pastor",   "label": "주임신부님",          "category": "성당 소개"},
    {"slug": "/saint",    "label": "수호성인 성 베드로",  "category": "성당 소개"},
    {"slug": "/history",  "label": "본당 연혁",           "category": "성당 소개"},
    {"slug": "/pastors",  "label": "역대 신부님",         "category": "성당 소개"},
    {"slug": "/sisters",  "label": "역대 수녀님",         "category": "성당 소개"},
    {"slug": "/priests",  "label": "본당 출신 사제",      "category": "성당 소개"},
    {"slug": "/info",     "label": "찾아오시는 길",       "category": "성당 소개"},
    # 본당 공동체
    {"slug": "/council",  "label": "사목평의회",          "category": "본당 공동체"},
    {"slug": "/groups",   "label": "분과와 단체",         "category": "본당 공동체"},
    {"slug": "/vision",   "label": "올해의 사목 방향",    "category": "본당 공동체"},
    # 말씀과 기도
    {"slug": "/word",       "label": "오늘의 복음",       "category": "말씀과 기도"},
    {"slug": "/bulletin",   "label": "주보 아카이브",     "category": "말씀과 기도"},
    {"slug": "/meditation", "label": "묵상 글",           "category": "말씀과 기도"},
    {"slug": "/prayer",     "label": "기도문",            "category": "말씀과 기도"},
    # 알림·게시판
    {"slug": "/calendar",   "label": "본당 일정",         "category": "알림"},
    # 사진 갤러리
    {"slug": "/gallery/liturgy", "label": "전례 사진",    "category": "사진"},
    {"slug": "/gallery/events",  "label": "행사 사진",    "category": "사진"},
    # 분과 상세 페이지들 (community_groups slug 기반)
    # /groups/{slug}는 동적이므로 여기에 모두 못 넣음. admin이 추가하려면 자유 입력 허용.
]

STATIC_PAGE_SLUGS = {p["slug"] for p in STATIC_PAGES}
# 주: STATIC_PAGES.label 은 admin 메뉴 picker UI에서 슬러그 고를 때 옆에 보이는
# 힌트 텍스트로만 쓰임. 실제 사이트 노출 라벨은 menu_items.label 이 단일 진실 소스.
