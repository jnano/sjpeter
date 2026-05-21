# 설치 가이드 — Faith and Me 본당 홈페이지

이 문서는 본당 운영자나 시스템 담당자가 처음 본당 홈페이지를 자기 서버에 설치하는 절차를 안내합니다. **시간 소요: 약 15분** (DB·외부 키 입력 제외).

기본 원칙: **`.env` 편집은 최소화**. DB 연결 정보만 직접 입력하고, 나머지(본당명·SMTP·OAuth·AI 키 등)는 모두 설치 후 admin 브라우저 화면에서 입력합니다.

---

## 1. 시스템 요구사항

| 항목 | 권장 버전 |
|---|---|
| OS | macOS · Ubuntu 22.04+ · Debian 12+ · CentOS 9+ |
| Python | 3.11 이상 |
| Node.js | 20 이상 (npm 포함) |
| PostgreSQL | 15 이상 |
| 메모리 | 2 GB 이상 |
| 디스크 | 10 GB 이상 (주보·사진 누적) |
| 외부 접속 | (선택) HTTPS 도메인 — 다른 본당이 외부에서 접속하려면 필요 |

---

## 2. 소스 다운로드

```bash
git clone https://github.com/jnano/sjpeter.git faithandme
cd faithandme
```

또는 zip 다운로드 후 압축 해제. 디렉토리 이름은 자유 (예: `our-parish`).

---

## 3. PostgreSQL DB 준비

```bash
# DB 사용자가 없다면 먼저 만듭니다 (예: 운영체제 사용자 이름과 동일)
createuser -s $USER
# DB 생성
createdb cathedral
```

> `cathedral` 외 다른 이름을 쓰려면 다음 단계의 `DATABASE_URL` 만 그에 맞게 바꿔주세요.

---

## 4. Backend 설정·기동

### 4-1. 의존성 설치

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 4-2. 환경변수 (`backend/.env`)

**필수 입력은 `DATABASE_URL` 하나뿐입니다.**

```bash
cat > .env <<'EOF'
DATABASE_URL=postgresql://USER@localhost/cathedral
EOF
```

`USER` 는 PostgreSQL 사용자 이름. 비밀번호가 있다면 `postgresql://USER:PASSWORD@localhost/cathedral` 형식.

> `AUTH_SECRET` 은 backend 첫 실행 시 자동으로 생성·DB 저장되므로 입력 불필요합니다.

### 4-3. 기동

```bash
uvicorn main:app --reload
```

`INFO: Uvicorn running on http://127.0.0.1:8000` 가 나오면 OK. 다음과 같은 자동 작업이 실행됩니다.

- 테이블 생성·마이그레이션
- 기본 시드: 사목지표·공동체 그룹·정적 페이지·성인 사전(1,600+ 항목)
- 시스템 게시판 4종: 공지사항·AI 추출·전례 사진·행사 사진
- `AUTH_SECRET` 자동 발급

---

## 5. Frontend 설정·기동

### 5-1. 의존성 설치

```bash
cd ../frontend
npm install
```

### 5-2. 환경변수 (`frontend/.env.local`)

```bash
cat > .env.local <<'EOF'
# 브라우저(client) 가 backend 호출 시 사용. 명시적으로 값을 채우세요.
NEXT_PUBLIC_API_URL=http://localhost:8000
BACKEND_INTERNAL_URL=http://127.0.0.1:8000
EOF
```

⚠ **`NEXT_PUBLIC_API_URL` 은 라인 자체를 비우거나 빈 문자열로 두지 마세요.** Next.js Turbopack 의 env inline 동작상 일부 컴포넌트의 `process.env.X` 가 string `"undefined"` 로 인식되어 `??` fallback 이 우회되는 함정이 있습니다 (`${API}/api/...` 가 `"undefined/api/..."` 가 되어 같은 origin 의 `/admin/undefined/...` 로 404). 명시적으로 `http://localhost:8000` 또는 운영 도메인을 채우세요.

⚠ **자기 외부 공인 IP 를 직접 넣으면 위험.** 자기 PC 가 그 IP 로 outgoing 시 라우터의 hairpin NAT 가 동작하지 않는 환경에서는 fetch timeout. 모바일 LAN 시연이라면 자기 PC 의 LAN IP (`192.168.x.x` 등) 를 사용하세요.

`BACKEND_INTERNAL_URL` 은 SSR/Server Component 가 backend 호출 시 사용 — 같은 머신이라면 `127.0.0.1:8000` 유지 권장.

### 5-3. 기동

```bash
npm run dev
```

`✓ Ready in 1s` 가 나오면 OK.

---

## 6. 첫 setup wizard

브라우저로 **http://localhost:3000/admin** 접속.

처음에는 `admins` 테이블이 비어 있으므로 `/setup` 으로 자동 이동합니다.

1. **환영** — 다음 두 단계로 본당 정보를 입력합니다.
2. **관리자 계정** — 본당 시스템을 운영할 슈퍼관리자 아이디·비밀번호.
3. **본당 정보** — 본당명, 영문명 (선택), 사이트 URL.
4. **완료** — 자동으로 `/admin/dashboard` 로 이동.

