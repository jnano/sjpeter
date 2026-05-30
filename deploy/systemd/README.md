# systemd unit 샘플

Docker 를 쓰지 않고 OS 에 직접 설치한 경우 systemd 로 backend·frontend 를 관리합니다.

## 파일

- `faithandme-backend.service` — uvicorn (FastAPI)
- `faithandme-frontend.service` — node (Next.js standalone)

## 빠른 설치 (Linux Ubuntu/Debian 기준)

```bash
# 1) 본당 운영 사용자 생성 (선택)
sudo useradd -m -s /bin/bash cathedral

# 2) /etc/faithandme/ 에 환경변수 파일 작성
sudo mkdir -p /etc/faithandme

sudo tee /etc/faithandme/backend.env > /dev/null <<EOF
DATABASE_URL=postgresql+psycopg2://cathedral:비밀번호@localhost/cathedral
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
INTERNAL_API_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
CORS_ORIGINS=https://본당도메인.kr
ENV=production
SITE_URL=https://본당도메인.kr
EOF

sudo tee /etc/faithandme/frontend.env > /dev/null <<EOF
PORT=3000
BACKEND_INTERNAL_URL=http://localhost:8000
INTERNAL_API_SECRET=동일한_INTERNAL_API_SECRET
AUTH_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
AUTH_TRUST_HOST=true
EOF

sudo chmod 600 /etc/faithandme/*.env
sudo chown cathedral:cathedral /etc/faithandme/*.env

# 3) systemd unit 복사 + 활성화
sudo cp deploy/systemd/faithandme-*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now faithandme-backend faithandme-frontend

# 4) 상태 확인
sudo systemctl status faithandme-backend faithandme-frontend
```

## 유지보수

```bash
# 재시작
sudo systemctl restart faithandme-backend

# 로그 (실시간)
sudo journalctl -u faithandme-backend -f

# 코드 업데이트 후 (frontend 변경 시 npm run build 다시 한 뒤)
sudo systemctl restart faithandme-frontend
```

## nginx reverse proxy (HTTPS)

frontend(3000) 와 backend(8000) 둘 다 nginx 뒤로 두고 Let's Encrypt 인증서:

```nginx
server {
    listen 443 ssl http2;
    server_name 본당도메인.kr;
    ssl_certificate     /etc/letsencrypt/live/본당도메인.kr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/본당도메인.kr/privkey.pem;

    # frontend (Next.js)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # backend (FastAPI)
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # backend uploads (정적 파일 — Nginx 가 직접 응답하면 더 빠름)
    location /uploads/ {
        proxy_pass http://127.0.0.1:8000;
    }

    client_max_body_size 50M;  # 주보 PDF 등 큰 파일 업로드
}

# HTTP → HTTPS 리다이렉트
server {
    listen 80;
    server_name 본당도메인.kr;
    return 301 https://$host$request_uri;
}
```

## 주의

- frontend 의 `NEXT_PUBLIC_*` 환경변수는 **빌드 시점**에 client 번들에 베이크됨.
  운영 도메인 정해진 후 `cd frontend && NEXT_PUBLIC_API_URL=https://본당도메인.kr npm run build` 로 다시 빌드.
- `EnvironmentFile` 경로는 systemd 가 일찍 읽으므로 권한·소유자 정확히.
