"""events.is_featured 추가 (중요 일정 — 공개 캘린더 와인색 강조)

Revision ID: a1b2c3d4e5f6
Revises: 7920e7e624db
Create Date: 2026-05-30 23:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '7920e7e624db'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'events',
        sa.Column('is_featured', sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )


def downgrade() -> None:
    op.drop_column('events', 'is_featured')
