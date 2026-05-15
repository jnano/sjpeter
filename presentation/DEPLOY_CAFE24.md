# Cafe24 VPS 배포 시나리오

> 세종성베드로성당 홈페이지 (Cephas)를 **Cafe24 개발언어 VPS**에 배포하는 단계별 절차.
> Cafe24 자동 설치 구성을 활용해 수동 설치 단계를 최소화. 결정 필요한 값은 `<자리표시자>`.

---

## Cafe24 자동 설치 구성 (활용)

선택한 상품: **개발언어 VPS (Ubuntu 24.04 LTS)**

| 사전 설치된 항목 | 우리 활용 |
|---|---|
| Python 3.12 | 백엔드 그대로 (FastAPI 호환) |
| FastAPI + Uvicorn (ASGI) | 우리 백엔드 실행 |
| **uv 패키지 매니저** | `requirements.txt` 호환, pip보다 빠름 |
| Nginx (리버스 프록시) | 설정 파일만 추가 |
| systemd · fail2ban | 서비스 등록만 |
| PostgreSQL 17 (+ asyncpg 옵션) | DB·user 생성만, psycopg2 추가 사용 |

| 우리가 추가 설치할 것 | 이유 |
|---|---|
| **Node.js 20 LTS** | Next.js 프론트엔드 (자동 설치 목록에 없음) |
| **psycopg2-binary** | 우리 SQLAlchemy 코드는 동기 psycopg2 사용. asyncpg는 향후 |
| **Certbot** | HTTPS 인증서 (Cafe24 기본 도메인은 자동, 외부 도메인은 수동) |

---

## 0. 사전 준비 (Cafe24 콘솔)

