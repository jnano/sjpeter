# Faith and Me — 본당 홈페이지

가톨릭 본당이 .env 편집 없이 다운로드 → 실행 → 브라우저 setup wizard 만으로 운영을 시작할 수 있는 본당 홈페이지 시스템.

> 처음 만들어진 곳: 세종성베드로성당. 이후 어떤 본당이라도 자기 본당명·로고·미사시간을 입력하면 그대로 자기 본당 사이트가 됩니다.

## 무엇을 할 수 있나요

- 주보 PDF 업로드 → AI 자동 추출 (공지·행사·모임을 게시판·캘린더에 자동 등록)
- 회원 가입·이메일 인증 / 카카오·구글 소셜 로그인 (선택)
- 게시판·갤러리·공지사항·캘린더·역대 사목자·본당 출신 사제·성인 사전
- 한 줄 게시판 (기도 청원·감사·위령)
- 본당 건축·공사 일지
- admin 대시보드에서 본당 운영을 위한 모든 설정 가능 (`.env` 편집 불필요)

## 5분 만에 시작하기

```bash
# 1. clone + 의존성
git clone https://github.com/jnano/sjpeter.git faithandme
cd faithandme/backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt

cd ../frontend
npm install

# 2. DB 생성 (PostgreSQL 15+ 필요)
createdb cathedral

# 3. backend 환경변수 (DB URL 만 — 그 외는 admin UI 에서 입력)
cd ../backend
echo 'DATABASE_URL=postgresql://USER@localhost/cathedral' > .env

# 4. 두 서버 기동
uvicorn main:app --reload &
cd ../frontend && npm run dev &

# 5. 브라우저에서 http://localhost:3000/admin 접속
#    → setup wizard 가 자동으로 열림. admin 계정 + 본당명 입력으로 끝.
```

이후 admin/settings 에서 SMTP·OAuth·AWS 등을 입력하면 회원가입 이메일·소셜 로그인·AI 추출이 차례로 활성화됩니다. **전부 선택 사항** — 입력 안 해도 게시판·캘린더·주보 업로드(수동) 등 핵심 기능은 동작합니다.

자세한 설치 안내는 [docs/INSTALL.md](docs/INSTALL.md) 를 참고하세요.

## 기술 스택

| 레이어 | 기술 |
|---|---|
| Backend | FastAPI · SQLAlchemy · PostgreSQL 15 |
| Frontend | Next.js 15 (App Router · Turbopack) · Tailwind CSS v4 |
| Admin 인증 | JWT (자체 발급, AUTH_SECRET 자동 생성) |
| 회원 인증 | NextAuth.js v5 (JWT 세션) |
| AI 추출 | AWS Bedrock — Claude Haiku/Sonnet (선택) |
| 외부 로그인 | Google · Kakao OAuth (선택) |
| 이메일 | SMTP (선택) |
| 지도 | Kakao Maps (선택) |

## 라이선스

자유롭게 사용·복제·수정·재배포 가능합니다. 본당 운영을 위한 비영리 용도를 우선 가정합니다.

## 문의·기여

- 버그 리포트·기능 제안: GitHub Issues
- 다른 본당의 사용 사례·디자인 개선 PR 환영합니다.
