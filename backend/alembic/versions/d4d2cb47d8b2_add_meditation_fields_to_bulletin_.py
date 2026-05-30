"""add meditation fields to bulletin_extractions

Revision ID: d4d2cb47d8b2
Revises: 4b08e018ed60
Create Date: 2026-05-30 19:35:56.695550

주: autogenerate 가 모델↔DB drift 로 무관한 변경을 대량 감지했으나,
이 리비전은 의도한 변경(bulletin_extractions 묵상 필드 3개 추가)만 담는다.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4d2cb47d8b2'
down_revision: Union[str, Sequence[str], None] = '4b08e018ed60'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """묵상 추출 전용 필드 — meditations 매핑용."""
    op.add_column('bulletin_extractions', sa.Column('scripture', sa.String(length=300), nullable=True))
    op.add_column('bulletin_extractions', sa.Column('practice', sa.Text(), nullable=True))
    op.add_column('bulletin_extractions', sa.Column('pull_quote', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('bulletin_extractions', 'pull_quote')
    op.drop_column('bulletin_extractions', 'practice')
    op.drop_column('bulletin_extractions', 'scripture')
