"""temporal_kind 4값 → 2값 (active/ended) 백필

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-05-31 01:00:00.000000

future·timeless → active(진행중·알림대상), past·unknown → ended(종료됨·알림아님).
대상: bulletin_extractions, posts, events.
"""
from typing import Sequence, Union

from alembic import op


revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLES = ('bulletin_extractions', 'posts', 'events')


def upgrade() -> None:
    for tbl in _TABLES:
        op.execute(f"UPDATE {tbl} SET temporal_kind='active' WHERE temporal_kind IN ('future','timeless')")
        op.execute(f"UPDATE {tbl} SET temporal_kind='ended' WHERE temporal_kind IN ('past','unknown') OR temporal_kind IS NULL")


def downgrade() -> None:
    # 비가역(원래 4분류 정보는 복원 불가). active→timeless, ended→unknown 으로 근사 복원.
    for tbl in _TABLES:
        op.execute(f"UPDATE {tbl} SET temporal_kind='timeless' WHERE temporal_kind='active'")
        op.execute(f"UPDATE {tbl} SET temporal_kind='unknown' WHERE temporal_kind='ended'")
