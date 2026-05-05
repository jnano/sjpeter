from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "세종성베드로성당"
    DATABASE_URL: str = "postgresql://user:password@localhost/cathedral"
    SECRET_KEY: str = "change-this-in-production"
    UPLOAD_DIR: str = "uploads"
    ANTHROPIC_API_KEY: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
