"""통합검색용 동의어 사전 — 본당 도메인 특화.

검색어 들어오면 동의어 그룹을 찾아 OR 매칭으로 확장한다.
대소문자·공백 무시, 양방향 매칭.

예: "성당건축" 검색 → ["성당건축", "성전건축", "성전 건축", "신축", "건축"] 모두 검사

새 동의어 추가는 이 파일 한 곳만 수정하면 됨.
"""

# 한 그룹 안의 단어는 서로 동의어로 취급
SYNONYM_GROUPS: list[list[str]] = [
    # 본당 핵심 용어
    ["성당건축", "성전건축", "성전 건축", "신축", "건축"],
    ["신부님", "신부", "사제", "주임신부", "보좌신부"],
    ["수녀님", "수녀", "수도자"],
    ["주임", "본당장"],
    ["사목회", "사목협의회"],
    ["사목지표", "사목 방향", "올해의 지표", "본당 슬로건"],
    # 미사·전례
    ["미사", "예식", "전례"],
    ["주일미사", "주일 미사"],
    ["고리기도", "묵주기도"],
    ["성모성월", "성모 성월"],
    ["판공성사", "고해성사"],
    # 모임·활동
    ["구역", "반"],
    ["소공동체", "소공"],
    ["피정", "피교"],
    ["봉사", "봉헌"],
    # 시간·날짜 별칭
    ["올해", "금년", "이번 해"],
    ["주보", "주간소식", "본당 주보"],
    # 공동체 그룹
    ["청년회", "청년"],
    ["성가대", "성가단"],
    ["교리", "교리반"],
    ["연도", "위령기도"],
]


def _normalize(text: str) -> str:
    """공백 제거 + 소문자."""
    return "".join((text or "").split()).lower()


# 사전 컴파일: 정규화된 단어 → 같은 그룹의 모든 동의어(정규화 형태) 집합
_LOOKUP: dict[str, list[str]] = {}
for _group in SYNONYM_GROUPS:
    _norm_group = [_normalize(w) for w in _group]
    for w in _norm_group:
        _LOOKUP[w] = _norm_group


def expand(query: str) -> list[str]:
    """검색어를 동의어로 확장. 항상 원본 정규화형을 포함.

    Returns: 공백·소문자 정규화된 동의어 리스트 (중복 제거)
    """
    norm = _normalize(query)
    if not norm:
        return []
    # 정확 매칭 우선
    if norm in _LOOKUP:
        return list(_LOOKUP[norm])
    # 부분 매칭: 검색어 안에 동의어 그룹의 어떤 단어가 포함되어 있으면 확장
    for key, group in _LOOKUP.items():
        if key in norm or norm in key:
            return list({norm, *group})
    return [norm]
