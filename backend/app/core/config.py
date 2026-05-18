from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "세종성베드로성당"
    DATABASE_URL: str = "postgresql://user:password@localhost/cathedral"
    SECRET_KEY: str = "change-this-in-production"
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

    class Config:
        env_file = ".env"


settings = Settings()
