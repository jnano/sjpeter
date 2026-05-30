import json
import logging
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

_client = None

TEXT_MODEL   = "global.anthropic.claude-haiku-4-5-20251001-v1:0"
VISION_MODEL = "global.anthropic.claude-sonnet-4-6"


def is_ai_available() -> bool:
    """site_settings 의 AWS 3개 키가 모두 설정되어 있으면 True.

    이 함수가 False 면 주보 AI 추출 기능은 비활성 — 핵심 기능(업로드·아카이브·게시판)은 영향 없음.
    """
    from app.core.site_settings import get_setting
    return bool(
        (get_setting("AWS_ACCESS_KEY_ID") or "").strip()
        and (get_setting("AWS_SECRET_ACCESS_KEY") or "").strip()
        and (get_setting("AWS_REGION") or "").strip()
    )


def _get_client():
    from app.core.site_settings import get_setting
    from botocore.config import Config
    # AWS 자격증명은 site_settings DB 단일 source — process.env / settings.AWS_* fallback 사용 안 함.
    # admin /admin/settings 의 AI 그룹에서 입력. 비어 있으면 Bedrock 호출 시 인증 실패 → AI 추출 기능만 비활성.
    # Vision 모델(이미지 다수 포함)은 60초 기본 read_timeout으로 부족 → 5분으로 확장
    bedrock_config = Config(read_timeout=300, connect_timeout=20, retries={"max_attempts": 2})
    return boto3.client(
        service_name="bedrock-runtime",
        region_name=get_setting("AWS_REGION"),
        aws_access_key_id=get_setting("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=get_setting("AWS_SECRET_ACCESS_KEY"),
        config=bedrock_config,
    )


_SYSTEM = (
    "당신은 천주교 성당 주보에서 공지·행사·모임·묵상·본당 사목지표를 추출하는 전문가입니다. "
    "JSON 으로만 응답하며 설명·코드펜스 없이 valid JSON 만 반환하세요. "
    "content 의 줄바꿈은 \\n, 따옴표는 \\\" 로 escape. "
    "한국 가톨릭 용어 정확히 표기: 전입가정·영성체·사목회의·본당 사목지표·견진·세례·레지오·꾸리아."
)


def _load_typo_rules(db) -> list[tuple[str, str, list[str]]]:
    """ai_typo_rules 테이블에서 (wrong, replacement, exclude_prefixes) 매번 fetch."""
    from sqlalchemy import text as _text
    try:
        rows = db.execute(
            _text("SELECT wrong, replacement, exclude_prefixes FROM ai_typo_rules")
        ).fetchall()
        return [(r.wrong, r.replacement, list(r.exclude_prefixes or [])) for r in rows]
    except Exception:
        return []


def fix_typos(text: str | None, db=None) -> str | None:
    """추출된 텍스트의 알려진 오타를 사전 기반 1:1 치환으로 교정.

    exclude_prefixes 가 지정된 규칙은 같은 줄에 그 prefix 가 wrong 보다 앞에 있으면
    해당 occurrence 만 skip — 다른 줄·다른 위치의 동일 wrong 은 정상 치환.
    """
    if not text or db is None:
        return text
    import re as _re
    out = text
    for wrong, replacement, excludes in _load_typo_rules(db):
        if not excludes:
            out = out.replace(wrong, replacement)
            continue
        # occurrence 단위로 검사 — 같은 줄의 앞부분에 prefix 가 있으면 skip
        result_parts: list[str] = []
        pos = 0
        for m in _re.finditer(_re.escape(wrong), out):
            start = m.start()
            line_start = out.rfind("\n", 0, start) + 1
            before_on_line = out[line_start:start]
            skip = any(p in before_on_line for p in excludes if p)
            result_parts.append(out[pos:start])
            result_parts.append(wrong if skip else replacement)
            pos = m.end()
        result_parts.append(out[pos:])
        out = "".join(result_parts)
    return out


def _build_prompt(published_date: date, text: str) -> str:
    date_str = published_date.isoformat()
    year = published_date.year
    return f"""발행일 {date_str} 주보입니다. 공지·행사·모임·묵상·본당 사목지표 항목을 모두 추출해 주세요.

날짜 규칙:
- 이 주보의 기준 연도는 {year}년입니다. PDF 첫 페이지 상단(예: "제623호 2026년 5월 11일")에서도 확인할 수 있습니다.
- "5월 18일"처럼 연도 없이 표기된 날짜는 반드시 {year}년으로 처리하세요.
- 단, 발행일({date_str})보다 훨씬 이전이라 다음 해가 분명한 경우에만 {year + 1}년으로 처리하세요.

event_type 분류 기준:
- "공지": 날짜 없이 알리는 안내·인사·모집·결과 등 공동체 공지 사항
- "행사": 전체 본당 또는 다수를 대상으로 하는 날짜 있는 이벤트 (피정, 순례, 강의, 봉사, 특별 미사 등)
- "모임": 특정 단체·소그룹의 모임 — 날짜·시간이 있어도 모임으로 분류 (사목회의, 구역 모임, 소공동체, 반 모임, 각종 회의, 단체 총회 등)
- "묵상": "주일 말씀 묵상과 실천", "복음 묵상", "한 줄 묵상", 강론·말씀 나눔 등 영적 양식 본문 (제목 + 성경 구절 출처 + 본문 + 이번 주 실천). 묵상은 아래 scripture·practice·pull_quote 필드도 함께 분리해서 채우세요.
- "지표": "본당 사목지표", "올해의 사목 방향", "본당 슬로건" 등 본당 사목 방향성 (연간 1회 정도 등장)

temporal_kind (알림 게이트 — 2분류): active(진행중·앞으로 유효: 발행일 이후 예정 일정 또는 날짜 없는 모집·신청·상시 안내) | ended(종료됨·알림 불필요: 이미 지난 일·후기·보고·끝난 회고, 또는 시점이 모호해 알림이 부적절한 것). 판단이 애매하면 ended.
temporal_reason: 30자 이내, 단순 명사구. ended 이면 null 가능.
groups: 본문 언급 분과·단체명 배열. 없으면 []. group_name 은 groups[0] 와 동일.

importance (중요도):
- "high": 본당 전체에 영향(주임신부 인사·전입·송별, 미사 시간 변경, 대축일·중요 전례, 본당 단위 행사 결정, 정책 변경 등)
- "normal": 일반 안내·행사·모임·모집
- "low": 자잘한 변동(주차 안내, 분과 내부 공지, 단체 소공지, 회의 일정 등)

JSON 형식 (설명·코드펜스 없이):
{{"events": [
  {{
    "title": "제목",
    "content": "원문 그대로. 단 묵상은 '이번 주 실천' 항목을 뺀 묵상 본문만 (실천은 practice 로 분리)",
    "scripture": "묵상의 성경 구절 출처. 그 외 null (예: '마태 25,31-46')",
    "practice": "묵상의 '이번 주 실천/실천하기' 항목들. 한 줄에 하나씩 \\n 으로 구분. 각 줄 앞에 번호(1. 2.)나 글머리표(-, ·, •)를 붙이지 말고 실천 내용만. 없거나 묵상이 아니면 null",
    "pull_quote": "묵상 본문에서 가장 핵심이 되는 한 문장(강조 인용). 적절한 게 없거나 묵상이 아니면 null",
    "group_name": "단일 (없으면 null)",
    "groups": ["복수 분과·단체"],
    "event_date": "YYYY-MM-DD 또는 null",
    "end_date": "YYYY-MM-DD 또는 null",
    "location": "장소 또는 null",
    "event_type": "공지|행사|모임|묵상|지표",
    "temporal_kind": "active|ended",
    "temporal_reason": "30자 이내 또는 null",
    "importance": "high|normal|low"
  }}
]}}

주보 내용:
{text}"""


def _invoke(model_id: str, messages: list[dict]) -> str:
    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        # 묵상 본문 등 긴 콘텐츠 포함 시 4096으로 잘려 JSON 파싱 실패 발생 → 8192로 확장
        "max_tokens": 8192,
        "system": _SYSTEM,
        "messages": messages,
    })
    try:
        resp = _get_client().invoke_model(modelId=model_id, body=body)
        result = json.loads(resp["body"].read())
        raw_text = result["content"][0]["text"]
        logger.info("[bedrock %s] 응답 %d자, 시작: %r", model_id, len(raw_text), raw_text[:200])
        return raw_text
    except ClientError as e:
        logger.error("Bedrock invoke_model 실패: %s", e)
        raise
    except Exception as e:
        logger.error("Bedrock invoke 알 수 없는 오류: %s", e, exc_info=True)
        raise


