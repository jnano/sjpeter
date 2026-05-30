"""공용 응답 Pydantic 모델 (v1.5.453).

dict 직접 반환 대신 이 모델들을 response_model 로 지정하면:
- OpenAPI 스키마에 응답 형식이 정확히 표시됨
- 프론트 IDE 가 응답 키 자동 완성 제공
- 응답 형식 변경 시 silent breakage 방지
"""
from pydantic import BaseModel
from typing import Optional


class OkResponse(BaseModel):
    """단순 성공 응답 — { "ok": true } 패턴."""
    ok: bool = True


class MessageResponse(BaseModel):
    """사용자 표시용 메시지 응답 — { "message": "..." } 패턴.

    인증·메일·세션 등 사용자 친화적 안내 텍스트 반환에 사용.
    """
    message: str


class DeletedIdResponse(BaseModel):
    """단일 ID 삭제 확인 — { "deleted": 123 } 패턴."""
    deleted: int


class BulkDeleteResponse(BaseModel):
    """다중 ID 삭제 결과 — { "deleted": [1,2], "not_found": [3] } 패턴."""
    deleted: list[int]
    not_found: list[int]


class BackfillCountsResponse(BaseModel):
    """일괄 작업(backfill, AI 재분석 등) 카운트 응답."""
    created: int = 0
    updated: int = 0
    skipped: int = 0
    failed: int = 0
    total: int = 0


class BulletinAiStatusResponse(BaseModel):
    """주보 AI 분석 비동기 시작 응답."""
    ok: bool = True
    ai_status: str = "processing"


class RoutedResponse(BaseModel):
    """AI 추출 이미지 라우팅 결과."""
    ok: bool = True
    routed_to: str
    post_id: Optional[int] = None


class SmtpTestResponse(BaseModel):
    """SMTP 연결 테스트 결과."""
    ok: bool = True
    message: str
