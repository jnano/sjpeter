# Cafe24 VPS 배포 시나리오

> 세종성베드로성당 홈페이지 (Cephas)를 Cafe24 VPS에 배포하는 단계별 절차.
> 결정 필요한 값은 `<자리표시자>`로 표기.

---

## 0. 사전 준비 (Cafe24 콘솔)

| 항목 | 값/결정 |
|---|---|
| 인스턴스 | Cafe24 VPS (Ubuntu 22.04 LTS 권장, 2 vCPU·4GB RAM·40GB SSD 이상) |
| 공인 IP | Cafe24가 할당 |
| SSH 접속 | 콘솔에서 root 비밀번호 또는 SSH 키 등록 |
| 도메인 | `<도메인>` (별도 등록업체 또는 Cafe24 도메인) DNS A 레코드 → VPS 공인 IP |
| 방화벽 (Cafe24) | 22(SSH), 80(HTTP), 443(HTTPS) 허용. PostgreSQL 5432·백엔드 8000·프론트엔드 3000은 **외부 차단**(Nginx 안쪽으로만) |

---

## 1. 시스템 초기 설정 (root)

```bash
ssh root@<vps_ip>
apt update && apt upgrade -y
apt install -y curl git build-essential ufw fail2ban

# 비-root 작업 계정
adduser deploy
usermod -aG sudo deploy
# (SSH 키 ~/.ssh/authorized_keys로 복사 후 PasswordAuth 비활성 권장)

# 방화벽
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

---

## 2. 의존성 설치

```bash
# Python 3.11
add-apt-repository ppa:deadsnakes/ppa -y
apt update
apt install -y python3.11 python3.11-venv python3.11-dev

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# PostgreSQL 16
sh -c 'echo "deb https://apt.postgresql.org/pub/repos/apt jammy-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg
apt update
apt install -y postgresql-16

# Nginx + Certbot
apt install -y nginx certbot python3-certbot-nginx
```

---

## 3. PostgreSQL 설정

```bash
sudo -u postgres psql <<EOF
CREATE USER cathedral_user WITH PASSWORD '<strong_password>';
CREATE DATABASE cathedral OWNER cathedral_user;
GRANT ALL PRIVILEGES ON DATABASE cathedral TO cathedral_user;
EOF
```

스키마 import (백업 파일 사용):

```bash
psql -U cathedral_user -d cathedral -h localhost < ~/faithandme/db_schema.sql
```

---

## 4. 소스 코드 배포

`deploy` 계정으로 전환:

```bash
su - deploy
mkdir -p ~/apps && cd ~/apps

# 옵션 A: Git
git clone https://github.com/jnano/sjpeter.git faithandme

# 옵션 B: 백업 tar (오프라인 배포)
# scp faithandme_20260515_v1.5.95_code.tar.gz deploy@<vps_ip>:~/
# tar xzf ~/faithandme_*_code.tar.gz -C ~/apps

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

---

## 6. 백엔드 (FastAPI + Gunicorn + systemd)

```bash
cd ~/apps/faithandme/backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install gunicorn uvicorn[standard]

mkdir -p uploads
```

### systemd 서비스 (`/etc/systemd/system/cathedral-backend.service`)

```ini
[Unit]
Description=Cathedral FastAPI Backend
After=network.target postgresql.service

[Service]
User=deploy
WorkingDirectory=/home/deploy/apps/faithandme/backend
EnvironmentFile=/home/deploy/apps/faithandme/backend/.env
ExecStart=/home/deploy/apps/faithandme/backend/venv/bin/gunicorn \
  -w 3 -k uvicorn.workers.UvicornWorker \
  -b 127.0.0.1:8000 main:app
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
sudo nginx -t
sudo systemctl reload nginx
```

---

## 9. HTTPS (Let's Encrypt)

```bash
sudo certbot --nginx -d <도메인> -d www.<도메인>
# 자동 갱신은 certbot.timer가 처리 (별도 cron 불필요)
```

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

# 백엔드 변경 시
cd backend && source venv/bin/activate && pip install -r requirements.txt
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

- [ ] SSH 비밀번호 인증 비활성 (`PasswordAuthentication no`)
- [ ] `.env` 파일 권한 `chmod 600`
- [ ] `uploads/` 디렉토리는 `deploy` 소유, web 사용자(`www-data`)는 읽기만
- [ ] PostgreSQL `pg_hba.conf`에서 외부 접속 차단 (localhost만)
- [ ] `fail2ban` 활성화 (SSH brute-force 방어)
- [ ] HTTPS 강제 redirect (Nginx 80 → 443)
- [ ] CORS: backend `.env`의 `ALLOWED_ORIGINS`에 운영 도메인만
- [ ] admin 초기 비밀번호 변경 (`backend/change_password.py`)

---

## 12. 트래픽·자원 모니터링

- `htop`, `df -h`로 자원 확인
- 디스크 부족 빈도 높은 곳: `backend/uploads/` (주보 PDF·이미지) → 정기 청소 또는 외부 스토리지 분리 고려
- Cafe24 VPS 콘솔의 트래픽 통계로 월간 사용량 추적

---

## 결정 필요한 항목 요약 (배포 전)

| 항목 | 예시 |
|---|---|
| 도메인 | `sjpeter.example.com` |
| DB 비밀번호 | 32자 이상 랜덤 |
| `SECRET_KEY`, `NEXTAUTH_SECRET` | `openssl rand -hex 32` 두 번 |
| Cafe24 VPS 사양 | 최소 2 vCPU·4GB RAM (AI 추출 Bedrock 호출 시 메모리 여유) |
| 이메일·OAuth 키 | `/admin/settings`에서 사후 등록 |

---

## 부록: 첫 배포 후 점검 순서

1. `curl https://<도메인>/api/docs` → FastAPI Swagger 200 응답
2. `https://<도메인>` 진입 → 홈 페이지 정상
3. `/admin` 로그인 → 초기 admin 계정 비밀번호 변경
4. `/admin/settings`에서 SMTP·카카오·AWS 키 입력
5. `/admin/season` 자동 모드 ON (전례 시기 자동 갱신)
6. 첫 주보 PDF 업로드 → AI 추출 동작 확인 (Bedrock 키 필요)
7. cron 백업 1회 수동 실행 → `/home/deploy/backups/`에 .sql.gz 생성 확인