def analyze_bulletin_text(published_date: date, text: str) -> list[dict]:
    """텍스트 기반 분석."""
    messages = [{"role": "user", "content": _build_prompt(published_date, text)}]
    raw = _invoke(TEXT_MODEL, messages)
    return _parse_response(raw)


# Bedrock Vision 동시 호출 수 — 너무 크게 잡으면 throttling, 5~6이 안전한 기본값
_VISION_MAX_WORKERS = 6


def _analyze_single_page(
    page_idx: int, total: int, img_b64: str, published_date: date
) -> tuple[int, list[dict]]:
    """단일 페이지를 Vision 으로 분석. (페이지 번호, events 리스트) 반환.

    페이지 하나가 실패해도 다른 페이지에 영향을 주지 않도록 안에서 예외를 흡수한다.
    """
    prompt = _build_prompt(
        published_date,
        f"(이미지를 직접 읽으세요. 이것은 {total}페이지 중 {page_idx}번째 페이지입니다.)",
    )
    content: list[dict] = [
        {"type": "text", "text": prompt},
        {"type": "image",
         "source": {"type": "base64", "media_type": "image/jpeg", "data": img_b64}},
    ]
    started = time.monotonic()
    try:
        raw = _invoke(VISION_MODEL, [{"role": "user", "content": content}])
        events = _parse_response(raw)
        logger.info(
            "[vision page %d/%d] %d건 (%.1fs)",
            page_idx, total, len(events), time.monotonic() - started,
        )
        return page_idx, events
    except Exception as exc:
        logger.warning(
            "[vision page %d/%d] 호출 실패: %s — 건너뜀 (%.1fs)",
            page_idx, total, exc, time.monotonic() - started,
        )
        return page_idx, []


