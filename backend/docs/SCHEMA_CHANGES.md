# 스키마 변경 워크플로

v1.5.452 이후 모든 신규 스키마 변경(컬럼 추가/제거/rename, 테이블 추가, 인덱스 변경)은 **alembic revision** 으로만 작성합니다.

## 왜 alembic 인가

이 프로젝트는 v0~v1.5.451 까지 `backend/main.py` 의 `_migrate_add_columns()` 함수에 `ALTER TABLE … ADD COLUMN IF NOT EXISTS` 를 누적해 왔습니다. 단일 본당 빠른 이터레이션엔 작동했으나 다음 문제가 있습니다.

- 다운그레이드 불가 — 잘못된 컬럼 추가를 되돌릴 방법 없음
- rename/drop 불가 — `IF NOT EXISTS` 패턴으론 표현 자체가 안 됨
- 변경 이력 추적 X — git blame 으로만 가능, atomic 단위 없음
- 멀티 본당 배포 시 각 인스턴스의 스키마 상태 검증 불가

`_migrate_add_columns()` 1100+ 줄은 baseline 으로 보존하고, 신규 변경부터 alembic 으로 옮깁니다.

## 신규 변경 시 워크플로

### 1) 모델 수정

`backend/app/models/*.py` 에 SQLAlchemy 컬럼·테이블 정의를 변경/추가합니다.

```python
# 예: backend/app/models/member.py
class Member(Base):
    __tablename__ = "members"
    # ... 기존 컬럼 ...
    nickname_locale = Column(String(20), nullable=True)  # 신규
```

### 2) revision 자동 생성

```bash
cd backend
source venv/bin/activate
alembic revision --autogenerate -m "add member.nickname_locale"
```

`backend/alembic/versions/XXXX_add_member_nickname_locale.py` 가 생성됩니다.

### 3) 생성된 revision 검토

자동 생성은 완벽하지 않으므로 반드시 열어 확인합니다.

- 의도하지 않은 컬럼 변경(server_default 등)이 끼어있지 않은지
- 인덱스/제약조건이 누락되지 않았는지
- 데이터 마이그레이션이 필요한 경우 `op.execute("UPDATE …")` 직접 추가

### 4) 적용

서버를 재기동하면 `main.py` 의 `_alembic_upgrade_to_head()` 가 startup 에 자동 실행됩니다. 수동 적용도 가능:

```bash
alembic upgrade head
```

### 5) commit

생성된 revision 파일은 반드시 git 에 commit 합니다.

```bash
git add backend/alembic/versions/XXXX_*.py backend/app/models/member.py
git commit -m "feat: member 닉네임 locale 컬럼 추가 (vX.X.X)"
```

## 다운그레이드

```bash
alembic downgrade -1   # 1단계 되돌리기
alembic downgrade <rev>  # 특정 revision 까지 되돌리기
```

`downgrade()` 함수가 비어 있지 않도록 autogenerate 결과를 검토해 반드시 채워두세요.

## 현재 상태 확인

```bash
alembic current  # 현재 적용된 revision
alembic history  # 모든 revision 목록
```

## ⚠️ 금지 사항

- ❌ `backend/main.py` 의 `_migrate_add_columns()` 에 신규 ALTER 추가 금지
- ❌ alembic 없이 직접 DB 에 `ALTER TABLE` 수동 실행 금지 (각 본당 환경 동기화 깨짐)
- ❌ 이미 머지된 revision 의 `upgrade()`/`downgrade()` 수정 금지 (새 revision 으로 대응)

## 기존 baseline (`_migrate_add_columns`) 처리

v1.5.452 시점의 1100+ 줄 baseline 은 그대로 유지합니다. 빈 DB 에 처음 부팅할 때 baseline 을 보장하는 역할을 합니다. 신규 변경만 alembic 으로 분리합니다.
