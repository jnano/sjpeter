# 관리자 비밀번호 변경

admin (슈퍼관리자) 계정의 비밀번호를 변경하는 두 가지 방법입니다.

## 방법 1 — 터미널 스크립트

```bash
cd backend
venv/bin/python change_password.py
```

새 비밀번호를 두 번 입력받습니다 (화면에 표시 안 됨). 즉시 적용 — 서버 재시작 불필요. 다음 로그인부터 새 비밀번호로 인증됩니다.

## 방법 2 — 비밀번호를 잊었을 때 (직접 DB 갱신)

스크립트를 쓸 수 없는 상황 (예: 비밀번호도 잊고 admin UI 진입 불가) 이라면 다음 절차로 복구.

```bash
cd backend
venv/bin/python <<'PY'
import sys; sys.path.insert(0, ".")
from app.core.database import SessionLocal
from app.models.admin import Admin
from app.core.auth import hash_password

db = SessionLocal()
admin = db.query(Admin).first()
print(f"대상 admin: {admin.username}")
new_pw = input("새 비밀번호: ")
admin.hashed_password = hash_password(new_pw)
db.commit()
print("변경 완료.")
db.close()
PY
```

> 주의: 위 방식은 평문 비밀번호가 한 번 stdin 에 보여집니다. 가능하면 방법 1 의 `getpass` 기반 스크립트를 우선 사용하세요.

## 비밀번호 정책

- 영문 + 숫자를 모두 포함
- 8자 이상 권장 (setup wizard 의 검증 기준과 동일)

## 비밀번호를 자주 잊는 경우

회원 계정이라면 `/admin/settings` 에서 SMTP 키를 입력한 뒤 회원 로그인 화면의 "비밀번호 찾기" 흐름으로 메일 재설정이 가능합니다. admin 계정은 메일 재설정 기능이 없으므로 이 문서의 방법 1 또는 2 를 사용하세요.