def analyze_bulletin_images(published_date: date, images_b64: list[str]) -> list[dict]:
    """이미지(스캔본) 기반 분석 — Bedrock Vision (페이지별 **병렬 호출**).

    각 페이지를 따로 호출해 응답을 짧게 유지하면서, ThreadPoolExecutor 로
    동시에 처리해 총 소요시간을 페이지 수와 무관하게 1~2회 호출 수준으로 줄인다.

    페이지 하나가 실패해도 나머지는 정상 수집됨. 페이지 간 단순 dedup 만 하고,
    정밀한 중복 제거는 _route_and_save_events 의 fingerprint/fuzzy 가 처리.
    """
    if not images_b64:
        return []

    total = len(images_b64)
    workers = min(_VISION_MAX_WORKERS, total)
    started = time.monotonic()
    logger.info(
        "[vision] %d페이지 병렬 분석 시작 (workers=%d)", total, workers,
    )

    # 페이지 번호 보존을 위해 dict 로 모음
    results: dict[int, list[dict]] = {}
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [
            pool.submit(_analyze_single_page, i, total, img, published_date)
            for i, img in enumerate(images_b64, start=1)
        ]
        for fut in as_completed(futures):
            page_idx, events = fut.result()
            results[page_idx] = events

    # 페이지 순서대로 합치고 페이지 간 단순 dedup
    all_events: list[dict] = []
    seen_titles: set[str] = set()
    for i in range(1, total + 1):
        for ev in results.get(i, []):
            title_key = "".join((ev.get("title") or "").split())
            if title_key and title_key in seen_titles:
                continue
            seen_titles.add(title_key)
            all_events.append(ev)

    elapsed = time.monotonic() - started
    logger.info(
        "[vision] 총 %d건 (페이지 %d장, 병렬 %d, %.1fs)",
        len(all_events), total, workers, elapsed,
    )
    return all_events


