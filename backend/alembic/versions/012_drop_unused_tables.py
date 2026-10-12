"""012 - drop unused tables feature_status and password_reset_tokens

Revision ID: 012_drop_unused_tables
Revises: 011_add_project_deletion_fields
Create Date: 2026-10-11
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '012_drop_unused_tables'
down_revision: Union[str, None] = '011_add_project_deletion_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'feature_status' in tables:
        op.drop_table('feature_status')

    if 'password_reset_tokens' in tables:
        op.drop_table('password_reset_tokens')


def downgrade() -> None:
    pass
