"""verify_workflow_noop

alembic 워크플로 동작 확인용 no-op revision (v1.5.455).

목적
- baseline(0001) 위에 새 revision 이 정상적으로 만들어지고 chain 이 형성되는지 검증
- _alembic_upgrade_to_head() startup 훅이 새 revision 을 자동 적용하는지 확인
- backend/docs/SCHEMA_CHANGES.md 워크플로 가이드의 첫 적용 사례

이 revision 은 실제 스키마 변경 없음. 다음 revision 부터는 `alembic revision
--autogenerate -m "..."` 로 생성한 결과를 검토·수정 후 commit 하면 된다.

Revision ID: 4b08e018ed60
Revises: 0001_baseline
Create Date: 2026-05-30 14:31:15.971872

"""
from typing import Sequence, Union

# from alembic import op  # noqa: F401 — 실제 op 미사용 (no-op)
# import sqlalchemy as sa  # noqa: F401


# revision identifiers, used by Alembic.
revision: str = '4b08e018ed60'
down_revision: Union[str, Sequence[str], None] = '0001_baseline'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """no-op — 워크플로 검증용. 실제 스키마 변경 없음."""
    pass


def downgrade() -> None:
    """no-op."""
    pass