def _parse_response(raw: str) -> list[dict]:
    """AI 응답을 events 배열로 파싱.

    Bedrock Vision 응답은 content 본문에 escape되지 않은 줄바꿈·따옴표를
    종종 포함해 json.loads가 중간에 깨지는 경우가 잦다. 깨지더라도 그 이전까지
    완성된 항목은 모두 살리기 위해 단계적으로 시도한다.
        1) 그대로 json.loads
        2) 코드펜스 제거 + 사소한 정규화 후 json.loads
        3) events 배열에서 완성된 {…} 객체를 하나씩 partial 파싱
    """
    text = _strip_code_fence(raw).strip()

    # 1) strict
    try:
        data = json.loads(text)
        events = data.get("events", []) if isinstance(data, dict) else []
        logger.info("[parse] strict 파싱 성공 — events %d건", len(events))
        return events
    except Exception:
        pass

    # 2) trailing comma 같은 사소한 오류 정리 후 재시도
    normalized = re.sub(r",\s*([}\]])", r"\1", text)
    try:
        data = json.loads(normalized)
        events = data.get("events", []) if isinstance(data, dict) else []
        logger.info("[parse] normalize 후 파싱 성공 — events %d건", len(events))
        return events
    except Exception:
        pass

    # 3) partial — events 배열을 객체 단위로 잘라 하나씩 파싱
    events = _partial_parse_events(text)
    if events:
        logger.warning(
            "[parse] strict 실패 → partial로 %d건 복구 (raw %d자)",
            len(events),
            len(raw),
        )
        return events

    logger.warning(
        "[parse] 모든 파싱 실패 — raw[:300]=%r", raw[:300]
    )
    return []


def _strip_code_fence(text: str) -> str:
    """```json … ``` 코드펜스 제거."""
    stripped = text.strip()
    if not stripped.startswith("```"):
        return stripped
    # 첫 ``` 뒤부터 마지막 ``` 앞까지
    body = stripped[3:]
    if body.startswith("json"):
        body = body[4:]
    elif body.startswith("\n"):
        body = body[1:]
    if body.endswith("```"):
        body = body[:-3]
    return body


def _partial_parse_events(text: str) -> list[dict]:
    """events 배열에서 균형 잡힌 {…} 객체를 하나씩 추출해 각각 json.loads.

    AI가 어떤 한 항목의 본문에서 escape를 빠뜨려도, 그 이전까지의 정상 항목과
    이후 정상 항목은 모두 살려낸다. JSON 객체 안의 문자열까지 인식해
    문자열 안의 `{` `}` 는 깊이 카운트에서 제외한다.
    """
    start = text.find('"events"')
    if start == -1:
        return []
    bracket_start = text.find("[", start)
    if bracket_start == -1:
        return []

    results: list[dict] = []
    i = bracket_start + 1
    n = len(text)
    while i < n:
        # 다음 객체 시작 위치
        while i < n and text[i] != "{":
            if text[i] == "]":
                return results
            i += 1
        if i >= n:
            break

        obj_start = i
        depth = 0
        in_str = False
        escape = False
        end = -1
        while i < n:
            ch = text[i]
            if in_str:
                if escape:
                    escape = False
                elif ch == "\\":
                    escape = True
                elif ch == '"':
                    in_str = False
            else:
                if ch == '"':
                    in_str = True
                elif ch == "{":
                    depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        end = i
                        break
            i += 1

        if end == -1:
            # 마지막 객체가 닫히지 않음 — 버린다
            break

        chunk = text[obj_start : end + 1]
        try:
            obj = json.loads(chunk)
            if isinstance(obj, dict):
                results.append(obj)
        except Exception:
            # 이 객체만 깨짐 — 건너뛰고 다음으로
            pass
        i = end + 1

    return results
