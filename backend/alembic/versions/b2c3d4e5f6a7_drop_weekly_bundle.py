"""bulletin_extractions.weekly_bundle 제거 ('이번 주만 유효' 기능 폐지)

Revision ID: b2c3d4e5f6a7
Revises: 7920e7e624db
Create Date: 2026-05-31 00:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = '7920e7e624db'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('bulletin_extractions', 'weekly_bundle')


def downgrade() -> None:
    op.add_column(
        'bulletin_extractions',
        sa.Column('weekly_bundle', sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )
