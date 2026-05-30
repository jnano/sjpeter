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


# ──────────────────────────────────────────
# Bulletin 통계·라우팅 응답 (v1.5.455 추가)
# ──────────────────────────────────────────

class BulletinResultCounts(BaseModel):
    """한 주보의 결과물(추출/이벤트/말씀/사목지표/공지/이미지) 카운트."""
    extractions: int = 0
    events: int = 0
    meditations: int = 0
    visions: int = 0
    posts: int = 0
    images: int = 0


class BatchBulletinCountsResponse(BaseModel):
    """다건 주보 결과물 카운트 합산 응답 — /routed-counts/batch."""
    per_bulletin: dict[int, BulletinResultCounts] = {}
    sum: BulletinResultCounts = BulletinResultCounts()
    not_found: list[int] = []


class DurationStats(BaseModel):
    count: int = 0
    avg: int = 0
    p50: int = 0
    p95: int = 0
    max: int = 0


class TopError(BaseModel):
    error: str
    count: int


class EventTypeStat(BaseModel):
    event_type: str
    count: int


class RecentAnalysis(BaseModel):
    id: int
    issue_number: Optional[int] = None  # bulletins.issue_number 는 정수 (예: 75호)
    published_date: Optional[str] = None
    ai_status: Optional[str] = None
    ai_started_at: Optional[str] = None
    ai_finished_at: Optional[str] = None
    ai_retry_count: int = 0
    ai_error: Optional[str] = None


class AiAnalysisStatsResponse(BaseModel):
    """AI 분석 관찰성 지표 — /ai-stats."""
    total_analyzed: int = 0
    by_status: dict[str, int] = {}
    success_rate: float = 0.0
    duration_seconds: DurationStats = DurationStats()
    retries: dict[int, int] = {}
    top_errors: list[TopError] = []
    by_event_type: list[EventTypeStat] = []
    recent: list[RecentAnalysis] = []


class BulkApproveResponse(BaseModel):
    """일괄 승인 결과 — /extractions/bulk-approve."""
    approved: list[int] = []
    skipped: list[int] = []
    failed: list[int] = []
