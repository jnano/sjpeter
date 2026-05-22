from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # 본당명 fallback. 실제 표시는 site_settings.PARISH_NAME (admin 입력) 우선.
    PROJECT_NAME: str = "본당 홈페이지"
    DATABASE_URL: str = "postgresql://user:password@localhost/cathedral"
    # JWT 서명 키. backend/.env 에서 반드시 32자 이상으로 설정해야 한다.
    # default 가 빈 문자열이라 누락 시 settings 초기화 단계에서 fail-fast.
    SECRET_KEY: str = ""
    UPLOAD_DIR: str = "uploads"

    # AWS Bedrock (Claude AI 분석)
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-1"

    # SMTP 설정 (비밀번호 찾기 이메일 발송)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    SITE_URL: str = "http://localhost:3000"

    # 분당 IP별 요청 한도 (slowapi default_limits).
    # 운영 기본 200/min, dev 는 .env 에서 1000+ 등 상향 권장 — /photos 무한스크롤·admin 다중 패널이 쉽게 한도 초과.
    RATE_LIMIT_PER_MINUTE: int = 200

    # CORS 허용 origin (콤마 구분). 기본은 localhost:3000 만 — LAN IP·운영 도메인은 .env 에서.
    CORS_ORIGINS: str = "http://localhost:3000"

    # Next.js 서버(NextAuth) → backend internal endpoint 인증용 shared secret.
    # 빈 값이면 X-Internal-Secret 검증을 건너뛴다 (dev 편의). 운영에선 반드시 32자+ 채울 것.
    INTERNAL_API_SECRET: str = ""

    class Config:
        env_file = ".env"


settings = Settings()

# SECRET_KEY fail-fast — 누락·평문 기본값이면 즉시 기동 중단.
# JWT 위조 위험을 막기 위함이며 운영뿐 아니라 dev 환경도 동일 기준을 적용한다.
if not settings.SECRET_KEY or len(settings.SECRET_KEY) < 32:
    raise RuntimeError(
        "SECRET_KEY 가 backend/.env 에 설정되지 않았거나 32자 미만입니다.\n"
        "  → openssl rand -hex 32 결과를 backend/.env 의 SECRET_KEY= 에 붙여 넣으세요."
    )