이 시점에 다음이 추가 적용됩니다.

- 본당명이 헤더·푸터·이메일 발신자 등 사이트 전체에 자동 반영
- 기본 게시판 4종 자동 생성: 자유게시판·사진 갤러리·기도 청원·묵상 나눔
- 대시보드 상단에 "사이트 운영 시작 가이드" 체크리스트가 나타남 (5개 항목 모두 완료 시 자동 숨김)

---

## 7. (선택) 외부 서비스 연동

본당 홈페이지의 모든 외부 서비스는 admin UI에서 입력합니다. `.env` 를 다시 건드릴 일이 없습니다.

**`/admin/settings`** 페이지에서 다음을 입력하면 해당 기능이 자동 활성화됩니다.

| 항목 | 입력 키 | 효과 |
|---|---|---|
| 이메일 발송 | `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_HOST`, `SMTP_PORT` | 회원 이메일 인증·비밀번호 재설정 메일 발송 |
| Google 로그인 | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | 회원 로그인 화면에 Google 버튼 노출 |
| Kakao 로그인 | `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET` | 회원 로그인 화면에 Kakao 버튼 노출 |
| AI 자동 추출 | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` | 주보 PDF 업로드 시 공지·행사·모임 자동 추출 |
| 카카오 지도 | `KAKAO_MAP_KEY` | `/info` 페이지의 본당 위치 지도 노출 |

**모두 선택 사항입니다.** 입력 안 해도 게시판·캘린더·주보 수동 업로드 등 핵심 기능은 동작합니다.

---

## 8. 운영 환경 배포

dev 모드 (`uvicorn --reload`, `npm run dev`) 는 로컬·소규모용입니다. 본당이 외부 접속을 받으려면 다음을 추천합니다.

### Backend
```bash
# gunicorn + uvicorn worker
pip install gunicorn
gunicorn main:app -k uvicorn.workers.UvicornWorker -w 2 -b 127.0.0.1:8000
```

### Frontend
```bash
npm run build
npm run start  # 기본 포트 3000
```

### Reverse proxy
Nginx 등으로 80/443 → 3000(frontend), `/api/*` → 8000(backend) 라우팅. HTTPS 인증서는 Let's Encrypt 권장.

### systemd
서버 재부팅 시 자동 기동을 위해 `systemd` 서비스 파일 작성을 권장합니다.

---

## 9. 자주 묻는 질문

### Q. setup wizard 가 안 뜨고 곧장 admin 로그인 화면이 나옵니다.
A. 이미 `admins` 테이블에 계정이 있어서입니다. DB 를 새로 만들거나, `DELETE FROM admins;` 후 backend 재시작하면 다시 setup 으로 진입합니다.

### Q. AUTH_SECRET 을 바꾸면 어떻게 되나요?
A. **모든 회원 세션이 즉시 무효화**됩니다 (다시 로그인 필요). admin/settings 에서 변경 시 경고 배너가 나옵니다. 평소엔 변경 금지.

### Q. 본당명을 바꾸려면?
A. `/admin/parish/info` 에서 본당명·연락처 등 수정. 다음 페이지 로드부터 사이트 전체에 반영됩니다.

### Q. 기본 게시판 4개를 안 쓰고 싶습니다.
A. `/admin/boards` 에서 자유롭게 삭제·이름 변경할 수 있습니다. 시스템 게시판 (공지사항·AI 추출·사진 갤러리 2종)은 보통 유지하길 권장합니다.

### Q. PostgreSQL 비밀번호를 바꿨더니 백엔드가 시작 안 됩니다.
A. `backend/.env` 의 `DATABASE_URL` 을 새 비밀번호로 갱신하고 backend 재시작.

### Q. 주보를 업로드했는데 AI 추출이 동작 안 합니다.
A. `/admin/settings` 에서 AWS 키 3종이 입력되어 있는지 확인. 안 되어 있으면 주보는 업로드되지만 자동 추출은 비활성화됩니다 (수동으로 공지·행사를 등록할 수 있음).

---

## 10. 문제 해결

| 증상 | 원인·해결 |
|---|---|
| `Address already in use` (uvicorn 시작 시) | 이전 backend 가 안 죽었음. `lsof -ti :8000 \| xargs kill -9` |
| Next.js 빌드 캐시 오류 (`require is not defined` 등) | `rm -rf frontend/.next && npm run dev` |
| 회원이 가입했는데 이메일 인증 메일이 안 옴 | `/admin/settings` 의 SMTP 키 확인. 또는 SMTP 미설정 시 가입 즉시 활성화로 동작합니다 |
| admin 로그인 후 즉시 logout | `AUTH_SECRET` 이 변경됐을 가능성. 기존 세션 모두 무효화됨 — 다시 로그인 |
| AI 추출이 timeout | AWS Bedrock 권한·리전 확인. `us-east-1` 또는 `ap-northeast-1` 권장 |

---

설치 도중 막히는 부분이 있으면 GitHub Issues 에 운영체제·로그 출력과 함께 알려주세요.

---

## 관련 문서

- [관리자 비밀번호 변경](CHANGE_PASSWORD.md)
