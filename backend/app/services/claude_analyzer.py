import json
import logging
from datetime import date

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

_client = None

TEXT_MODEL   = "global.anthropic.claude-haiku-4-5-20251001-v1:0"
VISION_MODEL = "global.anthropic.claude-sonnet-4-6"


def _get_client():
    from app.core.site_settings import get_setting
    from app.core.config import settings
    return boto3.client(
        service_name="bedrock-runtime",
        region_name=get_setting("AWS_REGION", settings.AWS_REGION),
        aws_access_key_id=get_setting("AWS_ACCESS_KEY_ID", settings.AWS_ACCESS_KEY_ID),
        aws_secret_access_key=get_setting("AWS_SECRET_ACCESS_KEY", settings.AWS_SECRET_ACCESS_KEY),
    )


_SYSTEM = (
    "당신은 천주교 성당 주보에서 공지·행사·모임을 추출하는 전문가입니다. "
    "주보에서 공지, 행사, 모임 항목을 모두 찾아 JSON으로만 응답하세요. "
    "설명 없이 JSON만 반환하세요."
)


def _build_prompt(published_date: date, text: str) -> str:
    date_str = published_date.isoformat()
    year = published_date.year
    return f"""발행일 {date_str} 주보입니다. 공지·행사·모임 항목을 모두 추출해 주세요.

날짜 규칙:
- 이 주보의 기준 연도는 {year}년입니다. PDF 첫 페이지 상단(예: "제623호 2026년 5월 11일")에서도 확인할 수 있습니다.
- "5월 18일"처럼 연도 없이 표기된 날짜는 반드시 {year}년으로 처리하세요.
- 단, 발행일({date_str})보다 훨씬 이전이라 다음 해가 분명한 경우에만 {year + 1}년으로 처리하세요.

event_type 분류 기준:
- "공지": 날짜 없이 알리는 안내·인사·모집·결과 등 공동체 공지 사항
- "행사": 전체 본당 또는 다수를 대상으로 하는 날짜 있는 이벤트 (피정, 순례, 강의, 봉사, 특별 미사 등)
- "모임": 특정 단체·소그룹의 모임 — 날짜·시간이 있어도 모임으로 분류 (사목회의, 구역 모임, 소공동체, 반 모임, 각종 회의, 단체 총회 등)

다음 JSON 형식으로만 응답하세요:
{{"events": [
  {{
    "title": "제목",
    "content": "원문 그대로의 상세 내용",
    "group_name": "담당 모임명 (없으면 null)",
    "event_date": "YYYY-MM-DD (불명확하면 null)",
    "location": "장소 (없으면 null)",
    "event_type": "공지|행사|모임"
  }}
]}}

주보 내용:
{text}"""


def _invoke(model_id: str, messages: list[dict]) -> str:
    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 4096,
        "system": _SYSTEM,
        "messages": messages,
    })
    try:
        resp = _get_client().invoke_model(modelId=model_id, body=body)
        result = json.loads(resp["body"].read())
        return result["content"][0]["text"]
    except ClientError as e:
        logger.error("Bedrock invoke_model 실패: %s", e)
        raise


def analyze_bulletin_text(published_date: date, text: str) -> list[dict]:
    """텍스트 기반 분석."""
    messages = [{"role": "user", "content": _build_prompt(published_date, text)}]
    raw = _invoke(TEXT_MODEL, messages)
    return _parse_response(raw)


def analyze_bulletin_images(published_date: date, images_b64: list[str]) -> list[dict]:
    """이미지(스캔본) 기반 분석 — Bedrock Vision 사용."""
    content: list[dict] = [
        {"type": "text", "text": _build_prompt(published_date, "(이미지를 직접 읽으세요)")}
    ]
    for img in images_b64:
        content.append({
            "type": "image",
            "source": {"type": "base64", "media_type": "image/jpeg", "data": img},
        })
    raw = _invoke(VISION_MODEL, [{"role": "user", "content": content}])
    return _parse_response(raw)


def _parse_response(raw: str) -> list[dict]:
    try:
        text = raw.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        data = json.loads(text.strip())
        return data.get("events", [])
    except Exception:
        return []
