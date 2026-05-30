# faithandme backend — FastAPI + SQLAlchemy + PostgreSQL client (v1.5.456)
FROM python:3.11-slim

WORKDIR /app

# 시스템 패키지 — psycopg2 (libpq), Pillow (libjpeg/zlib), PyMuPDF (fitz) 빌드용
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libjpeg-dev \
    zlib1g-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Python 의존성 — 변경 잦지 않아 먼저 caching
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# 소스 — 마지막에 복사해 코드 변경 시 의존성 재설치 회피
COPY . .

# uploads 디렉토리 보장 (Volume 으로 마운트되더라도 생성)
RUN mkdir -p /app/uploads /app/private-uploads /app/backups

EXPOSE 8000

# healthcheck — docker-compose 가 의존성 ready 판정에 사용
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS http://localhost:8000/api/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
