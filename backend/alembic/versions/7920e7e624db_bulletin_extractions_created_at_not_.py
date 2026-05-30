"""bulletin_extractions.created_at NOT NULL + server_default NOW()

Revision ID: 7920e7e624db
Revises: d4d2cb47d8b2
Create Date: 2026-05-30 21:36:02.030846

ORM 의 default=datetime.utcnow 는 Python 레벨이라 ORM 으로 INSERT 할 때만 채워진다.
raw SQL INSERT·일부 마이그레이션 경로로 들어온 행은 created_at 이 NULL 이 되어,
ExtractionOut.created_at(필수 datetime) 직렬화 시 GET /extractions/pending 가 500 을 냈다.
server_default=NOW() + NOT NULL 로 DB 레벨에서 항상 채워지도록 보장한다.

autogenerate 가 모델 미등록 테이블·인덱스를 전부 drop 하려는 오탐을 내, 의도한 단일 변경만 남겨 직접 작성함.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '7920e7e624db'
down_revision: Union[str, Sequence[str], None] = 'd4d2cb47d8b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1) 기존 NULL 행 백필 (NOT NULL 적용 전 필수)
    op.execute("UPDATE bulletin_extractions SET created_at = NOW() WHERE created_at IS NULL")
    # 2) server_default 설정 + NOT NULL
    op.alter_column(
        'bulletin_extractions', 'created_at',
        existing_type=postgresql.TIMESTAMP(),
        server_default=sa.text('NOW()'),
        nullable=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column(
        'bulletin_extractions', 'created_at',
        existing_type=postgresql.TIMESTAMP(),
        server_default=None,
        nullable=True,
    )
