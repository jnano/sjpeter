from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "세종성베드로성당"
    DATABASE_URL: str = "postgresql://user:password@localhost/cathedral"
    SECRET_KEY: str = "change-this-in-production"
    UPLOAD_DIR: str = "uploads"
    ANTHROPIC_API_KEY: str = ""

    # SMTP 설정 (비밀번호 찾기 이메일 발송)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    SITE_URL: str = "http://localhost:3000"

    class Config:
        env_file = ".env"


settings = Settings()