| 항목 | 값/결정 |
|---|---|
| 인스턴스 | 개발언어 VPS DEV B 권장 (vCPU 2·4GB·100GB 추정) — Bedrock + Next.js 빌드 메모리 여유 |
| OS | Ubuntu 24.04 LTS (자동) |
| 공인 IP | Cafe24가 할당 |
| SSH 접속 | 콘솔에서 root 비밀번호 또는 SSH 키 등록 |
| 도메인 | `<도메인>` — Cafe24 기본 도메인 또는 보유 도메인 연결 (최대 20개) |
| HTTPS | 기본 도메인은 자동, 보유 도메인은 SSL 인증서 발급 (Cafe24 또는 Let's Encrypt) |
| 방화벽 (Cafe24) | 22(SSH), 80(HTTP), 443(HTTPS) 허용. PostgreSQL 5432·백엔드 8000·프론트엔드 3000은 외부 차단(Nginx 내부 only) |

---

## 1. 시스템 초기 설정 (root)

대부분 사전 적용됨. 우리는 작업 계정만 추가:

```bash
ssh root@<vps_ip>

# 비-root 작업 계정
adduser deploy
usermod -aG sudo deploy

# SSH 키 등록 후 비밀번호 인증 비활성 (권장)
# ~deploy/.ssh/authorized_keys 에 공개 키 추가
# /etc/ssh/sshd_config 에서 PasswordAuthentication no
sudo systemctl reload ssh

# 시스템 업데이트만
apt update && apt upgrade -y
```

> **자동 적용된 보안**: fail2ban·SSH 하드닝·ufw는 Cafe24가 기본 활성화. 별도 설정 불필요.

---

## 2. 추가 의존성 설치

Cafe24가 설치 안 한 항목만:

```bash
# Node.js 20 LTS (Next.js)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Certbot (HTTPS - 보유 도메인용)
sudo apt install -y certbot python3-certbot-nginx
```

> Python 3.12 · FastAPI · Uvicorn · uv · Nginx · PostgreSQL 17 · systemd · fail2ban 은 사전 설치됨.

---

## 3. PostgreSQL 설정 (DB·user 생성만)

Cafe24가 PostgreSQL 17을 사전 설치·기동 중. 우리는 DB와 user만 추가:

```bash
sudo -u postgres psql <<EOF
CREATE USER cathedral_user WITH PASSWORD '<strong_password>';
CREATE DATABASE cathedral OWNER cathedral_user;
GRANT ALL PRIVILEGES ON DATABASE cathedral TO cathedral_user;
EOF
```

스키마 import (백업 파일 사용):

```bash
# 16용 dump도 17과 wire 호환. 안전을 위해 운영 도입 후 17용 pg_dump로 재생성 권장.
psql -U cathedral_user -d cathedral -h localhost < ~/faithandme/db_schema.sql
```

> 백엔드 첫 기동 시 `main.py` startup 블록이 `CREATE TABLE IF NOT EXISTS`·`ALTER TABLE ADD COLUMN IF NOT EXISTS`·`site_settings` 시드를 자동 처리하므로, 빈 DB로 시작해도 됨.

---

## 4. 소스 코드 배포

`deploy` 계정으로:

```bash
su - deploy
mkdir -p ~/apps && cd ~/apps

# 옵션 A: Git
git clone https://github.com/jnano/sjpeter.git faithandme

# 옵션 B: 백업 tar (오프라인 배포)
# scp faithandme_20260515_v1.5.95_code.tar.gz deploy@<vps_ip>:~/
# tar xzf ~/faithandme_*_code.tar.gz -C ~/apps
# (백업에는 db_schema.sql 도 함께 들어있음 — §3 import 단계에 활용)

cd ~/apps/faithandme
```

---

## 5. 환경 변수

### `backend/.env`
```env
DATABASE_URL=postgresql://cathedral_user:<password>@localhost/cathedral
SECRET_KEY=<32자_랜덤_문자열>
UPLOAD_DIR=/home/deploy/apps/faithandme/backend/uploads
ALLOWED_ORIGINS=https://<도메인>
```

### `frontend/.env.local`
```env
NEXT_PUBLIC_API_URL=https://<도메인>/api
NEXTAUTH_SECRET=<32자_랜덤_문자열>
NEXTAUTH_URL=https://<도메인>
```

> SMTP·AWS Bedrock·카카오 등의 키는 `/admin/settings`에서 DB에 저장 (코드 배포에 포함 안 됨).
> 랜덤 시크릿 생성: `openssl rand -hex 32` 두 번.

`.env` 파일 권한:
```bash
chmod 600 backend/.env frontend/.env.local
```

---

## 6. 백엔드 (Uvicorn + systemd)

Cafe24가 FastAPI·Uvicorn을 사전 설치했지만, 프로젝트별 venv를 분리해 의존성 충돌 회피.

### 옵션 A: uv (Cafe24 사전 설치, 권장 — 빠름)
```bash
cd ~/apps/faithandme/backend
uv venv
source .venv/bin/activate
uv pip install -r requirements.txt
uv pip install psycopg2-binary  # 우리 코드는 동기 psycopg2
mkdir -p uploads
```

### 옵션 B: pip (전통적)
```bash
cd ~/apps/faithandme/backend
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install psycopg2-binary
mkdir -p uploads
```

### systemd 서비스 (`/etc/systemd/system/cathedral-backend.service`)

Gunicorn 래퍼 없이 Uvicorn 직접 호출 (Cafe24 권장 패턴):

```ini
[Unit]
Description=Cathedral FastAPI Backend
After=network.target postgresql.service

[Service]
User=deploy
WorkingDirectory=/home/deploy/apps/faithandme/backend
EnvironmentFile=/home/deploy/apps/faithandme/backend/.env
# uv venv 사용 시 경로: .venv/bin/uvicorn / pip venv 사용 시: venv/bin/uvicorn
ExecStart=/home/deploy/apps/faithandme/backend/.venv/bin/uvicorn \
  main:app --host 127.0.0.1 --port 8000 --workers 3 --proxy-headers
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable cathedral-backend
sudo systemctl start cathedral-backend
sudo systemctl status cathedral-backend
```

---

## 7. 프론트엔드 (Next.js + systemd)

```bash
cd ~/apps/faithandme/frontend
npm ci
npm run build
```

### systemd 서비스 (`/etc/systemd/system/cathedral-frontend.service`)

```ini
[Unit]
Description=Cathedral Next.js Frontend
After=network.target cathedral-backend.service

[Service]
User=deploy
WorkingDirectory=/home/deploy/apps/faithandme/frontend
EnvironmentFile=/home/deploy/apps/faithandme/frontend/.env.local
ExecStart=/usr/bin/npm start
Environment=NODE_ENV=production
Environment=PORT=3000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable cathedral-frontend
sudo systemctl start cathedral-frontend
```

---

## 8. Nginx Reverse Proxy

Cafe24가 Nginx를 사전 설치·기동 중. 우리 사이트 설정만 추가.

`/etc/nginx/sites-available/cathedral`:

```nginx
server {
    listen 80;
    server_name <도메인> www.<도메인>;
    client_max_body_size 30M;       # 주보 PDF·이미지 업로드

    # 프론트엔드 (Next.js, 포트 3000)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # 백엔드 API (FastAPI, 포트 8000)
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 정적 업로드 (PDF·이미지) — 백엔드 통하지 않고 직접 서빙
    location /uploads/ {
        alias /home/deploy/apps/faithandme/backend/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/cathedral /etc/nginx/sites-enabled/
# Cafe24가 default 사이트로 다른 설정을 둔다면 비활성화
# sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

---

## 9. HTTPS

### 옵션 A: Cafe24 기본 도메인
Cafe24가 자동 적용. 별도 작업 없음.

### 옵션 B: 보유 외부 도메인 (Let's Encrypt)
```bash
sudo certbot --nginx -d <도메인> -d www.<도메인>
# certbot.timer 가 자동 갱신
```

### 옵션 C: Cafe24 SSL 인증서 구매
Cafe24 콘솔에서 발급 후 `/etc/nginx/sites-available/cathedral`에 인증서 경로 추가.

---

## 10. 운영 작업

### 로그 확인
```bash
sudo journalctl -u cathedral-backend -f
sudo journalctl -u cathedral-frontend -f
sudo tail -f /var/log/nginx/access.log
```

### 배포 업데이트 (이후)
```bash
cd ~/apps/faithandme
git pull

# 백엔드 변경 시 (uv 기준)
cd backend && source .venv/bin/activate && uv pip install -r requirements.txt
sudo systemctl restart cathedral-backend

# 프론트엔드 변경 시
cd ../frontend && npm ci && npm run build
sudo systemctl restart cathedral-frontend
```

### DB 백업 자동화 (cron)
```bash
crontab -e
# 매일 새벽 3시
0 3 * * * /usr/bin/pg_dump -U cathedral_user -h localhost cathedral | gzip > /home/deploy/backups/cathedral_$(date +\%Y\%m\%d).sql.gz
# 30일 이전 백업 정리
0 4 * * * find /home/deploy/backups -name 'cathedral_*.sql.gz' -mtime +30 -delete
```

---

## 11. 보안 체크리스트

자동 적용된 항목은 ✓, 우리가 확인할 항목은 [ ]:

- ✓ SSH 하드닝 (Cafe24 자동)
- ✓ fail2ban (Cafe24 자동)
- ✓ 방화벽 (ufw + Cafe24 콘솔 방화벽)
- [ ] SSH 비밀번호 인증 비활성 (`PasswordAuthentication no`) — 키 등록 후 수동
- [ ] `.env` 파일 권한 `chmod 600`
- [ ] `uploads/` 디렉토리는 `deploy` 소유, web 사용자(`www-data`)는 읽기만
- [ ] PostgreSQL `pg_hba.conf` 외부 접속 차단 (localhost only) — 기본값 확인
- [ ] HTTPS 강제 redirect (Nginx 80 → 443)
- [ ] CORS: backend `.env`의 `ALLOWED_ORIGINS`에 운영 도메인만
- [ ] admin 초기 비밀번호 변경 (`backend/change_password.py`)

---

## 12. 트래픽·자원 모니터링

- `htop`, `df -h` 자원 확인
- 디스크 부족 빈도 높은 곳: `backend/uploads/` (주보 PDF·이미지) → 정기 청소 또는 외부 스토리지 분리 고려
- Cafe24 VPS 콘솔의 트래픽 통계로 월간 사용량 추적 (DEV B는 보통 월 4TB 정도)

---

## 13. 결정 필요한 항목 요약 (배포 전)

| 항목 | 예시 |
|---|---|
| 도메인 | `sjpeter.example.com` (또는 Cafe24 기본 도메인) |
| DB 비밀번호 | 32자 이상 랜덤 |
| `SECRET_KEY`, `NEXTAUTH_SECRET` | `openssl rand -hex 32` 두 번 |
| Cafe24 VPS 상품 | 개발언어 VPS DEV B (또는 DEV C로 메모리 여유) |
| 이메일·OAuth 키 | `/admin/settings`에서 사후 등록 |

---

## 14. 첫 배포 후 점검 순서

1. `curl https://<도메인>/api/docs` → FastAPI Swagger 200
2. `https://<도메인>` 진입 → 홈 페이지 정상
3. `/admin` 로그인 → 초기 admin 계정 비밀번호 변경
4. `/admin/settings`에서 SMTP·카카오·AWS 키 입력
5. `/admin/season` 자동 모드 ON (전례 시기 자동 갱신)
6. 첫 주보 PDF 업로드 → AI 추출 동작 확인 (Bedrock 키 필요)
7. cron 백업 1회 수동 실행 → `/home/deploy/backups/`에 `.sql.gz` 생성 확인

---

## 부록: 자동 설치 활용으로 줄어든 작업

| 기존 시나리오 | Cafe24 자동 설치로 생략 |
|---|---|
| Python 3.11 PPA 추가·apt 설치 | ✓ Python 3.12 사전 설치 |
| PostgreSQL 16 apt 저장소 추가·설치·기동 | ✓ PostgreSQL 17 사전 설치·기동 |
| Nginx apt 설치·기본 설정 | ✓ Nginx 사전 설치·리버스 프록시 자리 |
| Gunicorn 별도 설치 (Uvicorn 래퍼) | ✓ Uvicorn 직접 사용으로 단순화 |
| fail2ban·ufw 설정 | ✓ 자동 활성 |
| pip만 의존 | uv 사용 시 의존성 설치 속도 10~100배 |

**남은 수동 작업**: Node.js 설치 (1줄), 사이트 설정·서비스 파일 작성, DB·user 생성, HTTPS(외부 도메인 경우).
